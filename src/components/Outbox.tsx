import Link from 'next/link'
import type { MailStatus, OutboxRow } from '@/server/outbox-views'
import { outboxTime } from '@/server/outbox-views'
import { OutboxActions, RunOutboxButton } from './OutboxActions'

const STATUS: Record<string, { label: string; chip: string }> = {
  queued: { label: 'In de wachtrij', chip: 'warn' },
  waiting: { label: 'Wacht op de vorige', chip: '' },
  sent: { label: 'Verstuurd', chip: 'good' },
  failed: { label: 'Mislukt', chip: 'bad' },
  cancelled: { label: 'Gestopt', chip: '' },
}

const STEP = ['Eerste mail', 'Opvolging 1', 'Opvolging 2']

/** How automatic sending is doing today, in one line, with what to do when it is not set up. */
export function MailBanner({ status }: { status: MailStatus }) {
  if (!status.ready)
    return (
      <p className="notice warn small row between">
        <span>Automatisch versturen is nog niet ingesteld. Goedgekeurde mails wachten tot je mailbox gekoppeld is.</span>
        <Link href="/settings#mail" className="button secondary small">
          Mailbox koppelen
        </Link>
      </p>
    )
  if (!status.enabled)
    return (
      <p className="notice warn small row between">
        <span>Automatisch versturen staat uit. Goedgekeurde mails wachten.</span>
        <Link href="/settings#mail" className="button secondary small">
          Aanzetten
        </Link>
      </p>
    )
  return (
    <p className="notice small row between">
      <span>
        Versturen staat aan vanaf {status.fromEmail} · <span className="num">{status.sentToday}</span> van <span className="num">{status.cap}</span> vandaag ·{' '}
        <span className="num">{status.queued}</span> in de wachtrij{status.failed ? ` · ${status.failed} mislukt` : ''}
        {status.inWindow ? '' : ' · buiten kantoortijd: de volgende gaan op de eerste werkdag om 9 uur'}
      </span>
      <RunOutboxButton />
    </p>
  )
}

/** The queue and what went out. */
export function OutboxList({ rows, now }: { rows: OutboxRow[]; now: Date }) {
  if (!rows.length) return <p className="empty">Nog niets ingepland. Keur een persoonlijke mail goed bij Contacten, dan verschijnt hij hier.</p>
  return (
    <ul className="list" aria-label="Wachtrij">
      {rows.map((r) => {
        const st = STATUS[r.status] ?? { label: r.status, chip: '' }
        return (
          <li key={r.id} className="row between outbox-row">
            <span className="stack-xs grow" style={{ minWidth: 0 }}>
              <span className="row nowrap">
                <strong style={{ overflowWrap: 'anywhere' }}>{r.organization ?? r.to}</strong>
                <span className="tiny faint">{STEP[r.step] ?? `Stap ${r.step + 1}`}</span>
              </span>
              <span className="small" style={{ overflowWrap: 'anywhere' }}>
                {r.subject}
              </span>
              <span className="tiny muted">
                {r.to}
                {r.status === 'sent' && r.sentAt ? ` · ${outboxTime(r.sentAt)}` : ''}
                {r.status === 'queued' && r.sendAfter && r.sendAfter.getTime() > now.getTime() ? ` · vanaf ${outboxTime(r.sendAfter)}` : ''}
                {r.status === 'failed' && r.error ? ` · ${r.error}` : ''}
              </span>
            </span>
            <span className="row nowrap">
              <span className={`chip ${st.chip}`}>{st.label}</span>
              <OutboxActions id={r.id} sequenceId={r.sequenceId} status={r.status} step={r.step} />
            </span>
          </li>
        )
      })}
    </ul>
  )
}
