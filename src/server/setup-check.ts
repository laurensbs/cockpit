import 'server-only'
import { execFile } from 'node:child_process'
import { resolveMx, resolveTxt } from 'node:dns/promises'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { and, eq, inArray, ne } from 'drizzle-orm'
import type { Db } from '@/db'
import * as s from '@/db/schema'
import { detectSetup, envExampleKeys, ownDomain, type Raw, vercelEnvNames } from '@/lib/setup-detect'
import { ACCOUNT_KEYS, type SetupRow, type SetupSource, type SetupStatus, setupProjectFrom, setupView, type SetupView } from '@/lib/setup'
import { socialsOf } from '@/lib/socials'
import { getPage } from './prospect-web'
import { fixturesAllowed } from './status'

// Looks for itself at what a project has arranged: DNS for mail, the homepage, Trustpilot, the App Store
// and, for a project linked to Vercel, which key names are in production (`vercel env ls`, names only).

const fake = () => fixturesAllowed() && process.env.COCKPIT_FAKE_WEB === '1'

async function dnsMx(domain: string): Promise<string[] | null> {
  try {
    return (await resolveMx(domain)).sort((a, b) => a.priority - b.priority).map((m) => m.exchange)
  } catch (error) {
    return (error as { code?: string }).code === 'ENODATA' || (error as { code?: string }).code === 'ENOTFOUND' ? [] : null
  }
}

async function hasTxt(name: string, pattern: RegExp): Promise<boolean | null> {
  try {
    return (await resolveTxt(name)).some((parts) => pattern.test(parts.join('')))
  } catch (error) {
    return (error as { code?: string }).code === 'ENODATA' || (error as { code?: string }).code === 'ENOTFOUND' ? false : null
  }
}

async function status(url: string): Promise<number | null> {
  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(10_000), headers: { 'User-Agent': 'Mozilla/5.0 (cockpit setup check)' } })
    return res.status
  } catch {
    return null
  }
}

