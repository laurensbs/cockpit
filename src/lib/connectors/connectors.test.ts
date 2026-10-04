import { describe, expect, it } from 'vitest'
import { checkMollieKey, mollieInterval, mollieMrr, mollieRevenueByDay } from './mollie'
import { plausibleQuery, plausibleRows } from './plausible'
import { checkStripeKey, monthlyFactor, stripeMrr, stripeRevenueByDay } from './stripe'

describe('Stripe', () => {
  it('counts euro revenue per Amsterdam day, minus refunds', () => {
    const { points, skipped } = stripeRevenueByDay([
      { amount: 14900, amount_refunded: 0, currency: 'eur', status: 'succeeded', created: Date.UTC(2026, 8, 30, 22, 30) / 1000 }, // Oct 1, 00:30 in Amsterdam
      { amount: 5000, amount_refunded: 1000, currency: 'eur', status: 'succeeded', created: Date.UTC(2026, 8, 30, 10) / 1000 },
      { amount: 999, currency: 'usd', status: 'succeeded', created: Date.UTC(2026, 8, 30, 10) / 1000 },
      { amount: 999, currency: 'eur', status: 'failed', created: Date.UTC(2026, 8, 30, 10) / 1000 },
    ])
    expect(points).toEqual([
      { day: '2026-09-30', value: 40 },
      { day: '2026-10-01', value: 149 },
    ])
    expect(skipped).toBe(1)
  })
  it('normalizes subscriptions to MRR and counts customers once', () => {
    const price = (unit: number, interval: string, count = 1) => ({ unit_amount: unit, currency: 'eur', recurring: { interval, interval_count: count } })
    const { mrr, customers } = stripeMrr([
      { status: 'active', customer: 'cus_1', items: { data: [{ quantity: 1, price: price(14900, 'month') }] } },
      { status: 'active', customer: 'cus_1', items: { data: [{ quantity: 2, price: price(120000, 'year') }] } },
      { status: 'canceled', customer: 'cus_2', items: { data: [{ quantity: 1, price: price(14900, 'month') }] } },
    ])
    expect(mrr).toBe(149 + 200)
    expect(customers).toBe(1)
    expect(monthlyFactor('month', 3)).toBeCloseTo(1 / 3)
  })
  it('accepts only restricted keys', () => {
    expect(checkStripeKey('rk_live_abc123')).toBeNull()
    expect(checkStripeKey('sk_live_abc123')).toContain('teruggeboekt')
    expect(checkStripeKey('pk_live_abc')).toContain('rk_live_')
  })
})

describe('Mollie', () => {
  it('counts paid euro payments per Amsterdam day, minus refunds', () => {
    const { points } = mollieRevenueByDay([
      { status: 'paid', amount: { value: '149.00', currency: 'EUR' }, paidAt: '2026-09-30T23:10:00+00:00', createdAt: '2026-09-30T23:00:00+00:00' },
      { status: 'paid', amount: { value: '50.00', currency: 'EUR' }, amountRefunded: { value: '10.00', currency: 'EUR' }, paidAt: '2026-10-01T09:00:00+00:00', createdAt: '2026-10-01T09:00:00+00:00' },
      { status: 'open', amount: { value: '99.00', currency: 'EUR' }, createdAt: '2026-10-01T09:00:00+00:00' },
    ])
    expect(points).toEqual([{ day: '2026-10-01', value: 189 }])
  })
  it('reads intervals and normalizes subscriptions to MRR', () => {
    expect(mollieInterval('1 month')).toBe(1)
    expect(mollieInterval('3 months')).toBeCloseTo(1 / 3)
    expect(mollieInterval('12 months')).toBeCloseTo(1 / 12)
    expect(mollieInterval('2 weeks')).toBeCloseTo(52 / 12 / 2)
    expect(mollieInterval('soon')).toBeNull()
    const { mrr, customers } = mollieMrr([
      { status: 'active', amount: { value: '149.00', currency: 'EUR' }, interval: '1 month', customerId: 'cst_1' },
      { status: 'active', amount: { value: '1200.00', currency: 'EUR' }, interval: '12 months', customerId: 'cst_2' },
      { status: 'canceled', amount: { value: '99.00', currency: 'EUR' }, interval: '1 month', customerId: 'cst_3' },
    ])
    expect(mrr).toBe(249)
    expect(customers).toBe(2)
  })
  it('accepts only organization tokens', () => {
    expect(checkMollieKey('access_abc123')).toBeNull()
    expect(checkMollieKey('live_abc123')).toContain('teruggeboekt')
  })
})

describe('Plausible', () => {
  it('builds the day-by-day queries and reads the answer', () => {
    expect(plausibleQuery('webstability.nl', '2026-09-01', '2026-09-30')).toMatchObject({ metrics: ['visitors', 'pageviews'], dimensions: ['time:day'] })
    expect(plausibleQuery('webstability.nl', '2026-09-01', '2026-09-30', 'Contact')).toMatchObject({ metrics: ['events'], filters: [['is', 'event:goal', ['Contact']]] })
    expect(
      plausibleRows(
        {
          results: [
            { dimensions: ['2026-09-01'], metrics: [120, 300] },
            { dimensions: ['2026-09-02T00:00:00'], metrics: [80, null] },
            { dimensions: ['junk'], metrics: [1, 1] },
          ],
        },
        ['visitors', 'pageviews'],
      ),
    ).toEqual([
      { key: 'visitors', day: '2026-09-01', value: 120 },
      { key: 'pageviews', day: '2026-09-01', value: 300 },
      { key: 'visitors', day: '2026-09-02', value: 80 },
    ])
  })
})
