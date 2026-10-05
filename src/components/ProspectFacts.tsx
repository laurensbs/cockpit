import { ExternalLink, Mail, Phone } from 'lucide-react'
import { Bubble } from './Bubble'

/**
 * One business as Claude saw it, the same in the lesson and under Contacten: what Claude saw (and where to
 * check it), how to open the call, and whether a phone number and a mail address were found.
 */
export function ProspectFacts({
  observation,
  website,
  pitch,
  found,
  small = false,
}: {
  observation: string
  website: string | null
  pitch: string
  found?: { phone: boolean; email: boolean }
  small?: boolean
}) {
  return (
    <>
      <Bubble title="Wat Claude zag" small={small}>
        <p>{observation}</p>
        {website ? (
          <a href={website} target="_blank" rel="noreferrer noopener" className="tiny row nowrap" style={{ gap: '0.3rem', width: 'fit-content' }}>
            Bekijk hun site <ExternalLink size={14} strokeWidth={2.5} aria-hidden="true" />
          </a>
        ) : null}
      </Bubble>
      {pitch ? (
        <div className="card sunken stack-xs">
          <p className="eyebrow">Zo open je</p>
          <p className={small ? 'small' : undefined}>“{pitch}”</p>
        </div>
      ) : null}
      {found ? (
        <div className="row" style={{ gap: '0.4rem' }}>
          <span className={`chip ${found.phone ? 'good' : ''}`}>
            <Phone size={13} strokeWidth={2.5} aria-hidden="true" /> {found.phone ? 'Telefoon gevonden' : 'Geen telefoon'}
          </span>
          <span className={`chip ${found.email ? 'good' : ''}`}>
            <Mail size={13} strokeWidth={2.5} aria-hidden="true" /> {found.email ? 'Mailadres gevonden' : 'Geen mailadres'}
          </span>
        </div>
      ) : null}
    </>
  )
}
