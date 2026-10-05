import { and, asc, eq, gte, inArray } from 'drizzle-orm'
import Link from 'next/link'
import { ClaudeButton } from '@/components/ClaudeButton'
import { PostStatsForm, PullStatsButton } from '@/components/ContentResults'
import { ApproveWeekButton, BrandRhythmForm, WeekItemCard, type WeekItemView } from '@/components/ContentWeek'
import { Icon } from '@/components/Icon'
import { MediaLibrary, type MediaView } from '@/components/MediaLibrary'
import { RefreshWhileDrawing } from '@/components/RefreshWhileDrawing'
import { getDb } from '@/db'
import * as s from '@/db/schema'
import { CHANNEL_LABELS, CONTENT_CHANNELS, FORMAT_LABELS, isContentChannel } from '@/lib/ai/playbooks'
import { normalizeBrand } from '@/lib/brand'
import type { WeekBody } from '@/lib/content-week'
import { addDays, dayLabel, dayOf } from '@/lib/dates'
import { ACTIVE_STAGES } from '@/lib/options'
import { hasStats, MIN_POSTS, normalizeStats, RESULT_DAYS, statsLine, summarize } from '@/lib/post-stats'
import { claudeBlocked } from '@/server/claude-status'
import { rhythms, rhythmTotal } from '@/server/content'
import { followerLines, publishedPosts } from '@/server/content-results'
import { channelReady } from '@/server/publish/accounts'
import { requireOwner } from '@/server/session'
import { getSetting } from '@/server/settings'

export const metadata = { title: 'Contentweek' }

const DAYS = 14

