import Link from 'next/link'
import type { DayStep } from '@/lib/today'

export const STEP_ICON: Record<DayStep['kind'], string> = { call: '📞', prospects: '🏢', reply: '💬', checkin: '📈', post: '📣', build: '🛠️', growth: '🚀' }

function Ring({ done, goal }: { done: number; goal: number }) {
  const shown = Math.min(done, goal)
  const r = 26
  const c = 2 * Math.PI * r
  return (
    <div className="day-ring" role="img" aria-label={`${shown} van ${goal} gedaan vandaag`}>
      <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--sunken)" strokeWidth="8" />
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--xp)" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(shown / goal) * c} ${c}`} transform="rotate(-90 32 32)" />
      </svg>
      <span className="num">
        {shown}/{goal}
      </span>
    </div>
  )
}

/**
 * Vandaag: what is waiting, in a few words, and one big button into the lesson (/dag), where Claude
 * takes him through it one card at a time.
 */
export function DayPath({ steps, done, goal }: { steps: DayStep[]; done: number; goal: number }) {
  const finished = done >= goal
  const shown = steps.slice(0, 3)
  return (
    <section className="card day-path stack-m" aria-label="Vandaag">
      <div className="row between nowrap">
        <div className="stack-xs">
          <h2>{finished ? 'Dagdoel gehaald 🎉' : shown.length ? 'Klaar voor je dag?' : 'Alles gedaan'}</h2>
          <span className="tiny muted">{finished ? '+30 XP · meer mag, hoeft niet' : shown.length ? `${shown.length} ${shown.length === 1 ? 'stap' : 'stappen'} · een paar minuten` : 'Claude zoekt intussen verder'}</span>
        </div>
        <Ring done={done} goal={goal} />
      </div>
      {shown.length ? (
        <>
          <ol className="day-preview">
            {shown.map((step) => (
              <li key={step.key}>
                <span className="day-icon small" aria-hidden="true">
                  {STEP_ICON[step.kind]}
                </span>
                <span className="stack-xs grow">
                  <strong>{step.title}</strong>
                  {step.sub ? <span className="tiny muted">{step.sub}</span> : null}
                </span>
              </li>
            ))}
          </ol>
          <Link href="/dag" className="button primary big">
            {finished ? 'Nog een rondje' : 'Start je dag'}
          </Link>
        </>
      ) : null}
    </section>
  )
}
