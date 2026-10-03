import 'server-only'
import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import type { Db } from '@/db'
import * as s from '@/db/schema'
import { emailsFixture, ideasFixture, opportunitiesFixture, planFixture, postsFixture, profileFixture, weeklyFixture } from '@/lib/ai/fixtures'
import {
  contactEmailTask,
  EMAIL_PURPOSES,
  emailsTask,
  IDEA_MODES,
  ideasTask,
  opportunitiesTask,
  planTask,
  PLATFORMS,
  postsTask,
  profileTask,
  weeklyTask,
} from '@/lib/ai/prompts'
import {
  EmailsWire,
  IdeasWire,
  normalizeEmails,
  normalizeIdeas,
  normalizeOpportunities,
  normalizePlan,
  normalizePosts,
  normalizeProfile,
  OpportunitiesWire,
  PlanWire,
  PostsWire,
  ProfileWire,
  normalizeWeekly,
  WeeklyWire,
} from '@/lib/ai/schemas'
import { dayOf } from '@/lib/dates'
import { LANGUAGES } from '@/lib/options'
import { award } from '../xp'
import type { JobContext } from './context'

/** Extra facts a job needs from the database before it builds its task (earlier titles, a contact). */
export interface JobExtras {
  pastTitles: string[]
  contact: (typeof s.contact.$inferSelect) | null
}

export interface Job<W extends z.ZodType = z.ZodType, O extends z.ZodType = z.ZodType> {
  label: string
  /** One project, or the whole portfolio. */
  scope?: 'project' | 'portfolio'
  wire: W
  options: O
  effort: 'low' | 'medium' | 'high'
  maxTokens: number
  /** What usually comes back, for the estimate on the button (the budget reserves the worst case). */
  typicalOutput: number
  /** Web search: its results add input, which the budget reserves as well. */
  webSearch?: { maxUses: number; extraInputTokens: number }
  task: (ctx: JobContext, options: z.infer<O>, extras: JobExtras) => string
  fixture: (ctx: JobContext) => z.infer<W>
  /** Earlier titles to avoid repeating, or the contact to write to. */
  extras?: (db: Db, ctx: JobContext, options: z.infer<O>) => Promise<Partial<JobExtras>>
  save: (db: Db, run: { id: string; ownerId: string; projectId: string | null }, ctx: JobContext, wire: z.infer<W>, options: z.infer<O>, extras: JobExtras) => Promise<void>
}

const none = z.object({})

/** The project of a project job (a portfolio job never comes here). */
function P(ctx: JobContext) {
  if (!ctx.project) throw new Error('This job needs a project')
  return ctx.project
}
const language = z.enum(LANGUAGES)

async function insertDrafts(
  db: Db,
  run: { id: string; ownerId: string },
  projectId: string,
  kind: string,
  channel: string,
  lang: string,
  items: { title: string; body: Record<string, unknown>; contactId?: string | null }[],
) {
  if (!items.length) return
  await db.insert(s.contentItem).values(
    items.map((item) => ({
      id: crypto.randomUUID(),
      ownerId: run.ownerId,
      projectId,
      kind,
      channel,
      language: lang,
      title: item.title,
      body: item.body,
      contactId: item.contactId ?? null,
      runId: run.id,
    })),
  )
}

async function pastTitles(db: Db, projectId: string, kind: string): Promise<string[]> {
  const rows = await db
    .select({ title: s.contentItem.title })
    .from(s.contentItem)
    .where(and(eq(s.contentItem.projectId, projectId), eq(s.contentItem.kind, kind)))
    .orderBy(desc(s.contentItem.createdAt))
    .limit(30)
  return rows.map((r) => r.title)
}

const profile: Job<typeof ProfileWire, typeof none> = {
  label: 'Marketingprofiel',
  wire: ProfileWire,
  options: none,
  effort: 'medium',
  maxTokens: 12_000,
  typicalOutput: 4_000,
  task: (ctx) => profileTask(P(ctx).name),
  fixture: (ctx) => profileFixture(P(ctx).name),
  async save(db, run, ctx, wire) {
    await db.insert(s.brief).values({ id: crypto.randomUUID(), ownerId: run.ownerId, projectId: P(ctx).id, kind: 'profile', content: normalizeProfile(wire), runId: run.id })
  },
}

const plan: Job<typeof PlanWire, typeof none> = {
  label: 'Plan voor 90 dagen',
  wire: PlanWire,
  options: none,
  effort: 'medium',
  maxTokens: 14_000,
  typicalOutput: 5_000,
  task: (ctx) => planTask(P(ctx).name, ctx.profile),
  fixture: () => planFixture(),
  async save(db, run, ctx, wire) {
    const id = crypto.randomUUID()
    await db.insert(s.brief).values({ id, ownerId: run.ownerId, projectId: P(ctx).id, kind: 'plan', content: normalizePlan(wire), runId: run.id })
    await award(db, run.ownerId, { kind: 'plan', refId: id, projectId: P(ctx).id })
  },
}

const emailsOptions = z.object({ purpose: z.enum(Object.keys(EMAIL_PURPOSES) as [keyof typeof EMAIL_PURPOSES]), language, note: z.string().trim().max(300).default('') })
const emails: Job<typeof EmailsWire, typeof emailsOptions> = {
  label: 'Mails',
  wire: EmailsWire,
  options: emailsOptions,
  effort: 'low',
  maxTokens: 6_000,
  typicalOutput: 2_000,
  task: (_ctx, o) => emailsTask(o.purpose, o.language, o.note),
  fixture: () => emailsFixture(),
  async save(db, run, ctx, wire, o) {
    const drafts = normalizeEmails(wire)
    await insertDrafts(db, run, P(ctx).id, 'email', o.purpose, o.language, drafts.map((d) => ({ title: d.title, body: { subject: d.subject, body: d.body, ps: d.ps } })))
  },
}

