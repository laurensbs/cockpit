/**
 * Runs once when the server starts. The cockpit's own clockwork lives in src/server/lifecycle.ts:
 * the outbox every two minutes and a clean stop. (The daily round is started by the app window, which
 * knows when the computer is in use.) Node only: the import stays out of the Edge build.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.NEXT_PHASE === 'phase-production-build') return
  const { startLifecycle } = await import('./server/lifecycle')
  startLifecycle()
}
