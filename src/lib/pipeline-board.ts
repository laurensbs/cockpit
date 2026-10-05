// The pipeline board: where each answered contact stands (lead, meeting, offer, won, lost), what the
// open deals are worth, which next step is due, and, when he wants that, won deals as revenue. Pure,
// so the board, the quests and the tests agree.

import type { QuestCandidate } from './quests'
import { formatEuro } from './time'

export const BOARD_STAGES = ['replied', 'meeting', 'offer', 'won', 'lost'] as const
export type BoardStage = (typeof BOARD_STAGES)[number]
export const BOARD_LABELS: Record<BoardStage, string> = { replied: 'Lead', meeting: 'Gesprek', offer: 'Offerte', won: 'Gewonnen', lost: 'Verloren' }
export const OPEN_STAGES: readonly BoardStage[] = ['replied', 'meeting', 'offer']
export const isBoardStage = (v: unknown): v is BoardStage => typeof v === 'string' && (BOARD_STAGES as readonly string[]).includes(v)

const FLOW: BoardStage[] = ['replied', 'meeting', 'offer', 'won']

/** One step on: lead → meeting → offer → won. Null at the end. */
export function nextStage(stage: string): BoardStage | null {
  const i = FLOW.indexOf(stage as BoardStage)
  return i >= 0 && i < FLOW.length - 1 ? FLOW[i + 1] : null
}

/** One step back; a lost deal reopens as a lead. */
export function prevStage(stage: string): BoardStage | null {
  if (stage === 'lost') return 'replied'
  const i = FLOW.indexOf(stage as BoardStage)
  return i > 0 ? FLOW[i - 1] : null
}

/** The button that takes a deal one step on, in his words. */
export const NEXT_LABELS: Record<string, string> = { replied: 'Gesprek gepland', meeting: 'Offerte gestuurd', offer: 'Gewonnen!' }

export interface Deal {
  id: string
  organization: string
  status: string
  value: number | null
  period: string | null
  nextStep: string
  nextStepOn: string | null
}

export interface Worth {
  monthly: number
  once: number
}

export function worthOf(deals: Pick<Deal, 'value' | 'period'>[]): Worth {
  const out = { monthly: 0, once: 0 }
  for (const d of deals) {
    if (d.value == null) continue
    if (d.period === 'once') out.once += d.value
    else out.monthly += d.value
  }
  return out
}

/** "€ 450 per maand + € 2.000 eenmalig". */
export const worthText = (w: Worth) =>
  [w.monthly ? `${formatEuro(w.monthly)} per maand` : null, w.once ? `${formatEuro(w.once)} eenmalig` : null].filter(Boolean).join(' + ') || 'geen bedrag'

export type Due = 'late' | 'today' | 'soon' | null

/** Is the next step late, today, or within three days? */
export function dueOf(d: Pick<Deal, 'nextStepOn' | 'status'>, today: string): Due {
  if (!d.nextStepOn || !(OPEN_STAGES as readonly string[]).includes(d.status)) return null
  if (d.nextStepOn < today) return 'late'
  if (d.nextStepOn === today) return 'today'
  const [y, m, day] = today.split('-').map(Number)
  const soon = new Date(Date.UTC(y, m - 1, day + 3)).toISOString().slice(0, 10)
  return d.nextStepOn <= soon ? 'soon' : null
}

export interface BoardColumn<T extends Deal = Deal> {
  stage: BoardStage
  label: string
  deals: T[]
  worth: Worth
}

/** The columns, each with its deals (late ones first, then by date) and what they are worth. */
export function boardColumns<T extends Deal>(deals: T[]): BoardColumn<T>[] {
  return BOARD_STAGES.map((stage) => {
    const own = deals
      .filter((d) => d.status === stage)
      .sort((a, b) => (a.nextStepOn ?? '9999').localeCompare(b.nextStepOn ?? '9999') || a.organization.localeCompare(b.organization))
    return { stage, label: BOARD_LABELS[stage], deals: own, worth: worthOf(own) }
  })
}

/** A quest for every next step that is due: the deal does not wait until he remembers it. */
export function dealQuests(deals: (Deal & { projectId: string })[], today: string): QuestCandidate[] {
  return deals
    .filter((d) => d.nextStep && d.nextStepOn && d.nextStepOn <= today && (OPEN_STAGES as readonly string[]).includes(d.status))
    .map((d) => ({
      sourceKey: `deal:${d.id}:${d.nextStepOn}`,
      projectId: d.projectId,
      title: `${d.nextStep}: ${d.organization}`.slice(0, 120),
      detail: 'De volgende stap in je pijplijn (Contacten → Bord). Gedaan? Zet de deal een stap verder, of plan de volgende stap.',
      xp: 15,
      dueOn: d.nextStepOn,
    }))
}

/**
 * Won deals as revenue, for a project without Stripe or Mollie: MRR is the sum of the monthly deals,
 * customers the number of won deals, and a one-off deal is revenue on the day it was won.
 */
export function wonRevenue(won: { value: number | null; period: string | null; wonOn: string }[]): { mrr: number; customers: number; revenue: Map<string, number> } {
  const revenue = new Map<string, number>()
  let mrr = 0
  for (const d of won) {
    if (d.value == null) continue
    if (d.period === 'once') revenue.set(d.wonOn, (revenue.get(d.wonOn) ?? 0) + d.value)
    else mrr += d.value
  }
  return { mrr, customers: won.length, revenue }
}
