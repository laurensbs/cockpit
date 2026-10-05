'use client'

import { useTransition } from 'react'
import { dayLabel } from '@/lib/dates'
import { BOARD_LABELS, type BoardColumn, type Deal, type Due, NEXT_LABELS, nextStage, OPEN_STAGES, prevStage, worthText } from '@/lib/pipeline-board'
import { formatEuro } from '@/lib/time'
import { setContactStatus, setWonAsRevenue } from '@/server/actions/contacts'
import { useCelebrate } from './CelebrationProvider'
import { ClaudeButton } from './ClaudeButton'

export type BoardDeal = Deal & { due: Due }

/** Lead → meeting → offer → won (or lost): every answered contact, what it is worth and what is next. */
export function PipelineBoard({ projectId, columns, language, blocked }: { projectId: string; columns: BoardColumn<BoardDeal>[]; language: string; blocked: string | null }) {
  return (
    <div className="board" role="list" aria-label="Pijplijn">
      {columns.map((col) => (
        <section key={col.stage} className="board-col" role="listitem" aria-label={col.label} data-stage={col.stage}>
          <header className="board-head">
            <strong>{col.label}</strong> <span className="chip">{col.deals.length}</span>
            <p className="tiny muted">{col.deals.length ? worthText(col.worth) : 'Leeg'}</p>
          </header>
          {col.deals.map((d) => (
            <DealCard key={d.id} projectId={projectId} deal={d} language={language} blocked={blocked} />
          ))}
        </section>
      ))}
    </div>
  )
}

function DealCard({ projectId, deal, language, blocked }: { projectId: string; deal: BoardDeal; language: string; blocked: string | null }) {
  const [pending, start] = useTransition()
  const celebrate = useCelebrate()
  const move = (to: string) =>
    start(async () => {
      const { xp } = await setContactStatus(deal.id, to)
      if (xp) celebrate({ xp, levelUp: null, badges: [] })
    })
  const next = nextStage(deal.status)
  const prev = prevStage(deal.status)
  const open = (OPEN_STAGES as readonly string[]).includes(deal.status)
  return (
    <article className="deal-card" data-due={deal.due ?? undefined} aria-label={deal.organization}>
      <a href={`#contact-${deal.id}`} className="small">
        <strong>{deal.organization}</strong>
      </a>
      {deal.value != null ? (
        <span className="small">
          {formatEuro(deal.value)} {deal.period === 'once' ? 'eenmalig' : 'per maand'}
        </span>
      ) : null}
      {deal.nextStep ? (
        <span className={`tiny ${deal.due === 'late' ? 'deal-late' : deal.due === 'today' ? '' : 'muted'}`}>
          {deal.nextStep}
          {deal.nextStepOn ? ` · ${dayLabel(deal.nextStepOn)}` : ''}
          {deal.due === 'late' ? ' · te laat' : deal.due === 'today' ? ' · vandaag' : ''}
        </span>
      ) : open ? (
        <span className="tiny faint">Nog geen volgende stap</span>
      ) : null}
      <div className="row tight">
        {next ? (
          <button type="button" className="button secondary small" disabled={pending} onClick={() => move(next)}>
            {NEXT_LABELS[deal.status]}
          </button>
        ) : null}
        {open ? (
          <button type="button" className="button ghost small" disabled={pending} onClick={() => move('lost')}>
            Verloren
          </button>
        ) : null}
        {prev ? (
          <button type="button" className="button ghost small" disabled={pending} onClick={() => move(prev)} aria-label={deal.status === 'lost' ? `Heropen: ${deal.organization}` : `Terug naar ${BOARD_LABELS[prev]}: ${deal.organization}`}>
            {deal.status === 'lost' ? 'Heropen' : '← Terug'}
          </button>
        ) : null}
      </div>
      {open ? <ClaudeButton task="contact_mail" projectId={projectId} label="Mail voor de volgende stap" disabledReason={blocked} options={{ contactId: deal.id, language }} variant="secondary" /> : null}
    </article>
  )
}

/** Won deals as MRR, revenue and customers, for a project without Stripe or Mollie. */
export function WonAsRevenueToggle({ projectId, on, payments }: { projectId: string; on: boolean; payments: boolean }) {
  const [pending, start] = useTransition()
  return (
    <label className="check">
      <input type="checkbox" defaultChecked={on} disabled={pending || payments} onChange={(e) => start(() => setWonAsRevenue(projectId, e.currentTarget.checked))} />
      <span className="stack-xs">
        <span className="small">
          <strong>Gewonnen telt als omzet</strong>
        </span>
        <span className="tiny muted">
          {payments
            ? 'Dit project haalt zijn omzet uit Stripe of Mollie; die tellen, gewonnen deals niet.'
            : 'Een gewonnen deal per maand telt als MRR, een eenmalige als omzet op de dag dat je hem won, en elke gewonnen deal als klant. Koppel je later Stripe of Mollie, dan gaan die voor.'}
        </span>
      </span>
    </label>
  )
}
