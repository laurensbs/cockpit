import 'server-only'
import { and, eq } from 'drizzle-orm'
import type { z } from 'zod'
import type { Db } from '@/db'
import * as s from '@/db/schema'
import { dayOf } from '@/lib/dates'
import { normalizeModel } from '@/lib/growth-model'
import { normalizePoints } from '@/lib/metrics'
import { isStopped } from '@/lib/options'
import {
  type ArticlesWire,
  type EmailsWire,
  type ExperimentsWire,
  type LinkedinWire,
  normalizeArticles,
  normalizeExperiments,
  normalizeLinkedin,
  type IdeasWire,
  normalizeEmails,
  normalizeIdeas,
  normalizeOpportunities,
  normalizePlan,
  normalizePosts,
  normalizeProfile,
  normalizeReview,
  normalizeWeekly,
  type OpportunitiesWire,
  type PlanWire,
  type PostsWire,
  type ProfileWire,
  type ReviewWire,
  type WeeklyWire,
} from '@/lib/ai/schemas'
import { CHANNEL_LABELS } from '@/lib/ai/playbooks'
import type { ContentItemInput } from '@/lib/ai/schemas'
import { normalizeWeek, weekBody } from '@/lib/content-week'
import { plannedLinkedinDays } from '../content'
import { rollupMonths, upsertPoints } from '../points'
import { award } from '../xp'
import { resolveProject } from './projects'

// What Claude Code hands back goes through the same normalizers as before: clamped, trimmed, safe
// to show. Every save says in one line what it stored, so Claude can tell him.

const SOURCE = 'claude-code'

async function insertDrafts(
  db: Db,
  ownerId: string,
  projectId: string,
  kind: string,
  channel: string,
  language: string,
  items: { title: string; body: Record<string, unknown>; contactId?: string | null }[],
): Promise<number> {
  if (!items.length) return 0
  await db.insert(s.contentItem).values(
    items.map((item) => ({
      id: crypto.randomUUID(),
      ownerId,
      projectId,
      kind,
      channel,
      language,
      title: item.title,
      body: item.body,
      contactId: item.contactId ?? null,
      runId: SOURCE,
    })),
  )
  await award(db, ownerId, { kind: 'generate', refId: `${kind}:${Date.now()}`, projectId })
  return items.length
}

export async function saveProfile(db: Db, ownerId: string, project: { id: string; name: string }, wire: z.infer<typeof ProfileWire>): Promise<string> {
  const profile = normalizeProfile(wire)
  const id = crypto.randomUUID()
  await db.insert(s.brief).values({ id, ownerId, projectId: project.id, kind: 'profile', content: profile, runId: SOURCE })
  await award(db, ownerId, { kind: 'generate', refId: `profile:${id}`, projectId: project.id })
  return `Opgeslagen: het marketingprofiel van ${project.name} (${profile.audiences.length} doelgroepen, ${profile.channels.length} kanalen, ${profile.quickWins.length} quick wins). Hij ziet het onder Marketingbrein.`
}

export async function savePlan(db: Db, ownerId: string, project: { id: string; name: string }, wire: z.infer<typeof PlanWire>): Promise<string> {
  const plan = normalizePlan(wire)
  const id = crypto.randomUUID()
  await db.insert(s.brief).values({ id, ownerId, projectId: project.id, kind: 'plan', content: plan, runId: SOURCE })
  await award(db, ownerId, { kind: 'plan', refId: id, projectId: project.id })
  const actions = plan.phases.reduce((n, p) => n + p.actions.length, 0)
  return `Opgeslagen: het plan voor ${project.name} (${plan.phases.length} fases, ${actions} acties). Hij kiest zelf welke acties quests worden.`
}

