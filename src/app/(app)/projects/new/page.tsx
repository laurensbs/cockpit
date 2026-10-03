import Link from 'next/link'
import { EMPTY_PROJECT, ProjectForm } from '@/components/ProjectForm'
import { getDb } from '@/db'
import { companiesOf } from '@/server/queries'
import { requireOwner } from '@/server/session'

export const metadata = { title: 'Nieuw project' }

export default async function NewProjectPage() {
  const owner = await requireOwner('/projects/new')
  const companies = await companiesOf(await getDb(), owner.userId)
  return (
    <div className="stack-l">
      <header className="stack-s">
        <Link href="/projects" className="button ghost small" style={{ alignSelf: 'start' }}>
          ← Projecten
        </Link>
        <h1>Nieuw project</h1>
        <p className="lede">Ook zonder repo: hoe meer je hier vertelt, hoe beter de marketing die eruit komt.</p>
      </header>
      <ProjectForm values={EMPTY_PROJECT} companies={companies.map((c) => ({ id: c.id, name: c.name }))} />
    </div>
  )
}
