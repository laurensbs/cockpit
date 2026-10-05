import { describe, expect, it } from 'vitest'
import { clockOf, reminderDue, reminderText, reminderTime } from './reminder'

// Monday 5 October 2026, 09:30 in Amsterdam (07:30 UTC).
const monday = new Date('2026-10-05T07:30:00Z')

describe('reminderDue', () => {
  it('nudges on a working day from his chosen time, once', () => {
    expect(clockOf(monday)).toBe('09:30')
    expect(reminderDue({ now: monday, time: '09:00', lastDay: null, reached: false })).toBe(true)
    expect(reminderDue({ now: monday, time: '10:00', lastDay: null, reached: false })).toBe(false)
    expect(reminderDue({ now: monday, time: '09:00', lastDay: '2026-10-05', reached: false })).toBe(false)
  })

  it('stays quiet when the day goal is reached, at the weekend, or when he switched it off', () => {
    expect(reminderDue({ now: monday, time: '09:00', lastDay: null, reached: true })).toBe(false)
    expect(reminderDue({ now: new Date('2026-10-04T08:00:00Z'), time: '09:00', lastDay: null, reached: false })).toBe(false)
    expect(reminderDue({ now: monday, time: '', lastDay: null, reached: false })).toBe(false)
  })
})

describe('reminderTime and reminderText', () => {
  it('reads the stored time: nothing stored is 09:00, empty is off, nonsense is off', () => {
    expect(reminderTime(null)).toBe('09:00')
    expect(reminderTime('')).toBe('')
    expect(reminderTime('07:45')).toBe('07:45')
    expect(reminderTime('25:00')).toBe('')
  })

  it('says how much is left and what comes first', () => {
    expect(reminderText(3, 'Bel PA Costa Brava')).toEqual({ title: 'Je dag staat klaar', body: '3 stappen · een paar minuten. Eerst: Bel PA Costa Brava' })
    expect(reminderText(1, null).body).toBe('1 stap · een paar minuten')
  })
})
