import 'server-only'
import { and, asc, eq, sql } from 'drizzle-orm'
import type { Db } from '@/db'
import * as s from '@/db/schema'
import { commitDaysFrom, trimCommitDays } from '@/lib/activity'
import { addDays, dayOf } from '@/lib/dates'
import { changeOf } from '@/lib/github-work'
import { clip, redactSecrets } from '@/lib/redact'
import { pickDocs } from '@/lib/repo-docs'
import { packageJsonPath, tagsFromFileNames, tagsFromPackageJson } from '@/lib/stack'
import { githubToken } from '../settings'
import { GithubError, githubSource, type GithubSource } from './source'

const README_MAX = 12_000
const DOC_MAX = 6_000
const DOCS_TOTAL_MAX = 24_000
const HISTORY_DAYS = 90

type RepoRow = typeof s.repo.$inferSelect

const cleanText = (text: string, max: number) => clip(redactSecrets(text.replace(/\r\n/g, '\n')).trim(), max)

/** A short reason for the owner, never a token or a URL. */
export function syncErrorText(error: unknown): string {
  if (error instanceof GithubError) {
    if (error.reason === 'token') return 'GitHub weigert de token: verlopen of geen toegang tot deze repo.'
    if (error.reason === 'rate') return 'GitHub vraagt even te wachten (limiet). Probeer het later opnieuw.'
    if (error.reason === 'network') return 'GitHub was niet bereikbaar.'
    return `GitHub gaf een fout (${error.status}).`
  }
  return 'Ophalen lukte niet.'
}

async function readContent(source: GithubSource, fullName: string, language: string | null) {
  const readme = (await source.readme(fullName)) ?? ''
  const top = (await source.dir(fullName, '')) ?? []
  const pkgPath = packageJsonPath(top)
  const pkg = pkgPath ? await source.file(fullName, pkgPath) : null
  const stack = [...new Set([...tagsFromFileNames(top), ...(pkg ? tagsFromPackageJson(pkg) : []), ...(language ? [language] : [])])]
  const docs: { path: string; text: string }[] = []
  if (top.includes('docs')) {
    const names = (await source.dir(fullName, 'docs')) ?? []
    let total = 0
    for (const path of pickDocs(names.map((n) => `docs/${n}`))) {
      if (total >= DOCS_TOTAL_MAX) break
      const text = await source.file(fullName, path)
      if (!text) continue
      const clean = cleanText(text, Math.min(DOC_MAX, DOCS_TOTAL_MAX - total))
      total += clean.length
      docs.push({ path, text: clean })
    }
  }
  return { readme: cleanText(readme, README_MAX), stack, docs }
}

/**
 * Reads one repository again. README, docs and commits are only fetched when GitHub says something
 * was pushed since the last time; otherwise just the details are refreshed.
 */
export async function syncRepo(db: Db, row: RepoRow, now = new Date()): Promise<{ ok: boolean; error?: string }> {
  const source = githubSource(await githubToken(db, row.ownerId))
  if (!source) return { ok: false, error: 'Geen GitHub-token ingesteld.' }
  try {
    const meta = await source.repo(row.fullName)
    if (!meta) {
      const error = 'Repo niet gevonden: hernoemd, verwijderd, of de token mag er niet bij.'
      await db.update(s.repo).set({ syncError: error, syncedAt: now }).where(eq(s.repo.id, row.id))
      return { ok: false, error }
    }
    const pushedAt = meta.pushedAt ? new Date(meta.pushedAt) : null
    const changed = !row.syncedAt || !row.pushedAt || !pushedAt || pushedAt.getTime() !== row.pushedAt.getTime()
    const details = {
      isPrivate: meta.isPrivate,
      archived: meta.archived,
      description: cleanText(meta.description, 500),
      homepage: meta.homepage,
      topics: meta.topics,
      language: meta.language,
      pushedAt,
      syncedAt: now,
      syncError: null,
    }
    if (!changed) {
      await db.update(s.repo).set(details).where(eq(s.repo.id, row.id))
      return { ok: true }
    }
    const content = await readContent(source, row.fullName, meta.language)
    const today = dayOf(now)
    const since = addDays(today, -HISTORY_DAYS)
    const commits = await source.commits(row.fullName, `${since}T00:00:00Z`)
    // Fresh counts replace the days GitHub returned; older stored days stay (a very busy repo can
    // have more commits in 90 days than the 300 we fetch).
    const freshDays = commitDaysFrom(commits.map((c) => c.date))
    const oldest = commits.length ? dayOf(new Date(commits.reduce((min, c) => (c.date < min ? c.date : min), commits[0].date))) : today
    const kept = Object.fromEntries(Object.entries(row.commitDays).filter(([day]) => day < oldest))
    const commitDays = trimCommitDays({ ...kept, ...freshDays }, since)
    const recentCommits = [...commits]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 20)
      .map((c) => ({ date: c.date, message: cleanText(c.message.split('\n')[0], 140) }))
    // The work in progress: the newest pull requests, and what the newest commits changed (3 new at most per sync).
    const pulls = (await source.pulls(row.fullName)).map((p) => ({ ...p, title: cleanText(p.title, 140), body: cleanText(p.body, 300) }))
    const known = new Set(row.recentChanges.map((c) => c.sha))
    const fresh = [...commits].sort((a, b) => b.date.localeCompare(a.date)).filter((c) => c.sha && !known.has(c.sha)).slice(0, 3)
    const changes = []
    for (const c of fresh) {
      const detail = await source.commitFiles(row.fullName, c.sha!)
      if (detail) changes.push(changeOf({ sha: c.sha!, date: c.date, message: cleanText(c.message, 300) }, detail.files))
    }
    const recentChanges = [...changes, ...row.recentChanges].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10)
    await db
      .update(s.repo)
      .set({ ...details, ...content, commitDays, recentCommits, recentPulls: pulls, recentChanges })
      .where(eq(s.repo.id, row.id))
    return { ok: true }
  } catch (error) {
    const message = syncErrorText(error)
    await db.update(s.repo).set({ syncError: message, syncedAt: now }).where(eq(s.repo.id, row.id))
    return { ok: false, error: message }
  }
}

/** Syncs the owner's repositories, stalest first, until the time budget runs out. */
export async function syncAll(db: Db, ownerId: string, budgetMs: number): Promise<{ synced: number; failed: number; left: number }> {
  const started = Date.now()
  const rows = await db
    .select()
    .from(s.repo)
    .where(and(eq(s.repo.ownerId, ownerId), eq(s.repo.archived, false)))
    .orderBy(sql`${s.repo.syncedAt} asc nulls first`, asc(s.repo.fullName))
  let synced = 0
  let failed = 0
  for (const row of rows) {
    if (Date.now() - started > budgetMs) break
    const result = await syncRepo(db, row)
    if (result.ok) synced++
    else failed++
  }
  return { synced, failed, left: rows.length - synced - failed }
}
