import 'server-only'
import { and, eq, inArray } from 'drizzle-orm'
import type { Db } from '@/db'
import * as s from '@/db/schema'
import { dayOf } from '@/lib/dates'
import { bareHost, type Discovered, discordInvites, type Found, ga4PropertyFor, gscSiteFor, hostOfUrl, pickDomain, scanHtml, type SiteScan, vercelRepoOf } from '@/lib/discover'
import { ACTIVE_STAGES } from '@/lib/options'
import { normalizeUrl } from '@/lib/urls'
import { GOOGLE_ACCOUNT_SETTING, googleAccountEmail, listGa4Streams, listGscSites } from './connectors/google'
import { PLAUSIBLE_KEY_SETTING } from './connectors/plausible'
import { fetchFor } from './connectors/run'
import { getSetting, setSetting } from './settings'
import { lastProductionDeploy, vercelDomains, vercelProjects, type VercelProject, vercelTokenSource } from './vercel'

// Linking a project to what it already has, without him typing it: its site (from Vercel or GitHub),
// whether its last deploy works, and on the site itself Plausible, Google Analytics, Search Console and
// Discord. What is clear is linked when the project has nothing there yet; what he typed is never
// overwritten; what needs him once becomes a suggestion that says exactly what to do.

const GAP_MS = 6 * 3600_000
export const discoveredKey = (projectId: string) => `discovered:${projectId}`

export async function readDiscovered(db: Db, ownerId: string, projectId: string): Promise<Discovered | null> {
  const raw = await getSetting(db, ownerId, discoveredKey(projectId))
  if (!raw) return null
  try {
    return JSON.parse(raw) as Discovered
  } catch {
    return null
  }
}

/** One GET of the site's home page: its final address and at most 1 MB of HTML. */
async function readSite(url: string): Promise<{ finalUrl: string; html: string } | null> {
  try {
    const res = await fetchFor()(url, { redirect: 'follow', signal: AbortSignal.timeout(10_000), headers: { 'User-Agent': 'cockpit-discover', Accept: 'text/html' } })
    if (!res.ok || !/html/i.test(res.headers.get('content-type') ?? 'text/html')) return null
    const html = (await res.text()).slice(0, 1_000_000)
    return { finalUrl: res.url || url, html }
  } catch {
    return null
  }
}

/** What the run knows once, for all projects: the Vercel projects, the GA4 streams and the GSC sites. */
interface Shared {
  vercel: { token: string; projects: VercelProject[] } | null
  google: string | null
  ga4: Awaited<ReturnType<typeof listGa4Streams>> | null
  gsc: Awaited<ReturnType<typeof listGscSites>> | null
  googleEmail: string | null
  plausibleKey: boolean
}

async function sharedFor(db: Db, ownerId: string): Promise<Shared> {
  const [vt, google, plausibleKey, googleEmail] = await Promise.all([
    vercelTokenSource(db, ownerId),
    getSetting(db, ownerId, GOOGLE_ACCOUNT_SETTING),
    getSetting(db, ownerId, PLAUSIBLE_KEY_SETTING),
    googleAccountEmail(db, ownerId),
  ])
  let vercel: Shared['vercel'] = null
  if (vt.token) vercel = { token: vt.token, projects: await vercelProjects(vt.token).catch(() => []) }
  return { vercel, google, ga4: null, gsc: null, googleEmail, plausibleKey: Boolean(plausibleKey) }
}

export interface DiscoverRun {
  projects: number
  linked: number
}

/** Look for every active project (or one), at most every six hours unless forced. */
export async function discoverAll(db: Db, ownerId: string, { projectId, force = false, now = new Date() }: { projectId?: string; force?: boolean; now?: Date } = {}): Promise<DiscoverRun> {
  const lock = globalThis as unknown as { __cockpitDiscovering?: Set<string> }
  lock.__cockpitDiscovering ??= new Set()
  if (lock.__cockpitDiscovering.has(ownerId)) return { projects: 0, linked: 0 }
  lock.__cockpitDiscovering.add(ownerId)
  try {
    const projects = (await db.select().from(s.project).where(eq(s.project.ownerId, ownerId))).filter(
      (p) => (projectId ? p.id === projectId : (ACTIVE_STAGES as readonly string[]).includes(p.stage)),
    )
    const due: typeof projects = []
    for (const p of projects) {
      const last = await readDiscovered(db, ownerId, p.id)
      if (force || !last || now.getTime() - Date.parse(last.at) >= GAP_MS) due.push(p)
    }
    if (!due.length) return { projects: 0, linked: 0 }
    const shared = await sharedFor(db, ownerId)
    let linked = 0
    for (const p of due) linked += await discoverProject(db, ownerId, p, shared, now)
    return { projects: due.length, linked }
  } finally {
    lock.__cockpitDiscovering.delete(ownerId)
  }
}

