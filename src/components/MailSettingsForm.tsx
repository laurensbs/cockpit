'use client'

import { useState, useTransition } from 'react'
import { MAX_DAILY_CAP, SMTP_PRESETS } from '@/lib/outbox'
import { useForm } from '@/lib/use-form'
import { saveMailSettings, testMail } from '@/server/actions/mail'
import { initialFormState } from '@/server/actions/types'
import { Icon } from './Icon'

export interface MailSettingsValues {
  host: string
  port: number
  secure: boolean
  user: string
  hasPass: boolean
  fromName: string
  fromEmail: string
  cap: number
  enabled: boolean
}

/** His own mailbox over SMTP, the daily cap, and the switch for automatic sending. */
export function MailSettingsForm({ values }: { values: MailSettingsValues }) {
  const { state, pending, onSubmit } = useForm(saveMailSettings, initialFormState)
  const [host, setHost] = useState(values.host)
  const [port, setPort] = useState(String(values.port))
  const [secure, setSecure] = useState(values.secure)
  const [note, setNote] = useState('')
  const [testing, startTest] = useTransition()
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null)
  return (
    <form className="stack-m" onSubmit={onSubmit}>
      <label className="field">
        <span className="tiny">Mailprovider</span>
        <select
          className="select"
          defaultValue=""
          aria-label="Mailprovider"
          onChange={(e) => {
            const preset = SMTP_PRESETS[e.target.value]
            if (!preset) return
            if (preset.host) setHost(preset.host)
            setPort(String(preset.port))
            setSecure(preset.secure)
            setNote(preset.note)
          }}
        >
          <option value="">Kies om in te vullen…</option>
          {Object.entries(SMTP_PRESETS).map(([key, p]) => (
            <option key={key} value={key}>
              {p.label}
            </option>
          ))}
        </select>
        {note ? <span className="hint">{note}</span> : null}
      </label>
      <div className="grid tight">
        <label className="field">
          <span className="tiny">SMTP-server</span>
          <input className="input" name="host" value={host} onChange={(e) => setHost(e.target.value)} placeholder="smtp.jouwdomein.nl" autoComplete="off" spellCheck={false} />
        </label>
        <label className="field">
          <span className="tiny">Poort</span>
          <input className="input" name="port" value={port} onChange={(e) => setPort(e.target.value)} inputMode="numeric" />
        </label>
        <label className="check small" style={{ alignSelf: 'end' }}>
          <input type="checkbox" name="secure" value="1" checked={secure} onChange={(e) => setSecure(e.target.checked)} />
          <span>SSL/TLS (poort 465)</span>
        </label>
      </div>
      <div className="grid tight">
        <label className="field">
          <span className="tiny">Gebruikersnaam</span>
          <input className="input" name="user" defaultValue={values.user} autoComplete="off" spellCheck={false} />
        </label>
        <label className="field">
          <span className="tiny">Wachtwoord</span>
          <input className="input" name="pass" type="password" placeholder={values.hasPass ? 'Bewaard; laat leeg om te houden' : 'App-wachtwoord'} autoComplete="new-password" />
        </label>
      </div>
      <div className="grid tight">
        <label className="field">
          <span className="tiny">Naam afzender</span>
          <input className="input" name="fromName" defaultValue={values.fromName} placeholder="Laurens van Rondje" />
        </label>
        <label className="field">
          <span className="tiny">Adres afzender</span>
          <input className="input" name="fromEmail" type="email" defaultValue={values.fromEmail} placeholder="laurens@jouwdomein.nl" />
        </label>
        <label className="field">
          <span className="tiny">Maximaal per dag</span>
          <input className="input" name="cap" type="number" min={1} max={MAX_DAILY_CAP} defaultValue={values.cap} />
        </label>
      </div>
      <label className="check">
        <input type="checkbox" name="enabled" value="1" defaultChecked={values.enabled} />
        <span className="stack-xs">
          <strong>Automatisch versturen</strong>
          <span className="tiny muted">Mails die jij goedkeurt, gaan op werkdagen tussen 9 en 17 uur de deur uit, één tegelijk, met opvolgmails na 4 en 11 dagen. Een antwoord of “geen interesse” stopt de rest.</span>
        </span>
      </label>
      {state.error ? (
        <p className="notice bad small" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok && state.message ? (
        <p className="notice small" role="status">
          {state.message}
        </p>
      ) : null}
      <div className="row">
        <button type="submit" className="button primary" disabled={pending}>
          <Icon name="check" size={18} /> {pending ? 'Bezig…' : 'Bewaren'}
        </button>
        <button type="button" className="button secondary" disabled={testing} onClick={() => startTest(async () => setTest(await testMail()))}>
          <Icon name="send" size={16} /> {testing ? 'Versturen…' : 'Stuur een testmail naar mezelf'}
        </button>
      </div>
      {test ? (
        <p className={`notice small ${test.ok ? '' : 'bad'}`} role={test.ok ? 'status' : 'alert'}>
          {test.message}
        </p>
      ) : null}
    </form>
  )
}
