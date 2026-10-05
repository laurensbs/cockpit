import 'server-only'
import { and, count, desc, eq, gt, gte, isNull, lte, or } from 'drizzle-orm'
import type { Db } from '@/db'
import * as s from '@/db/schema'
import { dayOf, daysBetween, hourOf, weekdayOf, weekStart } from '@/lib/dates'
import { preferredPlatform, socialsOf } from '@/lib/socials'
import { buildNote, recentPulls, recentWork } from '@/lib/today'
import { launchPrompt, runHeadless } from './claude'
import { createTicket } from './mcp/tickets'
import { getSetting, setSetting } from './settings'

/**
 * Opt-in: on Monday morning Claude Code makes the weekly focus by itself, in the background, once a
 * week. It runs on his own Claude account, like everything else.
 */
/** On unless he switched it off (he asked for Claude to work ahead on its own, 5 Oct 2026). */
export const autopilotOn = async (db: Db, ownerId: string) => (await getSetting(db, ownerId, 'autopilot_weekly')) !== '0'

export async function maybeAutopilot(db: Db, ownerId: string, now = new Date()): Promise<'off' | 'not-now' | 'done-already' | 'started' | 'failed'> {
  if (!(await autopilotOn(db, ownerId))) return 'off'
  const today = dayOf(now)
  if (weekdayOf(today) !== 1 || hourOf(now) < 7) return 'not-now'
  const week = weekStart(today)
  if ((await getSetting(db, ownerId, 'autopilot_week')) === week) return 'done-already'
  const [latest] = await db
    .select({ createdAt: s.brief.createdAt })
    .from(s.brief)
    .where(and(eq(s.brief.ownerId, ownerId), eq(s.brief.kind, 'weekly'), isNull(s.brief.projectId)))
    .orderBy(desc(s.brief.createdAt))
    .limit(1)
  if (latest && dayOf(latest.createdAt) >= week) {
    await setSetting(db, ownerId, 'autopilot_week', week)
    return 'done-already'
  }
  const ticket = createTicket({ task: 'weekly', projectId: null, options: {} })
  const { started } = await runHeadless(launchPrompt(ticket))
  if (started) await setSetting(db, ownerId, 'autopilot_week', week)
  return started ? 'started' : 'failed'
}

/**
 * Prospectie: on working days, once a day per project, Claude Code looks for the businesses of each
 * project where he switched it on, in the background, while the app is open. It pauses while too many
 * proposals still wait for his yes or no, so they never pile up.
 */
export async function maybeProspect(db: Db, ownerId: string, now = new Date()): Promise<{ started: string[]; waiting: string[] }> {
  const result = { started: [] as string[], waiting: [] as string[] }
  const today = dayOf(now)
  if (weekdayOf(today) > 5 || hourOf(now) < 8) return result
  const projects = await db
    .select({ id: s.project.id, name: s.project.name, perDay: s.project.prospectPerDay })
    .from(s.project)
    .where(and(eq(s.project.ownerId, ownerId), gt(s.project.prospectPerDay, 0)))
  for (const p of projects.slice(0, 3)) {
    const key = `prospect_day_${p.id}`
    if ((await getSetting(db, ownerId, key)) === today) continue
    const [open] = await db
      .select({ n: count() })
      .from(s.contact)
      .where(and(eq(s.contact.projectId, p.id), eq(s.contact.status, 'prospect'), or(isNull(s.contact.nextStepOn), lte(s.contact.nextStepOn, today))))
    if ((open?.n ?? 0) >= p.perDay * 2) {
      result.waiting.push(p.name)
      continue
    }
    const ticket = createTicket({ task: 'prospect', projectId: p.id, options: { count: p.perDay } })
    const { started } = await runHeadless(launchPrompt(ticket), { web: true })
    if (started) {
      await setSetting(db, ownerId, key, today)
      result.started.push(p.name)
    }
  }
  return result
}

/**
 * Autopilot, working days: one post ready per project, so the lesson offers "Post op Instagram" instead
 * of a chore. About what he built in the last two days (his GitHub sessions) when there is work, else
 * one that fits the project's phase and plan. Instagram first when it is linked. Never for a project
 * with marketing off, at most two projects a day, not when a post was made for it in the last two days,
 * and only for a project with work to show or a linked social profile.
 */
