import 'server-only'
import { and, count, desc, eq, gte, inArray, isNull, lte, or } from 'drizzle-orm'
import type { Db } from '@/db'
import * as s from '@/db/schema'
import { addDays, dayOf } from '@/lib/dates'
import { ACTION_KINDS } from '@/lib/game'
import { amountText, upcoming, whenText } from '@/lib/finance'
import { costOf } from '@/lib/costs'
import { nextSetupStep } from '@/lib/setup'
import { preferredPlatform, socialsOf } from '@/lib/socials'
import { buildNote, DAY_GOAL, type DayStep, pickGivePlace, pickSteps, recentPulls, recentWork } from '@/lib/today'
import { ACTION_TASKS, actionHref, nextActions } from '@/lib/growth'
import type { NextStepGroup } from '@/components/NextSteps'
import { projectPulses } from './game'
import { EMPTY_GROWTH, growthStates } from './growth-state'
import { outcomeHref, outcomeStates } from './outcome-state'
import { loadMoney } from './finance'
import { loadSetup } from './setup-check'
import { award } from './xp'

const PLATFORM_LABEL: Record<string, string> = { linkedin: 'LinkedIn', instagram: 'Instagram', x: 'X', tiktok: 'TikTok', discord: 'Discord' }
const marketingOff = (p: { what: string; redLines: string }) => /marketing staat uit/i.test(`${p.what} ${p.redLines}`)
const short = (text: string, max = 60) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text)

