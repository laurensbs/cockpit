// What the background runs of Claude Code wrote, read back: did the last one fail because Claude Code
// is logged out? Pure, so it can be tested; src/server/claude.ts writes the log.

export const RUN_MARKER = '--- run '

const LOGGED_OUT = /failed to authenticate|oauth session expired|please run \/login|not logged in|invalid api key|authentication_error/i

/** The problem of the newest run in the log, or null when it went fine (or nothing ran yet). */
export function lastRunProblem(logTail: string): 'logged-out' | null {
  const at = logTail.lastIndexOf(RUN_MARKER)
  if (at === -1) return null
  const run = logTail.slice(at)
  return LOGGED_OUT.test(run) ? 'logged-out' : null
}
