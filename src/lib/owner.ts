import { createHash, timingSafeEqual } from 'node:crypto'

export function isOwnerEmail(email: string, owners: readonly string[]): boolean {
  return owners.includes(email.trim().toLowerCase())
}

/** Compares in constant time, so the code cannot be guessed letter by letter. */
export function setupCodeMatches(given: unknown, expected: string | undefined): boolean {
  if (!expected?.trim() || typeof given !== 'string') return false
  const hash = (value: string) => createHash('sha256').update(value.trim().toLowerCase()).digest()
  return timingSafeEqual(hash(given), hash(expected))
}

export type SignUpRefusal = 'not-owner' | 'code'

/**
 * Only the owner may make an account, and only with the one-time setup code: without it, anyone
 * who knows the owner's address could sign up first and take the cockpit. In production there is
 * no sign-up at all until OWNER_SETUP_CODE is set.
 */
export function signUpRefusal(input: {
  email: string
  setupCode: unknown
  owners: readonly string[]
  expectedCode: string | undefined
  production: boolean
}): SignUpRefusal | null {
  if (!isOwnerEmail(input.email, input.owners)) return 'not-owner'
  if (input.expectedCode?.trim()) return setupCodeMatches(input.setupCode, input.expectedCode) ? null : 'code'
  return input.production ? 'code' : null
}
