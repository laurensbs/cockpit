import 'server-only'

/** Fixed answers instead of GitHub are for development and tests; the packaged app never uses them. */
export function fixturesAllowed(): boolean {
  return process.env.COCKPIT_PACKAGED !== '1'
}

export const githubFixtures = (): boolean => process.env.GITHUB_FIXTURES === '1' && fixturesAllowed()

export type ServiceStatus = 'live' | 'fixtures' | 'off'

export function githubStatus(token: string | null): ServiceStatus {
  if (githubFixtures()) return 'fixtures'
  return token ? 'live' : 'off'
}
