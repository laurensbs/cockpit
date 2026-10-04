// Plausible (Stats API v2): visitors and pageviews per day, and the conversions of one goal (for
// example "Contact") as leads. Pure: the server posts the queries, these read the answers.

export interface PlausibleResult {
  results: { dimensions: string[]; metrics: (number | null)[] }[]
}

/** The query for a day-by-day series between two days; with a goal, its conversions. */
export function plausibleQuery(siteId: string, from: string, to: string, goal?: string) {
  return goal
    ? { site_id: siteId, metrics: ['events'], date_range: [from, to], dimensions: ['time:day'], filters: [['is', 'event:goal', [goal]]] }
    : { site_id: siteId, metrics: ['visitors', 'pageviews'], date_range: [from, to], dimensions: ['time:day'] }
}

/** Rows of a day-by-day answer as points, one per metric name in the order of the query. */
export function plausibleRows(result: PlausibleResult, names: string[]): { key: string; day: string; value: number }[] {
  const out: { key: string; day: string; value: number }[] = []
  for (const row of result.results ?? []) {
    const day = String(row.dimensions?.[0] ?? '').slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue
    names.forEach((key, i) => {
      const value = row.metrics?.[i]
      if (typeof value === 'number' && Number.isFinite(value)) out.push({ key, day, value })
    })
  }
  return out
}
