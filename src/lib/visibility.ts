// "Word je gevonden?": once a month he asks three of his customers' real questions in Google, ChatGPT and
// Perplexity and ticks whether his business is named. AI answers take clicks, so this is how he sees
// whether search works for him; Claude reads the result before the next article. Pure, so it can be tested.

export interface SeenResult {
  /** 'YYYY-MM' */
  month: string
  asked: number
  named: number
}

export const monthOf = (day: string) => day.slice(0, 7)

/** Three questions for this month, a different three each month, round the list. */
export function questionsForMonth(questions: readonly string[], month: string, n = 3): string[] {
  if (!questions.length) return []
  const [y, m] = month.split('-').map(Number)
  const start = ((y * 12 + m) * n) % questions.length
  return Array.from({ length: Math.min(n, questions.length) }, (_, i) => questions[(start + i) % questions.length])
}

/** Where to ask it: Google, ChatGPT and Perplexity, with the question filled in. */
export function searchLinks(question: string): { google: string; chatgpt: string; perplexity: string } {
  const q = encodeURIComponent(question)
  return { google: `https://www.google.com/search?q=${q}`, chatgpt: `https://chatgpt.com/?q=${q}`, perplexity: `https://www.perplexity.ai/search?q=${q}` }
}

/** The results he keeps: newest first, one per month, at most a year. */
export function addResult(history: readonly SeenResult[], result: SeenResult): SeenResult[] {
  return [result, ...history.filter((r) => r.month !== result.month)].sort((a, b) => b.month.localeCompare(a.month)).slice(0, 12)
}

export function parseResults(raw: string | null): SeenResult[] {
  try {
    const list = JSON.parse(raw ?? '[]') as unknown
    return Array.isArray(list) ? list.filter((r): r is SeenResult => typeof r?.month === 'string' && Number.isFinite(r?.asked) && Number.isFinite(r?.named)) : []
  } catch {
    return []
  }
}

/** One line for Claude and for him: the last two months. */
export function visibilityLine(history: readonly SeenResult[]): string | null {
  const [now, before] = history
  if (!now) return null
  return `Named in AI and search answers for ${now.named} of ${now.asked} checked customer questions (${now.month})${before ? `; the month before ${before.named} of ${before.asked}` : ''}`
}
