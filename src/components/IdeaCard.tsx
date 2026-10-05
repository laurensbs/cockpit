'use client'

import { useState, useTransition } from 'react'
import { contentToQuest, opportunityToContact } from '@/server/actions/content'
import { ContentActions } from './ContentActions'
import { Icon } from './Icon'

export interface IdeaView {
  id: string
  title: string
  category: string
  why: string
  firstStep: string
  impact: number
  effort: number
  cost: string
  wildness: number
  status: string
  rating: number
  projectName: string | null
}

export function QuestFromContent({ id }: { id: string }) {
  const [pending, start] = useTransition()
  const [added, setAdded] = useState(false)
  return added ? (
    <span className="chip good">op je lijst</span>
  ) : (
    <button type="button" className="button secondary small" disabled={pending} onClick={() => start(async () => setAdded((await contentToQuest(id)).added))}>
      <Icon name="quests" size={16} /> Op mijn lijst
    </button>
  )
}

export function IdeaCard({ idea, index }: { idea: IdeaView; index: number }) {
  return (
    <article className="card stack-s draft">
      <div className="row between">
        <span className="row" style={{ gap: '0.35rem' }}>
          <span className="idea-number num">{index + 1}</span>
          <span className="chip accent">{idea.category}</span>
          <span className="chip flame" title="Hoe gewaagd, van 1 (veilig) tot 5 (wild)">Gewaagd {idea.wildness}/5</span>
        </span>
        {idea.projectName ? <span className="tiny faint">{idea.projectName}</span> : null}
      </div>
      <p className="draft-subject">{idea.title}</p>
      <p className="small">{idea.why}</p>
      <p className="small">
        <strong>Eerste stap:</strong> {idea.firstStep}
      </p>
      <p className="tiny muted num">
        impact {idea.impact}/5 · moeite {idea.effort}/5 · {idea.cost}
      </p>
      <div className="row between">
        <QuestFromContent id={idea.id} />
        <ContentActions id={idea.id} rating={idea.rating} archived={idea.status === 'archived'} />
      </div>
    </article>
  )
}

export interface OpportunityView {
  id: string
  title: string
  type: string
  url: string | null
  why: string
  howToApproach: string
  status: string
  rating: number
  projectName: string | null
}

export function OpportunityCard({ item }: { item: OpportunityView }) {
  const [pending, start] = useTransition()
  const [contact, setContact] = useState(item.status === 'done')
  return (
    <article className="card stack-s draft">
      <div className="row between">
        <span className="chip accent">{item.type}</span>
        {item.projectName ? <span className="tiny faint">{item.projectName}</span> : null}
      </div>
      <p className="draft-subject">{item.title}</p>
      {item.url ? (
        <a href={item.url} target="_blank" rel="noreferrer noopener nofollow" className="small" style={{ overflowWrap: 'anywhere' }}>
          {new URL(item.url).hostname}
        </a>
      ) : null}
      <p className="small">{item.why}</p>
      <p className="small">
        <strong>Zo begin je:</strong> {item.howToApproach}
      </p>
      <div className="row between">
        <div className="row">
          {contact ? (
            <span className="chip good">bij contacten</span>
          ) : (
            <button type="button" className="button secondary small" disabled={pending} onClick={() => start(async () => setContact(Boolean((await opportunityToContact(item.id)).contactId)))}>
              <Icon name="user" size={16} /> Naar contacten
            </button>
          )}
          <QuestFromContent id={item.id} />
        </div>
        <ContentActions id={item.id} rating={item.rating} archived={item.status === 'archived'} />
      </div>
    </article>
  )
}
