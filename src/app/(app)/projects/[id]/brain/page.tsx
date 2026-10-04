import { and, desc, eq, like } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ClaudeButton } from '@/components/ClaudeButton'
import { PlanActions } from '@/components/PlanActions'
import { ProjectHeader } from '@/components/ProjectHeader'
import { QuickWin } from '@/components/QuickWin'
import { getDb } from '@/db'
import * as s from '@/db/schema'
import { EFFORT_LABELS, planFromJson, profileFromJson } from '@/lib/ai/schemas'
import { ago } from '@/lib/time'
import { loadJobContext } from '@/server/ai/context'
import { claudeBlocked } from '@/server/claude-status'
import { isIntakeDone } from '@/server/game'
import { requireOwner } from '@/server/session'

export const metadata = { title: 'Marketingbrein' }

export default async function BrainPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const owner = await requireOwner(`/projects/${id}/brain`)
  const db = await getDb()
  const ctx = await loadJobContext(db, owner.userId, id)
  if (!ctx) notFound()
  const latest = (kind: string) =>
    db
      .select()
      .from(s.brief)
      .where(and(eq(s.brief.projectId, id), eq(s.brief.kind, kind)))
      .orderBy(desc(s.brief.createdAt))
      .limit(1)
  const [[profileBrief], [planBrief], blocked] = await Promise.all([latest('profile'), latest('plan'), claudeBlocked()])
  const profile = profileBrief ? profileFromJson(profileBrief.content) : null
  const plan = planBrief ? planFromJson(planBrief.content) : null
  const keys = async (prefix: string) =>
    (
      await db
        .select({ key: s.quest.sourceKey })
        .from(s.quest)
        .where(and(eq(s.quest.ownerId, owner.userId), like(s.quest.sourceKey, `${prefix}%`)))
    ).map((r) => r.key!.slice(prefix.length))
  const acceptedActions = planBrief ? await keys(`plan:${planBrief.id}:`) : []
  const acceptedWins = profileBrief ? await keys(`win:${profileBrief.id}:`) : []
  const now = new Date()

  return (
    <div className="stack-l">
      <ProjectHeader project={ctx.project} active="brain" />
      <p className="tiny muted">
        Een knop opent Claude Code op je eigen account. Claude leest dit project via de cockpit, denkt na, en zet het resultaat hier terug. Je kunt
        in dat venster meepraten.
      </p>
      {!isIntakeDone(ctx.project) ? (
        <p className="notice warn row between">
          <span>De intake is nog niet af. Hoe meer Claude weet, hoe beter het wordt.</span>
          <Link href={`/projects/${id}/edit`} className="button secondary small">
            Intake invullen
          </Link>
        </p>
      ) : null}

      <section className="card stack-m">
        <div className="row between">
          <div className="stack-xs">
            <h2>Marketingprofiel</h2>
            {profileBrief ? <p className="tiny muted">Gemaakt {ago(profileBrief.createdAt, now)}</p> : null}
          </div>
          {profile ? <ClaudeButton task="profile" projectId={id} label="Opnieuw" disabledReason={blocked} variant="secondary" /> : null}
        </div>
        {profile ? (
          <div className="stack-l">
            <p className="brain-quote">{profile.oneLiner}</p>
            <p className="prewrap">{profile.positioning}</p>
            <div className="stack-s">
              <p className="eyebrow">Doelgroepen en waar ze zitten</p>
              <div className="grid">
                {profile.audiences.map((a) => (
                  <div key={a.name} className="card sunken stack-xs">
                    <strong>{a.name}</strong>
                    <p className="small">{a.pains}</p>
                    <p className="small muted">
                      <strong>Vind ze:</strong> {a.whereToFind}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div className="stack-s">
              <p className="eyebrow">Kanalen, beste eerst</p>
              <ol className="channels">
                {profile.channels.map((c) => (
                  <li key={c.name} className="stack-xs">
                    <div className="row">
                      <strong>{c.name}</strong>
                      <span className="chip">{EFFORT_LABELS[c.effort]}</span>
                    </div>
                    <p className="small">{c.why}</p>
                    <p className="small">
                      <strong>Eerste stap:</strong> {c.firstStep}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
            <div className="grid">
              <div className="stack-s">
                <p className="eyebrow">Beloftes</p>
                <ul className="small stack-xs">
                  {profile.valueProps.map((v) => (
                    <li key={v}>{v}</li>
                  ))}
                </ul>
              </div>
              <div className="stack-s">
                <p className="eyebrow">Contentpijlers</p>
                <div className="row">
                  {profile.pillars.map((p) => (
                    <span key={p} className="chip accent">
                      {p}
                    </span>
                  ))}
                </div>
                <p className="eyebrow">Toon</p>
                <p className="small">{profile.tone}</p>
              </div>
            </div>
            <div className="grid">
              <div className="stack-s">
                <p className="eyebrow">Meten</p>
                <ul className="list small">
                  {profile.kpis.map((k) => (
                    <li key={k.name} className="row between">
                      <span>{k.name}</span>
                      <span className="muted">{k.target}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="stack-s">
                <p className="eyebrow">Risico’s</p>
                <ul className="small stack-xs">
                  {profile.risks.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            </div>
            {profile.quickWins.length && profileBrief ? (
              <div className="stack-s">
                <p className="eyebrow">Quick wins voor deze week</p>
                <ul className="list">
                  {profile.quickWins.map((w, i) => (
                    <QuickWin key={i} briefId={profileBrief.id} index={i} text={w} accepted={acceptedWins.includes(String(i))} />
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="stack-m">
            <p className="muted">
              Claude leest je intake{ctx.input.repos.length ? `, ${ctx.input.repos.length === 1 ? 'je repo' : `je ${ctx.input.repos.length} repo’s`}` : ''} en je cijfers, en maakt een profiel: voor wie,
              waar ze zitten, welke kanalen eerst, en wat je deze week al kunt doen.
            </p>
            <ClaudeButton task="profile" projectId={id} label="Maak het profiel" disabledReason={blocked} />
          </div>
        )}
      </section>

      <section className="card stack-m">
        <div className="row between">
          <div className="stack-xs">
            <h2>Plan voor 90 dagen</h2>
            {planBrief ? <p className="tiny muted">Gemaakt {ago(planBrief.createdAt, now)}</p> : null}
          </div>
          {plan ? <ClaudeButton task="plan" projectId={id} label="Opnieuw" disabledReason={blocked} variant="secondary" /> : null}
        </div>
        {plan && planBrief ? (
          <>
            <p className="prewrap">{plan.summary}</p>
            <PlanActions briefId={planBrief.id} plan={plan} accepted={acceptedActions} />
          </>
        ) : profile ? (
          <div className="stack-m">
            <p className="muted">Drie fases van 30 dagen, met acties per week. De acties die je kiest, worden quests.</p>
            <ClaudeButton task="plan" projectId={id} label="Maak het plan" disabledReason={blocked} />
          </div>
        ) : (
          <p className="muted small">Eerst het profiel; het plan bouwt daarop voort.</p>
        )}
      </section>
    </div>
  )
}
