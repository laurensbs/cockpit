import 'server-only'
import type { MetricKey, Source } from '@/lib/metrics'

export type Fetch = typeof fetch

export interface PullContext {
  config: Record<string, string>
  secret: string
  /** The owner's key shared by every project (the Google service account), or ''. */
  shared: string
  /** The first day to pull ('YYYY-MM-DD'), and today. */
  from: string
  today: string
  fetch: Fetch
}

export interface PulledPoint {
  key: MetricKey
  day: string
  value: number
  note?: string
}

export interface ConnectorField {
  name: string
  label: string
  placeholder?: string
  hint?: string
  required: boolean
  options?: { value: string; label: string }[]
}

/** A source of numbers: what it asks for, which keys it fills, and how it pulls them. */
export interface ConnectorKind {
  kind: string
  label: string
  source: Source
  /** What it delivers, for the form and for Claude. */
  delivers: MetricKey[]
  fields: ConnectorField[]
  secret: { label: string; placeholder: string; hint: string; optional?: boolean } | null
  checkSecret: (secret: string) => string | null
  /**
   * A key kept once for all projects, in the settings, and what to say while it is missing. With
   * `fallback`, a project's own key wins and the shared one is used when there is none (Plausible).
   */
  shared?: { setting: string; missing: string; fallback?: boolean }
  /** Checks the filled-in fields before they are saved. */
  checkConfig?: (config: Record<string, string>) => string | null
  /** Days to look back on the first pull, and on later pulls (to catch late data and refunds). */
  window: { first: number; again: number }
  pull: (ctx: PullContext) => Promise<{ points: PulledPoint[]; note?: string }>
}
