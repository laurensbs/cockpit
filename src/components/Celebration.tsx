'use client'

import { useEffect } from 'react'

export interface CelebrationContent {
  xp: number
  levelUp: { level: number; title: string } | null
  badges: { key: string; title: string; description: string }[]
}

const COLORS = ['#b5f23d', '#8f80ff', '#ffa040', '#22c55e', '#ec4899', '#06b6d4']

/**
 * "+25 XP" as a toast; a level-up or a new badge as a full moment with confetti. With reduced
 * motion the confetti stays still.
 */
export function Celebration({ content, onDone }: { content: CelebrationContent; onDone: () => void }) {
  const big = Boolean(content.levelUp || content.badges.length)
  useEffect(() => {
    const timer = setTimeout(onDone, big ? 3800 : 1800)
    return () => clearTimeout(timer)
  }, [big, onDone])
  if (!big) {
    return (
      <div className="toast" role="status">
        <strong className="num">+{content.xp} XP</strong>
      </div>
    )
  }
  return (
    <div className="celebrate" role="dialog" aria-live="polite" aria-label="Gefeliciteerd" onClick={onDone}>
      <div className="confetti" aria-hidden="true">
        {Array.from({ length: 36 }, (_, i) => (
          <i
            key={i}
            style={{
              left: `${(i * 37) % 100}%`,
              background: COLORS[i % COLORS.length],
              animationDelay: `${(i % 9) * 0.07}s`,
              animationDuration: `${1.6 + ((i * 13) % 10) / 10}s`,
              transform: `rotate(${(i * 47) % 360}deg)`,
            }}
          />
        ))}
      </div>
      <div className="card stack-s celebrate-card">
        {content.levelUp ? (
          <>
            <p className="eyebrow" style={{ color: 'var(--xp-ink)' }}>
              Level up
            </p>
            <p className="big-level num">{content.levelUp.level}</p>
            <h2>{content.levelUp.title}</h2>
          </>
        ) : null}
        {content.badges.map((b) => (
          <div key={b.key} className="stack-xs">
            <p className="eyebrow">Badge</p>
            <h3>{b.title}</h3>
            <p className="small muted">{b.description}</p>
          </div>
        ))}
        {content.xp ? <p className="chip xp num">+{content.xp} XP</p> : null}
      </div>
    </div>
  )
}
