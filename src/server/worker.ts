import 'server-only'
import { getDb } from '@/db'
import { syncAll } from './github/sync'
import { runOutbox } from './outbox'
import { LOCAL_OWNER_ID } from './session'

const EVERY_MS = 2 * 60_000

/** The outbox, every two minutes, never two runs at once. */
export function startWorker(): void {
  const state = globalThis as unknown as { __cockpitWorker?: NodeJS.Timeout }
  if (state.__cockpitWorker) return
  let busy = false
  const tick = async () => {
    if (busy) return
    busy = true
    try {
      await runOutbox(await getDb(), LOCAL_OWNER_ID)
    } catch (error) {
      console.error('outbox', error instanceof Error ? error.message : error)
    } finally {
      busy = false
    }
  }
  state.__cockpitWorker = setInterval(tick, EVERY_MS)
  setTimeout(tick, 20_000)

  // GitHub, every ten minutes: one cheap request per repo, and the full read only for one that was pushed to.
  let reading = false
  const github = async () => {
    if (reading) return
    reading = true
    try {
      await syncAll(await getDb(), LOCAL_OWNER_ID, 60_000)
    } catch (error) {
      console.error('github', error instanceof Error ? error.message : error)
    } finally {
      reading = false
    }
  }
  setInterval(github, 10 * 60_000)
}
