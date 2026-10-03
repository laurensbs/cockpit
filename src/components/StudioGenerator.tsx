'use client'

import { useState } from 'react'
import { LANGUAGE_LABELS } from '@/lib/options'
import { AiButton } from './AiButton'

const PURPOSES: Record<string, string> = {
  outreach: 'Eerste mail aan een organisatie',
  partnership: 'Samenwerking voorstellen',
  press: 'Pers en bloggers',
  newsletter: 'Nieuwsbrief',
  launch: 'Lancering aankondigen',
  followup: 'Opvolgreeks (3 mails)',
}
const PLATFORMS: Record<string, string> = { instagram: 'Instagram', tiktok: 'TikTok', linkedin: 'LinkedIn', x: 'X/Threads', discord: 'Discord' }
export const MODES: Record<string, string> = {
  surprise: 'Verras me',
  zero: '€0-guerrilla',
  cross: 'Kruisbestuiving met je andere projecten',
  inverse: 'Omgekeerd denken',
  season: 'Seizoenshaken (komende 60 dagen)',
  persona: 'Wat zou … doen?',
}

interface Props {
  kind: 'emails' | 'posts' | 'ideas' | 'opportunities'
  projectId: string
  languages: string[]
  estimateMicros: number
  disabledReason: string | null
}

const languageOptions = (languages: string[]) =>
  languages.map((l) => (
    <option key={l} value={l}>
      {LANGUAGE_LABELS[l as keyof typeof LANGUAGE_LABELS] ?? l}
    </option>
  ))

/** The few choices a batch needs, then the button that asks Claude for it. */
export function StudioGenerator({ kind, projectId, languages, estimateMicros, disabledReason }: Props) {
  const langs = languages.length ? languages : ['nl']
  const [language, setLanguage] = useState(langs[0])
  const [purpose, setPurpose] = useState('outreach')
  const [note, setNote] = useState('')
  const [platform, setPlatform] = useState('instagram')
  const [mode, setMode] = useState('surprise')
  const [persona, setPersona] = useState('')

  const options =
    kind === 'emails' ? { purpose, language, note } : kind === 'posts' ? { platform, language } : kind === 'ideas' ? { mode, persona } : { language }
  const label = kind === 'emails' ? 'Schrijf mails' : kind === 'posts' ? 'Maak 5 posts' : kind === 'ideas' ? 'Bedenk 6 ideeën' : 'Zoek kansen op het web'

  return (
    <div className="card stack-m">
      <div className="grid tight">
        {kind === 'emails' ? (
          <label className="field">
            <span className="tiny">Waarvoor</span>
            <select className="select" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
              {Object.entries(PURPOSES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {kind === 'posts' ? (
          <label className="field">
            <span className="tiny">Platform</span>
            <select className="select" value={platform} onChange={(e) => setPlatform(e.target.value)}>
              {Object.entries(PLATFORMS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {kind === 'ideas' ? (
          <label className="field">
            <span className="tiny">Manier van denken</span>
            <select className="select" value={mode} onChange={(e) => setMode(e.target.value)}>
              {Object.entries(MODES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {kind === 'ideas' && mode === 'persona' ? (
          <label className="field">
            <span className="tiny">Wie?</span>
            <input className="input" value={persona} onChange={(e) => setPersona(e.target.value)} maxLength={80} placeholder="Bijv. Duolingo, een punkband, de gemeente" />
          </label>
        ) : null}
        {kind !== 'ideas' ? (
          <label className="field">
            <span className="tiny">Taal</span>
            <select className="select" value={language} onChange={(e) => setLanguage(e.target.value)}>
              {languageOptions(langs)}
            </select>
          </label>
        ) : null}
      </div>
      {kind === 'emails' ? (
        <label className="field">
          <span className="tiny">Wat moet erin? (optioneel)</span>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Bijv. noem de groepswandeling van zaterdag" />
        </label>
      ) : null}
      {kind === 'opportunities' ? <p className="tiny muted">Claude zoekt op het web naar communities, gidsen, media en partners. Nooit privépersonen.</p> : null}
      <AiButton kind={kind} projectId={projectId} label={label} estimateMicros={estimateMicros} disabledReason={disabledReason} options={options} />
    </div>
  )
}
