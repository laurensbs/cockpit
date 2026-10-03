'use client'

import { useState, useTransition } from 'react'
import { acceptQuickWin } from '@/server/actions/ai'

export function QuickWin({ briefId, index, text, accepted }: { briefId: string; index: number; text: string; accepted: boolean }) {
  const [pending, start] = useTransition()
  const [added, setAdded] = useState(accepted)
  return (
    <li className="row between nowrap">
      <span className="grow" style={{ overflowWrap: 'anywhere' }}>
        {text}
      </span>
      {added ? (
        <span className="chip good">quest</span>
      ) : (
        <button type="button" className="button ghost small" disabled={pending} onClick={() => start(async () => setAdded((await acceptQuickWin(briefId, index)).added))}>
          + quest
        </button>
      )}
    </li>
  )
}
