import 'server-only'
import { and, count, eq, gt, inArray } from 'drizzle-orm'
import type { Db } from '@/db'
import * as s from '@/db/schema'
import { daysSinceLast, mergeCommitDays, momentum, series, type Trend } from '@/lib/activity'
import { addDays, addMonths, dayOf, daysBetween, monthStart } from '@/lib/dates'
import {
  ACTION_KINDS,
  currentStreak,
  earnedBadges,
  isComeback,
  levelFor,
  longestStreak,
  projectHealth,
  type BadgeStats,
  type Health,
  type LevelInfo,
  type Streak,
} from '@/lib/game'
import { ACTIVE_STAGES, isStage } from '@/lib/options'
import type { PaceStatus } from '@/lib/pace'
import { ruleQuests, type RuleProject } from '@/lib/quests'
import { type OutcomeState, paceTip } from './outcome-state'
import { award } from './xp'

export const isIntakeDone = (p: { oneLiner: string; what: string; audience: string; goal: string }) =>
  Boolean(p.oneLiner.trim() && p.what.trim() && p.audience.trim() && p.goal.trim())

export const MARKETING_KINDS = ['post', 'email', 'reply'] as const

export interface PlayerStats {
  totalXp: number
  todayXp: number
  level: LevelInfo
  actionStreak: Streak
  buildStreak: Streak
}

/** Everything the top bar and Today need: XP, level and both streaks. */
export async function playerStats(db: Db, ownerId: string, now = new Date()): Promise<PlayerStats> {
  const today = dayOf(now)
  const events = await db.select({ kind: s.xpEvent.kind, xp: s.xpEvent.xp, day: s.xpEvent.day }).from(s.xpEvent).where(eq(s.xpEvent.ownerId, ownerId))
  const repos = await db.select({ commitDays: s.repo.commitDays }).from(s.repo).where(eq(s.repo.ownerId, ownerId))
  const totalXp = events.reduce((sum, e) => sum + e.xp, 0)
  const todayXp = events.filter((e) => e.day === today).reduce((sum, e) => sum + e.xp, 0)
  const actionDays = new Set(events.filter((e) => (ACTION_KINDS as readonly string[]).includes(e.kind)).map((e) => e.day))
  const commits = mergeCommitDays(repos.map((r) => r.commitDays))
  const buildDays = new Set(Object.keys(commits).filter((d) => commits[d] > 0))
  return { totalXp, todayXp, level: levelFor(totalXp), actionStreak: currentStreak(actionDays, today), buildStreak: currentStreak(buildDays, today) }
}

/**
 * The daily round, run lazily when Today or Quests opens (and by the cron): XP for recent commit
 * days and finished intakes, and the quests that follow from the state of the projects.
 */
