export const STAGES = ['idea', 'build', 'launch', 'growth', 'maintain', 'paused', 'archived'] as const
export type Stage = (typeof STAGES)[number]
export const STAGE_LABELS: Record<Stage, string> = {
  idea: 'Idee',
  build: 'Bouwen',
  launch: 'Lanceren',
  growth: 'Groeien',
  maintain: 'Onderhouden',
  paused: 'Gepauzeerd',
  archived: 'Archief',
}
/** Stages that count as active work (for health, quests and the overview). */
export const ACTIVE_STAGES: readonly Stage[] = ['idea', 'build', 'launch', 'growth', 'maintain']
export const isStage = (v: unknown): v is Stage => typeof v === 'string' && (STAGES as readonly string[]).includes(v)

export const COMPANY_KINDS = ['own', 'client', 'side', 'nonprofit'] as const
export type CompanyKind = (typeof COMPANY_KINDS)[number]
export const COMPANY_KIND_LABELS: Record<CompanyKind, string> = {
  own: 'Eigen bedrijf',
  client: 'Klant',
  side: 'Zijproject',
  nonprofit: 'Sociaal / non-profit',
}

export const LANGUAGES = ['nl', 'en', 'es', 'fr', 'de'] as const
export const LANGUAGE_LABELS: Record<(typeof LANGUAGES)[number], string> = {
  nl: 'Nederlands',
  en: 'Engels',
  es: 'Spaans',
  fr: 'Frans',
  de: 'Duits',
}

export const MARKETS = ['NL', 'BE', 'ES', 'DE', 'FR', 'UK', 'US', 'Online'] as const

export const COMPANY_COLORS = ['#8b7bff', '#22c55e', '#f97316', '#06b6d4', '#ec4899', '#eab308', '#ef4444', '#64748b'] as const

// The numbers live in ./metrics (the catalog: label, unit, how each adds up); these names stay for the forms.
export { isMetricKey, METRIC_KEYS, type MetricKey } from './metrics'
import { METRIC_DEFS, type MetricKey as Key } from './metrics'
export const METRIC_LABELS = Object.fromEntries(Object.entries(METRIC_DEFS).map(([k, d]) => [k, d.label])) as Record<Key, string>

export const CONTACT_STATUSES = ['new', 'drafted', 'sent', 'replied', 'meeting', 'offer', 'won', 'lost', 'no'] as const
export type ContactStatus = (typeof CONTACT_STATUSES)[number]
export const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  new: 'Nieuw',
  drafted: 'Concept klaar',
  sent: 'Gemaild',
  replied: 'Antwoord!',
  meeting: 'Gesprek',
  offer: 'Offerte',
  won: 'Gewonnen!',
  lost: 'Verloren',
  no: 'Geen interesse',
}
/** They answered (and maybe went further): worth the reply XP, and counted as answers. */
export const ANSWERED_STATUSES: readonly string[] = ['replied', 'meeting', 'offer', 'won', 'lost']
/** Nothing more goes out to them on its own: they answered, or said no. */
export const STOP_STATUSES: readonly string[] = [...ANSWERED_STATUSES, 'no']
export const isStopped = (status: string | null | undefined) => STOP_STATUSES.includes(status ?? '')
/** The pipeline stages that count in the funnel, and the number each one feeds. */
export const PIPELINE_METRICS: Record<string, 'leads' | 'meetings' | 'offers' | 'deals_won'> = { replied: 'leads', meeting: 'meetings', offer: 'offers', won: 'deals_won' }
export const CONTACT_BASIS_LABELS: Record<string, string> = {
  business: 'Zakelijk adres (gerechtvaardigd belang)',
  relation: 'Bestaande relatie',
  consent: 'Toestemming gegeven',
}
