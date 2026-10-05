// Signing in to Google as a service account, without the googleapis package: a JWT signed with the
// account's private key (RS256), exchanged for an access token. Only node:crypto.

import { createSign } from 'node:crypto'

export interface ServiceAccount {
  client_email: string
  private_key: string
  token_uri: string
}

/** Reads the JSON key file Google gives for a service account; fixes a key whose newlines were escaped. */
export function parseServiceAccount(text: string): ServiceAccount | { error: string } {
  let data: Record<string, unknown>
  try {
    data = JSON.parse(text) as Record<string, unknown>
  } catch {
    return { error: 'Dat is geen JSON. Plak de hele inhoud van het sleutelbestand.' }
  }
  if (data.type !== 'service_account') return { error: 'Dit is geen service-account-sleutel (type moet "service_account" zijn).' }
  const email = typeof data.client_email === 'string' ? data.client_email.trim() : ''
  const key = typeof data.private_key === 'string' ? data.private_key.replace(/\\n/g, '\n') : ''
  if (!/^[^@\s]+@[^@\s]+\.iam\.gserviceaccount\.com$/.test(email)) return { error: 'Het e-mailadres van het service-account ontbreekt of klopt niet.' }
  if (!/-----BEGIN (RSA )?PRIVATE KEY-----/.test(key)) return { error: 'De privésleutel ontbreekt.' }
  const tokenUri = typeof data.token_uri === 'string' && data.token_uri.startsWith('https://') ? data.token_uri : 'https://oauth2.googleapis.com/token'
  return { client_email: email, private_key: key, token_uri: tokenUri }
}

const base64url = (input: Buffer | string) => Buffer.from(input).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')

/** The signed assertion to exchange for an access token with the given scope, valid for an hour. */
export function jwtAssertion(account: ServiceAccount, scope: string, nowMs = Date.now()): string {
  const iat = Math.floor(nowMs / 1000) - 60
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = base64url(JSON.stringify({ iss: account.client_email, scope, aud: account.token_uri, iat, exp: iat + 3600 }))
  const signer = createSign('RSA-SHA256')
  signer.update(`${header}.${claims}`)
  return `${header}.${claims}.${base64url(signer.sign(account.private_key))}`
}
