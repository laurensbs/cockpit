import 'server-only'

/** True outside Vercel production: only there may the AI and GitHub fixtures stand in for the real thing. */
export function fixturesAllowed(): boolean {
  return process.env.VERCEL_ENV !== 'production'
}

export type ServiceStatus = 'live' | 'fixtures' | 'off'

export function aiStatus(): ServiceStatus {
  if (process.env.AI_FIXTURES === '1' && fixturesAllowed()) return 'fixtures'
  return process.env.ANTHROPIC_API_KEY ? 'live' : 'off'
}

export function githubStatus(): ServiceStatus {
  if (process.env.GITHUB_FIXTURES === '1' && fixturesAllowed()) return 'fixtures'
  return process.env.GITHUB_TOKEN ? 'live' : 'off'
}

export function emailStatus(): 'live' | 'off' {
  return process.env.RESEND_API_KEY && process.env.EMAIL_FROM ? 'live' : 'off'
}

/** The monthly AI budget in dollars (AI_MONTHLY_BUDGET_USD, default 10). */
export function monthlyBudgetUsd(): number {
  const value = Number(process.env.AI_MONTHLY_BUDGET_USD ?? 10)
  return Number.isFinite(value) && value >= 0 ? value : 10
}
