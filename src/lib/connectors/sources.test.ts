import { createVerify, generateKeyPairSync } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { jwtAssertion, parseServiceAccount } from '../google-jwt'
import { appPoints, checkAppUrl } from './app'
import { discordCounts, inviteCode } from './discord'
import { checkGscSite, ga4Rows, gscRows } from './google'

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
const keyFile = JSON.stringify({ type: 'service_account', client_email: 'cockpit@my-project.iam.gserviceaccount.com', private_key: pem.replace(/\n/g, '\\n') })

describe('Google service account', () => {
  it('reads the key file, also with escaped newlines', () => {
    const account = parseServiceAccount(keyFile)
    expect('client_email' in account && account.client_email).toBe('cockpit@my-project.iam.gserviceaccount.com')
    expect('private_key' in account && account.private_key).toContain('\n')
    expect(parseServiceAccount('{"type":"user"}')).toEqual({ error: expect.stringContaining('service-account') })
    expect(parseServiceAccount('nope')).toEqual({ error: expect.stringContaining('JSON') })
  })
  it('signs an assertion Google can verify with the public key', () => {
    const account = parseServiceAccount(keyFile)
    if ('error' in account) throw new Error(account.error)
    const jwt = jwtAssertion(account, 'https://www.googleapis.com/auth/analytics.readonly', Date.UTC(2026, 9, 4))
    const [header, claims, signature] = jwt.split('.')
    expect(JSON.parse(Buffer.from(claims, 'base64url').toString())).toMatchObject({ iss: account.client_email, aud: 'https://oauth2.googleapis.com/token', scope: 'https://www.googleapis.com/auth/analytics.readonly' })
    const verify = createVerify('RSA-SHA256')
    verify.update(`${header}.${claims}`)
    expect(verify.verify(publicKey, Buffer.from(signature, 'base64url'))).toBe(true)
  })
})

describe('GA4 and Search Console', () => {
  it('reads a GA4 report by date', () => {
    expect(ga4Rows({ rows: [{ dimensionValues: [{ value: '20261004' }], metricValues: [{ value: '40' }, { value: '95' }] }, { dimensionValues: [{ value: 'x' }], metricValues: [] }] }, ['visitors', 'pageviews'])).toEqual([
      { key: 'visitors', day: '2026-10-04', value: 40 },
      { key: 'pageviews', day: '2026-10-04', value: 95 },
    ])
  })
  it('reads Search Console clicks and impressions, and checks the property', () => {
    expect(gscRows({ rows: [{ keys: ['2026-10-01'], clicks: 12, impressions: 340 }] })).toEqual([
      { key: 'search_clicks', day: '2026-10-01', value: 12 },
      { key: 'search_impressions', day: '2026-10-01', value: 340 },
    ])
    expect(checkGscSite('sc-domain:rondje.nl')).toBeNull()
    expect(checkGscSite('https://rondje.nl/')).toBeNull()
    expect(checkGscSite('rondje.nl')).toContain('sc-domain')
  })
})

describe('Discord', () => {
  it('finds the invite code in what he pastes', () => {
    expect(inviteCode('discord.gg/osrs-kastelen')).toBe('osrs-kastelen')
    expect(inviteCode('https://discord.com/invite/AbC123')).toBe('AbC123')
    expect(inviteCode('AbC123')).toBe('AbC123')
    expect(inviteCode('https://evil.example/discord.gg/x')).toBeNull()
    expect(discordCounts({ approximate_member_count: 812, approximate_presence_count: 97 })).toEqual({ members: 812, online: 97 })
  })
})

describe('own app stats', () => {
  it('reads today’s numbers and history, keeps only known keys, and lists the rest', () => {
    const r = appPoints({ metrics: { users: 412, signups: 9, walks: 77 }, series: [{ day: '2026-10-03', metrics: { signups: 7 } }] }, '2026-10-04')
    expect(r).toEqual({
      points: [
        { key: 'signups', day: '2026-10-03', value: 7 },
        { key: 'users', day: '2026-10-04', value: 412 },
        { key: 'signups', day: '2026-10-04', value: 9 },
      ],
      unknown: ['walks'],
    })
    expect(appPoints({ metrics: { users: 'veel' } }, '2026-10-04')).toEqual({ error: expect.any(String) })
  })
  it('only talks to https (or this computer)', () => {
    expect(checkAppUrl('https://rondje.nl/api/stats')).toBeNull()
    expect(checkAppUrl('http://localhost:3000/api/stats')).toBeNull()
    expect(checkAppUrl('http://rondje.nl/api/stats')).toContain('https')
    expect(checkAppUrl('nope')).toContain('geldig')
  })
})
