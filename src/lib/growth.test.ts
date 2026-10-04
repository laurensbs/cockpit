import { describe, expect, it } from 'vitest'
import { nextActions, type GrowthState } from './growth'

const base: GrowthState = {
  hasProfile: true,
  hasPlan: true,
  hasLinkedin: true,
  hasKeywords: true,
  experimentsRunning: 1,
  experimentsBacklog: 0,
  articlesThisMonth: 1,
  newContactsWithEmail: 0,
  readyDrafts: 0,
  postsDoneThisWeek: 3,
  postsPlannedThisWeek: 0,
  mailReady: true,
  contacts: 4,
}

describe('nextActions', () => {
  it('is empty when everything is on track', () => {
    expect(nextActions(base)).toEqual([])
  })

  it('starts with the profile, then what is ready to go out', () => {
    const keys = nextActions({ ...base, hasProfile: false, readyDrafts: 2, mailReady: false }).map((a) => a.key)
    expect(keys.slice(0, 3)).toEqual(['profile', 'approve', 'mailbox'])
  })

  it('asks for posts, experiments, articles and outreach when they are missing, at most five', () => {
    const actions = nextActions({ ...base, experimentsRunning: 0, experimentsBacklog: 2, postsDoneThisWeek: 1, articlesThisMonth: 0, newContactsWithEmail: 3, hasLinkedin: false, contacts: 0 })
    expect(actions).toHaveLength(5)
    expect(actions.map((a) => a.key)).toEqual(['start-experiment', 'posts', 'outreach', 'seo', 'opportunities'])
    expect(actions[1].title).toBe('Plan 2 posts deze week')
  })
})
