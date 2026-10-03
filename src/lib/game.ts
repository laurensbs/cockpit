// The game: XP, levels, streaks, project health and badges. All pure, all computed from the XP
// ledger and what is in the database, so nothing can drift out of step.

import { addDays, daysBetween, weekStart } from './dates'

/** How much each kind of action is worth. Outcomes (a reply) beat activity (a mail sent). */
export const XP_RULES = {
  quest: { xp: 0, dailyCap: Infinity }, // a quest carries its own XP
  post: { xp: 15, dailyCap: 10 },
  email: { xp: 10, dailyCap: 10 },
  reply: { xp: 40, dailyCap: Infinity },
  commitDay: { xp: 5, dailyCap: 3 },
  metric: { xp: 10, dailyCap: 5 },
  intake: { xp: 25, dailyCap: Infinity },
  plan: { xp: 20, dailyCap: 3 },
  // Making drafts costs money: it earns a little, never a lot.
  generate: { xp: 5, dailyCap: 5 },
} as const
export type XpKind = keyof typeof XP_RULES

/** Kinds that count as "doing" for the action streak (commits have their own streak). */
export const ACTION_KINDS: readonly XpKind[] = ['quest', 'post', 'email', 'reply', 'metric', 'intake', 'plan']

export const QUEST_XP = [10, 25, 50, 100] as const
export const BOSS_XP = 250

// ---------- levels ----------

const TITLES = ['Dromer', 'Knutselaar', 'Bouwer', 'Maker', 'Lanceerder', 'Groeier', 'Ondernemer', 'Serie-ondernemer', 'Mogul', 'Legende']

/** Total XP needed to reach a level: 0, 100, 300, 600, 1000, 1500 … (50·n·(n−1)). */
export function xpForLevel(level: number): number {
  return 50 * level * (level - 1)
}

export interface LevelInfo {
  level: number
  title: string
  /** XP earned within this level, and what the next level needs on top of the previous one. */
  current: number
  needed: number
  progress: number
}

export function levelFor(totalXp: number): LevelInfo {
  const xp = Math.max(0, Math.floor(totalXp))
  let level = 1
  while (xpForLevel(level + 1) <= xp) level++
  const base = xpForLevel(level)
  const needed = xpForLevel(level + 1) - base
  return { level, title: TITLES[Math.min(level, TITLES.length) - 1], current: xp - base, needed, progress: (xp - base) / needed }
}

// ---------- streaks ----------

export interface Streak {
  /** Active days in the current run (freeze days do not count, they only bridge). */
  length: number
  /** Today already counts. When false the streak is still alive until tonight. */
  today: boolean
  /** Days bridged by a freeze in the current run. */
  frozen: string[]
}

/**
 * The current run of active days up to today. Today may still be empty (the day is not over).
 * One missed day per week (Monday to Sunday) is bridged by a free freeze, so a single day off never
 * resets a long streak, not even before today's work is done. Freezes only bridge: they never count
 * as a day, and a run never begins with one.
 */
export function currentStreak(active: ReadonlySet<string>, today: string, freezesPerWeek = 1): Streak {
  const frozen: string[] = []
  const pending: string[] = []
  const used = new Map<string, number>()
  let length = 0
  let day = today
  const todayActive = active.has(today)
  if (!todayActive) day = addDays(today, -1)
  // Look back no further than the oldest active day.
  const oldest = [...active].sort()[0]
  if (!oldest) return { length: 0, today: false, frozen: [] }
  while (day >= oldest) {
    if (active.has(day)) {
      length++
      frozen.push(...pending)
      pending.length = 0
    } else {
      const week = weekStart(day)
      const n = used.get(week) ?? 0
      if (n >= freezesPerWeek) break
      used.set(week, n + 1)
      pending.push(day)
    }
    day = addDays(day, -1)
  }
  return { length, today: todayActive, frozen }
}

/** The longest run ever, with the same freeze rule (for badges). */
export function longestStreak(active: ReadonlySet<string>, freezesPerWeek = 1): number {
  const days = [...active].sort()
  let best = 0
  for (const end of days) {
    // Only the last day of a run can start the backwards walk that finds its full length.
    if (active.has(addDays(end, 1))) continue
    best = Math.max(best, currentStreak(active, end, freezesPerWeek).length)
  }
  return best
}

// ---------- project health ----------

export interface HealthInput {
  today: string
  hasRepos: boolean
  /** Commit days of the project's repositories. */
  commitDays: Record<string, number>
  /** Days on which the project earned action XP (quests, posts, mails, numbers…). */
  actionDays: ReadonlySet<string>
  /** Days on which it earned marketing XP (posts, mails, replies). */
  marketingDays: ReadonlySet<string>
  planDay: string | null
  questsDone: number
  questsMissed: number
  intakeDone: boolean
}

