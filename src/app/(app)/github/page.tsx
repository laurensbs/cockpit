import { asc, eq } from 'drizzle-orm'
import Link from 'next/link'
import { RepoAssign } from '@/components/RepoAssign'
import { RepoImport, type ImportableRepo } from '@/components/RepoImport'
import { getDb } from '@/db'
import * as s from '@/db/schema'
import { suggestGroups } from '@/lib/group-repos'
import { ago } from '@/lib/time'
import { githubSource, type RepoMeta } from '@/server/github/source'
import { syncErrorText } from '@/server/github/sync'
import { requireOwner } from '@/server/session'
import { githubToken } from '@/server/settings'

export const metadata = { title: 'GitHub' }

export default async function GithubPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const owner = await requireOwner('/github')
  const db = await getDb()
  const projects = await db
    .select({ id: s.project.id, name: s.project.name })
    .from(s.project)
    .where(eq(s.project.ownerId, owner.userId))
    .orderBy(asc(s.project.sortOrder), asc(s.project.name))
  const linked = await db
    .select({ id: s.repo.id, fullName: s.repo.fullName, projectId: s.repo.projectId })
    .from(s.repo)
    .where(eq(s.repo.ownerId, owner.userId))
    .orderBy(asc(s.repo.fullName))
  const requested = (await searchParams).project
  const defaultProject = projects.some((p) => p.id === requested) ? requested! : ''

  const source = githubSource(await githubToken(db, owner.userId))
  let all: RepoMeta[] = []
  let error: string | null = null
  if (source) {
    try {
      all = await source.listRepos()
    } catch (e) {
      error = syncErrorText(e)
    }
  }
  const known = new Set(linked.map((r) => r.fullName))
  const now = new Date()
  const toItem = (r: RepoMeta): ImportableRepo => ({
    fullName: r.fullName,
    description: r.description,
    isPrivate: r.isPrivate,
    pushedLabel: r.pushedAt ? ago(new Date(r.pushedAt), now) : '',
  })
  const fresh = all.filter((r) => !known.has(r.fullName) && !r.fork)
  const live = fresh.filter((r) => !r.archived)
  const archived = fresh.filter((r) => r.archived)
  const byName = new Map(live.map((r) => [r.fullName, r]))
  const groups = suggestGroups(live.map((r) => r.fullName)).map((g) => g.map((n) => toItem(byName.get(n)!)))

  return (
    <div className="stack-l">
      <header className="stack-s">
        <h1>GitHub</h1>
        <p className="lede">Kies welke repo’s bij welk project horen. De cockpit leest alleen: README, docs, stack en commits.</p>
      </header>
      {!source ? (
        <p className="notice warn">
          GitHub is nog niet gekoppeld. Zet een alleen-lezen token bij de <Link href="/settings">instellingen</Link>.
        </p>
      ) : null}
      {error ? <p className="notice bad">{error}</p> : null}
      {source && !error ? <RepoImport groups={groups} projects={projects} defaultProject={defaultProject} /> : null}
      {linked.length ? (
        <section className="card stack-m">
          <h2>Gekoppeld</h2>
          <ul className="list">
            {linked.map((r) => (
              <li key={r.id} className="row between">
                <span style={{ overflowWrap: 'anywhere' }}>{r.fullName}</span>
                <RepoAssign repoId={r.id} projectId={r.projectId} projects={projects} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {archived.length ? (
        <details className="card">
          <summary className="label">Gearchiveerd op GitHub ({archived.length})</summary>
          <ul className="list small muted">
            {archived.map((r) => (
              <li key={r.fullName}>
                {r.fullName} {r.description ? `· ${r.description}` : ''}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  )
}
