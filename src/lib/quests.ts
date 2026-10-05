import { addDays, addMonths, monthLabel, monthStart, weekStart } from './dates'

export const RECURRENCES = ['none', 'weekly', 'monthly', 'quarterly', 'yearly'] as const
export type Recurrence = (typeof RECURRENCES)[number]
export const RECURRENCE_LABELS: Record<Recurrence, string> = {
  none: 'Eenmalig',
  weekly: 'Elke week',
  monthly: 'Elke maand',
  quarterly: 'Elk kwartaal',
  yearly: 'Elk jaar',
}
export const isRecurrence = (v: unknown): v is Recurrence => typeof v === 'string' && (RECURRENCES as readonly string[]).includes(v)

/** The next due day of a recurring quest; months keep their day where they can (31 Jan → 28 Feb). */
export function nextDue(due: string, recurrence: Recurrence): string | null {
  if (recurrence === 'none') return null
  if (recurrence === 'weekly') return addDays(due, 7)
  const months = recurrence === 'monthly' ? 1 : recurrence === 'quarterly' ? 3 : 12
  const target = addMonths(monthStart(due), months)
  const lastDay = addDays(addMonths(target, 1), -1)
  const day = Math.min(Number(due.slice(8, 10)), Number(lastDay.slice(8, 10)))
  return `${target.slice(0, 8)}${String(day).padStart(2, '0')}`
}

export interface RuleProject {
  id: string
  name: string
  active: boolean
  intakeDone: boolean
  hasPlan: boolean
  /** Days since the last commit or action, or null when nothing ever happened. */
  quietDays: number | null
  hasMetricsLastMonth: boolean
  syncError: boolean
  /** For the growth rules: the stage, whether a growth model is set, and sources that keep failing. */
  stage?: string
  hasModel?: boolean
  failingSources?: { id: string; label: string; error: string }[]
}

export interface QuestCandidate {
  sourceKey: string
  projectId: string | null
  title: string
  detail: string
  xp: number
  dueOn: string | null
}

/**
 * Quests that follow from the state of things, without AI: finish an intake, get a plan, decide
 * about a quiet project, fill in last month's numbers, fix GitHub. Each has a key per period, so
 * it comes once and only comes back when it applies again.
 */
export function ruleQuests(projects: readonly RuleProject[], today: string, aiAvailable: boolean): QuestCandidate[] {
  const out: QuestCandidate[] = []
  const lastMonth = addMonths(monthStart(today), -1)
  const earlyInMonth = Number(today.slice(8, 10)) <= 10
  for (const p of projects) {
    if (!p.active) continue
    if (!p.intakeDone) {
      out.push({
        sourceKey: `intake:${p.id}`,
        projectId: p.id,
        title: `Vul de intake van ${p.name} in`,
        detail: 'Vijf vragen: wat, voor wie, doel, rode lijnen. Daar haalt alle marketing zijn kennis uit.',
        xp: 25,
        dueOn: today,
      })
    }
    if (aiAvailable && p.intakeDone && !p.hasPlan) {
      out.push({
        sourceKey: `plan:${p.id}`,
        projectId: p.id,
        title: `Laat Claude een marketingplan maken voor ${p.name}`,
        detail: 'Profiel en een plan voor 30, 60 en 90 dagen; de acties worden quests.',
        xp: 25,
        dueOn: null,
      })
    }
    if (p.quietDays !== null && p.quietDays >= 14) {
      out.push({
        sourceKey: `quiet:${p.id}:${weekStart(today)}`,
        projectId: p.id,
        title: `${p.name} ligt al ${p.quietDays} dagen stil: kies`,
        detail: 'Pak het op met één kleine stap, of zet het bewust op pauze. Allebei is goed, twijfelen niet.',
        xp: 25,
        dueOn: addDays(today, 3),
      })
    }
    if (p.intakeDone && p.hasModel === false && (p.stage === 'growth' || p.stage === 'launch')) {
      out.push({
        sourceKey: `model:${p.id}`,
        projectId: p.id,
        title: `Zet een groeidoel voor ${p.name}`,
        detail: 'Eén doelcijfer met een deadline en de trechter ernaartoe. Claude stelt het voor onder Cijfers; jij neemt het over.',
        xp: 25,
        dueOn: addDays(today, 3),
      })
    }
    for (const source of p.failingSources ?? []) {
      out.push({
        sourceKey: `source:${source.id}:${weekStart(today)}`,
        projectId: p.id,
        title: `${source.label} van ${p.name} levert geen cijfers`,
        detail: `${source.error} Kijk de bron na onder Cijfers.`,
        xp: 10,
        dueOn: null,
      })
    }
    if (earlyInMonth && !p.hasMetricsLastMonth) {
      out.push({
        sourceKey: `metrics:${p.id}:${lastMonth}`,
        projectId: p.id,
        title: `Cijfers van ${monthLabel(lastMonth)} voor ${p.name}`,
        detail: 'Omzet, kosten of gebruikers: één getal is genoeg voor je overzicht.',
        xp: 10,
        dueOn: `${today.slice(0, 8)}10`,
      })
    }
  }
  if (projects.some((p) => p.syncError)) {
    out.push({
      sourceKey: `github:${weekStart(today)}`,
      projectId: null,
      title: 'GitHub leest niet alles: kijk de token na',
      detail: 'Een repo gaf een fout. Verlopen token, of mist de token toegang tot een repo?',
      xp: 10,
      dueOn: null,
    })
  }
  return out
}

/** An experiment whose time is up: measure it and say whether it worked, so the lesson is not lost. */
export function experimentQuests(running: { id: string; projectId: string | null; title: string; endsOn: string | null }[], today: string): QuestCandidate[] {
  return running
    .filter((e) => e.endsOn && e.endsOn <= today)
    .map((e) => ({
      sourceKey: `experiment-end:${e.id}`,
      projectId: e.projectId,
      title: `Rond af: ${e.title}`.slice(0, 120),
      detail: 'De tijd is om. Kijk wat de cijfers deden, zeg of het werkte en wat je leerde; dat gaat mee in elke volgende klus van Claude.',
      xp: 10,
      dueOn: today,
    }))
}

export type QuestBucket = 'overdue' | 'today' | 'week' | 'later' | 'someday'

/** Where an open quest belongs on the board. */
export function bucketOf(dueOn: string | null, today: string): QuestBucket {
  if (!dueOn) return 'someday'
  if (dueOn < today) return 'overdue'
  if (dueOn === today) return 'today'
  return dueOn <= addDays(today, 6) ? 'week' : 'later'
}

/** Rule quests about a state (an intake, a plan, a growth target) that settle themselves once it is there. */
const SETTLES = ['intake:', 'plan:', 'model:']

/**
 * The open rule quests whose reason is gone: the intake was filled in, the plan or the growth target
 * exists. They close by themselves (no XP: that came with the thing itself), so nothing stale lingers.
 */
export function settledRuleKeys(openKeys: readonly string[], candidates: readonly { sourceKey: string }[]): string[] {
  const still = new Set(candidates.map((c) => c.sourceKey))
  return openKeys.filter((k) => SETTLES.some((prefix) => k.startsWith(prefix)) && !still.has(k))
}
