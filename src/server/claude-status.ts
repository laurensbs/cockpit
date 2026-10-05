import 'server-only'
import { claudeVersion, headlessProblem } from './claude'
import { fixturesAllowed } from './status'

/** Why a Claude Code button is off, or null when it can work. Pages show this under their buttons. */
export async function claudeBlocked(): Promise<string | null> {
  if (fixturesAllowed() && process.env.COCKPIT_FAKE_TERMINAL) return null
  if (!(await claudeVersion())) return 'Claude Code is niet gevonden op deze computer. Installeer het en koppel het bij Instellingen.'
  if (headlessProblem() === 'logged-out') return 'Claude Code is uitgelogd. Open Terminal, typ claude en log in met /login.'
  return null
}
