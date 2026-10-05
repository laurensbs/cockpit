import { describe, expect, it } from 'vitest'
import { detectSetup, envExampleKeys, ownDomain, type Raw, vercelEnvNames } from './setup-detect'

const raw = (over: Partial<Raw> = {}): Raw => ({ siteUrl: 'https://www.voorbeeld.example', mx: ['mx1.mail.example.'], spf: true, dmarc: false, html: '<a href="/privacy">Privacy</a><script src="/_vercel/insights/script.js"></script>', trustpilot: false, appStore: null, socials: 1, example: null, production: null, ...over })
const status = (rows: ReturnType<typeof detectSetup>, key: string) => rows.find((r) => r.key === key)

describe('detectSetup', () => {
  it('reads domain, mail, mail safety, privacy, analytics, Trustpilot and socials from what it found', () => {
    const rows = detectSetup(raw())
    expect(status(rows, 'domain')).toMatchObject({ status: 'done', note: 'voorbeeld.example' })
    expect(status(rows, 'mail')).toMatchObject({ status: 'done', note: 'Mail via mx1.mail.example' })
    expect(status(rows, 'mail-auth')).toMatchObject({ status: 'todo', note: 'DMARC ontbreekt' })
    expect(status(rows, 'privacy')?.status).toBe('done')
    expect(status(rows, 'analytics')).toMatchObject({ status: 'done', note: 'Vercel Analytics' })
    expect(status(rows, 'trustpilot')?.status).toBe('todo')
    expect(rows.every((r) => r.source === 'auto')).toBe(true)
  })

  it('knows a hosting subdomain is not a domain of his own, and then says nothing about mail', () => {
    const rows = detectSetup(raw({ siteUrl: 'https://teampje.vercel.app', mx: null, spf: null, dmarc: null }))
    expect(status(rows, 'domain')).toMatchObject({ status: 'todo', note: 'Nu op teampje.vercel.app' })
    expect(status(rows, 'mail')).toBeUndefined()
  })

  it('names the keys that are missing in production, never their values, and spots Stripe and Google', () => {
    const rows = detectSetup(raw({ example: ['STRIPE_SECRET_KEY', 'GOOGLE_CLIENT_ID', 'RESEND_API_KEY', 'E2E_TOKEN'], production: ['GOOGLE_CLIENT_ID'] }))
    expect(status(rows, 'env-keys')).toMatchObject({ status: 'todo', note: 'Ontbreekt in productie: STRIPE_SECRET_KEY, RESEND_API_KEY' })
    expect(status(rows, 'stripe')?.status).toBe('todo')
    expect(status(rows, 'google-oauth')?.status).toBe('unknown')
  })
})

describe('env names', () => {
  it('reads .env.example and the vercel listing, keeping only the names', () => {
    expect(envExampleKeys('# comment\nSTRIPE_SECRET_KEY=sk_test_x\nexport RESEND_API_KEY=\n\nlower=1')).toEqual(['STRIPE_SECRET_KEY', 'RESEND_API_KEY'])
    const out = 'Vercel CLI 62\n> Environment Variables found\n\nname value type environments\nAI_GATEWAY_API_KEY Hidden Secret Production\nCLERK_SECRET_KEY eyJ2Ijoi… Config Production\n'
    expect(vercelEnvNames(out)).toEqual(['AI_GATEWAY_API_KEY', 'CLERK_SECRET_KEY'])
  })

  it('tells an own domain from a hosting address', () => {
    expect(ownDomain('https://rondjemee.nl/x')).toBe('rondjemee.nl')
    expect(ownDomain('https://teampje.vercel.app')).toBeNull()
    expect(ownDomain(null)).toBeNull()
  })
})
