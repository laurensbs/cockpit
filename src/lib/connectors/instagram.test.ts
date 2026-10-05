import { describe, expect, it } from 'vitest'
import { instagramBase, instagramPoints } from './instagram'

describe('instagram', () => {
  it('talks to the right API for the kind of token', () => {
    expect(instagramBase('IGQWRabc')).toBe('https://graph.instagram.com')
    expect(instagramBase('EAAGabc')).toBe('https://graph.facebook.com')
  })

  it('reads followers for today and reach for the day each value closes', () => {
    const points = instagramPoints(
      { followers_count: 812, media_count: 40 },
      { data: [{ name: 'reach', values: [{ value: 150, end_time: '2026-10-04T07:00:00+0000' }, { value: 210, end_time: '2026-10-05T07:00:00+0000' }, { value: { a: 1 }, end_time: '2026-10-05T07:00:00+0000' }] }] },
      '2026-10-05',
    )
    expect(points).toEqual([
      { key: 'followers', day: '2026-10-05', value: 812 },
      { key: 'reach', day: '2026-10-03', value: 150 },
      { key: 'reach', day: '2026-10-04', value: 210 },
    ])
  })

  it('works with followers only when insights are not allowed', () => {
    expect(instagramPoints({ followers_count: 5 }, null, '2026-10-05')).toEqual([{ key: 'followers', day: '2026-10-05', value: 5 }])
  })
})
