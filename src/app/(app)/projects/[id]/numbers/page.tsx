import { and, desc, eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { DiscoveredCard } from '@/components/DiscoveredCard'
import { ClaudeButton } from '@/components/ClaudeButton'
import { ConnectorForm, ConnectorList } from '@/components/Connectors'
import { FunnelStrip } from '@/components/FunnelStrip'
import { GrowthCard } from '@/components/GrowthCard'
import { GrowthModelForm } from '@/components/GrowthModelForm'
import { Icon } from '@/components/Icon'
import { ModelProposal } from '@/components/ModelProposal'
import { PointForm } from '@/components/PointForm'
import { ProjectHeader } from '@/components/ProjectHeader'
import { getDb } from '@/db'
import * as s from '@/db/schema'
import { addDays, dayLabel, dayOf } from '@/lib/dates'
import { bucketWeeks, formatMetric, isMetricKey, lastWeeks, METRIC_DEFS, METRIC_KEYS, SOURCE_LABELS, type Source } from '@/lib/metrics'
import { ago } from '@/lib/time'
import { claudeBlocked } from '@/server/claude-status'
import { CONNECTOR_KINDS } from '@/server/connectors'
import { googleAccountEmail } from '@/server/connectors/google'
import { type LessonBody, outcomeStates } from '@/server/outcome-state'
import { dailySeries, loadPoints } from '@/server/points'
import { requireOwner } from '@/server/session'

export const metadata = { title: 'Cijfers' }

export default async function NumbersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const owner = await requireOwner(`/projects/${id}/numbers`)
  const db = await getDb()
  const [project] = await db
    .select({ id: s.project.id, name: s.project.name })
    .from(s.project)
    .where(and(eq(s.project.id, id), eq(s.project.ownerId, owner.userId)))
  if (!project) notFound()
  const now = new Date()
  const today = dayOf(now)
  const weeks = lastWeeks(addDays(today, 7), 12)
  const [states, rows, connectors, blocked, lessons, googleEmail] = await Promise.all([
    outcomeStates(db, owner.userId, now),
    loadPoints(db, owner.userId, addDays(weeks[0], -1), { projectIds: [id] }),
    db.select().from(s.connector).where(and(eq(s.connector.projectId, id), eq(s.connector.ownerId, owner.userId))),
    claudeBlocked(),
    db
      .select({ id: s.contentItem.id, title: s.contentItem.title, body: s.contentItem.body, doneAt: s.contentItem.doneAt })
      .from(s.contentItem)
      .where(and(eq(s.contentItem.projectId, id), eq(s.contentItem.ownerId, owner.userId), eq(s.contentItem.kind, 'lesson')))
      .orderBy(desc(s.contentItem.createdAt))
      .limit(20),
    googleAccountEmail(db, owner.userId),
  ])
  const state = states.get(id)
  const keys = METRIC_KEYS.filter((k) => rows.some((r) => r.key === k))
  const sourcesOf = (key: string) => [...new Set(rows.filter((r) => r.key === key).map((r) => r.source))].filter((src): src is Source => src in SOURCE_LABELS)

  return (
    <div className="stack-l">
      <ProjectHeader project={project} active="numbers" />

      {state?.proposal ? <ModelProposal briefId={state.proposal.id} model={state.proposal.model} /> : null}

      {state?.model && state.pace ? (
        <>
          <GrowthCard projectId={id} model={state.model} pace={state.pace} spark={state.spark} sources={state.sources} link={false} />
          {state.funnel ? <FunnelStrip stages={state.stages} funnel={state.funnel} /> : null}
        </>
      ) : !state?.proposal ? (
        <section className="card stack-s">
          <h2>Groeimodel</h2>
          <p className="small muted">
            Eén doelcijfer met een deadline, en de trechter ernaartoe. Daarna ziet de cockpit of {project.name} op schema ligt en waar het lekt, en kiest hij de stap die het meeste oplevert.
          </p>
          <div style={{ maxWidth: 360 }}>
            <ClaudeButton task="model" projectId={id} label="Laat Claude een groeimodel voorstellen" disabledReason={blocked} />
          </div>
        </section>
      ) : null}

      <section className="card stack-m" aria-labelledby="model-form-title">
        <details>
          <summary className="label" id="model-form-title">
            {state?.model ? 'Groeimodel aanpassen' : 'Zelf een groeimodel invullen'}
          </summary>
          <div style={{ marginTop: '0.8rem' }}>
            <GrowthModelForm projectId={id} model={state?.model ?? null} defaultDeadline={addDays(today, 90)} />
          </div>
        </details>
      </section>

      <DiscoveredCard db={db} ownerId={owner.userId} projectId={id} />

      <section className="card stack-m" aria-labelledby="sources-title">
        <h2 id="sources-title" className="row">
          <Icon name="refresh" size={20} /> Bronnen
        </h2>
        <p className="small muted">De cockpit haalt de cijfers elke dag zelf op, met sleutels die alleen kunnen lezen. Wat je zelf invult, gaat altijd voor.</p>
        <ConnectorList
          projectId={id}
          connectors={connectors.map((c) => ({
            id: c.id,
            kind: c.kind,
            label: CONNECTOR_KINDS.find((k) => k.kind === c.kind)?.label ?? c.kind,
            config: c.config,
            lastOk: c.lastOkAt ? ago(c.lastOkAt, now) : null,
            lastError: c.lastError,
          }))}
        />
        <details>
          <summary className="label">Bron koppelen</summary>
          <div style={{ marginTop: '0.8rem' }}>
            <ConnectorForm
              projectId={id}
              kinds={CONNECTOR_KINDS.map((k) => ({
                kind: k.kind,
                label: k.label,
                delivers: k.delivers.map((d) => METRIC_DEFS[d].label),
                fields: k.fields,
                secret: k.secret,
                needs: k.shared && !k.shared.fallback && !googleEmail ? k.shared.missing : null,
              }))}
            />
          </div>
        </details>
      </section>

      {lessons.length ? (
        <section className="card stack-s" aria-labelledby="lessons-title">
          <h2 id="lessons-title" className="row">
            <Icon name="idea" size={20} /> Lessen
          </h2>
          <p className="tiny muted">Wat de experimenten en de weekreviews opleverden. Claude leest dit bij elke klus voor {project.name}.</p>
          <ul className="list" style={{ margin: 0 }}>
            {lessons.map((l) => {
              const b = l.body as LessonBody
              return (
                <li key={l.id} className="stack-xs">
                  <span className="row">
                    <strong>{l.title}</strong>
                    {b.source === 'review' ? <span className="chip">Weekreview</span> : <span className={`chip ${b.result === 'won' ? 'good' : 'bad'}`}>{b.result === 'won' ? 'Werkte' : 'Werkte niet'}</span>}
                    {b.metricKey && isMetricKey(b.metricKey) && b.actual != null ? (
                      <span className="tiny muted num">
                        {METRIC_DEFS[b.metricKey].label}: {b.baseline == null ? '–' : formatMetric(b.metricKey, b.baseline)} → {formatMetric(b.metricKey, b.actual)}
                      </span>
                    ) : null}
                  </span>
                  {b.learning ? <span className="small">{b.learning}</span> : null}
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      <section className="card stack-m" aria-labelledby="weeks-title">
        <h2 id="weeks-title">Per week</h2>
        {keys.length ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Cijfer</th>
                  {weeks.map((w) => (
                    <th key={w} scope="col">
                      {dayLabel(w).slice(3)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {keys.map((key) => {
                  const values = bucketWeeks(dailySeries(rows, id, key), METRIC_DEFS[key], weeks)
                  return (
                    <tr key={key}>
                      <th scope="row">
                        <span className="stack-xs">
                          <span>{METRIC_DEFS[key].label}</span>
                          <span className="row tiny">
                            {sourcesOf(key).map((src) => (
                              <span key={src} className="chip">
                                {SOURCE_LABELS[src]}
                              </span>
                            ))}
                          </span>
                        </span>
                      </th>
                      {values.map((v, i) => (
                        <td key={weeks[i]} className="num">
                          {v == null ? <span className="faint">–</span> : formatMetric(key, Math.round(v * 100) / 100)}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="tiny muted">Stromen (bezoekers, leads, omzet) zijn weektotalen; standen (MRR, klanten, leden) de waarde aan het eind van de week. De laatste kolom is deze week, tot nu toe.</p>
          </div>
        ) : (
          <p className="muted small">Nog geen cijfers. Koppel een bron hierboven of vul er een in.</p>
        )}
        <details>
          <summary className="label">Zelf een cijfer invullen</summary>
          <div style={{ marginTop: '0.8rem' }}>
            <PointForm projectId={id} today={today} defaultKey={state?.model?.northStar.key ?? 'leads'} />
          </div>
        </details>
      </section>
    </div>
  )
}
