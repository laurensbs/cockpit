import 'server-only'
import { randomBytes } from 'node:crypto'

// A login with LinkedIn or TikTok happens in his own browser; the answer comes back to the cockpit's
// local address. The state ties that answer to the button he pressed: random, used once, gone after
// fifteen minutes.

export interface OauthState {
  platform: 'linkedin' | 'tiktok'
  ownerId: string
  projectId: string | null
  verifier: string | null
  redirectUri: string
  at: number
}

const TTL_MS = 15 * 60_000
const store = () => {
  const g = globalThis as unknown as { __cockpitOauth?: Map<string, OauthState> }
  g.__cockpitOauth ??= new Map()
  return g.__cockpitOauth
}

export function newState(input: Omit<OauthState, 'at'>): string {
  const now = Date.now()
  for (const [k, v] of store()) if (now - v.at > TTL_MS) store().delete(k)
  const state = randomBytes(18).toString('base64url')
  store().set(state, { ...input, at: now })
  return state
}

export function takeState(state: string | null, platform: OauthState['platform']): OauthState | null {
  if (!state) return null
  const found = store().get(state)
  store().delete(state)
  return found && found.platform === platform && Date.now() - found.at <= TTL_MS ? found : null
}