/** Every step the day route could offer now, before the choice (pickSteps). */
export async function dayCandidates(db: Db, ownerId: string, growth: { title: string; projectId: string; projectName: string; href: string; task: string | null; options?: Record<string, unknown> } | null): Promise<DayStep[]> {
  const today = dayOf(new Date())
  const projects = await db.select().from(s.project).where(eq(s.project.ownerId, ownerId))
  const byId = new Map(projects.map((p) => [p.id, p]))
  const steps: DayStep[] = []

  // Calls he said yes to: due today or earlier.
  const calls = await db
    .select({ id: s.quest.id, title: s.quest.title, projectId: s.quest.projectId, sourceKey: s.quest.sourceKey })
    .from(s.quest)
    .where(and(eq(s.quest.ownerId, ownerId), eq(s.quest.status, 'open'), eq(s.quest.source, 'prospect'), lte(s.quest.dueOn, today)))
    .orderBy(s.quest.dueOn)
  const callContacts = calls.map((c) => c.sourceKey?.replace(/^prospect:/, '')).filter((id): id is string => Boolean(id))
  const contactRows = callContacts.length ? await db.select({ id: s.contact.id, phone: s.contact.phone, city: s.contact.city, email: s.contact.email }).from(s.contact).where(inArray(s.contact.id, callContacts)) : []
  // The info mail for each call, so he reads exactly what goes out when they ask for it.
  const callDrafts = callContacts.length
    ? await db
        .select({ id: s.contentItem.id, contactId: s.contentItem.contactId, body: s.contentItem.body, createdAt: s.contentItem.createdAt })
        .from(s.contentItem)
        .where(and(inArray(s.contentItem.contactId, callContacts), eq(s.contentItem.kind, 'email'), eq(s.contentItem.status, 'draft')))
        .orderBy(desc(s.contentItem.createdAt))
    : []
  for (const c of calls) {
    const contactId = c.sourceKey?.replace(/^prospect:/, '') ?? null
    const contact = contactRows.find((r) => r.id === contactId)
    const mail = callDrafts.find((d) => d.contactId === contactId)
    const body = mail?.body as { subject?: string; body?: string; followups?: unknown[] } | undefined
    steps.push({
      kind: 'call',
      key: `call-${c.id}`,
      title: short(c.title, 40),
      sub: [contact?.phone, contact?.city].filter(Boolean).join(' · '),
      projectId: c.projectId,
      questId: c.id,
      phone: contact?.phone ?? null,
      contactId,
      hasEmail: Boolean(contact?.email),
      draft: mail ? { id: mail.id, subject: body?.subject ?? '', body: body?.body ?? '', followups: body?.followups?.length ?? 0 } : null,
    })
  }

  // Businesses Claude found, waiting for yes or no.
  const waiting = await db
    .select({ projectId: s.contact.projectId, n: count() })
    .from(s.contact)
    .where(and(eq(s.contact.ownerId, ownerId), eq(s.contact.status, 'prospect'), or(isNull(s.contact.nextStepOn), lte(s.contact.nextStepOn, today))))
    .groupBy(s.contact.projectId)
  for (const w of waiting) {
    const p = byId.get(w.projectId)
    if (p) steps.push({ kind: 'prospects', key: `prospects-${p.id}`, title: `${w.n} ${w.n === 1 ? 'nieuw bedrijf' : 'nieuwe bedrijven'}`, sub: p.name, projectId: p.id, count: w.n })
  }

  // Mailed three or more days ago and no answer marked: did they answer?
  const quiet = await db
    .select({ id: s.contact.id, organization: s.contact.organization, projectId: s.contact.projectId, at: s.contact.lastContactAt })
    .from(s.contact)
    .where(and(eq(s.contact.ownerId, ownerId), eq(s.contact.status, 'sent'), lte(s.contact.lastContactAt, new Date(Date.now() - 3 * 86_400_000))))
    .orderBy(s.contact.lastContactAt)
    .limit(3)
  for (const q of quiet) steps.push({ kind: 'reply', key: `reply-${q.id}`, title: short(`Antwoordde ${q.organization}?`, 44), sub: byId.get(q.projectId)?.name ?? '', projectId: q.projectId, contactId: q.id })

  // A money date within a week (a renewal, a tax return, a decision he set a day for): the nearest one.
  const due = upcoming(await loadMoney(db, ownerId), today, 7)[0]
  if (due) {
    const kind = due.kind as 'cost' | 'deadline' | 'plan'
    const when = whenText(today, due.nextDate!)
    steps.push({
      kind: 'money',
      key: `money-${due.id}-${due.nextDate}`,
      title: short(kind === 'cost' ? `${due.title} verlengt ${when}` : kind === 'plan' ? `Beslis: ${due.title}` : `${due.title}: ${when}`, 52),
      sub: due.project ?? 'Je bedrijf',
      projectId: due.projectId,
      itemId: due.id,
      moneyKind: kind,
      amount: amountText(due),
      when,
      note: due.note,
    })
  }

  // One thing to arrange from a project's growth checklist (a Business Profile, a domain, live keys…):
  // the most useful open step of the project that needs it most, asked or explained in the lesson.
  for (const p of projects.filter((x) => !marketingOff(x))) {
    const next = nextSetupStep(await loadSetup(db, p))
    if (!next || next.item.who === 'claude') continue
    const ask = next.status === 'unknown'
    steps.push({
      kind: 'setup',
      key: `setup-${p.id}-${next.item.key}`,
      title: short(ask ? `Al geregeld: ${next.item.title.charAt(0).toLowerCase()}${next.item.title.slice(1)}?` : next.item.title, 52),
      sub: p.name,
      projectId: p.id,
      setupKey: next.item.key,
      status: ask ? 'unknown' : 'todo',
      why: next.item.why,
      steps: next.item.steps,
      cost: costOf(next.item.cost)?.text ?? null,
    })
  }

  // One bit of value in a place where his audience talks (an answer, a tip; no pitch), once a day.
  const given = await db
    .select({ refId: s.xpEvent.refId, day: s.xpEvent.day })
    .from(s.xpEvent)
    .where(and(eq(s.xpEvent.ownerId, ownerId), eq(s.xpEvent.kind, 'give'), gte(s.xpEvent.day, addDays(today, -6))))
  if (!given.some((g) => g.day === today)) {
    const places = (
      await db
        .select({ id: s.contentItem.id, title: s.contentItem.title, body: s.contentItem.body, rating: s.contentItem.rating, projectId: s.contentItem.projectId, createdAt: s.contentItem.createdAt })
        .from(s.contentItem)
        .where(and(eq(s.contentItem.ownerId, ownerId), eq(s.contentItem.kind, 'opportunity'), eq(s.contentItem.status, 'draft')))
        .orderBy(s.contentItem.createdAt)
    )
      .filter((r) => !r.projectId || (byId.get(r.projectId) && !marketingOff(byId.get(r.projectId)!)))
      .map((r) => {
        const b = r.body as { type?: string; url?: string | null; howToApproach?: string }
        return { ...r, type: b.type ?? '', url: b.url ?? null, how: b.howToApproach ?? '' }
      })
    const place = pickGivePlace(places, new Set(given.map((g) => g.refId.split(':')[0])))
    if (place?.url)
      steps.push({
        kind: 'give',
        key: `give-${place.id}-${today}`,
        title: short(`Help iemand in ${place.title}`, 48),
        sub: place.projectId ? (byId.get(place.projectId)?.name ?? '') : '',
        projectId: place.projectId,
        itemId: place.id,
        url: place.url,
        how: place.how,
      })
  }

  // A post that is ready: planned for today (or overdue), else the newest draft he did not dislike.
  const posts = await db
    .select()
    .from(s.contentItem)
    .where(and(eq(s.contentItem.ownerId, ownerId), eq(s.contentItem.kind, 'social'), inArray(s.contentItem.status, ['draft', 'planned']), gte(s.contentItem.rating, 0)))
    .orderBy(desc(s.contentItem.createdAt))
    .limit(30)
  const post = posts.find((p) => p.plannedFor && p.plannedFor <= today) ?? posts.find((p) => !p.plannedFor)
  if (post) {
    const body = post.body as { hook?: string; caption?: string; hashtags?: string[] }
    const project = post.projectId ? byId.get(post.projectId) : undefined
    const platform = post.channel || 'linkedin'
    const socials = project ? socialsOf(project.links) : {}
    const [company] = project?.companyId ? await db.select({ color: s.company.color }).from(s.company).where(eq(s.company.id, project.companyId)) : []
    steps.push({
      kind: 'post',
      key: `post-${post.id}`,
      title: `Post op ${PLATFORM_LABEL[platform] ?? platform}`,
      sub: short(body.hook || post.title),
      projectId: post.projectId,
      itemId: post.id,
      platform,
      text: [body.caption ?? '', (body.hashtags ?? []).join(' ')].filter(Boolean).join('\n\n'),
      hook: body.hook || post.title,
      profile: socials[platform as keyof typeof socials] ?? null,
      color: company?.color ?? '#5a48f5',
      projectName: project?.name ?? '',
    })
  }

  // What he built in the last two days (his GitHub sessions): one post about it, if none was made since.
  const repos = await db.select({ projectId: s.repo.projectId, recentCommits: s.repo.recentCommits, recentPulls: s.repo.recentPulls }).from(s.repo).where(and(eq(s.repo.ownerId, ownerId), eq(s.repo.includeInAi, true)))
  // Any post made in the last two days counts, also one he already posted or turned down.
  const madeSince = new Set(
    (
      await db
        .selectDistinct({ projectId: s.contentItem.projectId })
        .from(s.contentItem)
        .where(and(eq(s.contentItem.ownerId, ownerId), eq(s.contentItem.kind, 'social'), gte(s.contentItem.createdAt, new Date(`${addDays(today, -2)}T00:00:00Z`))))
    ).map((p) => p.projectId),
  )
  const work = new Map<string, string[]>()
  for (const r of repos) if (r.projectId) work.set(r.projectId, [...(work.get(r.projectId) ?? []), ...recentPulls(r.recentPulls, today), ...recentWork(r.recentCommits, today)])
  const built = [...work.entries()].filter(([id, msgs]) => msgs.length && !madeSince.has(id) && byId.get(id) && !marketingOff(byId.get(id)!)).sort((a, b) => b[1].length - a[1].length)
  for (const [id, msgs] of built) {
    const p = byId.get(id)!
    steps.push({ kind: 'build', key: `build-${id}-${today}`, title: 'Deel wat je bouwde', sub: `${p.name} · ${msgs.length} ${msgs.length === 1 ? 'commit' : 'commits'}`, projectId: id, platform: preferredPlatform(socialsOf(p.links)), note: buildNote(p.name, msgs) })
  }

  // Instagram linked but not connected, and no follower count this week: one quick question.
  const igConnected = new Set((await db.select({ projectId: s.connector.projectId }).from(s.connector).where(and(eq(s.connector.ownerId, ownerId), eq(s.connector.kind, 'instagram')))).map((c) => c.projectId))
  const counted = new Set(
    (
      await db
        .select({ projectId: s.metricPoint.projectId })
        .from(s.metricPoint)
        .where(and(eq(s.metricPoint.ownerId, ownerId), eq(s.metricPoint.key, 'followers'), gte(s.metricPoint.day, addDays(today, -6))))
    ).map((m) => m.projectId),
  )
  for (const p of projects) {
    if (!socialsOf(p.links).instagram || igConnected.has(p.id) || counted.has(p.id) || marketingOff(p)) continue
    steps.push({ kind: 'checkin', key: `checkin-${p.id}-${today}`, title: 'Hoeveel volgers op Instagram?', sub: p.name, projectId: p.id, platform: 'instagram' })
  }

  if (growth) steps.push({ kind: 'growth', key: `growth-${growth.projectId}-${growth.title}`, title: short(growth.title, 44), sub: growth.projectName, projectId: growth.projectId, href: growth.href, task: growth.task, options: growth.options })
  return steps
}

