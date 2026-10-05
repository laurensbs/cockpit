'use client'

import { Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { amountText, CURRENCIES, KIND_LABEL, MONEY_KINDS, MONEY_PERIODS, type MoneyItem, PERIOD_LABEL, whenText } from '@/lib/finance'
import { useForm } from '@/lib/use-form'
import { askMoney } from '@/server/actions/claude'
import { moneyStatus, moneyStep, saveMoneyItem } from '@/server/actions/money'
import { initialFormState } from '@/server/actions/types'

type Project = { id: string; name: string }

/** Add a line, or change one; what he saves here is his and Claude leaves it alone. */
export function MoneyForm({ projects, item, onDone }: { projects: Project[]; item?: MoneyItem; onDone?: () => void }) {
  const { state, pending, onSubmit } = useForm(saveMoneyItem, initialFormState)
  useEffect(() => {
    if (state.ok) onDone?.()
  }, [state, onDone])
  return (
    <form className="stack-s" onSubmit={onSubmit} aria-label={item ? `${item.title} aanpassen` : 'Iets over geld toevoegen'}>
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      <div className="grid tight">
        <label className="field">
          <span className="tiny">Wat</span>
          <select className="select" name="kind" defaultValue={item?.kind ?? 'cost'}>
            {MONEY_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="tiny">Naam</span>
          <input className="input" name="title" required minLength={2} maxLength={120} defaultValue={item?.title ?? ''} placeholder="Bijv. Vercel Pro" />
        </label>
        <label className="field">
          <span className="tiny">Bedrag</span>
          <input className="input num" name="amount" inputMode="decimal" defaultValue={item?.amount ?? ''} placeholder="leeg = onbekend" />
        </label>
        <label className="field">
          <span className="tiny">Munt</span>
          <select className="select" name="currency" defaultValue={item?.currency ?? 'EUR'}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c === 'EUR' ? '€ euro' : '$ dollar'}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="tiny">Hoe vaak</span>
          <select className="select" name="period" defaultValue={item?.period ?? 'month'}>
            {MONEY_PERIODS.map((p) => (
              <option key={p} value={p}>
                {PERIOD_LABEL[p]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="tiny">Volgende datum</span>
          <input className="input" type="date" name="nextDate" defaultValue={item?.nextDate ?? ''} />
        </label>
        <label className="field">
          <span className="tiny">Voor</span>
          <select className="select" name="projectId" defaultValue={item?.projectId ?? ''}>
            <option value="">Je bedrijf (alles)</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="field">
        <span className="tiny">Notitie</span>
        <input className="input" name="note" maxLength={300} defaultValue={item?.note ?? ''} placeholder="Waar het vandaan komt, of wat je ervoor krijgt" />
      </label>
      <div className="row">
        <button type="submit" className="button secondary small" disabled={pending}>
          Bewaren
        </button>
        {state.message ? (
          <span className="tiny muted" role="status">
            {state.message}
          </span>
        ) : null}
        {state.error ? (
          <span className="tiny" style={{ color: 'var(--bad)' }} role="alert">
            {state.error}
          </span>
        ) : null}
      </div>
    </form>
  )
}

const SOURCE = { jij: 'door jou', claude: 'volgens Claude' } as const

/**
 * One line: what it is, what it costs, when it comes back. A date near or a proposal gets its two buttons;
 * the rest only "Aanpassen".
 */
export function MoneyRow({ item, today, projects, act }: { item: MoneyItem; today: string; projects: Project[]; act?: boolean }) {
  const [pending, start] = useTransition()
  const [editing, setEditing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const step = (action: 'done' | 'stop' | 'yes') =>
    start(async () => {
      const r = await moneyStep(item.id, action)
      setMessage(r.xp ? `${r.message} +${r.xp} XP` : r.message)
    })
  const late = item.nextDate !== null && item.nextDate < today
  const verb = item.kind === 'cost' ? (late ? 'verlengde' : 'verlengt') : item.kind === 'plan' ? 'beslissen' : late ? 'was' : 'uiterlijk'
  const when = item.nextDate ? `${verb} ${whenText(today, item.nextDate)} (${item.nextDate})` : null
  return (
    <li className={`setup-step money-row ${item.status}`} aria-label={item.title}>
      <div className="grow stack-xs" style={{ minWidth: 0 }}>
        <div className="row" style={{ gap: '0.4rem' }}>
          <strong>{item.title}</strong>
          <span className={`chip${item.kind === 'cost' || item.kind === 'plan' ? ' warn' : item.kind === 'income' ? ' good' : ''}`}>{amountText(item)}</span>
        </div>
        <span className="tiny muted">
          {[item.project ?? 'Je bedrijf', when, SOURCE[item.source]].filter(Boolean).join(' · ')}
        </span>
        {item.note ? <span className="tiny muted">{item.note}</span> : null}
        {editing ? (
          <div className="card sunken stack-s">
            <MoneyForm projects={projects} item={item} onDone={() => setEditing(false)} />
            <div className="row">
              {item.status !== 'stopped' ? (
                <button type="button" className="button ghost small" disabled={pending} onClick={() => step('stop')}>
                  {item.kind === 'plan' ? 'Niet doen' : 'Gestopt'}
                </button>
              ) : (
                <button type="button" className="button ghost small" disabled={pending} onClick={() => start(async () => void (await moneyStatus(item.id, item.kind === 'plan' ? 'proposed' : 'active')))}>
                  Weer meetellen
                </button>
              )}
              <button type="button" className="button ghost small" disabled={pending} onClick={() => start(async () => void (await moneyStatus(item.id, 'delete')))}>
                Verwijderen
              </button>
            </div>
          </div>
        ) : null}
        <div className="row" style={{ gap: '0.4rem' }}>
          {act && item.kind === 'plan' ? (
            <>
              <button type="button" className="button secondary small" disabled={pending} onClick={() => step('yes')}>
                Ja, doen
              </button>
              <button type="button" className="button ghost small" disabled={pending} onClick={() => step('stop')}>
                Nee
              </button>
            </>
          ) : act ? (
            <>
              <button type="button" className="button secondary small" disabled={pending} onClick={() => step('done')}>
                {item.kind === 'cost' ? 'Houden ✓' : 'Geregeld ✓'}
              </button>
              {item.kind === 'cost' ? (
                <button type="button" className="button ghost small" disabled={pending} onClick={() => step('stop')}>
                  Opzeggen
                </button>
              ) : null}
            </>
          ) : null}
          <button type="button" className="button ghost small" onClick={() => setEditing((e) => !e)} aria-expanded={editing}>
            {editing ? 'Sluiten' : 'Aanpassen'}
          </button>
          {message ? (
            <span className="tiny muted" role="status">
              {message}
            </span>
          ) : null}
        </div>
      </div>
    </li>
  )
}

/** "Zet al het geld erin": Claude reads his documents in the background; the page fills itself. */
export function MoneyAsk({ count, stamp }: { count: number; stamp: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [waitingFor, setWaitingFor] = useState<string | null>(null)
  useEffect(() => {
    if (waitingFor === null || waitingFor !== stamp) return
    const started = Date.now()
    const timer = setInterval(() => {
      if (Date.now() - started > 5 * 60_000) setWaitingFor(null)
      else router.refresh()
    }, 8000)
    return () => clearInterval(timer)
  }, [waitingFor, stamp, router])
  return (
    <div className="row">
      <button
        type="button"
        className={count ? 'button ghost small' : 'button primary'}
        disabled={pending || waitingFor === stamp}
        onClick={() =>
          start(async () => {
            const r = await askMoney()
            setMessage(r.message)
            if (r.ok) setWaitingFor(stamp)
          })
        }
      >
        <Sparkles size={16} strokeWidth={2.5} aria-hidden="true" /> {count ? 'Laat Claude het bijwerken' : 'Zet al het geld erin'}
      </button>
      {message ? (
        <span className="tiny muted" role="status">
          {message}
        </span>
      ) : null}
    </div>
  )
}
