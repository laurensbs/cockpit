import 'server-only'
import { getDb } from '@/db'
import { runOutbox } from './outbox'
import { renderPending } from './render/items'
import { LOCAL_OWNER_ID } from './session'

const EVERY_MS = 2 * 60_000

/** The outbox and the pictures still to draw, every two minutes, never two runs at once. */
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
      await renderPending(await getDb(), LOCAL_OWNER_ID)
    } catch (error) {
      console.error('render', error instanceof Error ? error.message : error)
    } finally {
      busy = false
    }
  }
  state.__cockpitWorker = setInterval(tick, EVERY_MS)
  setTimeout(tick, 20_000)
}
