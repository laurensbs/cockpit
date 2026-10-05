// The numbers the cockpit knows, and how each one adds up. Some are flows (visitors, leads, revenue:
// they add up over days), others are levels (MRR, members, users: only the latest value counts). And
// sources combine differently: Stripe and Mollie revenue add up, Plausible and GA visitors do not (one
// is preferred). Pure, so rollups, pace and funnels are predictable and testable.

import { addDays, daysBetween, monthStart, weekStart } from './dates'
import { formatEuro, formatNumber } from './time'

export type Agg = 'sum' | 'last'
export type Combine = 'sum' | 'prefer'

export interface MetricDef {
  label: string
  unit: 'eur' | 'count'
  agg: Agg
  combine: Combine
}

export const METRIC_DEFS = {
  revenue: { label: 'Omzet (€)', unit: 'eur', agg: 'sum', combine: 'sum' },
  costs: { label: 'Kosten (€)', unit: 'eur', agg: 'sum', combine: 'sum' },
  mrr: { label: 'MRR (€)', unit: 'eur', agg: 'last', combine: 'sum' },
  customers: { label: 'Klanten', unit: 'count', agg: 'last', combine: 'sum' },
  visitors: { label: 'Bezoekers', unit: 'count', agg: 'sum', combine: 'prefer' },
  pageviews: { label: 'Paginaweergaven', unit: 'count', agg: 'sum', combine: 'prefer' },
  search_clicks: { label: 'Kliks uit Google', unit: 'count', agg: 'sum', combine: 'prefer' },
  search_impressions: { label: 'Vertoningen in Google', unit: 'count', agg: 'sum', combine: 'prefer' },
  leads: { label: 'Leads', unit: 'count', agg: 'sum', combine: 'prefer' },
  meetings: { label: 'Gesprekken', unit: 'count', agg: 'sum', combine: 'prefer' },
  offers: { label: 'Offertes', unit: 'count', agg: 'sum', combine: 'prefer' },
  deals_won: { label: 'Deals gewonnen', unit: 'count', agg: 'sum', combine: 'prefer' },
  signups: { label: 'Aanmeldingen', unit: 'count', agg: 'sum', combine: 'prefer' },
  users: { label: 'Gebruikers', unit: 'count', agg: 'last', combine: 'prefer' },
  active_users: { label: 'Actieve gebruikers', unit: 'count', agg: 'last', combine: 'prefer' },
  followers: { label: 'Volgers', unit: 'count', agg: 'last', combine: 'prefer' },
  discord_members: { label: 'Discord-leden', unit: 'count', agg: 'last', combine: 'prefer' },
  discord_online: { label: 'Discord online', unit: 'count', agg: 'last', combine: 'prefer' },
  instagram_followers: { label: 'Volgers Instagram', unit: 'count', agg: 'last', combine: 'prefer' },
  tiktok_followers: { label: 'Volgers TikTok', unit: 'count', agg: 'last', combine: 'prefer' },
  linkedin_followers: { label: 'Volgers LinkedIn', unit: 'count', agg: 'last', combine: 'prefer' },
  social_reach: { label: 'Bereik van posts', unit: 'count', agg: 'sum', combine: 'prefer' },
} as const satisfies Record<string, MetricDef>

export type MetricKey = keyof typeof METRIC_DEFS
export const METRIC_KEYS = Object.keys(METRIC_DEFS) as [MetricKey, ...MetricKey[]]
export const isMetricKey = (v: unknown): v is MetricKey => typeof v === 'string' && v in METRIC_DEFS
export const metricLabel = (key: string) => (isMetricKey(key) ? METRIC_DEFS[key].label : key)
/** The name in running text, without the unit: "MRR", not "MRR (€)". */
export const metricName = (key: string) => metricLabel(key).replace(/ \(€\)$/, '')

/** Who said so. A number he typed beats Claude, Claude beats a connector, connectors beat the pipeline. */
export const SOURCES = ['manual', 'claude', 'stripe', 'mollie', 'plausible', 'ga4', 'gsc', 'discord', 'app', 'instagram', 'tiktok', 'posts', 'pipeline'] as const
export type Source = (typeof SOURCES)[number]
export const SOURCE_LABELS: Record<Source, string> = {
  manual: 'Jij',
  claude: 'Claude',
  stripe: 'Stripe',
  mollie: 'Mollie',
  plausible: 'Plausible',
  ga4: 'Google Analytics',
  gsc: 'Search Console',
  discord: 'Discord',
  app: 'Eigen app',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  posts: 'Je posts',
  pipeline: 'Pijplijn',
}
const rank = (source: string) => {
  const i = (SOURCES as readonly string[]).indexOf(source)
  return i === -1 ? SOURCES.length : i
}

export interface Point {
  day: string
  value: number
  source: string
}

/** Formats a value the way its metric reads: euros or a plain count. */
export function formatMetric(key: string, value: number): string {
  return isMetricKey(key) && METRIC_DEFS[key].unit === 'eur' ? formatEuro(value) : formatNumber(value)
}

