import 'server-only'
import { claudeVersion } from './claude'
import { fixturesAllowed } from './status'

/** Why a Claude Code button is off, or null when it can work. Pages show this under their buttons. */
export async function claudeBlocked(): Promise<string | null> {
  if (fixturesAllowed() && process.env.COCKPIT_FAKE_TERMINAL) return null
  return (await claudeVersion()) ? null : 'Claude Code is niet gevonden op deze computer. Installeer het en koppel het bij Instellingen.'
}
