import Link from 'next/link'
import type { PlayerStats } from '@/server/game'
import { Icon } from './Icon'

/** Level, XP towards the next level and the action streak, always in sight. */
export function TopStats({ stats }: { stats: PlayerStats }) {
  const { level, actionStreak } = stats
  return (
    <Link href="/quests" className="topstats" aria-label={`Level ${level.level}, ${level.title}. Streak ${actionStreak.length} dagen.`}>
      <span className="lv num">Lv {level.level}</span>
      <span className="bar mini" aria-hidden="true">
        <span style={{ width: `${Math.round(level.progress * 100)}%` }} />
      </span>
      <span className={`flame${actionStreak.length ? '' : ' cold'}${actionStreak.today ? '' : ' waiting'}`} aria-hidden="true">
        <Icon name="flame" size={16} /> <span className="num">{actionStreak.length}</span>
      </span>
    </Link>
  )
}
