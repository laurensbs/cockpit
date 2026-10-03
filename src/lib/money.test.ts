import { describe, expect, it } from 'vitest'
import { moneyFor } from './money'

describe('moneyFor', () => {
  it('adds up revenue and costs across projects', () => {
    const a = { '2026-10-01': { revenue: 1200, costs: 200 } }
    const b = { '2026-10-01': { revenue: 300 }, '2026-09-01': { revenue: 999 } }
    expect(moneyFor([a, b, undefined], '2026-10-01')).toEqual({ revenue: 1500, costs: 200, profit: 1300, known: true })
  })

  it('says when nothing is known for a month', () => {
    expect(moneyFor([{ '2026-10-01': { users: 50 } }], '2026-10-01')).toEqual({ revenue: 0, costs: 0, profit: 0, known: false })
  })
})
