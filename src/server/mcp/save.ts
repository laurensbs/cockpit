import 'server-only'
import { and, eq } from 'drizzle-orm'
import type { z } from 'zod'
import type { Db } from '@/db'
import * as s from '@/db/schema'
import { dayOf } from '@/lib/dates'
import { normalizeModel } from '@/lib/growth-model'
import { normalizePoints } from '@/lib/metrics'
import type { LANGUAGES, MARKETS, STAGES } from '@/lib/options'
import { prospectKey } from '@/lib/prospect'
import { normalizeUrl } from '@/lib/urls'
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
import { rollupMonths, upsertPoints } from '../points'
import { isIntakeDone } from '../game'
import { findSiteDetails } from '../prospect-web'
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

export interface IntakeInput {
  oneLiner?: string
  what?: string
  audience?: string
  goal?: string
  tone?: string
  northStar?: string
  redLines?: string
  siteUrl?: string
  localPath?: string
  languages?: (typeof LANGUAGES)[number][]
  markets?: (typeof MARKETS)[number][]
  stage?: (typeof STAGES)[number]
  prospectPerDay?: number
}

/**
 * Claude fills in or updates the intake from what it knows of the project (its own docs and code).
 * Only the fields it sends change; he reads and edits it under Bewerken.
 */
export async function saveIntake(db: Db, ownerId: string, project: { id: string; name: string }, input: IntakeInput): Promise<{ ok: boolean; text: string }> {
  const siteUrl = input.siteUrl === undefined ? undefined : input.siteUrl.trim() ? normalizeUrl(input.siteUrl) : null
  if (siteUrl === null && input.siteUrl?.trim()) return { ok: false, text: 'Niets opgeslagen: dat webadres klopt niet.' }
  const localPath = input.localPath === undefined ? undefined : input.localPath.trim() || null
  if (localPath && !localPath.startsWith('/') && !/^[A-Za-z]:\\/.test(localPath)) return { ok: false, text: 'Niets opgeslagen: de lokale map moet een volledig pad zijn.' }
  const changes = Object.fromEntries(
    Object.entries({
      oneLiner: input.oneLiner?.trim(),
      what: input.what?.trim(),
      audience: input.audience?.trim(),
      goal: input.goal?.trim(),
      tone: input.tone?.trim(),
      northStar: input.northStar?.trim(),
      redLines: input.redLines?.trim(),
      siteUrl,
      localPath,
      languages: input.languages?.length ? [...new Set(input.languages)] : undefined,
      markets: input.markets ? [...new Set(input.markets)] : undefined,
      stage: input.stage,
      prospectPerDay: input.prospectPerDay,
    }).filter(([, v]) => v !== undefined),
  )
  if (input.prospectPerDay) {
    const [current] = await db.select({ what: s.project.what, redLines: s.project.redLines }).from(s.project).where(eq(s.project.id, project.id))
    const text = `${(changes.what as string | undefined) ?? current?.what ?? ''} ${(changes.redLines as string | undefined) ?? current?.redLines ?? ''}`
    if (/marketing staat uit/i.test(text)) return { ok: false, text: `Niets opgeslagen: voor ${project.name} staat marketing uit, dus geen prospectie.` }
  }
  if (!Object.keys(changes).length) return { ok: false, text: 'Niets opgeslagen: er zat geen veld in.' }
  const [row] = await db
    .update(s.project)
    .set({ ...changes, updatedAt: new Date() })
    .where(and(eq(s.project.id, project.id), eq(s.project.ownerId, ownerId)))
    .returning()
  if (!row) return { ok: false, text: 'Niets opgeslagen: dat project bestaat niet.' }
  if (isIntakeDone(row)) await award(db, ownerId, { kind: 'intake', refId: row.id, projectId: row.id })
  return { ok: true, text: `Intake van ${project.name} bijgewerkt (${Object.keys(changes).join(', ')}). Hij leest en past hem aan onder Bewerken.` }
}

export interface ProspectInput {
  organization: string
  website: string
  city?: string
  what?: string
  howRequestsArrive?: string
  observation: string
  fit?: number
  why?: string
  pitch?: string
  channel?: string
}

/**
 * Businesses Claude found for a project. Each becomes a proposal (status "prospect") that waits for his
 * yes or no; one already known (same name or website, also one he said no to) is skipped. The cockpit
 * reads their public phone and address from their own site itself: Claude only hears whether it found them.
 */
export async function saveProspects(db: Db, ownerId: string, project: { id: string; name: string }, prospects: ProspectInput[]): Promise<{ ok: boolean; text: string }> {
  const known = new Set(
    (await db.select({ organization: s.contact.organization, website: s.contact.website }).from(s.contact).where(eq(s.contact.projectId, project.id))).flatMap((c) =>
      prospectKey(c.organization, c.website),
    ),
  )
  const fresh: { id: string; organization: string; website: string }[] = []
  let skipped = 0
  for (const p of prospects.slice(0, 10)) {
    const website = normalizeUrl(p.website)
    const keys = prospectKey(p.organization, website)
    if (!website || !p.organization.trim() || keys.some((k) => known.has(k))) {
      skipped++
      continue
    }
    keys.forEach((k) => known.add(k))
    const id = crypto.randomUUID()
    const note = [p.what?.trim(), p.howRequestsArrive?.trim() ? `Aanvragen nu: ${p.howRequestsArrive.trim()}` : '', p.why?.trim() ? `Waarom: ${p.why.trim()}` : '']
      .filter(Boolean)
      .join(' · ')
      .slice(0, 1000)
    await db.insert(s.contact).values({
      id,
      ownerId,
      projectId: project.id,
      organization: p.organization.trim().slice(0, 120),
      website,
      city: (p.city ?? '').trim().slice(0, 80),
      note,
      observation: p.observation.trim().slice(0, 400),
      fit: p.fit && p.fit >= 1 && p.fit <= 5 ? Math.round(p.fit) : null,
      pitch: (p.pitch ?? '').trim().slice(0, 600),
      channel: (p.channel ?? 'call').trim().slice(0, 20),
      basis: 'business',
      source: 'prospect',
      status: 'prospect',
    })
    fresh.push({ id, organization: p.organization.trim(), website })
  }
  const details = await Promise.all(fresh.map((f) => findSiteDetails(f.website).catch(() => ({ email: null, emailSource: null, phone: null }))))
  for (const [i, f] of fresh.entries()) {
    const d = details[i]
    if (d.email || d.phone) await db.update(s.contact).set({ email: d.email, emailSource: d.emailSource, phone: d.phone }).where(eq(s.contact.id, f.id))
  }
  if (!fresh.length) return { ok: false, text: `Niets nieuws opgeslagen: alle ${skipped} bedrijven stonden er al (of misten een naam of website). Zoek andere bedrijven.` }
  const list = fresh.map((f, i) => ({ id: f.id, organization: f.organization, phoneFound: Boolean(details[i].phone), addressFound: Boolean(details[i].email) }))
  return {
    ok: true,
    text: `Opgeslagen: ${fresh.length} voorstel${fresh.length === 1 ? '' : 'len'} voor ${project.name}${skipped ? ` (${skipped} stond${skipped === 1 ? '' : 'en'} er al)` : ''}. Hij beslist per bedrijf. ${JSON.stringify(list)}`,
  }
}
