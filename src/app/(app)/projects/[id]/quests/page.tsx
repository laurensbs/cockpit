import { and, eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { ProjectHeader } from '@/components/ProjectHeader'
import { QuestForm } from '@/components/QuestForm'
import { QuestItem } from '@/components/QuestItem'
import { getDb } from '@/db'
import * as s from '@/db/schema'
import { questViews } from '@/server/quest-views'
import { requireOwner } from '@/server/session'

export const metadata = { title: 'Quests' }

export default async function ProjectQuestsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const owner = await requireOwner(`/projects/${id}/quests`)
  const db = await getDb()
  const [project] = await db
    .select({ id: s.project.id, name: s.project.name })
    .from(s.project)
    .where(and(eq(s.project.id, id), eq(s.project.ownerId, owner.userId)))
  if (!project) notFound()
  const [open, closed] = await Promise.all([questViews(db, owner.userId, { status: 'open', projectId: id }), questViews(db, owner.userId, { status: 'closed', projectId: id, limit: 20 })])
  return (
    <div className="stack-l">
      <ProjectHeader project={project} active="quests" />
      <section className="card stack-s">
        <h2>Open</h2>
        {open.length ? (
          <ul className="list" style={{ margin: 0 }}>
            {open.map((q) => (
              <QuestItem key={q.id} quest={q} showProject={false} />
            ))}
          </ul>
        ) : (
          <p className="muted small">Geen open quests voor {project.name}.</p>
        )}
      </section>
      <section className="card stack-m">
        <h2>Nieuwe quest</h2>
        <QuestForm projects={[]} projectId={id} />
      </section>
      {closed.length ? (
        <section className="card stack-s">
          <h2>Afgerond</h2>
          <ul className="list" style={{ margin: 0 }}>
            {closed.map((q) => (
              <QuestItem key={q.id} quest={q} showProject={false} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
