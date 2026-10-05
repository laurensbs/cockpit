import 'server-only'
import { closeDb } from '@/db'
import { startWorker } from './worker'

/**
 * The server's own clockwork, Node only: the outbox every two minutes, and a clean stop. When the app
 * quits it sends SIGTERM: close the database and really stop. Without this the server kept running
 * after the window closed, holding the database and answering the next start.
 */
export function startLifecycle(): void {
  const stop = async () => {
    const timer = setTimeout(() => process.exit(0), 3000)
    try {
      await closeDb()
    } finally {
      clearTimeout(timer)
      process.exit(0)
    }
  }
  process.once('SIGTERM', stop)
  process.once('SIGINT', stop)
  if (process.env.COCKPIT_NO_WORKER !== '1') startWorker()
}
