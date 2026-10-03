import { describe, expect, it } from 'vitest'
import { clip, REDACTED, redactSecrets } from './redact'

describe('redactSecrets', () => {
  it('blanks keys and tokens that end up in a README', () => {
    const text = [
      'Set ANTHROPIC_API_KEY=sk-ant-api03-abcdefghijklmnopqrstuvwxyz',
      'token ghp_abcdefghijklmnopqrstuvwxyz0123',
      'github_pat_11ABCDEFG0123456789_abcdefghijklmnop',
      'AKIAABCDEFGHIJKLMNOP',
      'DATABASE_URL=postgres://user:hunter2@db.example.org/app',
      'stripe sk_live_abcdefghijkl123',
    ].join('\n')
    const out = redactSecrets(text)
    expect(out).not.toMatch(/sk-ant|ghp_|github_pat_|AKIA|hunter2|sk_live/)
    expect(out.split(REDACTED).length - 1).toBeGreaterThanOrEqual(6)
  })

  it('blanks private keys and secret assignments, but keeps empty examples', () => {
    const text = '-----BEGIN RSA PRIVATE KEY-----\nMIIabc\n-----END RSA PRIVATE KEY-----\nBETTER_AUTH_SECRET=abc123\nGITHUB_TOKEN=\nNEXT_PUBLIC_SITE_URL=https://x.dev'
    const out = redactSecrets(text)
    expect(out).not.toContain('MIIabc')
    expect(out).toContain(`BETTER_AUTH_SECRET=${REDACTED}`)
    expect(out).toContain('GITHUB_TOKEN=\n')
    expect(out).toContain('NEXT_PUBLIC_SITE_URL=https://x.dev')
  })

  it('leaves ordinary text alone', () => {
    const text = 'Rondje: jongeren wandelen met honden. Zie https://example.org en mail ons.'
    expect(redactSecrets(text)).toBe(text)
  })
})

describe('clip', () => {
  it('keeps short text and cuts long text near a line break', () => {
    expect(clip('kort', 10)).toBe('kort')
    const long = `${'a'.repeat(90)}\n${'b'.repeat(50)}`
    expect(clip(long, 100)).toBe(`${'a'.repeat(90)}\n…`)
  })
})
