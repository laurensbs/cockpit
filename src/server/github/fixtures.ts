import 'server-only'
import type { CommitInfo, GithubSource, RepoMeta } from './source'

// Fixed repositories for the tests (GITHUB_FIXTURES=1, never in production): no token, no network.

const daysAgo = (n: number, hour = 14) => {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  d.setUTCHours(hour, 0, 0, 0)
  return d.toISOString()
}

interface FixtureRepo {
  meta: RepoMeta
  readme: string
  files: Record<string, string>
  commitDaysAgo: number[]
}

const REPOS: FixtureRepo[] = [
  {
    meta: {
      fullName: 'laurensbs/value',
      isPrivate: false,
      archived: false,
      fork: false,
      description: 'Rondje: jongeren wandelen met honden van ouderen, zieken en opvangen',
      homepage: 'https://rondje-five.vercel.app',
      topics: ['dogs', 'volunteering'],
      language: 'TypeScript',
      pushedAt: daysAgo(0),
    },
    readme: '# Rondje\n\nGratis platform waar jongvolwassenen (18–30) wandelen met honden van ouderen, zieken en opvangen in NL, BE en ES.\n\nDATABASE_URL=postgres://user:secret@db.example.org/rondje\n',
    files: {
      'web/package.json': JSON.stringify({ dependencies: { next: '16.3.8', react: '19.2.8', 'drizzle-orm': '0.45', '@capacitor/core': '8', 'next-intl': '4' }, devDependencies: { typescript: '5' } }),
      'docs/MARKETING.md': '# Marketingplan\n\nAanbod eerst: opvangen zetten met een stapel foto’s in één middag 20 honden online.',
      'docs/STRATEGY.md': '# Strategie\n\nRode lijnen: geen advertenties, geen betaalmuur, nooit data verkopen.',
      'docs/ITERATIONS.md': '# Iteraties',
    },
    commitDaysAgo: [0, 0, 1, 2, 2, 3, 5, 6, 8, 9, 10, 12, 13, 15, 20, 22],
  },
  {
    meta: {
      fullName: 'laurensbs/webstability',
      isPrivate: true,
      archived: false,
      fork: false,
      description: 'Webstability: websites en webapps voor ondernemers',
      homepage: 'https://webstability.example',
      topics: [],
      language: 'TypeScript',
      pushedAt: daysAgo(1),
    },
    readme: '# Webstability\n\nWebsites, webapps en onderhoud voor kleine ondernemers in Nederland en Spanje.',
    files: { 'package.json': JSON.stringify({ dependencies: { next: '16', stripe: '17', resend: '4' } }) },
    commitDaysAgo: [1, 3, 4, 9, 16],
  },
  {
    meta: {
      fullName: 'laurensbs/teampje',
      isPrivate: true,
      archived: false,
      fork: false,
      description: 'Teampje',
      homepage: null,
      topics: [],
      language: 'TypeScript',
      pushedAt: daysAgo(2),
    },
    readme: '# Teampje\n\nSamen sporten met je team.',
    files: { 'package.json': JSON.stringify({ dependencies: { next: '16', 'better-auth': '1' } }) },
    commitDaysAgo: [2, 6, 7],
  },
  {
    meta: {
      fullName: 'laurensbs/caravanstallingspanje',
      isPrivate: true,
      archived: false,
      fork: false,
      description: 'Caravanstalling in Spanje',
      homepage: null,
      topics: [],
      language: 'TypeScript',
      pushedAt: daysAgo(70),
    },
    readme: '# Caravanstalling Spanje',
    files: {},
    commitDaysAgo: [70, 75],
  },
  {
    meta: {
      fullName: 'laurensbs/caravanstallingspanje-repair',
      isPrivate: true,
      archived: false,
      fork: false,
      description: '',
      homepage: null,
      topics: [],
      language: 'TypeScript',
      pushedAt: daysAgo(80),
    },
    readme: '# Reparaties',
    files: {},
    commitDaysAgo: [80],
  },
  {
    meta: {
      fullName: 'laurensbs/proofloop',
      isPrivate: true,
      archived: true,
      fork: false,
      description: 'Oud experiment',
      homepage: null,
      topics: [],
      language: 'TypeScript',
      pushedAt: daysAgo(200),
    },
    readme: '# Proofloop',
    files: {},
    commitDaysAgo: [],
  },
]

const byName = (fullName: string) => REPOS.find((r) => r.meta.fullName === fullName)

export const fixtureSource: GithubSource = {
  async listRepos() {
    return REPOS.map((r) => r.meta)
  },
  async repo(fullName) {
    return byName(fullName)?.meta ?? null
  },
  async readme(fullName) {
    return byName(fullName)?.readme ?? null
  },
  async dir(fullName, path) {
    const repo = byName(fullName)
    if (!repo) return null
    const prefix = path ? `${path}/` : ''
    const names = new Set<string>()
    for (const file of [...Object.keys(repo.files), 'README.md']) {
      if (!file.startsWith(prefix)) continue
      names.add(file.slice(prefix.length).split('/')[0])
    }
    return names.size || !path ? [...names] : null
  },
  async file(fullName, path) {
    return byName(fullName)?.files[path] ?? null
  },
  async commits(fullName, sinceIso): Promise<CommitInfo[]> {
    const repo = byName(fullName)
    if (!repo) return []
    return repo.commitDaysAgo
      .map((n, i) => ({ date: daysAgo(n, 9 + (i % 8)), message: `Werk aan ${repo.meta.fullName.split('/')[1]} (${i + 1})` }))
      .filter((c) => c.date >= sinceIso)
  },
}
