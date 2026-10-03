import { emailText, mailtoHref } from '@/lib/mailto'
import { ContentActions } from './ContentActions'
import { CopyButton } from './CopyButton'
import { DoneToggle } from './DoneToggle'
import { Icon } from './Icon'

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
}

/** A mail draft: read, copy, open in his own mail app, and tick it off once sent. */
export function EmailDraftCard({ email }: { email: EmailView }) {
  const text = emailText(email)
  const { href, bodyIncluded } = mailtoHref({ to: email.to, subject: email.subject, body: text })
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
      {email.to ? <p className="tiny muted">Aan: {email.to}</p> : null}
      <div className="row between">
        <div className="row">
          <a className="button primary small" href={href}>
            <Icon name="send" size={16} /> Open in mail
          </a>
          <CopyButton text={`${email.subject}\n\n${text}`} />
          <DoneToggle id={email.id} done={email.status === 'done'} label="Verstuurd" />
        </div>
        <ContentActions id={email.id} rating={email.rating} archived={email.status === 'archived'} />
      </div>
      {!bodyIncluded ? <p className="tiny muted">Te lang voor een maillink: kopieer de tekst en plak hem in je mail.</p> : null}
    </article>
  )
}
