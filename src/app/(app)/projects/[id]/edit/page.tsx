import { and, eq } from 'drizzle-orm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ConfirmButton } from '@/components/ConfirmButton'
import { ProjectForm } from '@/components/ProjectForm'
import { getDb } from '@/db'
import * as s from '@/db/schema'
import { deleteProject } from '@/server/actions/projects'
import { companiesOf } from '@/server/queries'
import { requireOwner } from '@/server/session'

export const metadata = { title: 'Project bewerken' }

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const owner = await requireOwner(`/projects/${id}/edit`)
  const db = await getDb()
  const [project] = await db
    .select()
    .from(s.project)
    .where(and(eq(s.project.id, id), eq(s.project.ownerId, owner.userId)))
  if (!project) notFound()
  const companies = await companiesOf(db, owner.userId)
  return (
    <div className="stack-l">
      <header className="stack-s">
        <Link href={`/projects/${id}`} className="button ghost small" style={{ alignSelf: 'start' }}>
          ← {project.name}
        </Link>
        <h1>Bewerken</h1>
      </header>
      <ProjectForm values={project} companies={companies.map((c) => ({ id: c.id, name: c.name }))} />
      <section className="card flat stack-s">
        <h2>Verwijderen</h2>
        <p className="muted small">Weg met alles: concepten, quests en cijfers van dit project. Je repo’s op GitHub blijven gewoon bestaan.</p>
        <ConfirmButton action={deleteProject.bind(null, id)} label="Project verwijderen" confirm="Zeker weten? Dit kan niet terug." />
      </section>
    </div>
  )
}