async function discoverProject(db: Db, ownerId: string, project: typeof s.project.$inferSelect, shared: Shared, now: Date): Promise<number> {
  const previous = await readDiscovered(db, ownerId, project.id)
  const dismissed = new Set(previous?.dismissed ?? [])
  const items: Found[] = []
  let linked = 0
  const [repos, connectors] = await Promise.all([
    db.select({ fullName: s.repo.fullName, homepage: s.repo.homepage, readme: s.repo.readme }).from(s.repo).where(and(eq(s.repo.ownerId, ownerId), eq(s.repo.projectId, project.id))),
    db.select({ kind: s.connector.kind, config: s.connector.config }).from(s.connector).where(eq(s.connector.projectId, project.id)),
  ])
  const has = (kind: string) => connectors.some((c) => c.kind === kind)
  const link = async (kind: string, config: Record<string, string>) => {
    if (has(kind) || dismissed.has(kind)) return false
    const rows = await db
      .insert(s.connector)
      .values({ id: crypto.randomUUID(), ownerId, projectId: project.id, kind, config: { ...config, via: 'auto' }, enabled: true })
      .onConflictDoNothing()
      .returning({ id: s.connector.id })
    if (rows.length) {
      connectors.push({ kind, config })
      linked++
    }
    return rows.length > 0
  }

  // 1. Vercel: the project that deploys one of its repositories, its domain and its last deploy.
  let vercelInfo: Discovered['vercel']
  let site: { url: string; from: string } | null = project.siteUrl ? { url: project.siteUrl, from: 'al ingesteld' } : null
  const repoNames = repos.map((r) => r.fullName.toLowerCase())
  const vp = shared.vercel?.projects.find((v) => {
    const repo = vercelRepoOf(v.link)
    return repo != null && repoNames.includes(repo)
  })
  if (shared.vercel && vp) {
    const [domains, deploy] = await Promise.all([vercelDomains(shared.vercel.token, vp).catch(() => []), lastProductionDeploy(shared.vercel.token, vp).catch(() => null)])
    const domain = pickDomain(domains)
    vercelInfo = { name: vp.name, state: deploy?.state ?? null, url: domain ? `https://${domain}` : (deploy?.url ?? null) }
    items.push({ kind: 'vercel', value: vp.name, from: 'via Vercel', status: 'linked' })
    if (!site && domain) site = { url: `https://${domain}`, from: 'via Vercel' }
    if (deploy?.state === 'ERROR') {
      await db
        .insert(s.quest)
        .values({
          id: crypto.randomUUID(),
          ownerId,
          projectId: project.id,
          title: `De laatste deploy van ${project.name} faalt`,
          detail: `Vercel (${vp.name}) zegt dat de laatste productie-deploy mislukte. Kijk de build-log na in Vercel; je site draait nog op de vorige versie.`,
          kind: 'custom',
          xp: 25,
          source: 'rule',
          sourceKey: `vercel-deploy:${project.id}:${deploy.id}`,
          dueOn: dayOf(now),
        })
        .onConflictDoNothing()
    }
  }
  // 2. Without Vercel: the address on the GitHub repository.
  if (!site) {
    const homepage = repos.map((r) => (r.homepage ? normalizeUrl(r.homepage) : null)).find(Boolean)
    if (homepage) site = { url: homepage, from: 'via GitHub' }
  }
  if (site && !project.siteUrl) {
    await db.update(s.project).set({ siteUrl: site.url, updatedAt: now }).where(and(eq(s.project.id, project.id), eq(s.project.ownerId, ownerId)))
    linked++
  }
  if (site) items.push({ kind: 'site', value: site.url, from: site.from, status: 'linked' })

  // 3. The site itself, and the README: which tools run there.
  const page = site ? await readSite(site.url) : null
  const scan: SiteScan = page ? scanHtml(page.html) : scanHtml('')
  const host = hostOfUrl(page?.finalUrl ?? site?.url)
  const invites = [...new Set([...scan.discord, ...repos.flatMap((r) => discordInvites(r.readme ?? ''))])]

  if (invites.length && !dismissed.has('discord')) {
    const from = scan.discord.length ? 'op je site' : 'in je README'
    const ok = has('discord') || (await link('discord', { invite: invites[0] }))
    items.push({ kind: 'discord', value: `discord.gg/${invites[0]}`, from, status: ok ? 'linked' : 'seen' })
  }

  if (scan.plausible && !dismissed.has('plausible')) {
    const ok = has('plausible') || (shared.plausibleKey && (await link('plausible', { siteId: scan.plausible })))
    items.push(
      ok
        ? { kind: 'plausible', value: scan.plausible, from: 'op je site', status: 'linked' }
        : { kind: 'plausible', value: scan.plausible, from: 'op je site', status: 'suggested', todo: 'Plak één keer je Plausible-sleutel in Instellingen → Bronnen; daarna koppelt de cockpit al je sites zelf.' },
    )
  }

  if ((scan.ga4.length || (shared.google && host)) && !dismissed.has('ga4')) {
    let property: string | null = null
    if (shared.google && !has('ga4')) {
      shared.ga4 ??= await listGa4Streams(fetchFor(), shared.google).catch(() => [])
      property = ga4PropertyFor(scan.ga4, host, shared.ga4)
    }
    const ok = has('ga4') || (property != null && (await link('ga4', { propertyId: property })))
    if (ok) items.push({ kind: 'ga4', value: property ?? connectors.find((c) => c.kind === 'ga4')?.config.propertyId ?? '', from: property ? 'via Google' : 'al gekoppeld', status: 'linked' })
    else if (scan.ga4.length)
      items.push({
        kind: 'ga4',
        value: scan.ga4[0],
        from: 'op je site',
        status: 'suggested',
        todo: shared.googleEmail
          ? `Maak ${shared.googleEmail} lezer in Google Analytics (Beheer → Toegangsbeheer voor de property); de volgende ronde koppelt de cockpit hem zelf.`
          : 'Zet één keer het Google-service-account in Instellingen → Bronnen; daarna koppelt de cockpit Google Analytics zelf.',
      })
  }

  if (host && !dismissed.has('gsc')) {
    let gscSite: string | null = null
    if (shared.google && !has('gsc')) {
      shared.gsc ??= await listGscSites(fetchFor(), shared.google).catch(() => [])
      gscSite = gscSiteFor(host, shared.gsc)
    }
    const ok = has('gsc') || (gscSite != null && (await link('gsc', { siteUrl: gscSite })))
    if (ok) items.push({ kind: 'gsc', value: gscSite ?? connectors.find((c) => c.kind === 'gsc')?.config.siteUrl ?? '', from: gscSite ? 'via Google' : 'al gekoppeld', status: 'linked' })
    else if (shared.googleEmail)
      items.push({ kind: 'gsc', value: `sc-domain:${bareHost(host)}`, from: 'je site', status: 'suggested', todo: `Voeg ${shared.googleEmail} toe als gebruiker in Search Console (Instellingen → Gebruikers en rechten, met Beperkt); de volgende ronde koppelt de cockpit hem zelf.` })
  }

  if (scan.stripe && !has('stripe') && !has('mollie'))
    items.push({ kind: 'stripe', value: 'betalingen', from: 'op je site', status: 'suggested', todo: 'Koppel Stripe onder Cijfers met een sleutel die alleen kan lezen (rk_…); welk Stripe-account bij dit project hoort, kan de cockpit niet zien.' })
  if (scan.vercelAnalytics) items.push({ kind: 'vercel-analytics', value: 'staat aan', from: 'op je site', status: 'seen' })

  const discovered: Discovered = { at: now.toISOString(), items, vercel: vercelInfo, dismissed: [...dismissed] }
  await setSetting(db, ownerId, discoveredKey(project.id), JSON.stringify(discovered))
  return linked
}

/** He undid something the cockpit linked: the source goes, and it is never linked on its own again. */
export async function undoFound(db: Db, ownerId: string, projectId: string, kind: string): Promise<void> {
  const current = (await readDiscovered(db, ownerId, projectId)) ?? { at: new Date(0).toISOString(), items: [] }
  if (['plausible', 'ga4', 'gsc', 'discord'].includes(kind)) {
    const rows = await db
      .select({ id: s.connector.id, config: s.connector.config })
      .from(s.connector)
      .where(and(eq(s.connector.ownerId, ownerId), eq(s.connector.projectId, projectId), eq(s.connector.kind, kind)))
    const auto = rows.filter((r) => r.config.via === 'auto').map((r) => r.id)
    if (auto.length) await db.delete(s.connector).where(inArray(s.connector.id, auto))
  }
  const next: Discovered = { ...current, items: current.items.filter((i) => i.kind !== kind), dismissed: [...new Set([...(current.dismissed ?? []), kind])] }
  await setSetting(db, ownerId, discoveredKey(projectId), JSON.stringify(next))
}