const contactOptions = z.object({ contactId: z.string().min(1).max(64), language })
const contactEmail: Job<typeof EmailsWire, typeof contactOptions> = {
  label: 'Persoonlijke mail',
  wire: EmailsWire,
  options: contactOptions,
  effort: 'low',
  maxTokens: 3_000,
  typicalOutput: 900,
  async extras(db, ctx, o) {
    const [contact] = await db
      .select()
      .from(s.contact)
      .where(and(eq(s.contact.id, o.contactId), eq(s.contact.projectId, P(ctx).id)))
    return { contact: contact ?? null }
  },
  task: (_ctx, o, extras) =>
    contactEmailTask(
      {
        organization: extras.contact?.organization ?? '',
        name: extras.contact?.name ?? '',
        website: extras.contact?.website ?? null,
        note: extras.contact?.note ?? '',
        basis:
          extras.contact?.basis === 'consent'
            ? 'they agreed to be contacted'
            : extras.contact?.basis === 'relation'
              ? 'there is an existing relationship'
              : 'a business address of an organisation, with a clear reason to write (legitimate interest)',
      },
      o.language,
    ),
  fixture: () => ({ drafts: emailsFixture().drafts.slice(0, 1) }),
  async save(db, run, ctx, wire, o, extras) {
    const contact = extras.contact
    if (!contact) return
    const [draft] = normalizeEmails(wire)
    if (!draft) return
    await insertDrafts(db, run, P(ctx).id, 'email', 'contact', o.language, [
      { title: `Mail aan ${contact.organization}`, body: { subject: draft.subject, body: draft.body, ps: draft.ps }, contactId: contact.id },
    ])
    if (contact.status === 'new') await db.update(s.contact).set({ status: 'drafted' }).where(eq(s.contact.id, contact.id))
  },
}

const postsOptions = z.object({ platform: z.enum(Object.keys(PLATFORMS) as [keyof typeof PLATFORMS]), language })
const posts: Job<typeof PostsWire, typeof postsOptions> = {
  label: 'Posts',
  wire: PostsWire,
  options: postsOptions,
  effort: 'low',
  maxTokens: 8_000,
  typicalOutput: 2_500,
  extras: async (db, ctx) => ({ pastTitles: await pastTitles(db, P(ctx).id, 'social') }),
  task: (_ctx, o, extras) => postsTask(o.platform, o.language, extras.pastTitles),
  fixture: () => postsFixture(),
  async save(db, run, ctx, wire, o) {
    await insertDrafts(
      db,
      run,
      P(ctx).id,
      'social',
      o.platform,
      o.language,
      normalizePosts(wire).map(({ title, ...body }) => ({ title, body })),
    )
  },
}

const ideasOptions = z.object({ mode: z.enum(Object.keys(IDEA_MODES) as [keyof typeof IDEA_MODES]), persona: z.string().trim().max(80).default('') })
const ideas: Job<typeof IdeasWire, typeof ideasOptions> = {
  label: 'Ideeën',
  wire: IdeasWire,
  options: ideasOptions,
  effort: 'medium',
  maxTokens: 10_000,
  typicalOutput: 3_500,
  extras: async (db, ctx) => ({ pastTitles: await pastTitles(db, P(ctx).id, 'idea') }),
  task: (_ctx, o, extras) => ideasTask(o.mode, dayOf(new Date()), o.persona, extras.pastTitles),
  fixture: () => ideasFixture(),
  async save(db, run, ctx, wire, o) {
    await insertDrafts(
      db,
      run,
      P(ctx).id,
      'idea',
      o.mode,
      'nl',
      normalizeIdeas(wire).map(({ title, ...body }) => ({ title, body })),
    )
  },
}

const opportunitiesOptions = z.object({ language })
const opportunities: Job<typeof OpportunitiesWire, typeof opportunitiesOptions> = {
  label: 'Kansen zoeken',
  wire: OpportunitiesWire,
  options: opportunitiesOptions,
  effort: 'medium',
  maxTokens: 12_000,
  typicalOutput: 3_000,
  webSearch: { maxUses: 5, extraInputTokens: 50_000 },
  task: (ctx, o) => opportunitiesTask(o.language, P(ctx).markets),
  fixture: () => opportunitiesFixture(),
  async save(db, run, ctx, wire, o) {
    await insertDrafts(
      db,
      run,
      P(ctx).id,
      'opportunity',
      'web',
      o.language,
      normalizeOpportunities(wire).map(({ name, ...body }) => ({ title: name, body })),
    )
  },
}

const weekly: Job<typeof WeeklyWire, typeof none> = {
  label: 'Weekfocus',
  scope: 'portfolio',
  wire: WeeklyWire,
  options: none,
  effort: 'medium',
  maxTokens: 8_000,
  typicalOutput: 2_000,
  task: () => weeklyTask(dayOf(new Date())),
  fixture: () => weeklyFixture(),
  async save(db, run, _ctx, wire) {
    await db.insert(s.brief).values({ id: crypto.randomUUID(), ownerId: run.ownerId, projectId: null, kind: 'weekly', content: normalizeWeekly(wire), runId: run.id })
  },
}

export const JOBS = { profile, plan, emails, contactEmail, posts, ideas, opportunities, weekly } as const
export type JobKind = keyof typeof JOBS
export const isJobKind = (v: unknown): v is JobKind => typeof v === 'string' && Object.hasOwn(JOBS, v)
