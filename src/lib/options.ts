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

export const METRIC_KEYS = ['revenue', 'costs', 'users', 'leads', 'followers'] as const
export type MetricKey = (typeof METRIC_KEYS)[number]
export const METRIC_LABELS: Record<MetricKey, string> = {
  revenue: 'Omzet (€)',
  costs: 'Kosten (€)',
  users: 'Gebruikers',
  leads: 'Leads',
  followers: 'Volgers',
}
export const isMetricKey = (v: unknown): v is MetricKey => typeof v === 'string' && (METRIC_KEYS as readonly string[]).includes(v)
