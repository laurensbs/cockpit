'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { drawPending } from '@/server/actions/content-week'

/**
 * While pictures are still waiting, make sure the cockpit draws them (also after a restart) and look
 * again every few seconds, for two minutes at most.
 */
export function RefreshWhileDrawing({ drawing }: { drawing: boolean }) {
  const router = useRouter()
  useEffect(() => {
    if (!drawing) return
    void drawPending().catch(() => undefined)
    const started = Date.now()
    const timer = setInterval(() => {
      if (Date.now() - started > 120_000) clearInterval(timer)
      else router.refresh()
    }, 3000)
    return () => clearInterval(timer)
  }, [drawing, router])
  return null
}
