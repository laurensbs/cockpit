import { emailText, mailtoHref } from '@/lib/mailto'
import { ContentActions } from './ContentActions'
import { CopyButton } from './CopyButton'
import { DoneToggle } from './DoneToggle'
import { Icon } from './Icon'
import { ScheduleButton } from './ScheduleButton'

export interface EmailView {
  id: string
  title: string
  subject: string
  body: string
  ps: string
  to: string | null
  status: string
  rating: number
  projectName: string | null
  /** Follow-ups that go out after the first mail when there is no answer. */
  followups?: { subject: string; body: string }[]
  /** Where it stands in the queue, when he approved it. */
  queue?: { status: 'queued' | 'sent' | 'failed' | 'cancelled'; label: string } | null
  /** Approving it sends it automatically (a contact with an address, no answer yet). */
  canSchedule?: boolean
}

/** A mail draft: read it, approve it for automatic sending, or copy and send it yourself. */
export function EmailDraftCard({ email }: { email: EmailView }) {
  const text = emailText(email)
  const { href, bodyIncluded } = mailtoHref({ to: email.to, subject: email.subject, body: text })
  const followups = email.followups ?? []
  const queue = email.queue ?? null
  const handled = queue !== null && queue.status !== 'cancelled'
  return (
    <article className="card stack-s draft">
      <div className="row between">
        <span className="chip">
          <Icon name="mail" size={14} /> {email.title}
        </span>
        {email.projectName ? <span className="tiny faint">{email.projectName}</span> : null}
      </div>
      <p className="draft-subject">{email.subject}</p>
      <p className="prewrap small">{text}</p>
      {followups.length ? (
        <details>
          <summary className="tiny">
            {followups.length} opvolgmail{followups.length === 1 ? '' : 's'} (na 4{followups.length > 1 ? ' en 11' : ''} dagen zonder antwoord)
          </summary>
          <ol className="stack-s small" style={{ marginTop: '0.5rem' }}>
            {followups.map((f, i) => (
              <li key={i} className="stack-xs">
                {f.subject ? <strong>{f.subject}</strong> : <span className="tiny muted">Antwoord op de eerste mail</span>}
                <span className="prewrap">{f.body}</span>
              </li>
            ))}
          </ol>
        </details>
      ) : null}
      {email.to ? <p className="tiny muted">Aan: {email.to}</p> : null}
      {queue ? (
        <p className={`tiny chip ${queue.status === 'sent' ? 'good' : queue.status === 'failed' ? 'bad' : queue.status === 'queued' ? 'warn' : ''}`} style={{ width: 'fit-content' }}>
          {queue.label}
        </p>
      ) : null}
      <div className="row between">
        <div className="row">
          {email.canSchedule && !handled ? <ScheduleButton contentItemId={email.id} /> : null}
          {!handled ? (
            <a className={`button ${email.canSchedule ? 'secondary' : 'primary'} small`} href={href}>
              <Icon name="send" size={16} /> Open in mail
            </a>
          ) : null}
          <CopyButton text={`${email.subject}\n\n${text}`} />
          {!handled ? <DoneToggle id={email.id} done={email.status === 'done'} label="Verstuurd" /> : null}
        </div>
        <ContentActions id={email.id} rating={email.rating} archived={email.status === 'archived'} />
      </div>
      {!bodyIncluded && !handled ? <p className="tiny muted">Te lang voor een maillink: kopieer de tekst en plak hem in je mail.</p> : null}
    </article>
  )
}