export async function dailyRound(db: Db, ownerId: string, now = new Date()): Promise<void> {
  const today = dayOf(now)
  const projects = await db.select().from(s.project).where(eq(s.project.ownerId, ownerId))
  if (!projects.length) return
  const repos = await db
    .select({ projectId: s.repo.projectId, commitDays: s.repo.commitDays, syncError: s.repo.syncError })
    .from(s.repo)
    .where(eq(s.repo.ownerId, ownerId))
  const events = await db
    .select({ projectId: s.xpEvent.projectId, kind: s.xpEvent.kind, day: s.xpEvent.day })
    .from(s.xpEvent)
    .where(and(eq(s.xpEvent.ownerId, ownerId), gt(s.xpEvent.day, addDays(today, -120))))
  const plans = await db
    .select({ projectId: s.brief.projectId })
    .from(s.brief)
    .where(and(eq(s.brief.ownerId, ownerId), eq(s.brief.kind, 'plan')))
  const lastMonth = addMonths(monthStart(today), -1)
  const metricRows = await db
    .select({ projectId: s.metric.projectId })
    .from(s.metric)
    .where(and(eq(s.metric.ownerId, ownerId), eq(s.metric.month, lastMonth)))
  const connectors = await db
    .select({ id: s.connector.id, projectId: s.connector.projectId, kind: s.connector.kind, lastError: s.connector.lastError, lastOkAt: s.connector.lastOkAt, createdAt: s.connector.createdAt })
    .from(s.connector)
    .where(and(eq(s.connector.ownerId, ownerId), eq(s.connector.enabled, true)))
  // A source counts as failing when it has delivered nothing for three days (or never, three days after it was added).
  const threeDaysAgo = new Date(now.getTime() - 3 * 86_400_000)

  const ruleProjects: RuleProject[] = []
  for (const p of projects) {
    const own = repos.filter((r) => r.projectId === p.id)
    const commits = mergeCommitDays(own.map((r) => r.commitDays))
    // XP for the last three commit days, so a sync after a weekend still counts.
    for (let i = 0; i < 3; i++) {
      const day = addDays(today, -i)
      if ((commits[day] ?? 0) > 0) await award(db, ownerId, { kind: 'commitDay', refId: `${p.id}:${day}`, projectId: p.id, day })
    }
    const intakeDone = isIntakeDone(p)
    if (intakeDone) await award(db, ownerId, { kind: 'intake', refId: p.id, projectId: p.id })
    const lastAction = events
      .filter((e) => e.projectId === p.id)
      .map((e) => e.day)
      .sort()
      .at(-1)
    const lastCommit = daysSinceLast(commits, today)
    const sinceAction = lastAction ? daysBetween(lastAction, today) : null
    const quietDays = lastCommit === null ? sinceAction : sinceAction === null ? lastCommit : Math.min(lastCommit, sinceAction)
    ruleProjects.push({
      id: p.id,
      name: p.name,
      active: isStage(p.stage) && ACTIVE_STAGES.includes(p.stage),
      intakeDone,
      hasPlan: plans.some((b) => b.projectId === p.id),
      quietDays,
      hasMetricsLastMonth: metricRows.some((m) => m.projectId === p.id),
      syncError: own.some((r) => r.syncError),
      stage: p.stage,
      hasModel: Boolean(p.growthModel),
      failingSources: connectors
        .filter((c) => c.projectId === p.id && c.lastError && (c.lastOkAt ?? c.createdAt) < threeDaysAgo)
        .map((c) => ({ id: c.id, label: c.kind.charAt(0).toUpperCase() + c.kind.slice(1), error: c.lastError ?? '' })),
    })
  }
  const candidates = ruleQuests(ruleProjects, today, true)
  if (candidates.length) {
    await db
      .insert(s.quest)
      .values(candidates.map((c) => ({ id: crypto.randomUUID(), ownerId, ...c, kind: 'custom', source: 'rule' })))
      .onConflictDoNothing()
  }
}

/** What the badges are judged on. */
export async function badgeStats(db: Db, ownerId: string, now = new Date()): Promise<BadgeStats> {
  const today = dayOf(now)
  const events = await db.select({ kind: s.xpEvent.kind, day: s.xpEvent.day, xp: s.xpEvent.xp }).from(s.xpEvent).where(eq(s.xpEvent.ownerId, ownerId))
  const [quests, bosses, plans, revenue] = await Promise.all([
    db
      .select({ n: count() })
      .from(s.quest)
      .where(and(eq(s.quest.ownerId, ownerId), eq(s.quest.status, 'done'))),
    db
      .select({ n: count() })
      .from(s.quest)
      .where(and(eq(s.quest.ownerId, ownerId), eq(s.quest.status, 'done'), eq(s.quest.kind, 'boss'))),
    db
      .select({ projectId: s.brief.projectId })
      .from(s.brief)
      .where(and(eq(s.brief.ownerId, ownerId), eq(s.brief.kind, 'plan'))),
    db
      .select({ n: count() })
      .from(s.metric)
      .where(and(eq(s.metric.ownerId, ownerId), eq(s.metric.key, 'revenue'), gt(s.metric.value, 0))),
  ])
  const projects = await db.select({ id: s.project.id, stage: s.project.stage }).from(s.project).where(eq(s.project.ownerId, ownerId))
  const active = projects.filter((p) => isStage(p.stage) && ACTIVE_STAGES.includes(p.stage))
  const repos = active.length
    ? await db
        .select({ projectId: s.repo.projectId, commitDays: s.repo.commitDays })
        .from(s.repo)
        .where(
          inArray(
            s.repo.projectId,
            active.map((p) => p.id),
          ),
        )
    : []
  const n = (kind: string) => events.filter((e) => e.kind === kind).length
  const actionDays = new Set(events.filter((e) => (ACTION_KINDS as readonly string[]).includes(e.kind)).map((e) => e.day))
  const withPlan = new Set(plans.map((p) => p.projectId))
  return {
    level: levelFor(events.reduce((sum, e) => sum + e.xp, 0)).level,
    questsDone: quests[0].n,
    bossesDone: bosses[0].n,
    posts: n('post'),
    emails: n('email'),
    replies: n('reply'),
    longestActionStreak: longestStreak(actionDays),
    plans: plans.length,
    activeProjects: active.length,
    projectsWithPlan: active.filter((p) => withPlan.has(p.id)).length,
    firstRevenue: revenue[0].n > 0,
    comeback: active.some((p) =>
      isComeback(
        mergeCommitDays(repos.filter((r) => r.projectId === p.id).map((r) => r.commitDays)),
        today,
      ),
    ),
  }
}

