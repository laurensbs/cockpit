'use client'

import { COMPANY_COLORS, COMPANY_KINDS, COMPANY_KIND_LABELS } from '@/lib/options'
import { useForm } from '@/lib/use-form'
import { saveCompany } from '@/server/actions/companies'
import { initialFormState } from '@/server/actions/types'

export interface CompanyValues {
  id?: string
  name: string
  kind: string
  country: string | null
  registration: string
  website: string | null
  color: string
  status: string
  notes: string
}

export const EMPTY_COMPANY: CompanyValues = { name: '', kind: 'own', country: '', registration: '', website: '', color: COMPANY_COLORS[0], status: 'active', notes: '' }

export function CompanyForm({ values }: { values: CompanyValues }) {
  const { state, pending, onSubmit } = useForm(saveCompany, initialFormState)
  return (
    <form className="stack-m" onSubmit={onSubmit}>
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
      <div className="grid-2">
        <label className="field">
          <span>Naam</span>
          <input className="input" name="name" defaultValue={values.name} required maxLength={80} />
        </label>
        <label className="field">
          <span>Soort</span>
          <select className="select" name="kind" defaultValue={values.kind}>
            {COMPANY_KINDS.map((k) => (
              <option key={k} value={k}>
                {COMPANY_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Land</span>
          <input className="input" name="country" defaultValue={values.country ?? ''} maxLength={40} placeholder="Nederland, Spanje…" />
        </label>
        <label className="field">
          <span>KvK, CIF of btw-nummer</span>
          <input className="input" name="registration" defaultValue={values.registration} maxLength={120} />
        </label>
        <label className="field">
          <span>Website</span>
          <input className="input" name="website" defaultValue={values.website ?? ''} maxLength={300} inputMode="url" />
        </label>
        <label className="field">
          <span>Status</span>
          <select className="select" name="status" defaultValue={values.status}>
            <option value="active">Actief</option>
            <option value="paused">Gepauzeerd</option>
            <option value="archived">Archief</option>
          </select>
        </label>
      </div>
      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="label">Kleur</legend>
        <div className="row">
          {COMPANY_COLORS.map((c) => (
            <label key={c} className="swatch" style={{ background: c }}>
              <input type="radio" name="color" value={c} defaultChecked={values.color === c} aria-label={c} />
            </label>
          ))}
        </div>
      </fieldset>
      <label className="field">
        <span>Notities</span>
        <textarea className="textarea" name="notes" defaultValue={values.notes} maxLength={4000} placeholder="Afspraken, boekhouder, deadlines, wat je niet wilt vergeten" />
      </label>
      <div className="row">
        <button type="submit" className="button primary" disabled={pending}>
          {values.id ? 'Bewaren' : 'Bedrijf toevoegen'}
        </button>
        {state.message ? (
          <span className="small muted" role="status">
            {state.message}
          </span>
        ) : null}
        {state.error ? (
          <span className="small" style={{ color: 'var(--bad)' }} role="alert">
            {state.error}
          </span>
        ) : null}
      </div>
    </form>
  )
}