export async function saveEmails(
  db: Db,
  ownerId: string,
  project: { id: string; name: string },
  input: { purpose: string; language: string; contactId?: string | null },
  wire: z.infer<typeof EmailsWire>,
): Promise<string> {
  const drafts = normalizeEmails(wire)
  if (!drafts.length) return 'Niets opgeslagen: er zaten geen concepten in.'
  if (input.purpose === 'contact') {
    const [contact] = input.contactId
      ? await db
          .select()
          .from(s.contact)
          .where(eq(s.contact.id, input.contactId))
      : []
    if (!contact || contact.projectId !== project.id) return 'Niets opgeslagen: dat contact hoort niet bij dit project (zie list_contacts).'
    const [draft, ...rest] = drafts
    const followups = rest.slice(0, 2).map((f) => ({ subject: f.subject, body: f.body }))
    await insertDrafts(db, ownerId, project.id, 'email', 'contact', input.language, [
      { title: `Mail aan ${contact.organization}`, body: { subject: draft.subject, body: draft.body, ps: draft.ps, followups }, contactId: contact.id },
    ])
    if (contact.status === 'new') await db.update(s.contact).set({ status: 'drafted' }).where(eq(s.contact.id, contact.id))
    if (isStopped(contact.status)) return `Opgeslagen: een mail aan ${contact.organization}. Ze zijn al in gesprek met hem, dus hij stuurt hem zelf (Contacten → kopiëren).`
    return `Opgeslagen: een persoonlijke mail aan ${contact.organization}${followups.length ? ` met ${followups.length} opvolgmail${followups.length === 1 ? '' : 's'}` : ''}. Hij keurt hem goed in Contacten; daarna gaat hij vanzelf de deur uit.`
  }
  const n = await insertDrafts(
    db,
    ownerId,
    project.id,
    'email',
    input.purpose,
    input.language,
    drafts.map((d) => ({ title: d.title, body: { subject: d.subject, body: d.body, ps: d.ps } })),
  )
  return `Opgeslagen: ${n} mailconcept${n === 1 ? '' : 'en'} voor ${project.name}. Hij vindt ze in de Studio.`
}

export async function savePosts(db: Db, ownerId: string, project: { id: string; name: string }, input: { platform: string; language: string }, wire: z.infer<typeof PostsWire>): Promise<string> {
  const n = await insertDrafts(
    db,
    ownerId,
    project.id,
    'social',
    input.platform,
    input.language,
    normalizePosts(wire).map(({ title, ...body }) => ({ title, body })),
  )
  return n ? `Opgeslagen: ${n} post${n === 1 ? '' : 's'} voor ${input.platform} (${project.name}). Hij plant en post ze zelf vanuit de Studio.` : 'Niets opgeslagen: er zaten geen posts in.'
}

export async function saveIdeas(db: Db, ownerId: string, project: { id: string; name: string }, input: { mode: string }, wire: z.infer<typeof IdeasWire>): Promise<string> {
  const n = await insertDrafts(
    db,
    ownerId,
    project.id,
    'idea',
    input.mode,
    'nl',
    normalizeIdeas(wire).map(({ title, ...body }) => ({ title, body })),
  )
  return n ? `Opgeslagen: ${n} idee${n === 1 ? '' : 'ën'} voor ${project.name}, in het idee-lab met een impact/moeite-matrix.` : 'Niets opgeslagen: er zaten geen ideeën in.'
}

export async function saveOpportunities(db: Db, ownerId: string, project: { id: string; name: string }, input: { language: string }, wire: z.infer<typeof OpportunitiesWire>): Promise<string> {
  const items = normalizeOpportunities(wire)
  const n = await insertDrafts(
    db,
    ownerId,
    project.id,
    'opportunity',
    'web',
    input.language,
    items.map(({ name, ...body }) => ({ title: name, body })),
  )
  const dropped = items.filter((i) => !i.url).length
  return n
    ? `Opgeslagen: ${n} kans${n === 1 ? '' : 'en'} voor ${project.name}${dropped ? ` (${dropped} zonder bruikbare link)` : ''}. Hij zet er zelf contacten van.`
    : 'Niets opgeslagen: er zaten geen kansen in.'
}

export async function saveWeekly(db: Db, ownerId: string, wire: z.infer<typeof WeeklyWire>): Promise<string> {
  const weekly = normalizeWeekly(wire)
  await db.insert(s.brief).values({ id: crypto.randomUUID(), ownerId, projectId: null, kind: 'weekly', content: weekly, runId: SOURCE })
  return `Opgeslagen: de focus van deze week (“${weekly.headline}”), met ${weekly.focus.length} projecten en de boss “${weekly.boss.title}”. Hij ziet het op Vandaag.`
}

