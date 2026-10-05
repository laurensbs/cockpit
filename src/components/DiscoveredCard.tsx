import { and, eq } from 'drizzle-orm'
import Link from 'next/link'
import type { Db } from '@/db'
import * as s from '@/db/schema'
import { FOUND_LABELS } from '@/lib/discover'
import { readDiscovered } from '@/server/discover'
import { DiscoverButton, UndoFoundButton } from './Discover'
import { Icon } from './Icon'

const UNDOABLE = ['plausible', 'ga4', 'gsc', 'discord']

/** What the cockpit found and linked for a project by itself, and what still needs him once. */
export async function DiscoveredCard({ db, ownerId, projectId }: { db: Db; ownerId: string; projectId: string }) {
  const [found, connectors] = await Promise.all([
    readDiscovered(db, ownerId, projectId),
    db
      .select({ kind: s.connector.kind, config: s.connector.config })
      .from(s.connector)
      .where(and(eq(s.connector.ownerId, ownerId), eq(s.connector.projectId, projectId))),
  ])
  const auto = (kind: string) => connectors.some((c) => c.kind === kind && c.config.via === 'auto')
  const linked = found?.items.filter((i) => i.status !== 'suggested') ?? []
  const todo = found?.items.filter((i) => i.status === 'suggested') ?? []
  return (
    <section className="card stack-s" aria-labelledby={`found-${projectId}`}>
      <div className="row between">
        <h2 id={`found-${projectId}`} className="row">
          <Icon name="search" size={20} /> Gevonden
        </h2>
        {found?.vercel?.state === 'ERROR' ? <span className="chip bad">Laatste deploy faalt</span> : found?.vercel?.state === 'READY' ? <span className="chip good">Deploy werkt</span> : null}
      </div>
      <p className="tiny muted">
        Wat de cockpit zelf vond via GitHub, Vercel, Google en je site, en meteen koppelde. Wat je zelf invulde, laat hij staan. <Link href="/settings#sources">Sleutels in Instellingen</Link>
      </p>
      {linked.length ? (
        <ul className="list found-list" style={{ margin: 0 }}>
          {linked.map((i) => (
            <li key={`${i.kind}-${i.value}`} className="row between" data-kind={i.kind}>
              <span className="small">
                <strong>{FOUND_LABELS[i.kind]}</strong> {i.value} <span className="muted">· {i.from}</span>
              </span>
              {UNDOABLE.includes(i.kind) && auto(i.kind) ? <UndoFoundButton projectId={projectId} kind={i.kind} /> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="small muted">{found ? 'Nog niets gevonden.' : 'Nog niet gezocht.'}</p>
      )}
      {todo.length ? (
        <div className="stack-xs">
          <strong className="small">Nog één keer jij</strong>
          <ul className="list found-list" style={{ margin: 0 }}>
            {todo.map((i) => (
              <li key={`${i.kind}-${i.value}`} className="stack-xs" data-kind={i.kind}>
                <p className="small" style={{ margin: 0 }}>
                  <strong>{FOUND_LABELS[i.kind]}</strong> {i.value} <span className="muted">· {i.from}</span>
                </p>
                {i.todo ? (
                  <p className="tiny" style={{ margin: 0 }}>
                    {i.todo}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <DiscoverButton projectId={projectId} label="Zoek opnieuw" />
    </section>
  )
}