export async function badgesOf(db: Db, ownerId: string): Promise<string[]> {
  return earnedBadges(await badgeStats(db, ownerId))
}


export interface ProjectPulse {
  id: string
  name: string
  color: string
  stage: string
  health: Health
  trend: Trend
  spark: number[]
  /** Pace towards the growth model's target, when there is one. */
  pace: PaceStatus | null
}

/** Health and momentum for every active project, worst first: where attention is needed. */
export async function projectPulses(db: Db, ownerId: string, now = new Date(), outcomes?: Map<string, OutcomeState>): Promise<ProjectPulse[]> {
  const today = dayOf(now)
  const from = addDays(today, -60)
  const [projects, repos, events, plans, quests] = await Promise.all([
    db
      .select({ id: s.project.id, name: s.project.name, stage: s.project.stage, oneLiner: s.project.oneLiner, what: s.project.what, audience: s.project.audience, goal: s.project.goal, color: s.company.color })
      .from(s.project)
      .leftJoin(s.company, eq(s.company.id, s.project.companyId))
      .where(eq(s.project.ownerId, ownerId)),
    db.select({ projectId: s.repo.projectId, commitDays: s.repo.commitDays }).from(s.repo).where(eq(s.repo.ownerId, ownerId)),
    db
      .select({ projectId: s.xpEvent.projectId, kind: s.xpEvent.kind, day: s.xpEvent.day })
      .from(s.xpEvent)
      .where(and(eq(s.xpEvent.ownerId, ownerId), gt(s.xpEvent.day, from))),
    db
      .select({ projectId: s.brief.projectId, createdAt: s.brief.createdAt })
      .from(s.brief)
      .where(and(eq(s.brief.ownerId, ownerId), eq(s.brief.kind, 'plan'))),
    db
      .select({ projectId: s.quest.projectId, status: s.quest.status, dueOn: s.quest.dueOn, doneAt: s.quest.doneAt })
      .from(s.quest)
      .where(eq(s.quest.ownerId, ownerId)),
  ])
  const twoWeeksAgo = addDays(today, -13)
  return projects
    .filter((p) => isStage(p.stage) && ACTIVE_STAGES.includes(p.stage))
    .map((p) => {
      const own = repos.filter((r) => r.projectId === p.id)
      const commitDays = mergeCommitDays(own.map((r) => r.commitDays))
      const mine = events.filter((e) => e.projectId === p.id)
      const actionDays = new Set(mine.filter((e) => (ACTION_KINDS as readonly string[]).includes(e.kind)).map((e) => e.day))
      const marketingDays = new Set(mine.filter((e) => (MARKETING_KINDS as readonly string[]).includes(e.kind)).map((e) => e.day))
      const latestPlan = plans
        .filter((b) => b.projectId === p.id)
        .map((b) => dayOf(b.createdAt))
        .sort()
        .at(-1)
      const recent = quests.filter((q) => q.projectId === p.id)
      const questsDone = recent.filter((q) => q.status === 'done' && q.doneAt && dayOf(q.doneAt) >= twoWeeksAgo).length
      const questsMissed = recent.filter((q) => (q.status === 'open' && q.dueOn != null && q.dueOn < today && q.dueOn >= twoWeeksAgo) || (q.status === 'skipped' && q.doneAt && dayOf(q.doneAt) >= twoWeeksAgo)).length
      const outcome = outcomes?.get(p.id)
      const health = projectHealth({
        today,
        hasRepos: own.length > 0,
        commitDays,
        actionDays,
        marketingDays,
        planDay: latestPlan ?? null,
        questsDone,
        questsMissed,
        intakeDone: isIntakeDone(p),
      }, outcome?.model && outcome.pace ? { status: outcome.pace.status, tip: paceTip(outcome.model, outcome.pace) } : null)
      // Momentum: commits and actions of the last 7 days against the 7 before.
      const daily = series(commitDays, today, 14).map((c, i) => c + (actionDays.has(addDays(today, i - 13)) ? 1 : 0))
      const trend = momentum(
        daily.slice(7).reduce((a, b) => a + b, 0),
        daily.slice(0, 7).reduce((a, b) => a + b, 0),
      )
      return { id: p.id, name: p.name, color: p.color ?? '#8a90b0', stage: p.stage, health, trend, spark: daily, pace: outcome?.pace?.status ?? null }
    })
    .sort((a, b) => a.health.score - b.health.score)
}
