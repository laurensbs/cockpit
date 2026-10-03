import { describe, expect, it } from 'vitest'
import { hostOf, normalizeUrl, REPO_NAME } from './urls'

describe('urls', () => {
  it('accepts web addresses with or without https', () => {
    expect(normalizeUrl('rondje.nl')).toBe('https://rondje.nl')
    expect(normalizeUrl(' https://x.dev/ ')).toBe('https://x.dev')
    expect(normalizeUrl('http://example.org/a')).toBe('http://example.org/a')
  })

  it('refuses anything that is not a web address', () => {
    expect(normalizeUrl('javascript:alert(1)')).toBeNull()
    expect(normalizeUrl('mailto:me@example.org')).toBeNull()
    expect(normalizeUrl('localhost')).toBeNull()
    expect(normalizeUrl('')).toBeNull()
  })

  it('checks repository names and shortens hosts', () => {
    expect(REPO_NAME.test('laurensbs/value')).toBe(true)
    expect(REPO_NAME.test('laurensbs/..')).toBe(false)
    expect(REPO_NAME.test('laurensbs/../x')).toBe(false)
    expect(REPO_NAME.test('laurensbs/.github')).toBe(true)
    expect(REPO_NAME.test('https://github.com/a/b')).toBe(false)
    expect(hostOf('https://www.rondje.nl/x')).toBe('rondje.nl')
  })
})
