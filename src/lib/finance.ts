// Everything about money for his businesses in one place: what he pays (subscriptions, domains), what
// comes in, the prices he asks, spending that waits for his decision, and the dates to watch (a renewal,
// a tax return). Claude fills it from his own documents and his own word wins. The cockpit only adds up
// and reminds: paying is always his.

import { daysBetween } from './dates'

export const MONEY_KINDS = ['cost', 'income', 'price', 'plan', 'deadline'] as const
export type MoneyKind = (typeof MONEY_KINDS)[number]
export const MONEY_PERIODS = ['month', 'quarter', 'year', 'once'] as const
export type MoneyPeriod = (typeof MONEY_PERIODS)[number]
export const MONEY_STATUSES = ['active', 'proposed', 'stopped'] as const
export type MoneyStatus = (typeof MONEY_STATUSES)[number]
export const CURRENCIES = ['EUR', 'USD'] as const
export type Currency = (typeof CURRENCIES)[number]

/** Dollars in euros, roughly: enough to add up, not for the books. */
export const USD_IN_EUR = 0.92

export interface MoneyItem {
  id: string
  projectId: string | null
  /** The project's name, or null for the business as a whole. */
  project: string | null
  kind: MoneyKind
  title: string
  /** Per period, in its own currency; null when nobody knows it yet. */
  amount: number | null
  currency: Currency
  period: MoneyPeriod
  /** The next renewal, due date or decision day. */
  nextDate: string | null
  status: MoneyStatus
  note: string
  source: 'jij' | 'claude'
}

export const KIND_LABEL: Record<MoneyKind, string> = { cost: 'Kosten', income: 'Inkomsten', price: 'Prijs', plan: 'Voorstel', deadline: 'Datum' }
export const PERIOD_LABEL: Record<MoneyPeriod, string> = { month: 'per maand', quarter: 'per kwartaal', year: 'per jaar', once: 'eenmalig' }

const MONTHS_IN: Record<MoneyPeriod, number> = { month: 1, quarter: 3, year: 12, once: 0 }

export const inEuro = (amount: number, currency: Currency) => (currency === 'USD' ? amount * USD_IN_EUR : amount)

/** Euros per month: a yearly amount spread over twelve months; a one-time amount is no monthly cost. */
export function perMonth(item: Pick<MoneyItem, 'amount' | 'currency' | 'period'>): number {
  if (item.amount == null || item.period === 'once') return 0
  return inEuro(item.amount, item.currency) / MONTHS_IN[item.period]
}

const fmt = (amount: number, currency: Currency) =>
  new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'nl-NL', { style: 'currency', currency, maximumFractionDigits: Number.isInteger(amount) ? 0 : 2 }).format(amount)

/** "€20 per maand", "$99 per jaar", "bedrag onbekend". */
export function amountText(item: Pick<MoneyItem, 'amount' | 'currency' | 'period'>): string {
  if (item.amount == null) return 'bedrag onbekend'
  return `${fmt(item.amount, item.currency)} ${PERIOD_LABEL[item.period]}`
}

export interface MoneyPicture {
  /** Euros a month for what he pays now. */
  costsPerMonth: number
  /** Costs he pays without a known amount: the real total is higher by these. */
  unknownCosts: number
  /** Euros a month that come in: his own income lines, or a connected source's MRR. */
  incomePerMonth: number
  balance: number
  /** How many paying customers cover the fixed costs, at his best monthly price. */
  breakEven: { title: string; project: string | null; price: number; customers: number } | null
}

/**
 * The month in one picture. Income counts his own lines first; a project without them counts the MRR of
 * its connected source (Stripe, Mollie), so a customer is never counted twice.
 */