/**
 * One value per day. What he typed (or Claude recorded) replaces the day; otherwise the sources add up
 * or the most trusted one wins, depending on the metric.
 */
export function resolveDaily(points: Point[], def: MetricDef): Map<string, number> {
  const byDay = new Map<string, Point[]>()
  for (const p of points) byDay.set(p.day, [...(byDay.get(p.day) ?? []), p])
  const out = new Map<string, number>()
  for (const day of [...byDay.keys()].sort()) {
    const list = byDay.get(day)!.slice().sort((a, b) => rank(a.source) - rank(b.source))
    const override = list.find((p) => p.source === 'manual') ?? list.find((p) => p.source === 'claude')
    // Won deals from the pipeline only count where no payment source says anything that day.
    const real = list.filter((p) => p.source !== 'pipeline')
    if (override) out.set(day, override.value)
    else if (def.combine === 'sum') out.set(day, (real.length ? real : list).reduce((sum, p) => sum + p.value, 0))
    else out.set(day, list[0].value)
  }
  return out
}

/** The latest value on or before the day, with its day. */
export function lastOnOrBefore(daily: Map<string, number>, day: string): { day: string; value: number } | null {
  let best: { day: string; value: number } | null = null
  for (const [d, value] of daily) if (d <= day && (!best || d > best.day)) best = { day: d, value }
  return best
}

/** Sum of the days from `from` up to and including `to`; null when there is no day in between. */
export function sumBetween(daily: Map<string, number>, from: string, to: string): number | null {
  let sum: number | null = null
  for (const [d, value] of daily) if (d >= from && d <= to) sum = (sum ?? 0) + value
  return sum
}

/** The Mondays of the last `count` full weeks before the week of `today`, oldest first. */
export function lastWeeks(today: string, count: number): string[] {
  const current = weekStart(today)
  return Array.from({ length: count }, (_, i) => addDays(current, -7 * (count - i)))
}

/** Per week: the total of a flow, or the value of a level at the end of the week. Null for an empty week. */
export function bucketWeeks(daily: Map<string, number>, def: MetricDef, weeks: string[]): (number | null)[] {
  return weeks.map((monday) => {
    const sunday = addDays(monday, 6)
    if (def.agg === 'sum') return sumBetween(daily, monday, sunday)
    const last = lastOnOrBefore(daily, sunday)
    return last && last.day >= monday ? last.value : null
  })
}

/**
 * What flowed in per week: a flow's weekly total, or for a level its growth that week (end of week minus
 * end of the week before). Used by the funnel, which counts what moved, not what stands.
 */
export function weeklyFlow(daily: Map<string, number>, def: MetricDef, weeks: string[]): (number | null)[] {
  if (def.agg === 'sum') return bucketWeeks(daily, def, weeks)
  return weeks.map((monday) => {
    const end = lastOnOrBefore(daily, addDays(monday, 6))
    const before = lastOnOrBefore(daily, addDays(monday, -1))
    if (!end || end.day < monday || !before) return null
    return Math.max(0, end.value - before.value)
  })
}

/** Per month ('YYYY-MM-01'): the total of a flow, or the last value of a level. */
export function monthRollup(daily: Map<string, number>, def: MetricDef): Map<string, number> {
  const out = new Map<string, number>()
  const lastDay = new Map<string, string>()
  for (const day of [...daily.keys()].sort()) {
    const month = monthStart(day)
    const value = daily.get(day)!
    if (def.agg === 'sum') out.set(month, (out.get(month) ?? 0) + value)
    else if (!lastDay.has(month) || day > lastDay.get(month)!) {
      out.set(month, value)
      lastDay.set(month, day)
    }
  }
  return out
}

/**
 * Keeps only points that can be true: a known metric, a real day that is not in the future and not more
 * than 400 days back, a finite value within ±1e9. Returns why the others were left out.
 */
export function normalizePoints<T extends { key: string; day: string; value: number }>(points: T[], today: string): { ok: T[]; rejected: { point: T; why: string }[] } {
  const ok: T[] = []
  const rejected: { point: T; why: string }[] = []
  for (const point of points) {
    const why = !isMetricKey(point.key)
      ? `onbekend cijfer "${point.key}"`
      : !/^\d{4}-\d{2}-\d{2}$/.test(point.day) || Number.isNaN(Date.parse(`${point.day}T00:00:00Z`))
        ? 'geen geldige dag'
        : point.day > today
          ? 'een dag in de toekomst'
          : daysBetween(point.day, today) > 400
            ? 'meer dan 400 dagen geleden'
            : !Number.isFinite(point.value) || Math.abs(point.value) > 1e9
              ? 'geen geldig getal'
              : null
    if (why) rejected.push({ point, why })
    else ok.push(point)
  }
  return { ok, rejected }
}

/** A conversion as a Dutch percentage: one decimal below 10% ("0,6%"), whole above ("44%"). */
export function formatPct(rate: number): string {
  const pct = rate * 100
  return `${pct.toLocaleString('nl-NL', { maximumFractionDigits: pct < 10 ? 1 : 0 })}%`
}
