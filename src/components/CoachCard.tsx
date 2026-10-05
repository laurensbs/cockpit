'use client'

import { Compass, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import type { CoachAdvice } from '@/lib/coach'
import { askCoach, runInBackground } from '@/server/actions/claude'
import { setSetupStatus } from '@/server/actions/setup'

const WHO: Record<CoachAdvice['who'], string> = { jij: 'Jij', claude: 'Claude', samen: 'Samen met Claude' }

export interface CoachProps {
  advice: CoachAdvice | null
  projectId: string | null
  projectName: string | null
  /** When it was written, as a short label ("vandaag 14:02"), and as a key to notice a new one. */
  when: string | null
  stamp: string | null
}

/**
 * The coach: the one best next step, with why and how. "Ik weet het even niet" asks Claude to look across
 * everything (on a project page: at this project) and the card fills in when the answer lands.
 */
export function CoachCard({ coach, scope, disabledReason }: { coach: CoachProps; scope: { projectId: string } | null; disabledReason: string | null }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [waitingFor, setWaitingFor] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  // Waiting for Claude: refresh now and then until a new advice is there (at most four minutes).
  useEffect(() => {
    if (waitingFor === null) return
    const started = Date.now()
    const timer = setInterval(() => {
      if (Date.now() - started > 4 * 60_000) setWaitingFor(null)
      else router.refresh()
    }, 8000)
    return () => clearInterval(timer)
  }, [waitingFor, router])
  const waiting = waitingFor !== null && waitingFor === (coach.stamp ?? '')
  const ask = () =>
    start(async () => {
      const r = scope ? await runInBackground('refresh', scope.projectId) : await askCoach()
      setMessage({ ok: r.ok, text: r.ok ? (scope ? 'Claude kijkt opnieuw naar dit project. Het advies verschijnt hier vanzelf.' : r.message) : r.message })
      if (r.ok) setWaitingFor(coach.stamp ?? '')
    })
  const { advice } = coach
  return (
    <section className="card stack-s coach-card rail-wide" aria-label="Je coach">
      <div className="row nowrap" style={{ gap: '0.7rem' }}>
        <span className="disc tone-violet" style={{ width: 44, height: 44 }} aria-hidden="true">
          <Compass size={22} strokeWidth={2.5} />
        </span>
        <div className="grow stack-xs" style={{ minWidth: 0 }}>
          <p className="eyebrow">Je coach{coach.projectName && !scope ? ` · ${coach.projectName}` : ''}</p>
          <h3>{advice ? advice.title : 'Wat nu?'}</h3>
        </div>
      </div>
      {advice ? (
        <>
          <p className="small">{advice.why}</p>
          {advice.steps.length ? (
            <ol className="small setup-how">
              {advice.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          ) : null}
          <div className="row" style={{ gap: '0.4rem' }}>
            <span className="chip accent">{WHO[advice.who]}</span>
            {advice.cost ? <span className="chip">{advice.cost}</span> : null}
            {coach.when ? <span className="tiny faint">{coach.when}</span> : null}
          </div>
          {advice.setupKey && coach.projectId && !done ? (
            <button
              type="button"
              className="button secondary small"
              disabled={pending}
              style={{ width: 'fit-content' }}
              onClick={() =>
                start(async () => {
                  const r = await setSetupStatus(coach.projectId!, advice.setupKey!, 'done')
                  if (r.ok) {
                    setDone(true)
                    setMessage({ ok: true, text: `Afgevinkt${r.xp ? ` · +${r.xp} XP` : ''}.` })
                  }
                })
              }
            >
              Gedaan
            </button>
          ) : null}
        </>
      ) : (
        <p className="small muted">Even geen idee wat het belangrijkst is? Claude kijkt naar al je projecten, je checklist en je deadlines, en zegt het ene ding dat nu het meeste oplevert.</p>
      )}
      <button type="button" className="button primary" disabled={pending || waiting || Boolean(disabledReason)} onClick={ask}>
        <Sparkles size={18} strokeWidth={2.5} aria-hidden="true" /> {waiting ? 'Claude denkt na…' : scope ? 'Wat nu voor dit project?' : 'Ik weet het even niet'}
      </button>
      {disabledReason ? <span className="tiny muted">{disabledReason}</span> : null}
      {message ? (
        <span className="tiny" role={message.ok ? 'status' : 'alert'} style={message.ok ? undefined : { color: 'var(--bad)' }}>
          {message.text}
        </span>
      ) : null}
    </section>
  )
}
