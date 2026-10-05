import { and, desc, eq, like } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ClaudeButton } from '@/components/ClaudeButton'
import { CopyButton } from '@/components/CopyButton'
import { PlanActions } from '@/components/PlanActions'
import { ProjectHeader } from '@/components/ProjectHeader'
import { QuickWin } from '@/components/QuickWin'
import { getDb } from '@/db'
import * as s from '@/db/schema'
import { EFFORT_LABELS, linkedinFromJson, planFromJson, profileFromJson } from '@/lib/ai/schemas'
import { linkedinShareUrl } from '@/lib/share'
import { ago } from '@/lib/time'
import { loadJobContext } from '@/server/ai/context'
import { claudeBlocked } from '@/server/claude-status'
import { isIntakeDone } from '@/server/game'
import { requireOwner } from '@/server/session'

export const metadata = { title: 'Marketingplan' }

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
  const [[profileBrief], [planBrief], [linkedinBrief], blocked] = await Promise.all([latest('profile'), latest('plan'), latest('linkedin'), claudeBlocked()])
  const linkedin = linkedinBrief ? linkedinFromJson(linkedinBrief.content) : null
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
      <p className="tiny muted">Hoe je {ctx.project.name} in de markt zet: voor wie, via welke kanalen, en wat je per week doet.</p>
      {!isIntakeDone(ctx.project) ? (
        <p className="notice warn row between">
          <span>Beantwoord de vijf vragen over {ctx.project.name}: daar haalt Claude alles uit.</span>
          <Link href={`/projects/${id}/edit`} className="button secondary small">
            Vijf vragen invullen
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

      <section className="card stack-m">
        <div className="row between">
          <div className="stack-xs">
            <h2>LinkedIn</h2>
            {linkedinBrief ? <p className="tiny muted">Gemaakt {ago(linkedinBrief.createdAt, now)}</p> : null}
          </div>
          {linkedin ? <ClaudeButton task="linkedin" projectId={id} label="Opnieuw" disabledReason={blocked} variant="secondary" /> : null}
        </div>
        {linkedin ? (
          <div className="stack-l">
            <div className="stack-xs">
              <p className="eyebrow">Je kop</p>
              <p className="brain-quote">{linkedin.headline}</p>
              <CopyButton text={linkedin.headline} label="Kopieer kop" />
            </div>
            <div className="stack-xs">
              <p className="eyebrow">Over jou</p>
              <p className="prewrap small">{linkedin.about}</p>
              <CopyButton text={linkedin.about} label="Kopieer tekst" />
            </div>
            <div className="grid">
              <div className="stack-s">
                <p className="eyebrow">Uitlichten</p>
                <ul className="small stack-xs">
                  {linkedin.featured.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </div>
              <div className="stack-s">
                <p className="eyebrow">Je weekritme</p>
                <ul className="small stack-xs">
                  {linkedin.routine.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="stack-s">
              <p className="eyebrow">Met wie je moet connecten</p>
              <ul className="list">
                {linkedin.connect.map((c) => (
                  <li key={c.who} className="stack-xs">
                    <strong>{c.who}</strong>
                    <span className="small muted">{c.why}</span>
                    <span className="small prewrap">“{c.message}”</span>
                    <CopyButton text={c.message} label="Kopieer bericht" />
                  </li>
                ))}
              </ul>
            </div>
            <div className="stack-s">
              <p className="eyebrow">Posts</p>
              <div className="grid">
                {linkedin.posts.map((post, i) => {
                  const text = [post.text, post.hashtags.join(' ')].filter(Boolean).join('\n\n')
                  return (
                    <article key={i} className="card sunken stack-s">
                      <strong>{post.hook}</strong>
                      <p className="prewrap small">{post.text}</p>
                      {post.hashtags.length ? <p className="small" style={{ color: 'var(--accent-ink)' }}>{post.hashtags.join(' ')}</p> : null}
                      <div className="row">
                        <a className="button primary small" href={linkedinShareUrl(text)} target="_blank" rel="noreferrer noopener">
                          Post op LinkedIn
                        </a>
                        <CopyButton text={text} label="Kopieer" />
                      </div>
                    </article>
                  )
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="stack-m">
            <p className="muted">
              Je profielkop, een about-tekst, met wie je moet connecten (met een bericht), een weekritme en vijf posts. Jij post zelf, met één klik.
            </p>
            <ClaudeButton task="linkedin" projectId={id} label="Maak je LinkedIn-plan" disabledReason={blocked} />
          </div>
        )}
      </section>
    </div>
  )
}
