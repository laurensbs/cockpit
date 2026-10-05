import 'server-only'
import { getDb } from '@/db'
import { runOutbox } from './outbox'
import { LOCAL_OWNER_ID } from './session'

const EVERY_MS = 2 * 60_000

/**
 * Asks the cockpit's own server to publish what is due. Through HTTP on purpose: publishing reads
 * media files, and code imported here would make Next copy the whole project into the app.
 */
async function publishDue(): Promise<void> {
  const port = process.env.PORT
  const token = process.env.COCKPIT_TOKEN
  if (!port || !token) return
  await fetch(`http://127.0.0.1:${port}/api/publish/run`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15 * 60_000) }).catch(() => undefined)
}

/** The outbox and the posts that are due, every two minutes, never two runs at once. */
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
    }
    try {
      await publishDue()
    } finally {
      busy = false
    }
  }
  state.__cockpitWorker = setInterval(tick, EVERY_MS)
  setTimeout(tick, 20_000)
}