export async function maybeBuildPosts(db: Db, ownerId: string, now = new Date()): Promise<string[]> {
  if (!(await autopilotOn(db, ownerId))) return []
  const today = dayOf(now)
  if (weekdayOf(today) > 5 || hourOf(now) < 7) return []
  const projects = await db.select().from(s.project).where(eq(s.project.ownerId, ownerId))
  const repos = await db.select({ projectId: s.repo.projectId, recentCommits: s.repo.recentCommits, recentPulls: s.repo.recentPulls }).from(s.repo).where(and(eq(s.repo.ownerId, ownerId), eq(s.repo.includeInAi, true)))
  const since = new Date(now.getTime() - 2 * 86_400_000)
  const started: string[] = []
  for (const p of projects) {
    if (started.length >= 2 || /marketing staat uit/i.test(`${p.what} ${p.redLines}`)) continue
    const key = `build_post_${p.id}`
    if ((await getSetting(db, ownerId, key)) === today) continue
    const socials = socialsOf(p.links)
    const work = repos.filter((r) => r.projectId === p.id).flatMap((r) => [...recentPulls(r.recentPulls, today), ...recentWork(r.recentCommits, today)])
    if (!work.length && !Object.keys(socials).length) continue
    const [recent] = await db
      .select({ id: s.contentItem.id })
      .from(s.contentItem)
      .where(and(eq(s.contentItem.projectId, p.id), eq(s.contentItem.kind, 'social'), gt(s.contentItem.createdAt, since)))
      .limit(1)
    if (recent) continue
    const platform = socials.instagram ? 'instagram' : preferredPlatform(socials)
    const note = work.length
      ? buildNote(p.name, work)
      : `Eén post voor deze week die past bij de fase en de open criteria van ${p.name} (zie het kompas en het profiel). Concreet en echt, geen reclame.`.slice(0, 300)
    const ticket = createTicket({ task: 'posts', projectId: p.id, options: { platform, note } })
    const { started: ok } = await runHeadless(launchPrompt(ticket))
    if (ok) {
      await setSetting(db, ownerId, key, today)
      started.push(p.name)
    }
  }
  return started
}

/**
 * "Plan de week": a project with socials and nothing planned for the coming days gets a week of posts,
 * each on a day (Claude picks the days). Once a week per project, at most two projects a day.
 */
export async function maybePlanWeek(db: Db, ownerId: string, now = new Date()): Promise<string[]> {
  if (!(await autopilotOn(db, ownerId))) return []
  const today = dayOf(now)
  if (weekdayOf(today) > 5 || hourOf(now) < 7) return []
  const week = weekStart(today)
  const projects = await db.select().from(s.project).where(eq(s.project.ownerId, ownerId))
  const started: string[] = []
  for (const p of projects) {
    if (started.length >= 2 || /marketing staat uit/i.test(`${p.what} ${p.redLines}`)) continue
    const socials = socialsOf(p.links)
    if (!Object.keys(socials).length) continue
    const key = `plan_week_${p.id}`
    if ((await getSetting(db, ownerId, key)) === week) continue
    // Not on a day the single post for this project was started: one Claude run per project a day.
    if ((await getSetting(db, ownerId, `build_post_${p.id}`)) === today) continue
    const [{ n }] = await db
      .select({ n: count() })
      .from(s.contentItem)
      .where(and(eq(s.contentItem.projectId, p.id), eq(s.contentItem.kind, 'social'), eq(s.contentItem.status, 'planned'), gte(s.contentItem.plannedFor, today)))
    if (n >= 2) continue
    const platform = socials.instagram ? 'instagram' : preferredPlatform(socials)
    const note = `Plan de week: drie posts voor ${p.name}, elk op een andere dag in de komende zeven dagen. Mix: één die helpt of leert, één achter de schermen (wat er gebouwd is), één met een vraag aan de doelgroep. Echt, geen reclame.`.slice(0, 300)
    // Claim the week first, so a second round that starts at the same time skips this project.
    await setSetting(db, ownerId, key, week)
    const ticket = createTicket({ task: 'posts', projectId: p.id, options: { platform, note } })
    if ((await runHeadless(launchPrompt(ticket))).started) started.push(p.name)
    else await setSetting(db, ownerId, key, null)
  }
  return started
}

/**
 * Money stays current by itself: when nothing about money is known yet, and then once a month, Claude
 * reads his documents (read-only, no web) and writes down costs, prices and dates. Working days from 7:00.
 */
export async function maybeMoneyRound(db: Db, ownerId: string, now = new Date()): Promise<'not-now' | 'done-already' | 'started' | 'failed'> {
  if (!(await autopilotOn(db, ownerId))) return 'not-now'
  const today = dayOf(now)
  if (weekdayOf(today) > 5 || hourOf(now) < 7) return 'not-now'
  const last = await getSetting(db, ownerId, 'money_round')
  const [{ n }] = await db.select({ n: count() }).from(s.moneyItem).where(eq(s.moneyItem.ownerId, ownerId))
  if (last && (n > 0 ? daysBetween(last, today) < 30 : last === today)) return 'done-already'
  await setSetting(db, ownerId, 'money_round', today)
  const ticket = createTicket({ task: 'money', projectId: null, options: {} })
  if ((await runHeadless(launchPrompt(ticket), { read: true })).started) return 'started'
  await setSetting(db, ownerId, 'money_round', last)
  return 'failed'
}
