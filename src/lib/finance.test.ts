import { describe, expect, it } from 'vitest'
import { amountText, type MoneyItem, moneyLines, moneyPicture, nextAfter, perMonth, upcoming, whenText } from './finance'

const item = (over: Partial<MoneyItem>): MoneyItem => ({
  id: over.title ?? 'x',
  projectId: null,
  project: null,
  kind: 'cost',
  title: 'Iets',
  amount: 10,
  currency: 'EUR',
  period: 'month',
  nextDate: null,
  status: 'active',
  note: '',
  source: 'claude',
  ...over,
})

const items: MoneyItem[] = [
  item({ title: 'Hosting', amount: 20, currency: 'USD' }),
  item({ title: 'Domein', amount: 12, period: 'year', nextDate: '2026-10-12' }),
  item({ title: 'Mailbox', amount: null }),
  item({ title: 'Ontwikkelaarsaccount', amount: 25, period: 'once', currency: 'USD' }),
  item({ title: 'Opgezegd', amount: 50, status: 'stopped' }),
  item({ kind: 'price', title: 'Pakket', project: 'Voorbeeld', projectId: 'p1', amount: 69 }),
  item({ kind: 'price', title: 'Via partner', project: 'Voorbeeld', projectId: 'p1', amount: 49 }),
  item({ kind: 'plan', title: 'Jurist', amount: 1000, period: 'once', status: 'proposed' }),
  item({ kind: 'deadline', title: 'Aangifte', amount: null, period: 'quarter', nextDate: '2026-10-31' }),
]

describe('perMonth and amountText', () => {
  it('spreads a year over twelve months, converts dollars, and counts nothing for a one-time amount', () => {
    expect(perMonth(items[0])).toBeCloseTo(18.4)
    expect(perMonth(items[1])).toBe(1)
    expect(perMonth(items[3])).toBe(0)
    expect(amountText(items[0])).toBe('$20 per maand')
    expect(amountText(items[2])).toBe('bedrag onbekend')
    expect(amountText(item({ amount: 9.5 }))).toMatch(/9,50/)
  })
})

describe('moneyPicture', () => {
  it('adds up what he pays now, flags the unknown ones, and says how many customers cover it', () => {
    const p = moneyPicture(items)
    expect(p.costsPerMonth).toBeCloseTo(19.4)
    expect(p.unknownCosts).toBe(1)
    expect(p.incomePerMonth).toBe(0)
    expect(p.breakEven).toMatchObject({ title: 'Pakket', customers: 1 })
  })

  it('counts a connected MRR only for a project without its own income lines', () => {
    const own = [...items, item({ kind: 'income', title: 'Klant A', projectId: 'p1', amount: 69 })]
    expect(moneyPicture(own, { p1: 500, p2: 100 }).incomePerMonth).toBe(169)
  })

  it('needs more customers when the costs are higher', () => {
    expect(moneyPicture([item({ amount: 150 }), item({ kind: 'price', title: 'P', amount: 49 })]).breakEven?.customers).toBe(4)
  })
})

describe('dates', () => {
  it('lists what is coming within the window, and what passed in the last two weeks', () => {
    expect(upcoming(items, '2026-10-05', 30).map((i) => i.title)).toEqual(['Domein', 'Aangifte'])
    expect(upcoming(items, '2026-10-05', 7).map((i) => i.title)).toEqual(['Domein'])
    expect(upcoming(items, '2026-10-20', 7).map((i) => i.title)).toEqual(['Domein'])
    expect(upcoming(items, '2026-11-20', 7)).toEqual([])
  })

  it('moves a renewal on by its period, on the last day of a short month', () => {
    expect(nextAfter('2026-01-31', 'month')).toBe('2026-02-28')
    expect(nextAfter('2026-10-31', 'quarter')).toBe('2027-01-31')
    expect(nextAfter('2026-10-12', 'year')).toBe('2027-10-12')
    expect(nextAfter('2026-10-12', 'once')).toBeNull()
  })

  it('says when in words', () => {
    expect(whenText('2026-10-05', '2026-10-05')).toBe('vandaag')
    expect(whenText('2026-10-05', '2026-10-06')).toBe('morgen')
    expect(whenText('2026-10-05', '2026-10-12')).toBe('over 7 dagen')
    expect(whenText('2026-10-05', '2026-10-02')).toBe('3 dagen geleden')
  })
})

describe('moneyLines', () => {
  it('gives Claude the costs, the prices, the break-even, what is coming and what waits for him', () => {
    const lines = moneyLines(items, '2026-10-05').join('\n')
    expect(lines).toContain('Fixed costs, about €19 a month plus 1 without a known amount')
    expect(lines).toContain('Income: nothing comes in yet')
    expect(lines).toContain('Break-even: 1 paying customer at €69 a month (Pakket)')
    expect(lines).toContain('Domein on 2026-10-12')
    expect(lines).toMatch(/Jurist: €\s1\.000 eenmalig/)
    expect(lines).not.toContain('Opgezegd')
  })
})
