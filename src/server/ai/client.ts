import 'server-only'
import Anthropic from '@anthropic-ai/sdk'

export const MODEL = 'claude-opus-5-5'
/** Server-side fallbacks: when a request is declined, Anthropic re-runs it on its recommended model. */
export const FALLBACK_BETA = 'server-side-fallback-2026-07-01'

let client: Anthropic | null = null

/**
 * The key is passed explicitly: without it the SDK would also pick up other credentials on a
 * machine (an auth token or a CLI login), and could spend money no one meant to spend.
 */
export function anthropic(): Anthropic {
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 250_000, maxRetries: 1 })
  return client
}
