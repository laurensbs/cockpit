import { describe, expect, it } from 'vitest'
import { costLines, costSummary } from './costs'

describe('costSummary', () => {
  it('counts the Apple and Google Play accounts once for all apps, and adds up the first year and the years after', () => {
    const s = costSummary([
      { name: 'Rondje Mee', open: [{ title: 'Apple Developer-account', cost: 'apple-developer' }, { title: 'In Google Play', cost: 'google-play' }] },
      { name: 'Short Stack', open: [{ title: 'Apple Developer-account', cost: 'apple-developer' }, { title: 'In de App Store', cost: null }] },
      { name: 'Teampje', open: [{ title: 'Eigen domeinnaam', cost: 'domain' }, { title: 'Google Bedrijfsprofiel', cost: null }] },
    ])
    expect(s.shared.find((l) => l.cost === 'apple-developer')?.for).toEqual(['Rondje Mee: Apple Developer-account', 'Short Stack: Apple Developer-account'])
    expect(s.projects).toEqual([{ name: 'Teampje', lines: [{ cost: 'domain', for: ['Eigen domeinnaam'] }] }])
    // Apple ~92 a year, Play 23 once, a domain 12 a year.
    expect(s.firstYear).toBe(92 + 23 + 12)
    expect(s.perYear).toBe(92 + 12)
  })

  it('shows a cost per payment (Stripe) without adding it to the totals', () => {
    const s = costSummary([{ name: 'Webstability', open: [{ title: 'Online betalen live', cost: 'stripe' }] }])
    expect(s.projects[0].lines[0].cost).toBe('stripe')
    expect(s.firstYear).toBe(0)
  })
})

describe('costLines', () => {
  it('gives Claude every checked price in one line each', () => {
    const lines = costLines()
    expect(lines.some((l) => l.startsWith('Apple Developer Program (one membership for all his apps): 99 USD per jaar'))).toBe(true)
    expect(lines).toHaveLength(9)
  })
})
