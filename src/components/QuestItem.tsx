'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { completeQuest, deleteQuest, reopenQuest, skipQuest } from '@/server/actions/quests'
import { useCelebrate } from './CelebrationProvider'
import { Icon } from './Icon'

export interface QuestView {
  id: string
  title: string
  detail: string
  xp: number
  kind: string
  status: string
  dueLabel: string | null
  overdue: boolean
  recurring: boolean
  project: { id: string; name: string; color: string } | null
}

export function QuestItem({ quest, showProject = true }: { quest: QuestView; showProject?: boolean }) {
  const [pending, start] = useTransition()
  const celebrate = useCelebrate()
  const [done, setDone] = useState(quest.status === 'done')
  const [menu, setMenu] = useState(false)
  const boss = quest.kind === 'boss'
  return (
    <li className={`quest${done ? ' done' : ''}${boss ? ' boss' : ''}`}>
      <button
        type="button"
        className="quest-check"
        aria-label={done ? `${quest.title}: afgerond` : `Rond af: ${quest.title}`}
        aria-pressed={done}
        disabled={pending || done || quest.status === 'skipped'}
        onClick={() =>
          start(async () => {
            setDone(true)
            const result = await completeQuest(quest.id)
            if (!result.ok) return
            celebrate({ xp: result.xp, levelUp: result.levelUp, badges: result.badges })
          })
        }
      >
        {done ? <Icon name="check" size={18} /> : boss ? <Icon name="crown" size={16} /> : null}
      </button>
      <div className="grow stack-xs" style={{ minWidth: 0 }}>
        <p className="quest-title">{quest.title}</p>
        {quest.detail ? <p className="tiny muted">{quest.detail}</p> : null}
        <div className="row" style={{ gap: '0.35rem' }}>
          <span className="chip xp num">+{quest.xp} XP</span>
          {boss ? <span className="chip flame">Boss</span> : null}
          {quest.dueLabel ? <span className={`chip ${quest.overdue ? 'bad' : ''}`}>{quest.dueLabel}</span> : null}
          {quest.recurring ? (
            <span className="chip" title="Komt terug">
              <Icon name="refresh" size={12} />
            </span>
          ) : null}
          {showProject && quest.project ? (
            <Link href={`/projects/${quest.project.id}`} className="chip" style={{ textDecoration: 'none' }}>
              <span className="dot" style={{ background: quest.project.color, width: 8, height: 8 }} /> {quest.project.name}
            </Link>
          ) : null}
        </div>
      </div>
      <div className="quest-menu">
        <button type="button" className="icon-button" aria-label="Meer" aria-expanded={menu} onClick={() => setMenu((m) => !m)} style={{ width: 32, height: 32 }}>
          ⋯
        </button>
        {menu ? (
          <div className="menu card" role="menu">
            {done || quest.status === 'skipped' ? (
              <button type="button" role="menuitem" disabled={pending} onClick={() => start(async () => { setDone(false); setMenu(false); await reopenQuest(quest.id) })}>
                Terugzetten
              </button>
            ) : (
              <button type="button" role="menuitem" disabled={pending} onClick={() => start(async () => { setMenu(false); await skipQuest(quest.id) })}>
                Overslaan
              </button>
            )}
            <button type="button" role="menuitem" disabled={pending} onClick={() => start(async () => { setMenu(false); await deleteQuest(quest.id) })}>
              Verwijderen
            </button>
          </div>
        ) : null}
      </div>
    </li>
  )
}
