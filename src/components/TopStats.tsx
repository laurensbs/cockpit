import { Flame } from 'lucide-react'
import Link from 'next/link'
import type { PlayerStats } from '@/server/game'

/** Days in a row, top right and always in sight; the rest of the game stays on Taken. */
export function TopStats({ stats }: { stats: PlayerStats }) {
  const { actionStreak } = stats
  return (
    <Link href="/quests" className="topstats" aria-label={`${actionStreak.length} ${actionStreak.length === 1 ? 'dag' : 'dagen'} op rij`}>
      <span className={`stat streak${actionStreak.length ? '' : ' cold'}`} title="Dagen op rij">
        <Flame size={20} strokeWidth={2.5} fill={actionStreak.today ? 'currentColor' : 'none'} aria-hidden="true" />
        {actionStreak.length}
      </span>
    </Link>
  )
}
