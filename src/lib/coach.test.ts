import { describe, expect, it } from 'vitest'
import { coachFromJson } from './coach'

describe('coachFromJson', () => {
  it('reads an advice back and drops what does not belong', () => {
    expect(coachFromJson({ title: 'Maak je Google Bedrijfsprofiel', why: 'Recensies wegen zwaar.', steps: ['Ga naar business.google.com', '', 42], who: 'jij', cost: 'gratis', setupKey: 'gbp' })).toEqual({
      title: 'Maak je Google Bedrijfsprofiel',
      why: 'Recensies wegen zwaar.',
      steps: ['Ga naar business.google.com'],
      who: 'jij',
      cost: 'gratis',
      setupKey: 'gbp',
    })
    expect(coachFromJson({ title: 'Iets', why: 'Omdat', who: 'iemand' })?.who).toBe('jij')
    expect(coachFromJson({ title: '', why: 'x' })).toBeNull()
    expect(coachFromJson(null)).toBeNull()
  })
})
