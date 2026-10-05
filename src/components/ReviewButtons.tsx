'use client'

import { useState, useTransition } from 'react'
import { applyTargetChange, keepReviewLesson, reviewQuest } from '@/server/actions/review'
import { Icon } from './Icon'

/** One thing from the weekly review he can take over: a quest, a lesson, a new target. */
export function ReviewButton({ briefId, index, what, done }: { briefId: string; index: number; what: 'quest' | 'lesson' | 'target'; done: boolean }) {
  const [pending, start] = useTransition()
  const [ok, setOk] = useState(done)
  const [error, setError] = useState<string | null>(null)
  if (ok) return <span className="chip good">{what === 'quest' ? 'Quest staat erin' : what === 'lesson' ? 'Bewaard als les' : 'Overgenomen'}</span>
  const run = () =>
    start(async () => {
      if (what === 'quest') setOk((await reviewQuest(briefId, index)).ok)
      else if (what === 'lesson') setOk((await keepReviewLesson(briefId, index)).ok)
      else {
        const r = await applyTargetChange(briefId, index)
        setOk(r.ok)
        setError(r.ok ? null : r.message)
      }
    })
  return (
    <span className="row tight">
      <button type="button" className={`button small ${what === 'quest' ? 'xp' : 'secondary'}`} disabled={pending} onClick={run}>
        {what === 'quest' ? (
          <>
            <Icon name="plus" size={16} /> Maak quest
          </>
        ) : what === 'lesson' ? (
          'Bewaar als les'
        ) : (
          'Overnemen'
        )}
      </button>
      {error ? (
        <span className="tiny" role="alert" style={{ color: 'var(--bad)' }}>
          {error}
        </span>
      ) : null}
    </span>
  )
}
