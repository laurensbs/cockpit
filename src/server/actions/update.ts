'use server'

import { MAC_INSTALL_COMMAND } from '@/lib/terminal'
import { runInMacTerminal } from '../claude'
import { actionOwner } from '../session'

/** "Bijwerken": Terminal runs the same install line as the README; it closes the app and opens the new one. */
export async function runUpdate(): Promise<{ ok: boolean; command: string; error?: string }> {
  await actionOwner()
  const outcome = await runInMacTerminal(MAC_INSTALL_COMMAND)
  return { ok: outcome.launched, command: outcome.command, error: outcome.error }
}
