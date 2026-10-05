'use client'

import { Mail, Phone, Star } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { acceptProspect, prospectNow, prospectWantsInfo, setProspecting, skipProspect, writeAllMails } from '@/server/actions/prospects'
import { Logo } from './Logo'
import { StepDisc } from './StepIcon'

const REASONS = ['past niet', 'klopt niet wat Claude zag', 'te groot', 'te ver weg', 'anders'] as const
const VERB: Record<string, string> = { call: 'Ja, ik bel ze', visit: 'Ja, ik ga langs', form: 'Ja, ik vul hun formulier in', email: 'Ja, ik bel ze' }

/** Refreshes the page when something new lands, for a while after Claude started looking. */
function useWatch(active: boolean) {
  const router = useRouter()
  useEffect(() => {
    if (!active) return
    let since: string | null = null
    const started = Date.now()
    const timer = setInterval(async () => {
      if (Date.now() - started > 20 * 60_000) return clearInterval(timer)
      try {
        const { latest } = (await (await fetch('/api/changes', { cache: 'no-store' })).json()) as { latest: string | null }
        if (since === null) since = latest ?? ''
        else if ((latest ?? '') !== since) {
          since = latest ?? ''
          router.refresh()
        }
      } catch {
        // The next look tries again.
      }
    }, 5000)
    return () => clearInterval(timer)
  }, [active, router])
}

/** "Zoek nu" runs four searches side by side, so twenty businesses take as long as five. */
const SEARCH_NOW = 20

/** The switch per project and "Zoek nu": Claude looks for businesses that fit, he decides per business. */
export function ProspectPanel({ projectId, projectName, perDay, waiting, off }: { projectId: string; projectName: string; perDay: number; waiting: number; off: boolean }) {
  const [pending, start] = useTransition()
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [searching, setSearching] = useState(false)
  useWatch(searching)
  if (off) return null
  return (
    <section className="card stack-s" aria-labelledby="prospect-title">
      <h2 id="prospect-title">Claude zoekt bedrijven voor je</h2>
      <p className="small muted">
        Claude zoekt bedrijven die passen bij {projectName} en kijkt op hun eigen site hoe klanten nu contact opnemen. Per bedrijf schrijft hij één
        ding op dat je zelf kunt nakijken, en wat je zegt als je belt. Jij zegt per bedrijf ja of nee. Eerst bellen of langsgaan (dat mag); vragen ze om
        informatie, dan gaat de mail die Claude al klaarzette.
      </p>
      <div className="row wrap">
        <label className="row nowrap small">
          Elke werkdag
          <select
            className="select"
            aria-label="Bedrijven per werkdag"
            value={perDay}
            disabled={pending}
            style={{ width: 'auto', minHeight: 36 }}
            onChange={(e) => {
              const n = Number(e.target.value)
              start(async () => {
                const r = await setProspecting(projectId, n)
                setMessage({ ok: r.ok, text: r.message })
              })
            }}
          >
            <option value={0}>uit</option>
            <option value={3}>3 bedrijven</option>
            <option value={5}>5 bedrijven</option>
            <option value={10}>10 bedrijven</option>
          </select>
        </label>
        <button
          type="button"
          className="button secondary"
          disabled={pending || searching}
          onClick={() =>
            start(async () => {
              const r = await prospectNow(projectId, SEARCH_NOW)
              setMessage({ ok: r.ok, text: r.message })
              if (r.ok) setSearching(true)
            })
          }
        >
          {searching ? 'Claude zoekt…' : `Zoek nu ${SEARCH_NOW} bedrijven`}
        </button>
      </div>
      {waiting ? <p className="tiny muted">{waiting === 1 ? 'Er wacht 1 voorstel op je.' : `Er wachten ${waiting} voorstellen op je.`} Zolang er veel wachten, zoekt Claude niet verder.</p> : null}
      {message ? (
        <p className={`small ${message.ok ? 'muted' : ''}`} role={message.ok ? 'status' : 'alert'} style={message.ok ? undefined : { color: 'var(--bad)' }}>
          {message.text}
        </p>
      ) : null}
    </section>
  )
}

