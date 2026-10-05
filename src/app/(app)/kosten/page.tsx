import { eq } from 'drizzle-orm'
import Link from 'next/link'
import { getDb } from '@/db'
import * as s from '@/db/schema'
import { COSTS, costSummary } from '@/lib/costs'
import { formatEuro } from '@/lib/time'
import { requireOwner } from '@/server/session'
import { loadSetup } from '@/server/setup-check'

export const metadata = { title: 'Kosten' }

/** What it still costs to arrange everything, per project and for accounts that cover all apps; he pays, the cockpit adds up. */
export default async function CostsPage() {
  const owner = await requireOwner('/kosten')
  const db = await getDb()
  const projects = (await db.select().from(s.project).where(eq(s.project.ownerId, owner.userId))).filter((p) => !/marketing staat uit/i.test(`${p.what} ${p.redLines}`))
  const open = await Promise.all(
    projects.map(async (p) => ({
      id: p.id,
      name: p.name,
      open: (await loadSetup(db, p)).filter((v) => v.status !== 'done').map((v) => ({ title: v.item.title, cost: v.item.cost })),
    })),
  )
  const summary = costSummary(open)
  const idOf = (name: string) => open.find((p) => p.name === name)?.id
  return (
    <div className="stack-l">
      <header className="stack-xs">
        <h1>Kosten</h1>
        <p className="lede">Wat het nog kost om alles te regelen, en wat het oplevert. Betalen doe jij; Cockpit rekent alleen.</p>
      </header>

      <section className="kpis" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        <div className="kpi card">
          <span className="eyebrow">Het eerste jaar</span>
          <span className="value">± {formatEuro(summary.firstYear)}</span>
          <span className="tiny muted">eenmalig plus een jaar abonnementen</span>
        </div>
        <div className="kpi card">
          <span className="eyebrow">Daarna per jaar</span>
          <span className="value">± {formatEuro(summary.perYear)}</span>
          <span className="tiny muted">wat blijft terugkomen</span>
        </div>
      </section>

      {summary.shared.length ? (
        <section className="card stack-m">
          <h2>Voor al je apps tegelijk</h2>
          <ul className="setup-list">
            {summary.shared.map((line) => {
              const c = COSTS[line.cost]
              return (
                <li key={line.cost} className="setup-step">
                  <div className="grow stack-xs">
                    <div className="row" style={{ gap: '0.4rem' }}>
                      <strong>{line.cost === 'apple-developer' ? 'Apple Developer-account' : 'Google Play-account'}</strong>
                      <span className="chip warn">{c.text}</span>
                    </div>
                    <span className="small">{c.note}</span>
                    <span className="tiny muted">Nodig voor: {line.for.join(' · ')}</span>
                    <a className="tiny" href={c.source} target="_blank" rel="noreferrer noopener">
                      Bron
                    </a>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {summary.projects.map((p) => (
        <section key={p.name} className="card stack-m">
          <div className="row between">
            <h2>{p.name}</h2>
            {idOf(p.name) ? (
              <Link href={`/projects/${idOf(p.name)}`} className="button ghost small">
                Naar de checklist
              </Link>
            ) : null}
          </div>
          <ul className="setup-list">
            {p.lines.map((line) => {
              const c = COSTS[line.cost]
              return (
                <li key={line.cost} className="setup-step">
                  <div className="grow stack-xs">
                    <div className="row" style={{ gap: '0.4rem' }}>
                      <strong>{line.for.join(', ')}</strong>
                      <span className={`chip${c.amount > 0 ? ' warn' : ''}`}>{c.text}</span>
                    </div>
                    <span className="small muted">{c.note}</span>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      {!summary.shared.length && !summary.projects.length ? <p className="empty">Alles wat geld kost is geregeld, of nog niet nodig.</p> : null}

      <p className="tiny muted">
        Prijzen van de officiële pagina&apos;s, gecontroleerd op 5 okt 2026 (Apple, Google Play, Trustpilot en Stripe); domein, mailbox en analytics zijn richtbedragen. Belastingen en btw: vraag je gestor.
      </p>
    </div>
  )
}
