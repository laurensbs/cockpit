import { describe, expect, it } from 'vitest'
import { isOwnerEmail, setupCodeMatches, signUpRefusal } from './owner'

const owners = ['me@example.org']

describe('owner access', () => {
  it('matches the owner address case-insensitively', () => {
    expect(isOwnerEmail(' Me@Example.org ', owners)).toBe(true)
    expect(isOwnerEmail('someone@example.org', owners)).toBe(false)
    expect(isOwnerEmail('me@example.org', [])).toBe(false)
  })

  it('checks the setup code, ignoring case and spaces around it', () => {
    expect(setupCodeMatches(' Tiger-Moon-42 ', 'tiger-moon-42')).toBe(true)
    expect(setupCodeMatches('tiger-moon-41', 'tiger-moon-42')).toBe(false)
    expect(setupCodeMatches(undefined, 'tiger-moon-42')).toBe(false)
    expect(setupCodeMatches('anything', undefined)).toBe(false)
    expect(setupCodeMatches('', '  ')).toBe(false)
  })

  it('refuses sign-up for anyone but the owner with the right code', () => {
    const base = { owners, expectedCode: 'code-1', production: true }
    expect(signUpRefusal({ ...base, email: 'me@example.org', setupCode: 'code-1' })).toBeNull()
    expect(signUpRefusal({ ...base, email: 'me@example.org', setupCode: 'wrong' })).toBe('code')
    expect(signUpRefusal({ ...base, email: 'other@example.org', setupCode: 'code-1' })).toBe('not-owner')
  })

  it('keeps sign-up closed in production until a setup code is set', () => {
    const base = { owners, email: 'me@example.org', setupCode: undefined, expectedCode: undefined }
    expect(signUpRefusal({ ...base, production: true })).toBe('code')
    expect(signUpRefusal({ ...base, production: false })).toBeNull()
  })
})
