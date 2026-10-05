import 'server-only'
import type { Db } from '@/db'
import { getSetting, setSetting } from './settings'

// "Aan laten staan": the app window asks every minute whether to keep the computer awake, and says
// what it is doing. On by default; '0' means off.

const KEY = 'keep_awake'

export type AwakeStatus = 'awake' | 'battery' | 'off'

export async function keepAwakeOn(db: Db, ownerId: string): Promise<boolean> {
  return (await getSetting(db, ownerId, KEY)) !== '0'
}

export async function setKeepAwakeSetting(db: Db, ownerId: string, on: boolean): Promise<void> {
  await setSetting(db, ownerId, KEY, on ? null : '0')
}

const state = globalThis as unknown as { __cockpitAwake?: { status: AwakeStatus; at: number } }

/** What the app window last said it does; nothing when no window reported in the last three minutes. */
export function reportAwake(status: AwakeStatus, now = Date.now()): void {
  state.__cockpitAwake = { status, at: now }
}

export function lastAwake(now = Date.now()): AwakeStatus | null {
  const r = state.__cockpitAwake
  return r && now - r.at < 3 * 60_000 ? r.status : null
}
