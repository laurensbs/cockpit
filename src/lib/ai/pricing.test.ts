import { describe, expect, it } from 'vitest'
import { costMicros, estimateTokens, worstCaseMicros } from './pricing'

describe('AI cost', () => {
  it('prices a plain Opus 5.5 call', () => {
    // 10k in × $4 + 2k out × $20 = $0.04 + $0.04
    expect(costMicros({ input_tokens: 10_000, output_tokens: 2_000 }, 'claude-opus-5-5')).toBe(80_000)
  })

  it('prices cache reads at $0.20 and 5-minute writes at $5 per million', () => {
    const usage = { input_tokens: 1_000, output_tokens: 1_000, cache_read_input_tokens: 10_000, cache_creation_input_tokens: 2_000 }
    // 0.004 + 0.02 + 0.002 + 0.01
    expect(costMicros(usage, 'claude-opus-5-5')).toBe(36_000)
  })

  it('splits 1-hour cache writes when the breakdown is given', () => {
    const usage = { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 3_000, cache_creation: { ephemeral_5m_input_tokens: 1_000, ephemeral_1h_input_tokens: 2_000 } }
    // 1k × $5 + 2k × $8
    expect(costMicros(usage, 'claude-opus-5-5')).toBe(21_000)
  })

  it('prices each iteration with its own model when a fallback ran', () => {
    const usage = {
      input_tokens: 0,
      output_tokens: 0,
      iterations: [
        { type: 'message', model: 'claude-opus-5-5', input_tokens: 1_000, output_tokens: 100 },
        { type: 'fallback_message', model: 'claude-opus-4-8', input_tokens: 1_000, output_tokens: 1_000 },
      ],
    }
    // (0.004 + 0.002) + (0.005 + 0.025)
    expect(costMicros(usage, 'claude-opus-5-5')).toBe(36_000)
  })

  it('adds web searches at a cent each', () => {
    expect(costMicros({ input_tokens: 0, output_tokens: 0, server_tool_use: { web_search_requests: 3 } }, 'claude-opus-5-5')).toBe(30_000)
  })

  it('reserves the worst case at fallback prices', () => {
    // 10k × $5 + 8k × $25 = $0.05 + $0.20
    expect(worstCaseMicros(10_000, 8_000)).toBe(250_000)
    expect(worstCaseMicros(0, 0, 5)).toBe(50_000)
    expect(estimateTokens('a'.repeat(35))).toBe(10)
  })
})
