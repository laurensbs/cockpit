'use client'

import { useState } from 'react'
import { LaunchStatus } from './ClaudeButton'
import { Icon } from './Icon'
import { useClaudeLaunch } from './useClaudeLaunch'

const EXAMPLES = ['Wat is deze week het slimste om te doen?', 'Schrijf drie posts over de laatste update', 'Waar haal ik mijn eerste 100 gebruikers vandaan?']

/** A free question or job for Claude Code: about one project or all of them, or about the project he is on. */
export function AskClaude({ projects, project, disabledReason }: { projects: { id: string; name: string }[]; project?: { id: string; name: string }; disabledReason?: string | null }) {
  const { open, pending, launch, done } = useClaudeLaunch()
  const [question, setQuestion] = useState('')
  const [chosen, setChosen] = useState('')
  const projectId = project?.id ?? chosen

  return (
    <section className="card ask stack-s" aria-labelledby="ask-title">
      <div className="row between">
        <h2 id="ask-title" className="row">
          <Icon name="bolt" size={20} /> Vraag Claude
        </h2>
        <span className="tiny muted">
          Of overal: <kbd>⌘</kbd> <kbd>K</kbd>
        </span>
      </div>
      <form
        className="stack-s"
        onSubmit={(e) => {
          e.preventDefault()
          if (!question.trim()) return
          void open('ask', projectId || null, { question: question.trim() }).then((r) => {
            if (r.ok) setQuestion('')
          })
        }}
      >
        <label className="sr-only" htmlFor="ask-question">
          Je vraag of opdracht
        </label>
        <textarea
          id="ask-question"
          className="textarea"
          rows={2}
          maxLength={600}
          placeholder={project ? `Wat wil je weten of laten doen voor ${project.name}?` : 'Wat wil je weten of laten doen? Claude kent je projecten, cijfers en contacten.'}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit()
          }}
        />
        <div className="row between">
          {project ? (
            <span className="tiny muted">Claude leest {project.name} via de cockpit, en de code als het project een lokale map heeft.</span>
          ) : (
            <div className="row">
              <label className="sr-only" htmlFor="ask-project">
                Over
              </label>
              <select id="ask-project" className="select" value={chosen} onChange={(e) => setChosen(e.target.value)} style={{ width: 'auto' }}>
                <option value="">Alle projecten</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <button type="submit" className="button primary ai-button" disabled={pending || !question.trim() || Boolean(disabledReason)}>
            <Icon name="bolt" size={18} />
            {pending ? 'Claude begint…' : 'Vraag het Claude'}
          </button>
        </div>
      </form>
      {!question && !launch ? (
        <div className="row">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" className="chip button-chip" onClick={() => setQuestion(ex)}>
              {ex}
            </button>
          ))}
        </div>
      ) : null}
      {disabledReason ? <p className="tiny muted">{disabledReason}</p> : null}
      <LaunchStatus launch={launch} done={done} />
    </section>
  )
}
