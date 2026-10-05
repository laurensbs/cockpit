import { describe, expect, it } from 'vitest'
import { projectLine, weekLearning, weekScore, type ScoreEvent } from './week-score'

const ev = (measure: ScoreEvent['measure'], day: string, projectId: string | null = 'ws'): ScoreEvent => ({ measure, projectId, day })

describe('weekScore', () => {
  const events = [ev('called', '2026-10-05'), ev('called', '2026-10-06'), ev('posted', '2026-10-06', 'rm'), ev('called', '2026-09-30'), ev('helped', '2026-09-21')]
  const score = weekScore(events, '2026-10-05', '2026-09-28')

  it('counts this week next to last week, and forgets what is older', () => {
    expect(score.now).toMatchObject({ called: 2, posted: 1, helped: 0 })
    expect(score.before).toMatchObject({ called: 1, helped: 0 })
  })

  it('lists the projects of this week, the busiest first, in one short line each', () => {
    expect(score.projects.map((p) => p.projectId)).toEqual(['ws', 'rm'])
    expect(projectLine(score.projects[0].counts)).toBe('2 gebeld')
  })

  it('tells Claude the week, and nothing when nothing happened', () => {
    expect(weekLearning(score)).toContain('called 2 (last week 1)')
    expect(weekLearning(weekScore([], '2026-10-05', '2026-09-28'))).toBeNull()
  })
})
