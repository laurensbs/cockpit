import { Check, Trophy } from 'lucide-react'
import Link from 'next/link'
import type { DayStep } from '@/lib/today'
import { StepDisc } from './StepIcon'

// How far each node sits from the middle, so the path winds down the page like a trail.
const WIND = [0, 44, 66, 44, 0, -44, -66, -44]
const at = (i: number) => ({ '--x': `${WIND[i % WIND.length]}px` }) as React.CSSProperties

/**
 * Vandaag: the day as a path. What he did today first (gold), then what is waiting (the first one asks
 * to start), then the day goal. Every node opens the lesson (/dag), where Claude takes him through it.
 */
export function DayPath({
  steps,
  done,
  goal,
  empty,
  children,
}: {
  steps: DayStep[]
  done: number
  goal: number
  /** With no steps and the goal still open: where to start instead (a setup step, or the projects). */
  empty?: { title: string; href: string; label: string } | null
  /** The coach's one line, under the heading. */
  children?: React.ReactNode
}) {
  const finished = done >= goal
  const shown = steps.slice(0, 3)
  const doneNodes = Math.min(done, goal)
  const waiting = !finished && !shown.length
  return (
    <section className="stack-m" aria-label="Vandaag">
      <div className="unit tone-violet">
        <div>
          <p className="unit-eyebrow">
            Vandaag · {Math.min(done, goal)} van {goal}
          </p>
          <h2>{finished ? 'Dagdoel gehaald' : shown.length ? 'Jouw stappen van vandaag' : 'Claude zet je stappen klaar'}</h2>
          {waiting && empty ? <p className="small">{empty.title}</p> : null}
        </div>
        {shown.length ? (
          <Link href="/dag" className="button big unit-cta">
            {finished ? 'Nog een rondje' : 'Start je dag'}
          </Link>
        ) : waiting && empty ? (
          <Link href={empty.href} className="button big unit-cta">
            {empty.label}
          </Link>
        ) : null}
      </div>
      {children}
      <ol className="path">
        {Array.from({ length: doneNodes }, (_, i) => (
          <li key={`done-${i}`} className="path-node done" style={at(i)}>
            <span className="disc done" style={{ width: 76, height: 76 }} aria-hidden="true">
              <Check size={34} strokeWidth={3.5} />
            </span>
            <span className="node-label">
              <strong>Gedaan</strong>
              <span className="tiny muted">Stap {i + 1}</span>
            </span>
          </li>
        ))}
        {shown.map((step, i) => (
          <li key={step.key} className={`path-node${i === 0 ? ' now' : ''}`} style={at(doneNodes + i)}>
            <Link href="/dag" className="node-btn" aria-label={`${step.title}: start je dag`}>
              <StepDisc kind={step.kind} size={76} />
            </Link>
            {i === 0 ? <span className="node-start">Start</span> : null}
            <span className="node-label">
              <strong>{step.title}</strong>
              {step.sub ? <span className="tiny muted">{step.sub}</span> : null}
            </span>
          </li>
        ))}
        <li className={`path-node${finished ? ' done' : ' locked'}`} style={at(doneNodes + shown.length)}>
          <span className={`disc ${finished ? 'done' : 'locked'}`} style={{ width: 76, height: 76 }} aria-hidden="true">
            <Trophy size={34} strokeWidth={2.5} />
          </span>
          <span className="node-label">
            <strong>Dagdoel</strong>
            <span className="tiny muted">{finished ? 'Gehaald · meer mag, hoeft niet' : `Nog ${goal - doneNodes} ${goal - doneNodes === 1 ? 'stap' : 'stappen'}`}</span>
          </span>
        </li>
      </ol>
    </section>
  )
}
