// From the numbers to the next step: the leak in the funnel (or the lack of a model or of numbers)
// decides what to do, and which Claude job fits. Pure, so the choice is predictable and testable.

import type { Bottleneck } from './funnel'
import type { Pace } from './pace'
import { formatMetric, formatPct, metricName } from './metrics'

/** Where the step is done: a tab of the project, or a Claude job (task + options). */
export type OutcomePlace = 'numbers' | 'contacts' | 'experiments' | 'brain'

export interface OutcomeStep {
  key: string
  title: string
  why: string
  place: OutcomePlace
  task: string | null
  options?: Record<string, unknown>
}

export interface OutcomeInput {
  hasModel: boolean
  hasProposal: boolean
  northStarKey: string | null
  pace: Pace | null
  bottleneck: Bottleneck | null
}

const pct = formatPct

/** What to do about a step that leaks, by the stage it leaks into. */
function stepPlay(to: string, from: string): Pick<OutcomeStep, 'title' | 'place' | 'task' | 'options'> {
  switch (to) {
    case 'leads':
    case 'signups':
      return { title: `Meer ${metricName(from).toLowerCase()} omzetten in ${metricName(to).toLowerCase()}`, place: 'experiments', task: 'experiments', options: { focus: to } }
    case 'meetings':
      return { title: 'Meer leads aan tafel krijgen', place: 'contacts', task: 'contact_mails' }
    case 'offers':
      return { title: 'Gesprekken omzetten in offertes', place: 'contacts', task: null }
    case 'deals_won':
    case 'customers':
      return { title: 'Meer offertes binnenhalen', place: 'contacts', task: null }
    default:
      return { title: `${metricName(to)} verbeteren`, place: 'experiments', task: 'experiments', options: { focus: to } }
  }
}

/** What to do when every step works but too little comes in at the top. */
function volumePlay(top: string): Pick<OutcomeStep, 'title' | 'place' | 'task' | 'options'> {
  switch (top) {
    case 'visitors':
    case 'pageviews':
    case 'search_clicks':
    case 'search_impressions':
      return { title: 'Meer bezoekers: zoekwoorden en een artikel', place: 'brain', task: 'seo' }
    case 'leads':
      return { title: 'Meer leads: plekken waar je klanten zitten', place: 'brain', task: 'opportunities' }
    case 'discord_members':
      return { title: 'Meer leden voor de community', place: 'experiments', task: 'experiments', options: { focus: top } }
    default:
      return { title: `Meer ${metricName(top).toLowerCase()} binnenhalen`, place: 'experiments', task: 'experiments', options: { focus: top } }
  }
}

/**
 * The one step that matters most for the outcome, or null when the numbers say all is well (then the
 * usual marketing steps follow).
 */
export function outcomeStep(input: OutcomeInput): OutcomeStep | null {
  if (!input.hasModel) {
    return input.hasProposal
      ? { key: 'model-accept', title: 'Neem je doel over', why: 'Claude stelde een doel voor, met de stappen ernaartoe; kijk het na en neem het over.', place: 'numbers', task: null }
      : { key: 'model', title: 'Kies je doel', why: 'Eén cijfer met een datum, en de stappen ernaartoe: daarna ziet Cockpit waar het vastloopt.', place: 'numbers', task: 'model' }
  }
  const { pace, bottleneck } = input
  if (pace?.status === 'no_data' || bottleneck?.kind === 'no_data') {
    const label = bottleneck?.kind === 'no_data' ? bottleneck.label : metricName(input.northStarKey ?? '')
    return { key: 'connect', title: `Koppel je cijfers voor ${label.toLowerCase()}`, why: 'Zonder cijfers kan de cockpit niet zien of je op schema ligt. Koppel een bron of vul ze in.', place: 'numbers', task: null }
  }
  const behind = pace && (pace.status === 'behind' || pace.status === 'far_behind' || pace.status === 'overdue')
  const paceWhy =
    pace && behind && pace.current != null && input.northStarKey
      ? ` ${metricName(input.northStarKey)}: ${formatMetric(input.northStarKey, pace.current)} van ${formatMetric(input.northStarKey, pace.target)}.`
      : ''
  if (bottleneck?.kind === 'step') {
    const play = stepPlay(bottleneck.to, bottleneck.from)
    return {
      key: `step-${bottleneck.to}`,
      ...play,
      why: `${bottleneck.fromLabel} → ${bottleneck.toLabel}: ${pct(bottleneck.actual)}, verwacht ${pct(bottleneck.expected)}. Daar lekt het meest.${paceWhy}`,
    }
  }
  if (bottleneck?.kind === 'volume' && (behind || bottleneck.lowData)) {
    const play = volumePlay(bottleneck.key)
    const need = bottleneck.neededPerWeek != null && bottleneck.neededPerWeek > bottleneck.perWeek ? `, nodig ~${Math.ceil(bottleneck.neededPerWeek)}` : ''
    return {
      key: `volume-${bottleneck.key}`,
      ...play,
      why: `Elke stap doet wat hij moet; er komt te weinig binnen: ~${Math.round(bottleneck.perWeek)} ${bottleneck.label.toLowerCase()} per week${need}.${paceWhy}`,
    }
  }
  return null
}
