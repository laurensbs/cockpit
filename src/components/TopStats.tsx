import { Crown, Flame, Zap } from 'lucide-react'
import Link from 'next/link'
import type { PlayerStats } from '@/server/game'

/** Streak, today's XP and the level, top right and always in sight. */
export function TopStats({ stats }: { stats: PlayerStats }) {
  const { level, actionStreak, todayXp } = stats
  return (
    <Link href="/quests" className="topstats" aria-label={`Level ${level.level}, ${level.title}. Streak ${actionStreak.length} dagen. ${todayXp} XP vandaag.`}>
      <span className={`stat streak${actionStreak.length ? '' : ' cold'}`} title="Dagen op rij">
        <Flame size={20} strokeWidth={2.5} fill={actionStreak.today ? 'currentColor' : 'none'} aria-hidden="true" />
        {actionStreak.length}
      </span>
      <span className="stat xp" title="XP vandaag">
        <Zap size={20} strokeWidth={2.5} fill="currentColor" aria-hidden="true" />
        {todayXp}
      </span>
      <span className="stat level" title={`Level ${level.level} · ${level.title}`}>
        <Crown size={20} strokeWidth={2.5} fill="currentColor" aria-hidden="true" />
        {level.level}
      </span>
    </Link>
  )
}
