import 'server-only'
import { and, desc, eq, gte, ne } from 'drizzle-orm'
import type { Db } from '@/db'
import * as s from '@/db/schema'
import { portfolioContext, projectContext, type ContextInput, type PortfolioInput } from '@/lib/ai/prompts'
import { profileFromJson, type Profile } from '@/lib/ai/schemas'
import { addMonths, dayOf, monthStart } from '@/lib/dates'
import { socialsOf } from '@/lib/socials'
import { readCompass } from '../compass'
import { bottleneckLine, growthText, lessonLine, type LessonBody, outcomeStates, paceLine } from '../outcome-state'

export interface JobContext {
  ownerId: string
  /** The project of a project job; null for a job about the whole portfolio. */
  project: typeof s.project.$inferSelect | null
  input: ContextInput | null
  portfolio: PortfolioInput | null
  profile: Profile | null
}

/** A job about one project always has that project and its information. */
export type ProjectJobContext = JobContext & { project: NonNullable<JobContext['project']>; input: ContextInput }

/** The cached part of the prompt: one project in full, or the portfolio in short. */
export const contextText = (ctx: JobContext) => (ctx.input ? projectContext(ctx.input) : ctx.portfolio ? portfolioContext(ctx.portfolio) : '')

/** Everything the AI may know about one of the owner's projects, or null when it is not theirs. */
export async function loadJobContext(db: Db, ownerId: string, projectId: string): Promise<ProjectJobContext | null> {
  const [project] = await db
    .select()
    .from(s.project)
    .where(and(eq(s.project.id, projectId), eq(s.project.ownerId, ownerId)))
  if (!project) return null
  const [company] = project.companyId ? await db.select().from(s.company).where(eq(s.company.id, project.companyId)) : []
  const repos = await db
    .select()
    .from(s.repo)
    .where(and(eq(s.repo.projectId, projectId), eq(s.repo.includeInAi, true)))
  const metrics = await db
    .select({ month: s.metric.month, key: s.metric.key, value: s.metric.value })
    .from(s.metric)
    .where(and(eq(s.metric.projectId, projectId), gte(s.metric.month, addMonths(monthStart(dayOf(new Date())), -3))))
  const others = await db
    .select({ name: s.project.name, oneLiner: s.project.oneLiner, stage: s.project.stage })
    .from(s.project)
    .where(and(eq(s.project.ownerId, ownerId), ne(s.project.id, projectId)))
  const rated = await db
    .select({ title: s.contentItem.title, rating: s.contentItem.rating })
    .from(s.contentItem)
    .where(and(eq(s.contentItem.projectId, projectId), ne(s.contentItem.rating, 0)))
    .orderBy(desc(s.contentItem.createdAt))
    .limit(30)
  const [profileBrief] = await db
    .select({ content: s.brief.content })
    .from(s.brief)
    .where(and(eq(s.brief.projectId, projectId), eq(s.brief.kind, 'profile')))
    .orderBy(desc(s.brief.createdAt))
    .limit(1)
  const outcome = (await outcomeStates(db, ownerId)).get(projectId)
  const lessons = await db
    .select({ title: s.contentItem.title, body: s.contentItem.body })
    .from(s.contentItem)
    .where(and(eq(s.contentItem.projectId, projectId), eq(s.contentItem.kind, 'lesson')))
    .orderBy(desc(s.contentItem.createdAt))
    .limit(12)
  return {
    ownerId,
    project,
    portfolio: null,
    profile: profileBrief ? profileFromJson(profileBrief.content) : null,
    input: {
      project: {
        name: project.name,
        stage: project.stage,
        oneLiner: project.oneLiner,
        what: project.what,
        audience: project.audience,
        goal: project.goal,
        northStar: project.northStar,
        tone: project.tone,
        redLines: project.redLines,
        markets: project.markets,
        languages: project.languages,
        monthlyBudget: project.monthlyBudget,
        siteUrl: project.siteUrl,
      },
      company: company ? { name: company.name, kind: company.kind } : null,
      repos: repos.map((r) => ({ fullName: r.fullName, description: r.description, homepage: r.homepage, stack: r.stack, readme: r.readme, docs: r.docs, recentCommits: r.recentCommits })),
      metrics,
      others,
      liked: rated.filter((r) => r.rating > 0).map((r) => r.title),
      disliked: rated.filter((r) => r.rating < 0).map((r) => r.title),
      growth: outcome ? growthText(outcome) : null,
      lessons: lessons.map((l) => lessonLine(l.title, l.body as LessonBody)),
      socials: socialsOf(project.links) as Record<string, string>,
      compass: readCompass(project),
    },
  }
}

/** The whole portfolio in short: health, momentum, open quests and money per project, and what slid. */
export async function loadPortfolioContext(db: Db, ownerId: string): Promise<JobContext> {
  const { playerStats, projectPulses } = await import('../game')
  const today = dayOf(new Date())
  const outcomes = await outcomeStates(db, ownerId)
  const [stats, pulses, quests, metrics, done] = await Promise.all([
    playerStats(db, ownerId),
    projectPulses(db, ownerId, new Date(), outcomes),
    db.select({ projectId: s.quest.projectId, title: s.quest.title, status: s.quest.status, dueOn: s.quest.dueOn, doneAt: s.quest.doneAt }).from(s.quest).where(eq(s.quest.ownerId, ownerId)),
    db
      .select({ projectId: s.metric.projectId, value: s.metric.value })
      .from(s.metric)
      .where(and(eq(s.metric.ownerId, ownerId), eq(s.metric.month, monthStart(today)), eq(s.metric.key, 'revenue'))),
    db
      .select({ title: s.contentItem.title, doneAt: s.contentItem.doneAt })
      .from(s.contentItem)
      .where(and(eq(s.contentItem.ownerId, ownerId), eq(s.contentItem.status, 'done'))),
  ])
  const weekAgo = new Date(Date.now() - 7 * 86_400_000)
  const twoWeeksAgo = new Date(Date.now() - 14 * 86_400_000)
  return {
    ownerId,
    project: null,
    input: null,
    profile: null,
    portfolio: {
      today,
      level: stats.level.level,
      actionStreak: stats.actionStreak.length,
      projects: pulses.map((p) => ({
        name: p.name,
        stage: p.stage,
        oneLiner: '',
        health: p.health.score,
        tips: p.health.tips,
        trend: p.trend,
        openQuests: quests.filter((q) => q.projectId === p.id && q.status === 'open').length,
        revenueThisMonth: metrics.find((m) => m.projectId === p.id)?.value ?? null,
        growth: (() => {
          const o = outcomes.get(p.id)
          if (!o?.model || !o.pace) return null
          const leak = bottleneckLine(o)
          return `${paceLine(o.model, o.pace)}${leak ? `; ${leak}` : ''}.`
        })(),
      })),
      doneThisWeek: [
        ...quests.filter((q) => q.status === 'done' && q.doneAt && q.doneAt > weekAgo).map((q) => q.title),
        ...done.filter((d) => d.doneAt && d.doneAt > weekAgo).map((d) => d.title),
      ].slice(0, 20),
      skipped: [
        ...quests.filter((q) => q.status === 'skipped' && q.doneAt && q.doneAt > twoWeeksAgo).map((q) => q.title),
        ...quests.filter((q) => q.status === 'open' && q.dueOn && q.dueOn < today).map((q) => `${q.title} (overdue)`),
      ].slice(0, 15),
    },
  }
}