export interface Health {
  score: number
  parts: { activity: number; marketing: number; plan: number; quests: number }
  tips: string[]
}

const countDays = (days: Iterable<string>, today: string, n: number) => {
  const from = addDays(today, -(n - 1))
  let c = 0
  for (const d of days) if (d >= from && d <= today) c++
  return c
}

/** 0–100: building, marketing, a fresh plan and keeping your word, each with a reason when low. */
export function projectHealth(h: HealthInput): Health {
  const commitDays = Object.keys(h.commitDays).filter((d) => h.commitDays[d] > 0)
  const busy = h.hasRepos ? Math.max(countDays(commitDays, h.today, 14), countDays(h.actionDays, h.today, 14)) : countDays(h.actionDays, h.today, 14)
  const activity = Math.round(Math.min(busy / 6, 1) * 30)
  const marketing = Math.round(Math.min(countDays(h.marketingDays, h.today, 14) / 4, 1) * 30)
  const planAge = h.planDay ? daysBetween(h.planDay, h.today) : null
  const plan = planAge === null ? 0 : planAge <= 30 ? 20 : planAge <= 60 ? 10 : 0
  const total = h.questsDone + h.questsMissed
  const quests = total === 0 ? 10 : Math.round((h.questsDone / total) * 20)
  const tips: string[] = []
  if (!h.intakeDone) tips.push('Intake nog niet af')
  if (activity < 10) tips.push(h.hasRepos ? 'Weinig gebouwd de laatste twee weken' : 'Twee weken weinig gebeurd')
  if (marketing === 0) tips.push('Twee weken geen marketing')
  if (plan === 0) tips.push(planAge === null ? 'Nog geen marketingplan' : 'Plan is ouder dan twee maanden')
  if (total > 0 && quests < 10) tips.push('Quests blijven liggen')
  return { score: activity + marketing + plan + quests, parts: { activity, marketing, plan, quests }, tips }
}

// ---------- badges ----------

export interface BadgeStats {
  level: number
  questsDone: number
  bossesDone: number
  posts: number
  emails: number
  replies: number
  longestActionStreak: number
  plans: number
  activeProjects: number
  projectsWithPlan: number
  firstRevenue: boolean
  comeback: boolean
}

export interface Badge {
  key: string
  title: string
  description: string
  earned: (s: BadgeStats) => boolean
}

export const BADGES: Badge[] = [
  { key: 'first-quest', title: 'Eerste quest', description: 'Je eerste quest afgerond', earned: (s) => s.questsDone >= 1 },
  { key: 'first-plan', title: 'Plan op tafel', description: 'Een eerste marketingplan', earned: (s) => s.plans >= 1 },
  { key: 'all-plans', title: 'Alles in kaart', description: 'Elk actief project heeft een plan', earned: (s) => s.activeProjects > 0 && s.projectsWithPlan >= s.activeProjects },
  { key: 'streak-7', title: 'Week vol', description: '7 dagen op rij iets gedaan', earned: (s) => s.longestActionStreak >= 7 },
  { key: 'streak-30', title: 'Onstuitbaar', description: '30 dagen op rij iets gedaan', earned: (s) => s.longestActionStreak >= 30 },
  { key: 'posts-10', title: 'Zichtbaar', description: '10 posts geplaatst', earned: (s) => s.posts >= 10 },
  { key: 'emails-25', title: 'Netwerker', description: '25 mails verstuurd', earned: (s) => s.emails >= 25 },
  { key: 'first-reply', title: 'Raak', description: 'Een eerste antwoord op je outreach', earned: (s) => s.replies >= 1 },
  { key: 'boss', title: 'Baas verslagen', description: 'Een boss-quest afgerond', earned: (s) => s.bossesDone >= 1 },
  { key: 'comeback', title: 'Comeback', description: 'Een stilgevallen project weer opgepakt', earned: (s) => s.comeback },
  { key: 'first-revenue', title: 'Eerste euro', description: 'Omzet ingevuld voor een project', earned: (s) => s.firstRevenue },
  { key: 'level-5', title: 'Lanceerder', description: 'Level 5 gehaald', earned: (s) => s.level >= 5 },
  { key: 'level-10', title: 'Legende', description: 'Level 10 gehaald', earned: (s) => s.level >= 10 },
]

export const earnedBadges = (stats: BadgeStats) => BADGES.filter((b) => b.earned(stats)).map((b) => b.key)

/** A project that was quiet for at least 14 days and had activity again in the last 7. */
export function isComeback(days: Record<string, number>, today: string): boolean {
  const active = Object.keys(days)
    .filter((d) => days[d] > 0 && d <= today)
    .sort()
  const recent = active.filter((d) => daysBetween(d, today) < 7)
  if (!recent.length) return false
  const before = active.filter((d) => d < recent[0])
  if (!before.length) return false
  return daysBetween(before.at(-1)!, recent[0]) >= 14
}
