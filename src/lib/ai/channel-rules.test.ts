import { describe, expect, it } from 'vitest'
import { CHANNEL_RULES, CHANNELS, channelRulesBlock, channelsFor, type ChannelRule } from './channel-rules'

const rules: ChannelRule[] = [
  { channel: 'email', rule: 'Mail a reply-able plain text first mail.', solid: false, source: '' },
  { channel: 'email', rule: 'Keep spam complaints under 0.3%.', solid: true, source: '' },
  { channel: 'instagram', rule: 'Sends per reach matter most.', solid: true, source: '' },
  { channel: 'seo', rule: 'Write for people first.', solid: true, source: '' },
]

describe('channelsFor', () => {
  it('gives a task the channels it works on', () => {
    expect(channelsFor('posts', 'instagram')).toEqual(['instagram'])
    expect(channelsFor('posts', 'x')).toEqual([])
    expect(channelsFor('contact_mails')).toEqual(['email'])
    expect(channelsFor('opportunities')).toEqual(['reddit', 'forums'])
    expect(channelsFor('plan')).toEqual([...CHANNELS])
    expect(channelsFor('weekly')).toEqual([])
  })
})

describe('channelRulesBlock', () => {
  it('puts the solid rules of a channel first and says which kind each is', () => {
    const block = channelRulesBlock(['email'], rules)
    expect(block.indexOf('0.3%')).toBeLessThan(block.indexOf('plain text'))
    expect(block).toContain('- email, solid: Keep spam complaints under 0.3%.')
    expect(block).toContain('- email, anecdotal:')
    expect(block).not.toContain('Sends per reach')
  })

  it('takes rules in turns per channel, so a broad task hears about every channel', () => {
    const block = channelRulesBlock(['email', 'instagram', 'seo'], rules, 3)
    expect(block).toContain('0.3%')
    expect(block).toContain('Sends per reach')
    expect(block).toContain('people first')
    expect(block).not.toContain('plain text')
  })

  it('is empty when nothing fits', () => {
    expect(channelRulesBlock([], rules)).toBe('')
    expect(channelRulesBlock(['appstore'], rules)).toBe('')
  })

  it('has researched rules for every channel, each one short and actionable', () => {
    for (const c of CHANNELS) expect(CHANNEL_RULES.some((r) => r.channel === c), c).toBe(true)
    for (const r of CHANNEL_RULES) {
      expect(r.rule.length, r.rule).toBeLessThanOrEqual(260)
      expect(r.source).toMatch(/^https:\/\//)
    }
  })
})
