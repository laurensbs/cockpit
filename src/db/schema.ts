import { sql } from 'drizzle-orm'
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import type { GrowthModel } from '../lib/growth-model'
// Every row belongs to an owner ('local' in the app on your own computer), so the cockpit can serve
// more people later without a rewrite.
const ownerId = () => text('owner_id').notNull()
const createdAt = () => timestamp('created_at').defaultNow().notNull()
const emptyTextArray = sql`'{}'::text[]`

/** A company or brand: your own business, a client, a side project or a non-profit. */
export const company = pgTable(
  'company',
  {
    id: text('id').primaryKey(),
    ownerId: ownerId(),
    name: text('name').notNull(),
    kind: text('kind').notNull().default('own'),
    country: text('country'),
    registration: text('registration').notNull().default(''),
    website: text('website'),
    color: text('color').notNull().default('#8b7bff'),
    status: text('status').notNull().default('active'),
    notes: text('notes').notNull().default(''),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index('company_owner_idx').on(t.ownerId)],
)

/** Something you build and market. It may have GitHub repos, or none yet. */
export const project = pgTable(
  'project',
  {
    id: text('id').primaryKey(),
    ownerId: ownerId(),
    companyId: text('company_id').references(() => company.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    stage: text('stage').notNull().default('build'),
    oneLiner: text('one_liner').notNull().default(''),
    what: text('what').notNull().default(''),
    audience: text('audience').notNull().default(''),
    goal: text('goal').notNull().default(''),
    markets: text('markets').array().notNull().default(emptyTextArray),
    languages: text('languages').array().notNull().default(sql`'{nl}'::text[]`),
    tone: text('tone').notNull().default(''),
    northStar: text('north_star').notNull().default(''),
    redLines: text('red_lines').notNull().default(''),
    siteUrl: text('site_url'),
    siteStatus: integer('site_status'),
    siteCheckedAt: timestamp('site_checked_at'),
    // The folder on this computer with the code: Claude Code starts there, so it can read everything.
    localPath: text('local_path'),
    links: jsonb('links').$type<{ label: string; url: string }[]>().notNull().default([]),
    monthlyBudget: integer('monthly_budget'),
    sortOrder: integer('sort_order').notNull().default(0),
    // The growth model he accepted: one target number with a deadline, and the funnel that leads to it.
    growthModel: jsonb('growth_model').$type<GrowthModel>(),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('project_owner_idx').on(t.ownerId), index('project_company_idx').on(t.companyId)],
)

/** A GitHub repository and what the cockpit last read from it. */
export const repo = pgTable(
  'repo',
  {
    id: text('id').primaryKey(),
    ownerId: ownerId(),
    projectId: text('project_id').references(() => project.id, { onDelete: 'set null' }),
    fullName: text('full_name').notNull(),
    isPrivate: boolean('is_private').notNull().default(true),
    archived: boolean('archived').notNull().default(false),
    // Off for a client's repo whose content should not go to the AI.
    includeInAi: boolean('include_in_ai').notNull().default(true),
    description: text('description').notNull().default(''),
    homepage: text('homepage'),
    topics: text('topics').array().notNull().default(emptyTextArray),
    language: text('language'),
    stack: text('stack').array().notNull().default(emptyTextArray),
    readme: text('readme').notNull().default(''),
    docs: jsonb('docs').$type<{ path: string; text: string }[]>().notNull().default([]),
    commitDays: jsonb('commit_days').$type<Record<string, number>>().notNull().default({}),
    recentCommits: jsonb('recent_commits').$type<{ date: string; message: string }[]>().notNull().default([]),
    pushedAt: timestamp('pushed_at'),
    syncedAt: timestamp('synced_at'),
    syncError: text('sync_error'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('repo_owner_full_name_idx').on(t.ownerId, t.fullName), index('repo_project_idx').on(t.projectId)],
)

/** What the AI made for a project (profile, plan) or for the whole portfolio (weekly focus). The newest one counts. */
export const brief = pgTable(
  'brief',
  {
    id: text('id').primaryKey(),
    ownerId: ownerId(),
    projectId: text('project_id').references(() => project.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    content: jsonb('content').notNull(),
    runId: text('run_id'),
    createdAt: createdAt(),
  },
  (t) => [index('brief_owner_kind_idx').on(t.ownerId, t.kind, t.createdAt), index('brief_project_idx').on(t.projectId)],
)

/** Someone to reach out to for a project: always an organisation or a business address. */
export const contact = pgTable(
  'contact',
  {
    id: text('id').primaryKey(),
    ownerId: ownerId(),
    projectId: text('project_id')
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    organization: text('organization').notNull(),
    name: text('name').notNull().default(''),
    email: text('email'),
    website: text('website'),
    note: text('note').notNull().default(''),
    // Why mailing them is allowed: consent, an existing relationship, or a business address (legitimate interest).
    basis: text('basis').notNull().default('business'),
    status: text('status').notNull().default('new'),
    lastContactAt: timestamp('last_contact_at'),
    // The deal: what it is worth (per month or once) and the next step, for the pipeline.
    dealValue: integer('deal_value'),
    dealPeriod: text('deal_period'),
    nextStep: text('next_step').notNull().default(''),
    nextStepOn: date('next_step_on'),
    createdAt: createdAt(),
  },
  (t) => [index('contact_project_idx').on(t.projectId)],
)

/** A draft: an email, a social post, an idea or an opportunity. Nothing here is ever sent on its own. */
export const contentItem = pgTable(
  'content_item',
  {
    id: text('id').primaryKey(),
    ownerId: ownerId(),
    projectId: text('project_id').references(() => project.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    channel: text('channel').notNull().default(''),
    language: text('language').notNull().default('nl'),
    title: text('title').notNull(),
    body: jsonb('body').notNull(),
    status: text('status').notNull().default('draft'),
    plannedFor: date('planned_for'),
    doneAt: timestamp('done_at'),
    rating: integer('rating').notNull().default(0),
    contactId: text('contact_id').references(() => contact.id, { onDelete: 'set null' }),
    runId: text('run_id'),
    createdAt: createdAt(),
  },
  (t) => [
    index('content_owner_kind_idx').on(t.ownerId, t.kind, t.status),
    index('content_project_idx').on(t.projectId),
    index('content_planned_idx').on(t.ownerId, t.plannedFor),
  ],
)

/** Something to do, worth XP. sourceKey keeps generated quests from appearing twice. */
export const quest = pgTable(
  'quest',
  {
    id: text('id').primaryKey(),
    ownerId: ownerId(),
    projectId: text('project_id').references(() => project.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    detail: text('detail').notNull().default(''),
    kind: text('kind').notNull().default('custom'),
    xp: integer('xp').notNull().default(25),
    source: text('source').notNull().default('manual'),
    sourceKey: text('source_key'),
    status: text('status').notNull().default('open'),
    // A recurring quest (VAT return, domain renewal) comes back after it is done.
    recurrence: text('recurrence').notNull().default('none'),
    dueOn: date('due_on'),
    doneAt: timestamp('done_at'),
    createdAt: createdAt(),
  },
  (t) => [index('quest_owner_status_idx').on(t.ownerId, t.status), uniqueIndex('quest_source_idx').on(t.ownerId, t.sourceKey)],
)

/** The XP ledger. Levels, streaks and badges are all computed from it; (kind, refId) can only score once. */
export const xpEvent = pgTable(
  'xp_event',
  {
    id: text('id').primaryKey(),
    ownerId: ownerId(),
    projectId: text('project_id').references(() => project.id, { onDelete: 'set null' }),
    kind: text('kind').notNull(),
    refId: text('ref_id').notNull(),
    xp: integer('xp').notNull(),
    day: date('day').notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('xp_event_ref_idx').on(t.ownerId, t.kind, t.refId), index('xp_event_owner_day_idx').on(t.ownerId, t.day)],
)


/**
 * A number per project per month: typed in by hand ('manual'), or the sum of the daily points that came
 * in by themselves ('auto'). A number he typed always wins.
 */
export const metric = pgTable(
  'metric',
  {
    id: text('id').primaryKey(),
    ownerId: ownerId(),
    projectId: text('project_id')
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    month: date('month').notNull(),
    key: text('key').notNull(),
    value: doublePrecision('value').notNull(),
    source: text('source').notNull().default('manual'),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('metric_project_month_key_idx').on(t.projectId, t.month, t.key)],
)

/** A number on a day, from a source: a payment provider, analytics, the pipeline, Claude, or him. */
export const metricPoint = pgTable(
  'metric_point',
  {
    id: text('id').primaryKey(),
    ownerId: ownerId(),
    projectId: text('project_id')
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    day: date('day').notNull(),
    value: doublePrecision('value').notNull(),
    source: text('source').notNull(),
    note: text('note').notNull().default(''),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('metric_point_unique_idx').on(t.projectId, t.key, t.day, t.source),
    index('metric_point_owner_idx').on(t.ownerId, t.projectId, t.key, t.day),
  ],
)

/** Where a project's numbers come from by themselves (Stripe, Mollie, Plausible, …). Its key lives in `setting`. */
export const connector = pgTable(
  'connector',
  {
    id: text('id').primaryKey(),
    ownerId: ownerId(),
    projectId: text('project_id')
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    config: jsonb('config').$type<Record<string, string>>().notNull().default({}),
    enabled: boolean('enabled').notNull().default(true),
    lastRunAt: timestamp('last_run_at'),
    lastOkAt: timestamp('last_ok_at'),
    lastError: text('last_error'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('connector_project_kind_idx').on(t.projectId, t.kind), index('connector_owner_idx').on(t.ownerId)],
)

/** Every step a contact takes in the pipeline, so the funnel can count per week. */
export const contactEvent = pgTable(
  'contact_event',
  {
    id: text('id').primaryKey(),
    ownerId: ownerId(),
    projectId: text('project_id')
      .notNull()
      .references(() => project.id, { onDelete: 'cascade' }),
    contactId: text('contact_id')
      .notNull()
      .references(() => contact.id, { onDelete: 'cascade' }),
    status: text('status').notNull(),
    day: date('day').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('contact_event_project_idx').on(t.projectId, t.day)],
)

/**
 * A mail that goes out on its own, after he approved it once: a first mail or one of its follow-ups.
 * Follow-ups wait until the mail before was sent; a reply or a "no" cancels the rest of the sequence.
 */
export const emailJob = pgTable(
  'email_job',
  {
    id: text('id').primaryKey(),
    ownerId: ownerId(),
    projectId: text('project_id').references(() => project.id, { onDelete: 'cascade' }),
    contactId: text('contact_id').references(() => contact.id, { onDelete: 'cascade' }),
    contentItemId: text('content_item_id').references(() => contentItem.id, { onDelete: 'set null' }),
    sequenceId: text('sequence_id').notNull(),
    step: integer('step').notNull().default(0),
    toAddress: text('to_address').notNull(),
    subject: text('subject').notNull(),
    body: text('body').notNull(),
    // waiting (a follow-up whose turn has not come) → queued → sent | failed | cancelled
    status: text('status').notNull().default('queued'),
    sendAfter: timestamp('send_after'),
    sentAt: timestamp('sent_at'),
    messageId: text('message_id'),
    error: text('error'),
    createdAt: createdAt(),
  },
  (t) => [index('email_job_owner_status_idx').on(t.ownerId, t.status, t.sendAfter), index('email_job_sequence_idx').on(t.sequenceId)],
)

/** One value per key: the owner's name, the GitHub token, what is connected. */
export const setting = pgTable(
  'setting',
  {
    id: text('id').primaryKey(),
    ownerId: ownerId(),
    key: text('key').notNull(),
    value: text('value').notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('setting_owner_key_idx').on(t.ownerId, t.key)],
)
