'use client'

import { useState } from 'react'
import { STAGE_LABELS } from '@/lib/options'
import type { StarterProject } from '@/lib/starter'
import { useForm } from '@/lib/use-form'
import { setupStarter } from '@/server/actions/projects'
import { initialFormState } from '@/server/actions/types'
import { Icon } from './Icon'

/** "Zet je projecten erin": the projects he builds now, ready to confirm in one go. */
export function StarterSetup({ starters, repoNames, github }: { starters: StarterProject[]; repoNames: string[]; github: boolean }) {
  const { state, pending, onSubmit } = useForm(setupStarter, initialFormState)
  const [checked, setChecked] = useState<Set<string>>(() => new Set(starters.map((s) => s.key)))
  const toggle = (key: string) =>
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  return (
    <form className="stack-m" onSubmit={onSubmit}>
      <datalist id="github-repos">
        {repoNames.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <ul className="grid">
        {starters.map((p) => (
          <li key={p.key} className={`card stack-s starter${checked.has(p.key) ? '' : ' off'}`}>
            <label className="check">
              <input type="checkbox" name="starter" value={p.key} checked={checked.has(p.key)} onChange={() => toggle(p.key)} />
              <span className="stack-xs grow">
                <strong>{p.name}</strong>
                <span className="tiny muted">{STAGE_LABELS[p.stage]}</span>
              </span>
            </label>
            <label className="field">
              <span className="tiny">Naam</span>
              <input className="input" name={`name-${p.key}`} defaultValue={p.name} maxLength={80} />
            </label>
            <label className="field">
              <span className="tiny">GitHub-repo{p.repos.length ? '' : ' (nog geen? laat leeg)'}</span>
              <input
                className="input"
                name={`repos-${p.key}`}
                defaultValue={p.repos.join(', ')}
                placeholder="eigenaar/repo"
                list="github-repos"
                autoCapitalize="none"
                spellCheck={false}
              />
            </label>
          </li>
        ))}
      </ul>
      {!github ? <p className="notice warn small">GitHub is nog niet gekoppeld: de repo’s worden gelezen zodra GITHUB_TOKEN in Vercel staat.</p> : null}
      {state.error ? (
        <p className="notice bad" role="alert">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className="button primary" disabled={pending || checked.size === 0}>
        <Icon name="check" size={18} /> {pending ? 'Bezig met GitHub lezen…' : `Zet ${checked.size} project${checked.size === 1 ? '' : 'en'} erin`}
      </button>
    </form>
  )
}