/** How many things he did today (the XP of doing), and the bonus once he reaches the day goal. */
export async function dayProgress(db: Db, ownerId: string): Promise<{ done: number; goal: number; bonus: boolean }> {
  const today = dayOf(new Date())
  const [row] = await db
    .select({ n: count() })
    .from(s.xpEvent)
    .where(and(eq(s.xpEvent.ownerId, ownerId), eq(s.xpEvent.day, today), inArray(s.xpEvent.kind, [...ACTION_KINDS])))
  const done = row?.n ?? 0
  // Awarding is once per day by itself (kind daily, refId the day): calling it again changes nothing.
  if (done >= DAY_GOAL) await award(db, ownerId, { kind: 'daily', refId: today })
  return { done, goal: DAY_GOAL, bonus: done >= DAY_GOAL }
}

type Pulses = Awaited<ReturnType<typeof projectPulses>>
type Outcomes = Awaited<ReturnType<typeof outcomeStates>>
type Growth = Awaited<ReturnType<typeof growthStates>>

/**
 * One step per project, the least healthy project first: that is where attention pays off most. What
 * the numbers say (the leak, a missing model or missing numbers) comes before the usual marketing
 * steps. The same step for several projects becomes one row.
 */
export function orderNextSteps(pulses: Pulses, outcomes: Outcomes, growth: Growth): NextStepGroup[] {
  const groups: (NextStepGroup & { fromNumbers: boolean })[] = []
  for (const p of pulses) {
    const fromNumbers = outcomes.get(p.id)?.step
    const [first] = nextActions(growth.get(p.id) ?? EMPTY_GROWTH)
    const step = fromNumbers
      ? { key: fromNumbers.key, title: fromNumbers.title, why: fromNumbers.why, href: outcomeHref(p.id, fromNumbers.place), task: fromNumbers.task, options: fromNumbers.options }
      : first
        ? { key: first.key, title: first.title, why: first.why, href: actionHref(p.id, first.tab), task: ACTION_TASKS[first.key] ?? null, options: undefined }
        : null
    if (!step) continue
    const item = { projectId: p.id, projectName: p.name, color: p.color, href: step.href, task: step.task, options: step.options }
    const same = groups.find((g) => g.title === step.title && g.why === step.why)
    if (same) same.projects.push(item)
    else groups.push({ key: `${step.key}-${groups.length}`, title: step.title, why: step.why, projects: [item], fromNumbers: Boolean(fromNumbers) })
  }
  return [...groups.filter((g) => g.fromNumbers), ...groups.filter((g) => !g.fromNumbers)]
}

/** The growth step that closes the day route: the first one of the least healthy project. */
export function growthStep(ordered: NextStepGroup[]) {
  const first = ordered[0]?.projects[0]
  return first ? { title: ordered[0].title, projectId: first.projectId, projectName: first.projectName, href: first.href, task: first.task ?? null, options: first.options } : null
}

/** The day's steps, as Vandaag and the lesson show them. */
export async function daySteps(db: Db, ownerId: string, max = 8): Promise<DayStep[]> {
  const outcomes = await outcomeStates(db, ownerId)
  const [pulses, growth] = await Promise.all([projectPulses(db, ownerId, new Date(), outcomes), growthStates(db, ownerId)])
  return pickSteps(await dayCandidates(db, ownerId, growthStep(orderNextSteps(pulses, outcomes, growth))), new Set(), max)
}
