import 'server-only'
import type { Db } from '@/db'
import { expectedToken } from '@/lib/local'
import { claudeVersion, connectClaudeCode, mcpUrl } from './claude'
import { getSetting, setSetting } from './settings'

export type HealResult = 'ok' | 'connected' | 'reconnected' | 'no-claude' | 'failed'

/**
 * Keeps Claude Code pointed at this cockpit, in the real app only: the first time Claude Code is
 * found it gets connected, and when the cockpit's address changes (another port) the registration
 * is renewed. Otherwise nothing is touched.
 */
export async function healClaudeConnection(db: Db, ownerId: string): Promise<HealResult> {
  if (process.env.COCKPIT_PACKAGED !== '1') return 'ok'
  const token = expectedToken()
  if (!token) return 'failed'
  const [connectedAt, url] = await Promise.all([getSetting(db, ownerId, 'claude_connected'), getSetting(db, ownerId, 'claude_url')])
  if (connectedAt && url === mcpUrl()) return 'ok'
  if (!(await claudeVersion())) return 'no-claude'
  const result = await connectClaudeCode(token)
  if (!result.ok) return 'failed'
  await setSetting(db, ownerId, 'claude_connected', new Date().toISOString())
  await setSetting(db, ownerId, 'claude_url', mcpUrl())
  return connectedAt ? 'reconnected' : 'connected'
}
