import Link from 'next/link'
import { CompanyForm, EMPTY_COMPANY } from '@/components/CompanyForm'
import { MetricForm } from '@/components/MetricForm'
import { getDb } from '@/db'
import { addMonths, dayOf, monthLabel, monthStart } from '@/lib/dates'
import { moneyFor } from '@/lib/money'
import { ACTIVE_STAGES, COMPANY_KIND_LABELS, STAGE_LABELS, isStage, type CompanyKind } from '@/lib/options'
import { formatEuro } from '@/lib/time'
import { companiesOf, metricsSince, projectSummaries } from '@/server/queries'
import { requireOwner } from '@/server/session'

export const metadata = { title: 'Bedrijven' }

function Money({ label, value, previous, known }: { label: string; value: number; previous?: number; known: boolean }) {
  const delta = previous != null && known ? value - previous : null
  return (
    <div className="kpi card flat">
      <span className="eyebrow">{label}</span>
      <span className="value">{known ? formatEuro(value) : '–'}</span>
      {delta != null && delta !== 0 ? (
        <span className={`tiny ${delta > 0 ? '' : ''}`} style={{ color: delta > 0 ? 'var(--good)' : 'var(--bad)' }}>
          {delta > 0 ? '▲' : '▼'} {formatEuro(Math.abs(delta))} t.o.v. vorige maand
        </span>
      ) : null}
    </div>
  )
}

export default async function CompaniesPage() {
  const owner = await requireOwner('/companies')
  const db = await getDb()
  const today = dayOf(new Date())
  const month = monthStart(today)
  const previous = addMonths(month, -1)
  const [companies, projects, metrics] = await Promise.all([companiesOf(db, owner.userId), projectSummaries(db, owner.userId), metricsSince(db, owner.userId, previous)])
  const all = Object.values(metrics)
  const now = moneyFor(all, month)
  const before = moneyFor(all, previous)
  const active = projects.filter((p) => isStage(p.stage) && ACTIVE_STAGES.includes(p.stage))

  return (
    <div className="stack-l">
      <header className="stack-s">
        <h1>Bedrijven</h1>
        <p className="lede">Alles wat je runt, met de cijfers van {monthLabel(month)}.</p>
      </header>

      <section className="grid tight">
        <Money label="Omzet" value={now.revenue} previous={before.known ? before.revenue : undefined} known={now.known} />
        <Money label="Kosten" value={now.costs} known={now.known} />
        <Money label="Winst" value={now.profit} previous={before.known ? before.profit : undefined} known={now.known} />
        <div className="kpi card flat">
          <span className="eyebrow">Actieve projecten</span>
          <span className="value">{active.length}</span>
          <span className="tiny muted">van {projects.length}</span>
        </div>
      </section>

      <section className="grid">
        {companies.map((c) => {
          const own = projects.filter((p) => p.companyId === c.id)
          const money = moneyFor(
            own.map((p) => metrics[p.id]),
            month,
          )
          return (
            <Link key={c.id} href={`/companies/${c.id}`} className="card stack-s company-card" style={{ ['--company' as string]: c.color }}>
              <div className="row between">
                <h2>{c.name}</h2>
                <span className="chip">{COMPANY_KIND_LABELS[c.kind as CompanyKind] ?? c.kind}</span>
              </div>
              {c.status !== 'active' ? <span className="chip warn">{c.status === 'paused' ? 'Gepauzeerd' : 'Archief'}</span> : null}
              <ul className="row" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {own.map((p) => (
                  <li key={p.id} className="chip accent">
                    {p.name} · {isStage(p.stage) ? STAGE_LABELS[p.stage] : p.stage}
                  </li>
                ))}
                {own.length ? null : <li className="tiny faint">Geen projecten</li>}
              </ul>
              <p className="small muted num">{money.known ? `Omzet ${formatEuro(money.revenue)} · winst ${formatEuro(money.profit)}` : 'Nog geen cijfers deze maand'}</p>
            </Link>
          )
        })}
      </section>

      {projects.length ? (
        <section className="card stack-m">
          <h2>Cijfers invullen</h2>
          <MetricForm projects={projects.map((p) => ({ id: p.id, name: p.name }))} month={month.slice(0, 7)} />
        </section>
      ) : null}

      <details className="card">
        <summary className="label">Bedrijf toevoegen</summary>
        <div style={{ marginTop: '1rem' }}>
          <CompanyForm values={EMPTY_COMPANY} />
        </div>
      </details>
    </div>
  )
}
