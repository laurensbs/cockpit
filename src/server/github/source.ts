import 'server-only'
import { githubFixtures } from '../status'
import { fixtureSource } from './fixtures'

export interface RepoMeta {
  fullName: string
  isPrivate: boolean
  archived: boolean
  fork: boolean
  description: string
  homepage: string | null
  topics: string[]
  language: string | null
  pushedAt: string | null
}

export interface CommitInfo {
  date: string
  message: string
}

/** Everything the cockpit reads from GitHub. Read-only, by design. */
export interface GithubSource {
  listRepos(): Promise<RepoMeta[]>
  repo(fullName: string): Promise<RepoMeta | null>
  readme(fullName: string): Promise<string | null>
  /** Names of the files and folders in a folder ('' is the top), or null when it does not exist. */
  dir(fullName: string, path: string): Promise<string[] | null>
  file(fullName: string, path: string): Promise<string | null>
  commits(fullName: string, sinceIso: string): Promise<CommitInfo[]>
}

export class GithubError extends Error {
  constructor(
    readonly status: number,
    readonly reason: 'token' | 'rate' | 'http' | 'network',
  ) {
    super(`github ${reason} (${status})`)
  }
}

const API = 'https://api.github.com'

async function request(token: string, path: string, accept: string): Promise<string | null> {
  let res: Response
  try {
    res = await fetch(`${API}${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: accept, 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'cockpit' },
      signal: AbortSignal.timeout(12_000),
      cache: 'no-store',
    })
  } catch {
    throw new GithubError(0, 'network')
  }
  // 404: no such file or folder. 409: an empty repository has no commits yet.
  if (res.status === 404 || res.status === 409) return null
  if (res.status === 401) throw new GithubError(401, 'token')
  if (res.status === 403 || res.status === 429) throw new GithubError(res.status, 'rate')
  if (!res.ok) throw new GithubError(res.status, 'http')
  return res.text()
}

const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/')

interface ApiRepo {
  full_name: string
  private: boolean
  archived: boolean
  fork: boolean
  description: string | null
  homepage: string | null
  topics?: string[]
  language: string | null
  pushed_at: string | null
}

const toMeta = (r: ApiRepo): RepoMeta => ({
  fullName: r.full_name,
  isPrivate: r.private,
  archived: r.archived,
  fork: r.fork,
  description: r.description ?? '',
  homepage: r.homepage || null,
  topics: r.topics ?? [],
  language: r.language,
  pushedAt: r.pushed_at,
})

/** The GitHub REST API with a fine-grained, read-only token. Requests go one at a time, as GitHub asks. */
function apiSource(token: string): GithubSource {
  const json = async <T>(path: string): Promise<T | null> => {
    const body = await request(token, path, 'application/vnd.github+json')
    return body == null ? null : (JSON.parse(body) as T)
  }
  const raw = (path: string) => request(token, path, 'application/vnd.github.raw+json')
  return {
    async listRepos() {
      const all: RepoMeta[] = []
      for (let page = 1; page <= 3; page++) {
        const repos = await json<ApiRepo[]>(`/user/repos?affiliation=owner&sort=pushed&per_page=100&page=${page}`)
        if (!repos?.length) break
        all.push(...repos.map(toMeta))
        if (repos.length < 100) break
      }
      return all
    },
    async repo(fullName) {
      const r = await json<ApiRepo>(`/repos/${fullName}`)
      return r ? toMeta(r) : null
    },
    readme: (fullName) => raw(`/repos/${fullName}/readme`),
    async dir(fullName, path) {
      const entries = await json<{ name: string }[] | { name: string }>(`/repos/${fullName}/contents/${encodePath(path)}`)
      return Array.isArray(entries) ? entries.map((e) => e.name) : null
    },
    file: (fullName, path) => raw(`/repos/${fullName}/contents/${encodePath(path)}`),
    async commits(fullName, sinceIso) {
      const out: CommitInfo[] = []
      for (let page = 1; page <= 3; page++) {
        const commits = await json<{ commit: { message: string; author: { date: string } | null; committer: { date: string } | null } }[]>(
          `/repos/${fullName}/commits?since=${encodeURIComponent(sinceIso)}&per_page=100&page=${page}`,
        )
        if (!commits?.length) break
        for (const c of commits) {
          const date = c.commit.author?.date ?? c.commit.committer?.date
          if (date) out.push({ date, message: c.commit.message })
        }
        if (commits.length < 100) break
      }
      return out
    },
  }
}

/** The real API with the owner's token, the fixtures in tests, or null when there is no token. */
export function githubSource(token: string | null): GithubSource | null {
  if (githubFixtures()) return fixtureSource
  return token ? apiSource(token) : null
}
