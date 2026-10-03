import Link from 'next/link'
import { Icon } from '@/components/Icon'
import { ProjectCard } from '@/components/ProjectCard'
import { StarterSetup } from '@/components/StarterSetup'
import { SyncButton } from '@/components/SyncButton'
import { getDb } from '@/db'
import { dayOf } from '@/lib/dates'
import { ACTIVE_STAGES, STAGES, STAGE_LABELS, isStage } from '@/lib/options'
import { STARTER_PROJECTS } from '@/lib/starter'
import { githubSource } from '@/server/github/source'
import { projectSummaries, type ProjectSummary } from '@/server/queries'
import { requireOwner } from '@/server/session'

export const metadata = { title: 'Projecten' }

async function repoNames(): Promise<string[]> {
  try {
    const source = githubSource()
    return source ? (await source.listRepos()).filter((r) => !r.archived).map((r) => r.fullName) : []
  } catch {
    return []
  }
}

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const owner = await requireOwner('/projects')
  const view = (await searchParams).view === 'stage' ? 'stage' : 'company'
  const db = await getDb()
  const projects = await projectSummaries(db, owner.userId)
  const today = dayOf(new Date())

  if (!projects.length) {
    return (
      <div className="stack-l">
        <header className="stack-s">
          <p className="eyebrow">Start</p>
          <h1>Zet je projecten erin</h1>
          <p className="lede">
            Dit bouw je nu. Klopt een naam of repo niet? Pas hem aan. Wat nog niet op GitHub staat, krijgt later een repo. Elk project krijgt
            een eigen bedrijf; groeperen kan daarna.
          </p>
        </header>
        <StarterSetup starters={STARTER_PROJECTS} repoNames={await repoNames()} github={githubSource() !== null} />
      </div>
    )
  }

  const groups: { key: string; title: string; color?: string; projects: ProjectSummary[] }[] = []
  if (view === 'stage') {
    for (const stage of STAGES) {
      const list = projects.filter((p) => p.stage === stage)
      if (list.length) groups.push({ key: stage, title: STAGE_LABELS[stage], projects: list })
    }
  } else {
    for (const p of projects) {
      const key = p.companyId ?? 'none'
      let group = groups.find((g) => g.key === key)
      if (!group) {
        group = { key, title: p.companyName ?? 'Zonder bedrijf', color: p.companyColor, projects: [] }
        groups.push(group)
      }
      group.projects.push(p)
    }
    // A company that is just its one project (Rondje → Rondje) needs no heading of its own:
    // those cards go together, the real groups (several projects, or a client) keep a title.
    const solo = groups.filter((g) => g.projects.length === 1 && g.projects[0].name === g.title)
    if (solo.length > 1) {
      const rest = groups.filter((g) => !solo.includes(g))
      groups.splice(0, groups.length, { key: 'solo', title: '', projects: solo.flatMap((g) => g.projects) }, ...rest)
    }
  }
  const active = projects.filter((p) => isStage(p.stage) && ACTIVE_STAGES.includes(p.stage)).length

  return (
    <div className="stack-l">
      <header className="row between">
        <div className="stack-xs">
          <h1>Projecten</h1>
          <p className="muted small">
            {active} actief · {projects.length} totaal
          </p>
        </div>
        <div className="row">
          <SyncButton />
          <Link href="/github" className="button secondary small">
            <Icon name="branch" size={16} /> GitHub
          </Link>
          <Link href="/projects/new" className="button primary small">
            <Icon name="plus" size={16} /> Nieuw
          </Link>
        </div>
      </header>
      <nav className="segmented" aria-label="Weergave">
        <Link href="/projects" aria-current={view === 'company' ? 'page' : undefined}>
          Per bedrijf
        </Link>
        <Link href="/projects?view=stage" aria-current={view === 'stage' ? 'page' : undefined}>
          Per fase
        </Link>
      </nav>
      {groups.map((g) => (
        <section key={g.key} className="stack-m">
          {g.title ? (
            <h2 className="row">
              {g.color ? <span className="dot" style={{ background: g.color }} /> : null}
              {g.title}
            </h2>
          ) : null}
          <div className="grid">
            {g.projects.map((p) => (
              <ProjectCard key={p.id} project={p} today={today} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
