import { describe, expect, it } from 'vitest'
import { expectedToken, isLoopbackHost, tokenMatches } from './local'

describe('expectedToken', () => {
  it('is the configured token, or "dev" outside production, or nothing', () => {
    expect(expectedToken({ COCKPIT_TOKEN: ' abc ' })).toBe('abc')
    expect(expectedToken({ NODE_ENV: 'development' })).toBe('dev')
    expect(expectedToken({ NODE_ENV: 'test' })).toBe('dev')
    expect(expectedToken({ NODE_ENV: 'production' })).toBeNull()
    expect(expectedToken({ NODE_ENV: 'production', COCKPIT_TOKEN: '' })).toBeNull()
  })
})

describe('tokenMatches', () => {
  it('accepts only the exact token', () => {
    expect(tokenMatches('secret', 'secret')).toBe(true)
    expect(tokenMatches('secret ', 'secret')).toBe(false)
    expect(tokenMatches('Secret', 'secret')).toBe(false)
    expect(tokenMatches('', '')).toBe(false)
    expect(tokenMatches(undefined, 'secret')).toBe(false)
    expect(tokenMatches('secret', null)).toBe(false)
    expect(tokenMatches(['secret'], 'secret')).toBe(false)
  })
})

describe('isLoopbackHost', () => {
  it('knows the three loopback names, with or without a port', () => {
    for (const host of ['127.0.0.1', '127.0.0.1:41414', 'localhost', 'LOCALHOST:3000', '[::1]', '[::1]:41414']) expect(isLoopbackHost(host), host).toBe(true)
  })
  it('refuses everything else', () => {
    for (const host of [null, '', 'evil.example', 'evil.example:41414', '127.0.0.1.evil.example', 'localhost.evil.example', '10.0.0.5:41414', '[::2]']) {
      expect(isLoopbackHost(host), String(host)).toBe(false)
    }
  })
})