export interface ProspectView {
  id: string
  organization: string
  website: string | null
  city: string
  note: string
  observation: string
  pitch: string
  fit: number | null
  channel: string
  hasPhone: boolean
  hasEmail: boolean
  draft: { subject: string; body: string; followups: number } | null
}

/** One business Claude found: what it saw, what to say, and his yes or no. */
export function ProspectCard({ p, decided, onDecided }: { p: ProspectView; decided?: { ok: boolean; text: string } | null; onDecided?: (result: { ok: boolean; text: string }) => void }) {
  const [pending, start] = useTransition()
  const [asking, setAsking] = useState(false)
  const [later, setLater] = useState(false)
  const [own, setResult] = useState<{ ok: boolean; text: string } | null>(null)
  const result = decided ?? own
  const decide = (r: { ok: boolean; text: string }) => {
    setResult(r)
    if (r.ok) onDecided?.(r)
  }
  if (later)
    return (
      <li className="card row between">
        <span className="small muted">{p.organization}: later</span>
        <button type="button" className="button ghost small" onClick={() => setLater(false)}>
          Toch nu bekijken
        </button>
      </li>
    )
  return (
    <li className="card stack-m prospect-card" aria-label={`Voorstel: ${p.organization}`}>
      <div className="prospect-head">
        <StepDisc kind={p.channel === 'visit' ? 'prospect' : 'call'} size={52} />
        <div className="stack-xs grow">
          <strong className="prospect-name">{p.organization}</strong>
          <span className="tiny muted">{[p.city, p.website ? p.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '') : null].filter(Boolean).join(' · ')}</span>
        </div>
        {p.fit ? (
          <span className="chip fit" aria-label={`Past ${p.fit} van 5`}>
            <Star size={14} strokeWidth={2.5} fill="currentColor" aria-hidden="true" /> {p.fit}/5
          </span>
        ) : null}
      </div>
      {p.note ? <p className="small muted">{p.note}</p> : null}
      <div className="bubble-row">
        <span className="bubble-who" aria-hidden="true">
          <Logo />
        </span>
        <div className="bubble small">
          <p className="bubble-title">Wat Claude zag</p>
          <p>{p.observation}</p>
          {p.website ? (
            <a href={p.website} target="_blank" rel="noreferrer" className="tiny">
              Kijk zelf op hun site
            </a>
          ) : null}
        </div>
      </div>
      {p.pitch ? (
        <div className="card sunken stack-xs">
          <p className="eyebrow">Zo kun je openen</p>
          <p className="small">“{p.pitch}”</p>
        </div>
      ) : null}
      <div className="row" style={{ gap: '0.4rem' }}>
        <span className={`chip ${p.hasPhone ? 'good' : ''}`}>
          <Phone size={13} strokeWidth={2.5} aria-hidden="true" /> {p.hasPhone ? 'Telefoonnummer gevonden' : 'Geen telefoonnummer gevonden'}
        </span>
        <span className={`chip ${p.hasEmail ? 'good' : ''}`}>
          <Mail size={13} strokeWidth={2.5} aria-hidden="true" /> {p.hasEmail ? 'algemeen mailadres gevonden' : 'geen mailadres gevonden'}
        </span>
      </div>
      {p.draft ? (
        <details>
          <summary className="small">De infomail die Claude klaarzette (gaat pas als ze om info vragen)</summary>
          <div className="stack-xs" style={{ marginTop: 8 }}>
            <strong className="small">{p.draft.subject}</strong>
            <p className="small" style={{ whiteSpace: 'pre-wrap' }}>
              {p.draft.body}
            </p>
            {p.draft.followups ? <span className="tiny muted">Met {p.draft.followups} korte opvolgmail{p.draft.followups === 1 ? '' : 's'} als ze niet antwoorden.</span> : null}
          </div>
        </details>
      ) : null}
      {result ? (
        <p className="small" role={result.ok ? 'status' : 'alert'} style={result.ok ? undefined : { color: 'var(--bad)' }}>
          {result.text}
        </p>
      ) : asking ? (
        <div className="stack-xs">
          <span className="small">Waarom niet? Dan zoekt Claude beter.</span>
          <div className="row wrap">
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                className="button secondary small"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await skipProspect(p.id, r)
                    decide({ ok: res.ok, text: res.message })
                  })
                }
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="row wrap prospect-actions">
          <button
            type="button"
            className="button primary big"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await acceptProspect(p.id)
                decide({ ok: res.ok, text: res.message })
              })
            }
          >
            {VERB[p.channel] ?? VERB.call}
          </button>
          <button type="button" className="button secondary big" disabled={pending} onClick={() => setAsking(true)}>
            Nee
          </button>
          <button type="button" className="button ghost big" disabled={pending} onClick={() => setLater(true)}>
            Later
          </button>
        </div>
      )}
    </li>
  )
}

