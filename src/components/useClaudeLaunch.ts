'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState, useTransition } from 'react'
import { openInClaude, type LaunchResult } from '@/server/actions/claude'

const WATCH_MS = 20 * 60_000

/**
 * Opens Claude Code with a task and watches the cockpit for the result: Claude works in its own
 * window, on his own account, and the page refreshes as soon as something lands.
 */
export function useClaudeLaunch() {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [launch, setLaunch] = useState<LaunchResult | null>(null)
  const [done, setDone] = useState(false)

  const open = useCallback(
    (task: string, projectId: string | null, options: Record<string, unknown> = {}) =>
      new Promise<LaunchResult>((resolve) =>
        start(async () => {
          setDone(false)
          const result = await openInClaude(task, projectId, options)
          setLaunch(result)
          resolve(result)
        }),
      ),
    [],
  )

  useEffect(() => {
    if (!launch?.ok || done) return
    let since: string | null = null
    let stopped = false
    const started = Date.now()
    const look = async () => {
      if (stopped) return
      try {
        const res = await fetch('/api/changes', { cache: 'no-store' })
        if (!res.ok) return
        const { latest } = (await res.json()) as { latest: string | null }
        if (since === null) since = latest ?? ''
        else if ((latest ?? '') !== since) {
          stopped = true
          setDone(true)
          router.refresh()
        }
      } catch {
        // A missed look is fine; the next one tries again.
      }
    }
    void look()
    const timer = setInterval(() => {
      if (Date.now() - started > WATCH_MS) stopped = true
      if (stopped) clearInterval(timer)
      else void look()
    }, 4000)
    window.addEventListener('focus', look)
    return () => {
      stopped = true
      clearInterval(timer)
      window.removeEventListener('focus', look)
    }
  }, [launch, done, router])

  return { open, pending, launch, done, reset: () => setLaunch(null) }
}
