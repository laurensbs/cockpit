'use client'

import { useForm } from '@/lib/use-form'
import { importAllRepos } from '@/server/actions/repos'
import { initialFormState } from '@/server/actions/types'
import { Icon } from './Icon'

/** One button for everything on GitHub: groups become projects, relatives join their project. */
export function ImportAll({ newCount, groupCount, companies }: { newCount: number; groupCount: number; companies: { id: string; name: string }[] }) {
  const { state, pending, onSubmit } = useForm(importAllRepos, initialFormState)
  return (
    <form className="card stack-m" onSubmit={onSubmit}>
      <div className="stack-xs">
        <h2>Alles in één keer</h2>
        <p className="small muted">
          {newCount
            ? `${newCount} repo${newCount === 1 ? '' : "'s"} nog niet in de cockpit, in ${groupCount} groep${groupCount === 1 ? '' : 'en'}. Elke groep wordt een project; wat bij een bestaand project hoort, komt daarbij.`
            : 'Alles van GitHub staat erin. Nieuwe repo’s verschijnen hier vanzelf.'}
        </p>
      </div>
      {newCount ? (
        <>
          <label className="field">
            <span className="tiny">Nieuwe projecten komen onder</span>
            <select className="select" name="companyId" defaultValue="">
              <option value="">Elk een eigen bedrijf</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="button primary" disabled={pending}>
            <Icon name="branch" size={18} /> {pending ? 'GitHub lezen…' : 'Alles binnenhalen'}
          </button>
        </>
      ) : null}
      {state.error ? (
        <p className="notice bad small" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok && state.message ? (
        <p className="notice good small" role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  )
}
