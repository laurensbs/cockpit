import { describe, expect, it } from 'vitest'
import { addResult, parseResults, questionsForMonth, searchLinks, visibilityLine } from './visibility'

const qs = ['a', 'b', 'c', 'd', 'e']

describe('visibility', () => {
  it('asks three different questions each month, round the list', () => {
    const oct = questionsForMonth(qs, '2026-10')
    const nov = questionsForMonth(qs, '2026-11')
    expect(oct).toHaveLength(3)
    expect(new Set(oct).size).toBe(3)
    expect(nov).not.toEqual(oct)
    expect(questionsForMonth(['x'], '2026-10')).toEqual(['x'])
    expect(questionsForMonth([], '2026-10')).toEqual([])
  })

  it('fills the question into Google, ChatGPT and Perplexity', () => {
    expect(searchLinks('wat kost een werkbon?').perplexity).toBe('https://www.perplexity.ai/search?q=wat%20kost%20een%20werkbon%3F')
  })

  it('keeps one result per month, newest first, and says how it went', () => {
    let h = addResult([], { month: '2026-09', asked: 3, named: 0 })
    h = addResult(h, { month: '2026-10', asked: 3, named: 1 })
    h = addResult(h, { month: '2026-10', asked: 3, named: 2 })
    expect(h.map((r) => r.named)).toEqual([2, 0])
    expect(visibilityLine(h)).toBe('Named in AI and search answers for 2 of 3 checked customer questions (2026-10); the month before 0 of 3')
    expect(visibilityLine([])).toBeNull()
    expect(parseResults('kapot')).toEqual([])
    expect(parseResults(JSON.stringify(h))).toEqual(h)
  })
})
