/**
 * Runs once when the server starts. The cockpit's own clockwork lives here: the outbox every two
 * minutes. (The daily round is started by the app window, which knows when the computer is in use.)
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.NEXT_PHASE === 'phase-production-build' || process.env.COCKPIT_NO_WORKER === '1') return
  const { startWorker } = await import('./server/worker')
  startWorker()
}
