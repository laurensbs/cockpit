// Keeping the computer awake while the cockpit works for him: only when he wants it and only on mains
// power. The display may sleep; the computer does not, so the daily round, the mails and Claude Code's
// connection keep going. Pure, so it is testable.

export type AwakeStatus = 'awake' | 'battery' | 'off'

export function awakeStatus(on: boolean, onBattery: boolean): AwakeStatus {
  if (!on) return 'off'
  return onBattery ? 'battery' : 'awake'
}
