import type { MetricKey } from './options'

/** metric values of one project: month ('YYYY-MM-01') → kind → value. */
export type MetricTable = Record<string, Partial<Record<MetricKey, number>>>

export interface MonthMoney {
  revenue: number
  costs: number
  profit: number
  known: boolean
}

/** Revenue, costs and profit for one month, added up over the given projects' metric tables. */
export function moneyFor(tables: readonly (MetricTable | undefined)[], month: string): MonthMoney {
  let revenue = 0
  let costs = 0
  let known = false
  for (const table of tables) {
    const m = table?.[month]
    if (!m) continue
    if (m.revenue != null) {
      revenue += m.revenue
      known = true
    }
    if (m.costs != null) {
      costs += m.costs
      known = true
    }
  }
  return { revenue, costs, profit: revenue - costs, known }
}
