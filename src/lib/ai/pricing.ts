// What a Claude call costs, from its usage. Prices in US dollars per million tokens (Oct 2026).
// A refused request can be re-run by a fallback model at that model's price, so every entry of
// usage.iterations is priced on its own.

export interface ModelPrice {
  input: number
  output: number
  cacheRead: number
  cacheWrite5m: number
  cacheWrite1h: number
}

const OPUS_5_5: ModelPrice = { input: 4, output: 20, cacheRead: 0.2, cacheWrite5m: 5, cacheWrite1h: 8 }
const OPUS_5: ModelPrice = { input: 5, output: 25, cacheRead: 0.5, cacheWrite5m: 6.25, cacheWrite1h: 10 }

export const PRICES: Record<string, ModelPrice> = {
  'claude-opus-5-5': OPUS_5_5,
  'claude-opus-5': OPUS_5,
  'claude-opus-4-8': OPUS_5,
}
/** Anything else is priced like the dearest model we expect, so the budget errs on the safe side. */
export const FALLBACK_PRICE = OPUS_5
export const WEB_SEARCH_USD = 0.01

export const priceOf = (model: string | null | undefined): ModelPrice => (model && PRICES[model]) || FALLBACK_PRICE

export interface UsageLike {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens?: number | null
  cache_creation_input_tokens?: number | null
  cache_creation?: { ephemeral_5m_input_tokens?: number | null; ephemeral_1h_input_tokens?: number | null } | null
}

export interface MessageUsage extends UsageLike {
  iterations?: (UsageLike & { type?: string; model?: string | null })[] | null
  server_tool_use?: { web_search_requests?: number | null } | null
}

function usd(usage: UsageLike, price: ModelPrice): number {
  const write1h = usage.cache_creation?.ephemeral_1h_input_tokens ?? 0
  const write5m = usage.cache_creation?.ephemeral_5m_input_tokens ?? Math.max(0, (usage.cache_creation_input_tokens ?? 0) - write1h)
  return (
    (usage.input_tokens * price.input +
      usage.output_tokens * price.output +
      (usage.cache_read_input_tokens ?? 0) * price.cacheRead +
      write5m * price.cacheWrite5m +
      write1h * price.cacheWrite1h) /
    1_000_000
  )
}

/** The cost of one message in millionths of a dollar (integers add up without rounding drift). */
export function costMicros(usage: MessageUsage, requestedModel: string): number {
  const parts = usage.iterations?.length ? usage.iterations : [usage]
  let total = 0
  for (const part of parts) total += usd(part, priceOf('model' in part && part.model ? part.model : requestedModel))
  total += (usage.server_tool_use?.web_search_requests ?? 0) * WEB_SEARCH_USD
  return Math.ceil(total * 1_000_000)
}

/** The most a call can cost: all input uncached and every output token used, at fallback prices. */
export function worstCaseMicros(inputTokens: number, maxTokens: number, webSearches = 0): number {
  return Math.ceil(((inputTokens * FALLBACK_PRICE.input + maxTokens * FALLBACK_PRICE.output) / 1_000_000 + webSearches * WEB_SEARCH_USD) * 1_000_000)
}

/** A rough token count for budgeting before the call (about 3.5 characters per token). */
export const estimateTokens = (text: string) => Math.ceil(text.length / 3.5)