/** An app of his in the App Store with exactly this name (the seller must look like him). */
async function appStore(name: string): Promise<string | null> {
  try {
    const res = await fetch(`https://itunes.apple.com/search?entity=software&limit=25&term=${encodeURIComponent(name)}`, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return null
    const data = (await res.json()) as { results?: { trackName?: string; sellerName?: string; artistName?: string; trackViewUrl?: string }[] }
    const hit = (data.results ?? []).find((r) => r.trackName?.toLowerCase().trim() === name.toLowerCase().trim() && /laurens|bos|webstability|teampje|rondje/i.test(`${r.sellerName} ${r.artistName}`))
    return hit?.trackViewUrl ?? ''
  } catch {
    return null
  }
}

function exampleKeys(dir: string): string[] | null {
  for (const name of ['.env.example', '.env.local.example', 'web/.env.example']) {
    const file = join(dir, name)
    try {
      if (existsSync(/*turbopackIgnore: true*/ file)) return envExampleKeys(readFileSync(/*turbopackIgnore: true*/ file, 'utf8'))
    } catch {
      return null
    }
  }
  return null
}

/** The key names in production, for a folder linked to Vercel; never the values. */
function productionKeys(dir: string): Promise<string[] | null> {
  if (!existsSync(/*turbopackIgnore: true*/ join(dir, '.vercel', 'project.json'))) return Promise.resolve(null)
  return new Promise((resolve) => {
    execFile('vercel', ['env', 'ls', 'production'], { cwd: dir, timeout: 120_000, env: { ...process.env, CI: '1', FORCE_COLOR: '0' }, maxBuffer: 1024 * 1024 }, (error, stdout) => {
      resolve(error ? null : vercelEnvNames(String(stdout)))
    })
  })
}

async function gather(project: { name: string; siteUrl: string | null; localPath: string | null; links: unknown; what: string; oneLiner: string }): Promise<Raw> {
  const socials = Object.keys(socialsOf(project.links as never)).length
  if (fake()) {
    return { siteUrl: project.siteUrl, mx: project.siteUrl ? ['mx.voorbeeld.example.'] : null, spf: true, dmarc: true, html: project.siteUrl ? '<a href="/privacy">Privacy</a>' : null, trustpilot: false, appStore: null, socials, example: null, production: null }
  }
  const domain = ownDomain(project.siteUrl)
  const kind = setupProjectFrom(project)
  const [mx, spf, dmarc, html, trustpilot, store, production] = await Promise.all([
    domain ? dnsMx(domain) : Promise.resolve(null),
    domain ? hasTxt(domain, /^v=spf1/i) : Promise.resolve(null),
    domain ? hasTxt(`_dmarc.${domain}`, /^v=DMARC1/i) : Promise.resolve(null),
    project.siteUrl ? getPage(project.siteUrl) : Promise.resolve(null),
    domain ? status(`https://www.trustpilot.com/review/${domain}`).then((code) => (code === 200 ? true : code === 404 ? false : null)) : Promise.resolve(null),
    kind.app ? appStore(project.name) : Promise.resolve(null),
    project.localPath ? productionKeys(project.localPath) : Promise.resolve(null),
  ])
  return { siteUrl: project.siteUrl, mx, spf, dmarc, html, trustpilot, appStore: store, socials, example: project.localPath ? exampleKeys(project.localPath) : null, production }
}

export async function saveSetupRows(db: Db, ownerId: string, projectId: string, rows: readonly SetupRow[]): Promise<void> {
  for (const r of rows) {
    await db
      .insert(s.setupItem)
      .values({ id: crypto.randomUUID(), ownerId, projectId, key: r.key, source: r.source, status: r.status, note: r.note.slice(0, 400), updatedAt: new Date() })
      .onConflictDoUpdate({ target: [s.setupItem.projectId, s.setupItem.key, s.setupItem.source], set: { status: r.status, note: r.note.slice(0, 400), updatedAt: new Date() } })
  }
}

/** Checks every project that markets (or one), and keeps what it found. */
export async function checkSetup(db: Db, ownerId: string, projectId?: string): Promise<number> {
  const projects = (await db.select().from(s.project).where(eq(s.project.ownerId, ownerId))).filter((p) => (!projectId || p.id === projectId) && !/marketing staat uit/i.test(`${p.what} ${p.redLines}`))
  let checked = 0
  for (const p of projects) {
    const rows = detectSetup(await gather(p))
    await saveSetupRows(db, ownerId, p.id, rows)
    checked++
  }
  return checked
}

/** The checklist of one project, as he sees it. */
export async function loadSetup(db: Db, project: { id: string; ownerId: string; what: string; oneLiner: string; siteUrl: string | null; localPath: string | null }): Promise<SetupView[]> {
  const rows = await db.select({ key: s.setupItem.key, source: s.setupItem.source, status: s.setupItem.status, note: s.setupItem.note }).from(s.setupItem).where(eq(s.setupItem.projectId, project.id))
  // An Apple or Google developer account he made for one app counts for all of them.
  const accounts = await db
    .select({ key: s.setupItem.key, source: s.setupItem.source, name: s.project.name })
    .from(s.setupItem)
    .innerJoin(s.project, eq(s.project.id, s.setupItem.projectId))
    .where(and(eq(s.setupItem.ownerId, project.ownerId), inArray(s.setupItem.key, [...ACCOUNT_KEYS]), eq(s.setupItem.status, 'done'), ne(s.setupItem.projectId, project.id), ne(s.setupItem.source, 'claude')))
  const shared: SetupRow[] = accounts.map((a) => ({ key: a.key, source: a.source as SetupSource, status: 'done', note: `al geregeld via ${a.name}` }))
  return setupView(setupProjectFrom(project), [...rows.map((r) => ({ key: r.key, source: r.source as SetupSource, status: r.status as SetupStatus, note: r.note })), ...shared])
}

/** His own word on a step ("done", "not needed"), or null to take it back. */
export async function setOwnStatus(db: Db, ownerId: string, projectId: string, key: string, status: SetupStatus | null): Promise<void> {
  if (status === null) {
    await db.delete(s.setupItem).where(and(eq(s.setupItem.projectId, projectId), eq(s.setupItem.key, key), eq(s.setupItem.source, 'jij')))
    return
  }
  await saveSetupRows(db, ownerId, projectId, [{ key, source: 'jij', status, note: '' }])
}
