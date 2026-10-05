'use client'

import { useState, useTransition } from 'react'
import { acceptWeeklyBoss } from '@/server/actions/ai'
import { Icon } from './Icon'

export function WeeklyBoss({ briefId, accepted }: { briefId: string; accepted: boolean }) {
  const [pending, start] = useTransition()
  const [added, setAdded] = useState(accepted)
  return added ? (
    <span className="chip flame">Hoofdtaak staat erop</span>
  ) : (
    <button type="button" className="button xp small" disabled={pending} onClick={() => start(async () => setAdded((await acceptWeeklyBoss(briefId)).added))}>
      <Icon name="crown" size={16} /> Maak er de hoofdtaak van
    </button>
  )
}