export async function saveReview(db: Db, ownerId: string, wire: z.infer<typeof ReviewWire>): Promise<string> {
  const review = normalizeReview(wire)
  if (!review.headline) return 'Niets opgeslagen: de review mist een headline.'
  await db.insert(s.brief).values({ id: crypto.randomUUID(), ownerId, projectId: null, kind: 'review', content: review, runId: SOURCE })
  return `Opgeslagen: de weekreview (“${review.headline}”), met ${review.decisions.length} besluit${review.decisions.length === 1 ? '' : 'en'}${review.targetChanges.length ? ` en ${review.targetChanges.length} voorgestelde doelwijziging${review.targetChanges.length === 1 ? '' : 'en'}` : ''}. Hij ziet hem op Vandaag en kiest zelf wat hij overneemt.`
}

export async function saveArticles(db: Db, ownerId: string, project: { id: string; name: string }, input: { language: string }, wire: z.infer<typeof ArticlesWire>): Promise<string> {
  const { keywords, articles } = normalizeArticles(wire)
  if (keywords.length) await db.insert(s.brief).values({ id: crypto.randomUUID(), ownerId, projectId: project.id, kind: 'seo', content: { keywords }, runId: SOURCE })
  const n = await insertDrafts(
    db,
    ownerId,
    project.id,
    'article',
    'seo',
    input.language,
    articles.map(({ title, ...body }) => ({ title, body })),
  )
  const full = articles.filter((a) => a.markdown).length
  return `Opgeslagen: ${keywords.length} zoekwoorden en ${n} artikel${n === 1 ? '' : 'en'} voor ${project.name}${full ? ` (${full} helemaal uitgeschreven)` : ''}. Hij vindt ze onder Marketing → Artikelen.`
}

export async function saveExperiments(db: Db, ownerId: string, project: { id: string; name: string }, wire: z.infer<typeof ExperimentsWire>): Promise<string> {
  const experiments = normalizeExperiments(wire)
  const n = await insertDrafts(
    db,
    ownerId,
    project.id,
    'experiment',
    'growth',
    'nl',
    experiments.map(({ title, ...body }) => ({ title, body: { ...body, result: '', learning: '' } })),
  )
  return n ? `Opgeslagen: ${n} groei-experiment${n === 1 ? '' : 'en'} voor ${project.name}, met de hoogste ICE-score bovenaan. Hij start ze vanaf het bord onder Marketing → Experimenten.` : 'Niets opgeslagen: er zaten geen experimenten in.'
}

export async function saveLinkedin(db: Db, ownerId: string, project: { id: string; name: string }, wire: z.infer<typeof LinkedinWire>): Promise<string> {
  const plan = normalizeLinkedin(wire)
  await db.insert(s.brief).values({ id: crypto.randomUUID(), ownerId, projectId: project.id, kind: 'linkedin', content: plan, runId: SOURCE })
  return `Opgeslagen: LinkedIn voor ${project.name}: een kop, een about-tekst, ${plan.connect.length} soorten connecties en ${plan.posts.length} posts. Hij ziet het onder Marketingbrein en post zelf, met één klik.`
}

/** A growth model from Claude: kept as a proposal; it only counts once he accepts it under Cijfers. */
export async function saveModelProposal(db: Db, ownerId: string, project: { id: string; name: string }, input: unknown): Promise<{ ok: boolean; text: string }> {
  const result = normalizeModel(input, dayOf(new Date()))
  if ('error' in result) return { ok: false, text: result.error }
  const m = result.model
  await db.insert(s.brief).values({ id: crypto.randomUUID(), ownerId, projectId: project.id, kind: 'model', content: m, runId: SOURCE })
  return {
    ok: true,
    text: `Voorstel opgeslagen voor ${project.name}: ${m.northStar.key} naar ${m.northStar.target} vóór ${m.northStar.deadline}, met de trechter ${m.funnel.map((f) => f.key).join(' → ')}. Hij neemt het over (of past het aan) onder Cijfers; pas dan telt het.`,
  }
}