export function moneyPicture(items: readonly MoneyItem[], mrr: Readonly<Record<string, number>> = {}): MoneyPicture {
  const active = items.filter((i) => i.status === 'active')
  const costs = active.filter((i) => i.kind === 'cost')
  const income = active.filter((i) => i.kind === 'income')
  const withIncome = new Set(income.map((i) => i.projectId))
  const costsPerMonth = costs.reduce((t, i) => t + perMonth(i), 0)
  const incomePerMonth = income.reduce((t, i) => t + perMonth(i), 0) + Object.entries(mrr).reduce((t, [id, v]) => t + (withIncome.has(id) ? 0 : Math.max(0, v)), 0)
  const best = active
    .filter((i) => i.kind === 'price' && i.period === 'month' && (i.amount ?? 0) > 0)
    .sort((a, b) => perMonth(b) - perMonth(a))[0]
  return {
    costsPerMonth: round(costsPerMonth),
    unknownCosts: costs.filter((i) => i.amount == null && i.period !== 'once').length,
    incomePerMonth: round(incomePerMonth),
    balance: round(incomePerMonth - costsPerMonth),
    breakEven: best && costsPerMonth > 0 ? { title: best.title, project: best.project, price: round(perMonth(best)), customers: Math.max(1, Math.ceil(costsPerMonth / perMonth(best))) } : null,
  }
}

const round = (n: number) => Math.round(n * 100) / 100

/** Renewals, due dates and decisions within `days`, and the ones that passed in the last two weeks. */
export function upcoming(items: readonly MoneyItem[], today: string, days = 30): MoneyItem[] {
  return items
    .filter((i) => i.status !== 'stopped' && i.nextDate && (i.kind === 'cost' || i.kind === 'deadline' || i.kind === 'plan'))
    .filter((i) => {
      const d = daysBetween(today, i.nextDate!)
      // A one-time cost on a day that passed was simply paid; nothing to remind.
      if (i.kind === 'cost' && i.period === 'once' && d < 0) return false
      return d >= -14 && d <= days
    })
    .sort((a, b) => a.nextDate!.localeCompare(b.nextDate!))
}

/** The same day some months later, on the last day of a shorter month (31 Jan + 1 month = 28 Feb). */
function addMonthsToDay(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number)
  const last = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate()
  return new Date(Date.UTC(y, m - 1 + n, Math.min(d, last))).toISOString().slice(0, 10)
}

/** The next date of something that comes back; null for a one-time thing. */
export function nextAfter(date: string, period: MoneyPeriod): string | null {
  return period === 'once' ? null : addMonthsToDay(date, MONTHS_IN[period])
}

/** "vandaag", "morgen", "over 5 dagen", "3 dagen geleden". */
export function whenText(today: string, date: string): string {
  const d = daysBetween(today, date)
  if (d === 0) return 'vandaag'
  if (d === 1) return 'morgen'
  if (d === -1) return 'gisteren'
  return d > 0 ? `over ${d} dagen` : `${-d} dagen geleden`
}

/** The money picture as short lines for Claude (`<money>`), so the coach weighs what a step costs and brings in. */
export function moneyLines(items: readonly MoneyItem[], today: string, picture = moneyPicture(items)): string[] {
  const label = (i: MoneyItem) => `${i.title}${i.project ? ` (${i.project})` : ''}: ${amountText(i)}`
  const active = items.filter((i) => i.status === 'active')
  const lines: string[] = []
  const costs = active.filter((i) => i.kind === 'cost' && i.period !== 'once')
  if (costs.length)
    lines.push(`Fixed costs, about €${Math.round(picture.costsPerMonth)} a month${picture.unknownCosts ? ` plus ${picture.unknownCosts} without a known amount` : ''}: ${costs.map(label).join('; ')}`)
  const income = active.filter((i) => i.kind === 'income')
  lines.push(picture.incomePerMonth > 0 ? `Income, about €${Math.round(picture.incomePerMonth)} a month${income.length ? `: ${income.map(label).join('; ')}` : ' (from the connected payment source)'}` : 'Income: nothing comes in yet')
  const prices = active.filter((i) => i.kind === 'price')
  if (prices.length) lines.push(`His prices: ${prices.map(label).join('; ')}`)
  if (picture.breakEven) lines.push(`Break-even: ${picture.breakEven.customers} paying customer${picture.breakEven.customers === 1 ? '' : 's'} at €${Math.round(picture.breakEven.price)} a month (${picture.breakEven.title}) cover the fixed costs`)
  const soon = upcoming(items, today, 30)
  if (soon.length) lines.push(`Coming up: ${soon.map((i) => `${i.title} on ${i.nextDate} (${amountText(i)})`).join('; ')}`)
  const plans = items.filter((i) => i.kind === 'plan' && i.status === 'proposed')
  if (plans.length) lines.push(`Spending that waits for his decision: ${plans.map(label).join('; ')}`)
  return lines
}
