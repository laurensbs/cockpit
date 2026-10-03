import Link from 'next/link'
import { activeDays, daysSinceLast, series } from '@/lib/activity'
import { STAGE_LABELS, isStage } from '@/lib/options'
import type { ProjectSummary } from '@/server/queries'
import { Sparkline } from './Sparkline'

function quietLabel(days: number | null, hasRepos: boolean): string {
  if (!hasRepos) return 'Nog geen repo'
  if (days === null) return 'Nog geen commits gezien'
  if (days === 0) return 'Vandaag gecommit'
  if (days === 1) return 'Gisteren gecommit'
  return `${days} dagen stil`
}

export function ProjectCard({ project, today }: { project: ProjectSummary; today: string }) {
  const spark = series(project.commitDays, today, 30)
  const quiet = daysSinceLast(project.commitDays, today)
  const errors = project.repos.filter((r) => r.syncError).length
  return (
    <Link href={`/projects/${project.id}`} className="card stack-s project-card">
      <div className="row between nowrap">
        <div className="row nowrap grow">
          <span className="dot" style={{ background: project.companyColor }} />
          <h3 className="grow" style={{ overflowWrap: 'anywhere' }}>
            {project.name}
          </h3>
        </div>
        <span className="chip accent">{isStage(project.stage) ? STAGE_LABELS[project.stage] : project.stage}</span>
      </div>
      <p className={`small ${project.oneLiner ? '' : 'faint'}`}>{project.oneLiner || 'Nog geen one-liner'}</p>
      {project.repos.length ? <Sparkline values={spark} label={`${activeDays(project.commitDays, today, 30)} actieve dagen in 30 dagen`} /> : null}
      <div className="row between tiny muted">
        <span>{quietLabel(quiet, project.repos.length > 0)}</span>
        {errors ? <span className="chip warn">GitHub: {errors} fout</span> : project.repos.length ? <span>{project.repos.length} repo{project.repos.length === 1 ? '' : "'s"}</span> : null}
      </div>
    </Link>
  )
}