/**
 * The proposals waiting for his yes or no. A card he decided on stays on screen with what happened
 * (the page refreshes underneath) until he leaves the page.
 */
export function ProspectList({ items }: { items: ProspectView[] }) {
  const [decided, setDecided] = useState<{ view: ProspectView; result: { ok: boolean; text: string } }[]>([])
  const shown = [...items.filter((p) => !decided.some((d) => d.view.id === p.id)).map((view) => ({ view, result: null })), ...decided]
  if (!shown.length) return null
  const open = items.filter((p) => !decided.some((d) => d.view.id === p.id)).length
  return (
    <section className="stack-s" aria-labelledby="proposals-title">
      <h2 id="proposals-title">{open ? `Voorstellen van Claude (${open})` : 'Alles beslist'}</h2>
      <ul className="stack-m" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {shown.map(({ view, result }) => (
          <ProspectCard key={view.id} p={view} decided={result} onDecided={(r) => setDecided((list) => (list.some((d) => d.view.id === view.id) ? list : [...list, { view, result: r }]))} />
        ))}
      </ul>
    </section>
  )
}

/** After the call: they asked for information, so now the prepared mail may go. */
export function WantsInfo({ contactId, hasEmail }: { contactId: string; hasEmail: boolean }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [pending, start] = useTransition()
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)
  if (result?.ok)
    return (
      <p className="small" role="status">
        {result.text}
      </p>
    )
  if (!open)
    return (
      <button type="button" className="button secondary small" onClick={() => setOpen(true)}>
        Ze willen info
      </button>
    )
  return (
    <form
      className="row wrap"
      onSubmit={(e) => {
        e.preventDefault()
        start(async () => {
          const r = await prospectWantsInfo(contactId, email)
          setResult({ ok: r.ok, text: r.message })
        })
      }}
    >
      <input
        className="input"
        type="email"
        aria-label="E-mailadres dat ze je gaven"
        placeholder={hasEmail ? 'Leeg laten: het adres van hun site' : 'Het adres dat ze je gaven'}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ maxWidth: 320 }}
      />
      <button type="submit" className="button primary small" disabled={pending}>
        Stuur de infomail
      </button>
      {result && !result.ok ? (
        <span className="small" role="alert" style={{ color: 'var(--bad)' }}>
          {result.text}
        </span>
      ) : null}
    </form>
  )
}

/** "Schrijf alle mails": every new contact gets a personal mail, written in the background, 100 in one go. */
export function WriteAllMailsButton({ projectId, count, disabledReason }: { projectId: string; count: number; disabledReason: string | null }) {
  const [pending, start] = useTransition()
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [writing, setWriting] = useState(false)
  useWatch(writing)
  return (
    <div className="stack-xs">
      <button
        type="button"
        className="button secondary"
        disabled={pending || writing || Boolean(disabledReason) || !count}
        onClick={() =>
          start(async () => {
            const r = await writeAllMails(projectId)
            setMessage({ ok: r.ok, text: r.message })
            if (r.ok) setWriting(true)
          })
        }
      >
        {writing ? 'Claude schrijft…' : `Schrijf mails voor ${count} nieuw${count === 1 ? ' contact' : 'e contacten'}`}
      </button>
      {disabledReason || !count ? <span className="tiny muted">{disabledReason ?? 'Geen nieuwe contacten met een e-mailadres.'}</span> : null}
      {message ? (
        <span className="small" role={message.ok ? 'status' : 'alert'} style={message.ok ? undefined : { color: 'var(--bad)' }}>
          {message.text}
        </span>
      ) : null}
    </div>
  )
}
