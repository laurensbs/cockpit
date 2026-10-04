import 'server-only'
import { eq } from 'drizzle-orm'
import type { z } from 'zod'
import type { Db } from '@/db'
import * as s from '@/db/schema'
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
  normalizeWeekly,
  type OpportunitiesWire,
  type PlanWire,
  type PostsWire,
  type ProfileWire,
  type WeeklyWire,
} from '@/lib/ai/schemas'
import { award } from '../xp'

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
