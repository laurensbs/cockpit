import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import type { Db } from '@/db'
import { accounts } from './accounts'
import { callJson } from './http'
import { newState, takeState } from './oauth-state'

// Logging in with LinkedIn and TikTok: the button gives a link that opens in his own browser; the
// platform sends him back to the cockpit's local address with a code, which becomes a token here.

/** Where LinkedIn and TikTok send him back. He registers exactly this address in his developer app. */
export function redirectUri(platform: 'linkedin' | 'tiktok', port: string): string {
  return platform === 'linkedin' ? `http://localhost:${port}/api/oauth/linkedin/callback` : `http://127.0.0.1:${port}/api/oauth/tiktok/callback`
}

export async function linkedinLoginUrl(db: Db, ownerId: string, port: string): Promise<string | { error: string }> {
  const app = await accounts.linkedinApp(db, ownerId)
  if (!app) return { error: 'Vul eerst de Client ID en het Client Secret van je LinkedIn-app in.' }
  const redirect = redirectUri('linkedin', port)
  const state = newState({ platform: 'linkedin', ownerId, projectId: null, verifier: null, redirectUri: redirect })
  return `https://www.linkedin.com/oauth/v2/authorization?${new URLSearchParams({ response_type: 'code', client_id: app.clientId, redirect_uri: redirect, state, scope: 'openid profile w_member_social' })}`
}

export async function linkedinCallback(db: Db, code: string | null, state: string | null): Promise<{ ok: boolean; message: string }> {
  const found = takeState(state, 'linkedin')
  if (!found || !code) return { ok: false, message: 'Deze inloglink is verlopen of al gebruikt. Druk in de Cockpit opnieuw op Koppel LinkedIn.' }
  const app = await accounts.linkedinApp(db, found.ownerId)
  if (!app) return { ok: false, message: 'De LinkedIn-app ontbreekt in de Cockpit.' }
  try {
    const token = await callJson<{ access_token?: string; expires_in?: number }>('LinkedIn', 'https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: found.redirectUri, client_id: app.clientId, client_secret: app.clientSecret }),
    })
    if (!token.access_token) return { ok: false, message: 'LinkedIn gaf geen toegang.' }
    const me = await callJson<{ sub?: string; name?: string }>('LinkedIn', 'https://api.linkedin.com/v2/userinfo', { headers: { Authorization: `Bearer ${token.access_token}` } })
    if (!me.sub) return { ok: false, message: 'LinkedIn zei niet wie je bent (zet "Sign In with LinkedIn using OpenID Connect" aan in je app).' }
    await accounts.setLinkedin(db, found.ownerId, { token: token.access_token, sub: me.sub, name: me.name ?? 'LinkedIn', expiresAt: new Date(Date.now() + (token.expires_in ?? 60 * 86_400) * 1000).toISOString() })
    return { ok: true, message: `LinkedIn is gekoppeld${me.name ? ` als ${me.name}` : ''}.` }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Koppelen lukte niet.' }
  }
}

/**
 * TikTok's Login Kit for desktop wants PKCE, with the challenge as the hex SHA-256 of the verifier
 * (TikTok's own variant of S256).
 */
export async function tiktokLoginUrl(db: Db, ownerId: string, projectId: string, port: string): Promise<string | { error: string }> {
  const app = await accounts.tiktokApp(db, ownerId)
  if (!app) return { error: 'Vul eerst de Client key en het Client secret van je TikTok-app in.' }
  const redirect = redirectUri('tiktok', port)
  const verifier = randomBytes(48).toString('base64url')
  const state = newState({ platform: 'tiktok', ownerId, projectId, verifier, redirectUri: redirect })
  const challenge = createHash('sha256').update(verifier).digest('hex')
  return `https://www.tiktok.com/v2/auth/authorize/?${new URLSearchParams({
    client_key: app.clientKey,
    response_type: 'code',
    scope: 'user.info.basic,user.info.stats,video.upload,video.list',
    redirect_uri: redirect,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })}`
}

export async function tiktokCallback(db: Db, code: string | null, state: string | null): Promise<{ ok: boolean; message: string }> {
  const found = takeState(state, 'tiktok')
  if (!found || !code || !found.projectId) return { ok: false, message: 'Deze inloglink is verlopen of al gebruikt. Druk in de Cockpit opnieuw op Koppel TikTok.' }
  const app = await accounts.tiktokApp(db, found.ownerId)
  if (!app) return { ok: false, message: 'De TikTok-app ontbreekt in de Cockpit.' }
  try {
    const token = await callJson<{ access_token?: string; expires_in?: number; refresh_token?: string; refresh_expires_in?: number; open_id?: string }>('TikTok', 'https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_key: app.clientKey, client_secret: app.clientSecret, code, grant_type: 'authorization_code', redirect_uri: found.redirectUri, code_verifier: found.verifier ?? '' }),
    })
    if (!token.access_token || !token.refresh_token) return { ok: false, message: 'TikTok gaf geen toegang.' }
    const me = await callJson<{ data?: { user?: { display_name?: string } } }>('TikTok', 'https://open.tiktokapis.com/v2/user/info/?fields=display_name', { headers: { Authorization: `Bearer ${token.access_token}` } }).catch(() => ({ data: undefined }))
    const name = me.data?.user?.display_name ?? 'TikTok'
    await accounts.setTiktok(db, found.ownerId, found.projectId, {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      openId: token.open_id ?? '',
      name,
      expiresAt: new Date(Date.now() + (token.expires_in ?? 86_400) * 1000).toISOString(),
      refreshExpiresAt: new Date(Date.now() + (token.refresh_expires_in ?? 365 * 86_400) * 1000).toISOString(),
    })
    return { ok: true, message: `TikTok is gekoppeld als ${name}.` }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Koppelen lukte niet.' }
  }
}

/** Checks a pasted Instagram token and finds the account it belongs to. */
export async function instagramAccount(token: string): Promise<{ userId: string; username: string } | { error: string }> {
  try {
    const me = await callJson<{ user_id?: string; id?: string; username?: string }>('Instagram', `https://graph.instagram.com/v23.0/me?${new URLSearchParams({ fields: 'user_id,username', access_token: token })}`)
    const userId = me.user_id ?? me.id
    return userId ? { userId, username: me.username ?? '' } : { error: 'Instagram zei niet welk account dit is.' }
  } catch {
    return { error: 'Instagram kent dit token niet: verlopen, of niet helemaal gekopieerd. Maak een nieuw token in je Meta-app.' }
  }
}
