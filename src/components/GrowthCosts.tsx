import Link from 'next/link'
import { COSTS, type CostSummary } from '@/lib/costs'
import { formatEuro } from '@/lib/time'

/** What the open checklist steps still cost, an account that covers all apps once. */
export function GrowthCosts({ summary, idOf }: { summary: CostSummary; idOf: (name: string) => string | undefined }) {
  if (!summary.shared.length && !summary.projects.length) return null
  return (
    <section className="card stack-m" aria-labelledby="growth-costs">
      <div className="stack-xs">
        <h2 id="growth-costs">Nog te regelen om te groeien</h2>
        <p className="small muted">
          Uit de checklists van je projecten: ± {formatEuro(summary.firstYear)} het eerste jaar, daarna ± {formatEuro(summary.perYear)} per jaar.
        </p>
      </div>
      <details className="stack-m">
        <summary className="small">Bekijk wat het per project kost</summary>
      {summary.shared.length ? (
        <div className="stack-xs">
          <p className="eyebrow">Voor al je apps tegelijk</p>
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
        </div>
      ) : null}
      {summary.projects.map((p) => (
        <div key={p.name} className="stack-xs">
          <div className="row between">
            <p className="eyebrow">{p.name}</p>
            {idOf(p.name) ? (
              <Link href={`/projects/${idOf(p.name)}`} className="tiny">
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
        </div>
      ))}
      </details>
    </section>
  )
}
