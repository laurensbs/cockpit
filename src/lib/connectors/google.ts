// Google Analytics 4 (Data API) and Search Console: the day-by-day answers as points. Pure: the server
// asks, these read.

export interface Ga4Report {
  rows?: { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] }[]
}

export interface GscReport {
  rows?: { keys?: string[]; clicks?: number; impressions?: number }[]
}

/** GA4 writes days as 20261004. */
const gaDay = (value: string | undefined) => (value && /^\d{8}$/.test(value) ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}` : null)

/** A GA4 report by date as points, one per metric name in the order of the request. */
export function ga4Rows(report: Ga4Report, names: string[]): { key: string; day: string; value: number }[] {
  const out: { key: string; day: string; value: number }[] = []
  for (const row of report.rows ?? []) {
    const day = gaDay(row.dimensionValues?.[0]?.value)
    if (!day) continue
    names.forEach((key, i) => {
      const value = Number(row.metricValues?.[i]?.value)
      if (Number.isFinite(value)) out.push({ key, day, value })
    })
  }
  return out
}

/** A Search Console query by date as clicks and impressions from Google. */
export function gscRows(report: GscReport): { key: string; day: string; value: number }[] {
  const out: { key: string; day: string; value: number }[] = []
  for (const row of report.rows ?? []) {
    const day = row.keys?.[0]
    if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) continue
    if (typeof row.clicks === 'number') out.push({ key: 'search_clicks', day, value: row.clicks })
    if (typeof row.impressions === 'number') out.push({ key: 'search_impressions', day, value: row.impressions })
  }
  return out
}

/** A Search Console property: a domain property (sc-domain:example.nl) or a URL prefix (https://example.nl/). */
export function checkGscSite(site: string): string | null {
  return /^sc-domain:[a-z0-9.-]+\.[a-z]{2,}$/i.test(site) || /^https?:\/\/[^\s/]+\/$/.test(site) ? null : 'Een property is sc-domain:jouwsite.nl, of een adres dat op / eindigt (https://jouwsite.nl/).'
}
