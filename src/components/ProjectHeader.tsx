import Link from 'next/link'
import { ProjectTabs, type ProjectTab } from './ProjectTabs'

/** The small header of a project's sub-pages: back, name, tabs. */
export function ProjectHeader({ project, active }: { project: { id: string; name: string }; active: ProjectTab }) {
  return (
    <header className="stack-m">
      <Link href="/projects" className="button ghost small" style={{ alignSelf: 'start' }}>
        ← Projecten
      </Link>
      <h1>{project.name}</h1>
      <ProjectTabs projectId={project.id} active={active} />
    </header>
  )
}
