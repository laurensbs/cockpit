import 'server-only'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Db } from '@/db'
import { fetchFor } from './connectors/run'
import { getSetting } from './settings'
import { fixturesAllowed } from './status'

// Reading his Vercel projects: which repository each deploys, its production domain and whether the
// last production deploy worked. Only GET requests; the token stays on his computer.

export const VERCEL_TOKEN_SETTING = 'vercel_token'
const API = 'https://api.vercel.com'

/** Where the Vercel CLI keeps its login, per system. */
function cliAuthPaths(): string[] {
  const home = homedir()
  if (process.platform === 'darwin') return [join(home, 'Library', 'Application Support', 'com.vercel.cli', 'auth.json')]
  if (process.platform === 'win32') return [join(process.env.APPDATA ?? join(home, 'AppData', 'Roaming'), 'com.vercel.cli', 'Data', 'auth.json'), join(process.env.APPDATA ?? '', 'com.vercel.cli', 'auth.json')]
  return [join(process.env.XDG_DATA_HOME ?? join(home, '.local', 'share'), 'com.vercel.cli', 'auth.json')]
}

let cliCache: { at: number; token: string | null } | null = null

/** The token of the Vercel CLI (`vercel login`), when it is installed and signed in. */
async function cliToken(): Promise<string | null> {
  if (cliCache && Date.now() - cliCache.at < 300_000) return cliCache.token
  let token: string | null = null
  for (const path of cliAuthPaths()) {
    try {
      const parsed = JSON.parse(await readFile(path, 'utf8')) as { token?: unknown }
      if (typeof parsed.token === 'string' && /^[A-Za-z0-9_-]{20,}$/.test(parsed.token)) {
        token = parsed.token
        break
      }
    } catch {
      // Not there, or not readable: no CLI login.
    }
  }
  cliCache = { at: Date.now(), token }
  return token
}

/** Where the Vercel token comes from: the settings, or the signed-in Vercel CLI. */
export async function vercelTokenSource(db: Db, ownerId: string): Promise<{ token: string | null; from: 'settings' | 'cli' | null }> {
  const stored = await getSetting(db, ownerId, VERCEL_TOKEN_SETTING)
  if (stored) return { token: stored, from: 'settings' }
  if (!(fixturesAllowed() && process.env.COCKPIT_NO_VERCEL_CLI === '1')) {
    const cli = await cliToken()
    if (cli) return { token: cli, from: 'cli' }
  }
  return { token: null, from: null }
}

export class VercelError extends Error {
  constructor(readonly status: number) {
    super(`vercel ${status}`)
  }
}

async function get<T>(token: string, path: string, params: Record<string, string | undefined> = {}): Promise<T> {
  const query = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => Boolean(e[1])))
  let res: Response
  try {
    res = await fetchFor()(`${API}${path}${query.size ? `?${query}` : ''}`, { headers: { Authorization: `Bearer ${token}` }, redirect: 'error', signal: AbortSignal.timeout(15_000) })
  } catch {
    throw new VercelError(0)
  }
  if (!res.ok) throw new VercelError(res.status)
  return (await res.json()) as T
}

export interface VercelProject {
  id: string
  name: string
  teamId: string | null
  link: { type?: string; org?: string; repo?: string } | null
}

/** Every project he can see: his own and those of his teams. */
export async function vercelProjects(token: string): Promise<VercelProject[]> {
  const teams = await get<{ teams?: { id: string }[] }>(token, '/v2/teams', { limit: '50' })
  const scopes: (string | null)[] = [null, ...(teams.teams ?? []).map((t) => t.id)]
  const out: VercelProject[] = []
  for (const teamId of scopes) {
    const r = await get<{ projects?: { id: string; name: string; link?: VercelProject['link'] }[] }>(token, '/v9/projects', { teamId: teamId ?? undefined, limit: '100' }).catch((error) => {
      // A scope the token may not read is skipped; anything else is a real failure.
      if (error instanceof VercelError && error.status === 403) return { projects: [] }
      throw error
    })
    for (const p of r.projects ?? []) if (!out.some((o) => o.id === p.id)) out.push({ id: p.id, name: p.name, teamId, link: p.link ?? null })
  }
  return out
}

export async function vercelDomains(token: string, project: VercelProject): Promise<{ name: string; verified?: boolean; redirect?: string | null }[]> {
  const r = await get<{ domains?: { name: string; verified?: boolean; redirect?: string | null }[] }>(token, `/v9/projects/${encodeURIComponent(project.id)}/domains`, { teamId: project.teamId ?? undefined, production: 'true' })
  return r.domains ?? []
}

/** The last production deploy: its state (READY, ERROR, BUILDING …) and id. */
export async function lastProductionDeploy(token: string, project: VercelProject): Promise<{ id: string; state: string; url: string | null } | null> {
  const r = await get<{ deployments?: { uid: string; state?: string; readyState?: string; url?: string }[] }>(token, '/v6/deployments', { projectId: project.id, teamId: project.teamId ?? undefined, target: 'production', limit: '1' })
  const d = r.deployments?.[0]
  return d ? { id: d.uid, state: d.state ?? d.readyState ?? 'UNKNOWN', url: d.url ? `https://${d.url}` : null } : null
}
