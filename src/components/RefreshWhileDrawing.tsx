'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

/** While the cockpit is still drawing pictures, look again every few seconds (for two minutes at most). */
export function RefreshWhileDrawing({ drawing }: { drawing: boolean }) {
  const router = useRouter()
  useEffect(() => {
    if (!drawing) return
    const started = Date.now()
    const timer = setInterval(() => {
      if (Date.now() - started > 120_000) clearInterval(timer)
      else router.refresh()
    }, 3000)
    return () => clearInterval(timer)
  }, [drawing, router])
  return null
}