export default async function ContentPage() {
  const owner = await requireOwner('/content')
  const db = await getDb()
  const today = dayOf(new Date())
  const projects = (
    await db
      .select({ id: s.project.id, name: s.project.name, stage: s.project.stage, brand: s.project.brand, color: s.company.color })
      .from(s.project)
      .leftJoin(s.company, eq(s.company.id, s.project.companyId))
      .where(eq(s.project.ownerId, owner.userId))
      .orderBy(asc(s.project.sortOrder), asc(s.project.name))
  ).filter((p) => (ACTIVE_STAGES as readonly string[]).includes(p.stage))
  const [rhythm, rows, blocked, autopilot] = await Promise.all([
    rhythms(db, owner.userId, projects),
    db
      .select({ item: s.contentItem, project: s.project.name })
      .from(s.contentItem)
      .leftJoin(s.project, eq(s.project.id, s.contentItem.projectId))
      .where(and(eq(s.contentItem.ownerId, owner.userId), inArray(s.contentItem.kind, ['social', 'forum']), inArray(s.contentItem.status, ['draft', 'approved', 'done']), gte(s.contentItem.plannedFor, today)))
      .orderBy(asc(s.contentItem.plannedFor)),
    claudeBlocked(),
    getSetting(db, owner.userId, 'autopilot_content'),
  ])
  const week = rows.filter((r) => (r.item.body as WeekBody).week && (r.item.plannedFor ?? '') <= addDays(today, DAYS - 1))
  const media = week.length
    ? await db
        .select({ id: s.mediaAsset.id, itemId: s.mediaAsset.contentItemId, role: s.mediaAsset.role, position: s.mediaAsset.position, createdAt: s.mediaAsset.createdAt })
        .from(s.mediaAsset)
        .where(and(eq(s.mediaAsset.ownerId, owner.userId), inArray(s.mediaAsset.contentItemId, week.map((r) => r.item.id))))
        .orderBy(asc(s.mediaAsset.position))
    : []
  const jobs = week.length
    ? await db
        .select({ id: s.publishJob.id, itemId: s.publishJob.contentItemId, status: s.publishJob.status, publishAt: s.publishJob.publishAt, permalink: s.publishJob.permalink, error: s.publishJob.error, stats: s.publishJob.stats, createdAt: s.publishJob.createdAt })
        .from(s.publishJob)
        .where(and(eq(s.publishJob.ownerId, owner.userId), inArray(s.publishJob.contentItemId, week.map((r) => r.item.id))))
        .orderBy(asc(s.publishJob.createdAt))
    : []
  const ready = new Map<string, boolean>()
  for (const { item } of week) {
    const key = `${item.channel}:${item.channel === 'linkedin' ? '' : item.projectId}`
    if (!ready.has(key)) ready.set(key, await channelReady(db, owner.userId, item.channel, item.projectId))
  }
  const timeLabel = (d: Date) => `${dayLabel(dayOf(d))} ${new Intl.DateTimeFormat('nl-NL', { timeZone: 'Europe/Amsterdam', hour: '2-digit', minute: '2-digit' }).format(d)}`
  const items: WeekItemView[] = week.map(({ item, project }) => {
    const body = item.body as WeekBody
    const own = media.filter((m) => m.itemId === item.id)
    const channel = isContentChannel(item.channel) ? item.channel : 'instagram'
    return {
      id: item.id,
      project: project ?? '',
      channel,
      channelLabel: CHANNEL_LABELS[channel],
      format: body.contentFormat,
      formatLabel: FORMAT_LABELS[body.contentFormat] ?? body.format,
      day: item.plannedFor ?? today,
      time: body.time ?? '',
      status: item.status,
      title: item.title,
      hook: body.hook ?? '',
      caption: body.caption ?? '',
      hashtags: body.hashtags ?? [],
      slides: body.slides ?? [],
      reel: body.reel ?? null,
      forum: body.forum ?? null,
      goal: body.goal ?? null,
      why: body.why ?? '',
      render: body.render?.status ?? null,
      renderError: body.render?.error ?? null,
      images: own.filter((m) => m.role === 'slide' || m.role === 'cover').map((m) => ({ id: m.id, url: `/api/media/${m.id}` })),
      pdf: own.find((m) => m.role === 'pdf') ? `/api/media/${own.find((m) => m.role === 'pdf')!.id}` : null,
      video: (() => {
        const v = own.find((m) => m.role === 'final') ?? own.find((m) => m.role === 'video')
        return v ? { url: `/api/media/${v.id}`, own: v.role === 'final' } : null
      })(),
      videoState: body.render?.video ?? null,
      capcut: body.capcut?.dir ?? null,
      connected: ready.get(`${item.channel}:${item.channel === 'linkedin' ? '' : item.projectId}`) ?? false,
      publish: (() => {
        const job = jobs.filter((j) => j.itemId === item.id).at(-1)
        return job ? { jobId: job.id, status: job.status, at: timeLabel(job.publishAt), permalink: job.permalink, note: job.error, stats: statsLine(normalizeStats(job.stats)) || null } : null
      })(),
    }
  })
  const uploads: MediaView[] = (
    await db
      .select({ id: s.mediaAsset.id, projectId: s.mediaAsset.projectId, role: s.mediaAsset.role, description: s.mediaAsset.description, durationMs: s.mediaAsset.durationMs, width: s.mediaAsset.width, height: s.mediaAsset.height })
      .from(s.mediaAsset)
      .where(and(eq(s.mediaAsset.ownerId, owner.userId), eq(s.mediaAsset.origin, 'upload'), inArray(s.mediaAsset.role, ['clip', 'photo'])))
      .orderBy(asc(s.mediaAsset.createdAt))
  ).map((m) => ({
    id: m.id,
    projectId: m.projectId ?? '',
    kind: m.role === 'clip' ? 'clip' : 'photo',
    description: m.description,
    seconds: m.durationMs ? Math.round(m.durationMs / 100) / 10 : null,
    portrait: m.width && m.height ? m.height > m.width : null,
  }))
  const posts = await publishedPosts(db, owner.userId)
  const results = summarize(posts)
  const projectName = (id: string | null) => projects.find((p) => p.id === id)?.name ?? ''
  const followers = (await Promise.all(projects.map(async (p) => ({ name: p.name, lines: await followerLines(db, owner.userId, p.id) })))).filter((f) => f.lines.length)
  // LinkedIn gives no numbers, and a TikTok draft only has them once he posted it and the cockpit knows which.
  const toFill = posts.filter((p) => !hasStats(p.stats) && (p.channel === 'linkedin' || (p.channel === 'tiktok' && !p.permalink)))
  const nl = (n: number) => Math.round(n).toLocaleString('nl-NL')
  const pct = (n: number) => `${(Math.round(n * 1000) / 10).toLocaleString('nl-NL')}%`
  const days = [...new Set(items.map((i) => i.day))].sort()
  const readyCount = items.filter((i) => i.status === 'draft' && i.render === 'done' && !i.forum).length
  const drawing = items.some((i) => i.render === 'pending')
  const perChannel = CONTENT_CHANNELS.map((c) => ({ c, n: items.filter((i) => i.channel === c && i.status !== 'done').length })).filter((x) => x.n)

  return (
    <div className="stack-l">
      <header className="stack-s">
        <h1>Contentweek</h1>
        <p className="lede">
          Wat Claude voor al je projecten maakte: posts, carrousels, video&apos;s en forumantwoorden, in je eigen huisstijl. Jij keurt goed; er gaat niets online zonder jou.
        </p>
      </header>

      <section className="card stack-m">
        <div className="row between">
          <div className="stack-xs">
            <p>
              <strong>{items.length ? `${items.length} items voor de komende twee weken` : 'Nog geen contentweek'}</strong>
            </p>
            <p className="tiny muted">
              {perChannel.length ? perChannel.map((x) => `${x.n} ${CHANNEL_LABELS[x.c]}`).join(' · ') : 'Claude maakt hem op basis van je profielen, je cijfers en het ritme per project hieronder.'}
            </p>
          </div>
          <span className={`chip ${autopilot === '1' ? 'good' : ''}`}>{autopilot === '1' ? 'Elke maandag automatisch' : 'Op knopdruk'}</span>
        </div>
        <div className="row" style={{ alignItems: 'start' }}>
          <div style={{ maxWidth: 380 }}>
            <ClaudeButton task="content" projectId={null} label={items.length ? 'Maak de volgende contentweek' : 'Maak de contentweek'} disabledReason={blocked} />
          </div>
          <ApproveWeekButton count={readyCount} />
        </div>
        {drawing ? <p className="tiny muted">De cockpit tekent nog beelden; ze verschijnen vanzelf.</p> : null}
        <RefreshWhileDrawing drawing={drawing} />
        <p className="tiny muted">
          Wat je goedkeurt, plaatst de cockpit op de dag en tijd van de post, op de kanalen die je koppelde (<Link href="/settings#channels">Instellingen → Kanalen</Link>). De rest plaats je zelf: kopieer de tekst, download de beelden en druk op <strong>Geplaatst</strong>.{' '}
          {autopilot === '1' ? (
            'Claude maakt elke maandagochtend vanzelf de volgende week.'
          ) : (
            <>
              Automatisch elke maandag? <Link href="/settings#claude">Zet het aan in Instellingen</Link>.
            </>
          )}
        </p>
      </section>

      {days.map((day) => (
        <section key={day} className="stack-s" aria-labelledby={`day-${day}`}>
          <h2 id={`day-${day}`} className="row">
            <Icon name="calendar" size={20} /> {day === today ? 'Vandaag' : dayLabel(day)}
          </h2>
          <div className="week-grid">
            {items
              .filter((i) => i.day === day)
              .sort((a, b) => a.time.localeCompare(b.time))
              .map((i) => (
                <WeekItemCard key={i.id} item={i} />
              ))}
          </div>
        </section>
      ))}

      <section className="card stack-m" aria-labelledby="results-title">
        <h2 id="results-title" className="row">
          <Icon name="chart" size={20} /> Wat werkt
        </h2>
        <p className="small muted">
          Wat je posts van de laatste {RESULT_DAYS} dagen deden. Instagram en TikTok haalt de cockpit elke dag zelf op; LinkedIn geeft ze niet vrij, die vul je hieronder in. Claude krijgt dit bij elke contentweek mee: meer van wat werkt, minder van wat niet werkt.
        </p>
        <PullStatsButton />
        {results.length ? (
          results.map((r) => (
            <div key={r.channel} className="stack-s">
              <h3>
                {CHANNEL_LABELS[r.channel as keyof typeof CHANNEL_LABELS] ?? r.channel} · {r.posts} {r.posts === 1 ? 'post' : 'posts'} · middenwaarde {nl(r.medianReach)} bereikt · {pct(r.engagement)} interactie
              </h3>
              {r.early ? <p className="tiny muted">Nog minder dan {MIN_POSTS} gemeten posts: te vroeg voor conclusies, blijf variëren.</p> : null}
              <div style={{ overflowX: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Vorm</th>
                      <th scope="col">Posts</th>
                      <th scope="col">Bereik</th>
                      <th scope="col">Interactie</th>
                      <th scope="col">Bewaard/gedeeld</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.formats.map((f) => (
                      <tr key={f.format}>
                        <th scope="row">{FORMAT_LABELS[f.format as keyof typeof FORMAT_LABELS] ?? f.format}</th>
                        <td className="num">{f.posts}</td>
                        <td className="num">{nl(f.medianReach)}</td>
                        <td className="num">{pct(f.engagement)}</td>
                        <td className="num">{pct(f.keep)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ol className="stack-xs result-list">
                {r.best.map((p) => (
                  <li key={p.id} className="small">
                    <strong>{p.hook}</strong>{' '}
                    <span className="muted">
                      ({projectName(p.projectId)}, {dayLabel(p.day)})
                    </span>
                    <br />
                    <span className="tiny">{statsLine(p.stats)}</span>
                    {p.permalink ? (
                      <>
                        {' '}
                        <a className="tiny" href={p.permalink} target="_blank" rel="noreferrer">
                          Bekijk
                        </a>
                      </>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          ))
        ) : (
          <p className="small muted">Nog geen gemeten posts. Na de eerste posts verschijnen hier per kanaal de vormen en posts die het best werken.</p>
        )}
        {followers.length ? (
          <p className="small">
            <strong>Volgers:</strong>{' '}
            {followers
              .map((f) => `${f.name}: ${f.lines.map((l) => `${CHANNEL_LABELS[l.channel as keyof typeof CHANNEL_LABELS] ?? l.channel} ${nl(l.now)}${l.change30 != null ? ` (${l.change30 >= 0 ? '+' : ''}${nl(l.change30)} in 30 dagen)` : ''}`).join(', ')}`)
              .join(' · ')}
          </p>
        ) : null}
        {toFill.length ? (
          <div className="stack-s">
            <h3>Nog in te vullen</h3>
            {toFill.map((p) => (
              <details key={p.id} className="result-fill">
                <summary className="small">
                  {CHANNEL_LABELS[p.channel as keyof typeof CHANNEL_LABELS] ?? p.channel} · {projectName(p.projectId)} · {dayLabel(p.day)}: {p.hook}
                </summary>
                <PostStatsForm itemId={p.id} channel={p.channel} stats={p.stats} link={p.permalink} />
              </details>
            ))}
          </div>
        ) : null}
        {posts.length ? (
          <details>
            <summary className="small">Alle posts ({posts.length})</summary>
            <ul className="stack-s result-list" style={{ marginTop: '0.6rem' }}>
              {posts.map((p) => (
                <li key={p.id} className="stack-xs">
                  <span className="small">
                    <strong>{p.hook}</strong>{' '}
                    <span className="muted">
                      ({CHANNEL_LABELS[p.channel as keyof typeof CHANNEL_LABELS] ?? p.channel}, {projectName(p.projectId)}, {dayLabel(p.day)})
                    </span>
                  </span>
                  <span className="tiny">{hasStats(p.stats) ? statsLine(p.stats) : 'Nog geen cijfers'}</span>
                  <details>
                    <summary className="tiny">Cijfers aanpassen</summary>
                    <PostStatsForm itemId={p.id} channel={p.channel} stats={p.stats} link={p.permalink} />
                  </details>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <section className="card stack-m" aria-labelledby="media-title">
        <h2 id="media-title" className="row">
          <Icon name="studio" size={20} /> Je media
        </h2>
        <p className="small muted">
          Clips en foto’s van je projecten: jij met de hond in het park, je schermopname, de echte plek. Zeg in een paar woorden wat er te zien is; Claude kiest ze voor reels en de cockpit maakt er de video van.
        </p>
        <MediaLibrary projects={projects.map((p) => ({ id: p.id, name: p.name }))} media={uploads} />
      </section>

      <section className="card stack-m" aria-labelledby="brand-title">
        <h2 id="brand-title" className="row">
          <Icon name="edit" size={20} /> Huisstijl en ritme
        </h2>
        <p className="small muted">Per project de kleuren, letters en handle op de beelden, en hoeveel posts per kanaal per week. Een project met alles op 0 slaat Claude over.</p>
        {projects.map((p) => {
          const r = rhythm.get(p.id)!
          return (
            <details key={p.id}>
              <summary className="row">
                <strong>{p.name}</strong>
                <span className="tiny muted">{rhythmTotal(r) ? CONTENT_CHANNELS.filter((c) => r[c]).map((c) => `${r[c]}× ${CHANNEL_LABELS[c]}`).join(' · ') : 'geen posts'}</span>
              </summary>
              <div style={{ marginTop: '0.8rem' }}>
                <BrandRhythmForm projectId={p.id} name={p.name} brand={normalizeBrand(p.brand, p.color)} rhythm={r} />
              </div>
            </details>
          )
        })}
      </section>
    </div>
  )
}