/** Numbers Claude was given or read himself, with where they came from; they count as Claude's for those days. */
export async function saveClaudeMetrics(db: Db, ownerId: string, project: { id: string; name: string }, points: { key: string; value: number; day?: string; note: string }[]): Promise<{ ok: boolean; text: string }> {
  const today = dayOf(new Date())
  const { ok, rejected } = normalizePoints(
    points.map((p) => ({ key: p.key, value: p.value, day: p.day ?? today, note: p.note.trim().slice(0, 200) })),
    today,
  )
  if (!ok.length) return { ok: false, text: `Niets opgeslagen: ${rejected.map((r) => `${r.point.key} op ${r.point.day}: ${r.why}`).join('; ')}.` }
  await upsertPoints(db, ownerId, project.id, 'claude', ok)
  await rollupMonths(db, ownerId, project.id, [...new Set(ok.map((p) => p.key))])
  return {
    ok: true,
    text: `${ok.length} cijfer${ok.length === 1 ? '' : 's'} opgeslagen voor ${project.name}.${rejected.length ? ` Overgeslagen: ${rejected.map((r) => `${r.point.key} op ${r.point.day} (${r.why})`).join('; ')}.` : ''}`,
  }
}

/**
 * The content week from Claude: every item checked, stored as a draft on its day, and its slides or
 * cover drawn in the background. An item with "replaces" takes the place of the one he asked to redo.
 */
export async function saveContentWeek(db: Db, ownerId: string, items: ContentItemInput[]): Promise<{ ok: boolean; text: string }> {
  const today = dayOf(new Date())
  const { ok, skipped } = normalizeWeek(items, today, await plannedLinkedinDays(db, ownerId, today))
  const projects = new Map<string, { id: string; name: string; language: string } | { error: string }>()
  const stored: { channel: string; project: string }[] = []
  for (const piece of ok) {
    if (!projects.has(piece.project)) {
      const found = await resolveProject(db, ownerId, piece.project)
      if ('error' in found) projects.set(piece.project, found)
      else {
        const [row] = await db.select({ languages: s.project.languages }).from(s.project).where(eq(s.project.id, found.id))
        projects.set(piece.project, { ...found, language: row?.languages[0] ?? 'nl' })
      }
    }
    const project = projects.get(piece.project)!
    if ('error' in project) {
      skipped.push(`"${piece.title}": ${project.error}`)
      continue
    }
    if (piece.replaces) {
      const [old] = await db
        .select({ id: s.contentItem.id })
        .from(s.contentItem)
        .where(and(eq(s.contentItem.id, piece.replaces), eq(s.contentItem.ownerId, ownerId), eq(s.contentItem.projectId, project.id)))
      if (!old) {
        skipped.push(`"${piece.title}": there is no item ${piece.replaces} on ${project.name} to replace.`)
        continue
      }
      await db.update(s.contentItem).set({ status: 'archived' }).where(eq(s.contentItem.id, old.id))
    }
    await db.insert(s.contentItem).values({
      id: crypto.randomUUID(),
      ownerId,
      projectId: project.id,
      kind: piece.channel === 'forum' ? 'forum' : 'social',
      channel: piece.channel,
      language: piece.language ?? project.language,
      title: piece.title,
      body: piece.channel === 'forum' ? { ...weekBody(piece), render: { status: 'done' } } : weekBody(piece),
      status: 'draft',
      plannedFor: piece.day,
      runId: SOURCE,
    })
    stored.push({ channel: piece.channel, project: project.name })
  }
  if (stored.length) {
    await award(db, ownerId, { kind: 'generate', refId: `content:${today}:${stored.length}:${crypto.randomUUID().slice(0, 8)}` })
    // Draw the slides and covers now, in the background; the Studio shows them when they are ready.
    void import('../render/items').then(({ renderPending }) => renderPending(db, ownerId)).catch(() => undefined)
  }
  const perChannel = Object.entries(Object.groupBy(stored, (x) => x.channel)).map(([c, list]) => `${list?.length ?? 0} ${CHANNEL_LABELS[c as keyof typeof CHANNEL_LABELS] ?? c}`)
  const lines = [
    stored.length
      ? `Opgeslagen: ${stored.length} item${stored.length === 1 ? '' : 's'} voor de contentweek (${perChannel.join(', ')}). De cockpit tekent nu de beelden; hij keurt alles goed onder Marketing → Contentweek.`
      : 'Niets opgeslagen.',
    ...(skipped.length ? [`Niet opgeslagen (fix these and call save_content_week again with only those items):\n${skipped.map((x) => `- ${x}`).join('\n')}`] : []),
  ]
  return { ok: stored.length > 0, text: lines.join('\n') }
}

