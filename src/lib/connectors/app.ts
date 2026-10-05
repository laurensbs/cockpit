// His own apps: each one answers a small stats address with its numbers, in this shape:
//   { "day": "2026-10-04", "metrics": { "users": 412, "signups": 9 } }
// or with history:
//   { "series": [ { "day": "2026-10-03", "metrics": { "signups": 7 } }, … ] }
// Only keys from the cockpit's catalog count; the rest is listed so he can fix the app. Pure.

import { z } from 'zod'
import { isMetricKey } from '../metrics'

const metrics = z.record(z.string(), z.number())

export const AppStatsWire = z.object({
  day: z.string().optional(),
  metrics: metrics.optional(),
  series: z.array(z.object({ day: z.string(), metrics })).max(400).optional(),
})

/** The answer as points (today for a bare "metrics"), and which keys were not understood. */
export function appPoints(input: unknown, today: string): { points: { key: string; day: string; value: number }[]; unknown: string[] } | { error: string } {
  const parsed = AppStatsWire.safeParse(input)
  if (!parsed.success) return { error: 'Het antwoord van de app heeft niet de vorm { "metrics": { … } } of { "series": [ … ] }.' }
  const rows = [...(parsed.data.series ?? []), ...(parsed.data.metrics ? [{ day: parsed.data.day ?? today, metrics: parsed.data.metrics }] : [])]
  const points: { key: string; day: string; value: number }[] = []
  const unknown = new Set<string>()
  for (const row of rows) {
    for (const [key, value] of Object.entries(row.metrics)) {
      if (isMetricKey(key)) points.push({ key, day: row.day.slice(0, 10), value })
      else unknown.add(key)
    }
  }
  return { points, unknown: [...unknown].sort() }
}

/** Only https, except a server on this computer. */
export function checkAppUrl(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.protocol === 'https:') return null
    if (u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')) return null
    return 'Het adres moet met https:// beginnen.'
  } catch {
    return 'Dat is geen geldig adres.'
  }
}
