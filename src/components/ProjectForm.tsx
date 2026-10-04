'use client'

import { useState } from 'react'
import { LANGUAGE_LABELS, LANGUAGES, MARKETS, STAGES, STAGE_LABELS } from '@/lib/options'
import { useForm } from '@/lib/use-form'
import { saveProject } from '@/server/actions/projects'
import { initialFormState } from '@/server/actions/types'

export interface ProjectFormValues {
  id?: string
  name: string
  companyId: string | null
  stage: string
  oneLiner: string
  what: string
  audience: string
  goal: string
  tone: string
  northStar: string
  redLines: string
  siteUrl: string | null
  localPath: string | null
  languages: string[]
  markets: string[]
  monthlyBudget: number | null
}

export const EMPTY_PROJECT: ProjectFormValues = {
  name: '',
  companyId: null,
  stage: 'build',
  oneLiner: '',
  what: '',
  audience: '',
  goal: '',
  tone: '',
  northStar: '',
  redLines: '',
  siteUrl: null,
  localPath: null,
  languages: ['nl'],
  markets: [],
  monthlyBudget: null,
}

/** The intake: five questions that matter most, then the details. It feeds everything the AI makes. */
export function ProjectForm({ values, companies }: { values: ProjectFormValues; companies: { id: string; name: string }[] }) {
  const { state, pending, onSubmit } = useForm(saveProject, initialFormState)
  const [company, setCompany] = useState(values.companyId ?? '')
  return (
    <form className="stack-l" onSubmit={onSubmit}>
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
      <section className="card stack-m">
        <label className="field">
          <span>Naam</span>
          <input className="input" name="name" defaultValue={values.name} required maxLength={80} />
        </label>
        <div className="grid-2">
          <label className="field">
            <span>Bedrijf</span>
            <select className="select" name="companyId" value={company} onChange={(e) => setCompany(e.target.value)}>
              <option value="">{values.id ? 'Geen bedrijf' : 'Nieuw bedrijf met deze naam'}</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              {values.id ? <option value="__new">Nieuw bedrijf…</option> : null}
            </select>
          </label>
          <label className="field">
            <span>Fase</span>
            <select className="select" name="stage" defaultValue={values.stage}>
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
        </div>
        {company === '__new' ? (
          <label className="field">
            <span>Naam van het nieuwe bedrijf</span>
            <input className="input" name="newCompany" maxLength={80} required />
          </label>
        ) : null}
      </section>

      <section className="card stack-m">
        <p className="eyebrow">De vijf vragen</p>
        <label className="field">
          <span>1. Wat is het, in één zin?</span>
          <input className="input" name="oneLiner" defaultValue={values.oneLiner} maxLength={200} placeholder="Bijv. een private OSRS-server met een eerlijke economie" />
        </label>
        <label className="field">
          <span>2. Wat doet het, en wat maakt het anders?</span>
          <textarea className="textarea" name="what" defaultValue={values.what} maxLength={2000} />
        </label>
        <label className="field">
          <span>3. Voor wie?</span>
          <textarea className="textarea" name="audience" defaultValue={values.audience} maxLength={1000} placeholder="Wie zijn de eerste 100 gebruikers of klanten, en waar zitten ze?" />
        </label>
        <label className="field">
          <span>4. Doel over 90 dagen</span>
          <textarea className="textarea" name="goal" defaultValue={values.goal} maxLength={600} placeholder="Meetbaar: aantal spelers, klanten, omzet, aanmeldingen…" />
        </label>
        <label className="field">
          <span>5. Rode lijnen: wat mag nooit?</span>
          <textarea className="textarea" name="redLines" defaultValue={values.redLines} maxLength={1000} />
          <span className="hint">De AI houdt zich hier altijd aan.</span>
        </label>
      </section>

      <section className="card stack-m">
        <p className="eyebrow">Details</p>
        <div className="grid-2">
          <label className="field">
            <span>Belangrijkste cijfer (north star)</span>
            <input className="input" name="northStar" defaultValue={values.northStar} maxLength={200} placeholder="Bijv. vaste koppels per week" />
          </label>
          <label className="field">
            <span>Toon</span>
            <input className="input" name="tone" defaultValue={values.tone} maxLength={300} placeholder="Bijv. warm, nuchter, met humor" />
          </label>
          <label className="field">
            <span>Website</span>
            <input className="input" name="siteUrl" defaultValue={values.siteUrl ?? ''} maxLength={300} inputMode="url" placeholder="voorbeeld.nl" />
          </label>
          <label className="field">
            <span>Marketingbudget per maand (€)</span>
            <input className="input" name="monthlyBudget" type="number" min={0} defaultValue={values.monthlyBudget ?? ''} inputMode="numeric" />
          </label>
        </div>
        <label className="field">
          <span>Map met de code op deze computer (optioneel)</span>
          <input className="input" name="localPath" defaultValue={values.localPath ?? ''} maxLength={400} spellCheck={false} placeholder="C:\Users\jij\code\project" />
          <span className="hint">Claude Code start dan in die map en kan de code zelf lezen.</span>
        </label>
        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="label">Talen voor content</legend>
          <div className="row">
            {LANGUAGES.map((l) => (
              <label key={l} className="chip">
                <input type="checkbox" name="languages" value={l} defaultChecked={values.languages.includes(l)} /> {LANGUAGE_LABELS[l]}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="label">Markten</legend>
          <div className="row">
            {MARKETS.map((m) => (
              <label key={m} className="chip">
                <input type="checkbox" name="markets" value={m} defaultChecked={values.markets.includes(m)} /> {m}
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      {state.error ? (
        <p className="notice bad" role="alert">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className="button primary" disabled={pending}>
        {pending ? 'Bewaren…' : values.id ? 'Bewaren' : 'Project maken'}
      </button>
    </form>
  )
}
