'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { useForm } from '@/lib/use-form'
import { connectionNow, disconnectLinkedin, linkedinLogin, removeBlobToken, removeInstagram, removeTiktok, saveBlobToken, saveInstagram, saveLinkedinApp, saveTiktokApp, setPublishPaused, tiktokLogin } from '@/server/actions/channels'
import { initialFormState, type FormState } from '@/server/actions/types'
import { CopyButton } from './CopyButton'
import { Icon } from './Icon'

export interface ChannelsView {
  paused: boolean
  /** Who is connected, as the page was built; a login in his browser changes it. */
  stamp: string
  projects: { id: string; name: string }[]
  linkedin: { clientId: string; appSet: boolean; account: { name: string; until: string } | null; redirect: string }
  instagram: { blobSet: boolean; accounts: { projectId: string; project: string; username: string; until: string }[] }
  tiktok: { clientKey: string; appSet: boolean; accounts: { projectId: string; project: string; name: string }[]; redirect: string }
}

function Result({ state }: { state: FormState }) {
  if (state.error)
    return (
      <span className="tiny" role="alert" style={{ color: 'var(--bad)' }}>
        {state.error}
      </span>
    )
  return state.message ? (
    <span className="tiny muted" role="status">
      {state.message}
    </span>
  ) : null
}

/** After he logs in in his own browser, look every few seconds whether it worked (for five minutes). */
function useWatchLogin(stamp: string) {
  const router = useRouter()
  const [watching, setWatching] = useState(false)
  const since = useRef(stamp)
  useEffect(() => {
    since.current = stamp
  }, [stamp])
  useEffect(() => {
    if (!watching) return
    const started = Date.now()
    const timer = setInterval(async () => {
      const now = await connectionNow().catch(() => since.current)
      if (now !== since.current || Date.now() - started > 5 * 60_000) {
        clearInterval(timer)
        setWatching(false)
        router.refresh()
      }
    }, 2500)
    return () => clearInterval(timer)
  }, [watching, router])
  return () => setWatching(true)
}

/** A login link that opens in his own browser (the app sends https links there). */
function LoginLink({ url, label }: { url: string; label: string }) {
  return (
    <p className="small stack-xs">
      <a className="button secondary small" href={url} target="_blank" rel="noreferrer">
        <Icon name="external" size={16} /> {label}
      </a>
      <span className="tiny muted">Log in en geef toestemming; daarna verschijnt de koppeling hier vanzelf.</span>
    </p>
  )
}

export function ChannelSettings({ view }: { view: ChannelsView }) {
  const [pending, start] = useTransition()
  const watch = useWatchLogin(view.stamp)
  const li = useForm(saveLinkedinApp, initialFormState)
  const ig = useForm(saveInstagram, initialFormState)
  const blob = useForm(saveBlobToken, initialFormState)
  const tt = useForm(saveTiktokApp, initialFormState)
  const [liUrl, setLiUrl] = useState<string | null>(null)
  const [ttUrl, setTtUrl] = useState<string | null>(null)
  const [ttProject, setTtProject] = useState(view.projects[0]?.id ?? '')
  const [error, setError] = useState('')
  const [paused, setPaused] = useState(view.paused)
  const login = (fn: () => Promise<{ url?: string; error?: string }>, set: (url: string) => void) =>
    start(async () => {
      setError('')
      const r = await fn()
      if (r.url) {
        set(r.url)
        watch()
      } else setError(r.error ?? 'Dat lukte niet.')
    })

  return (
    <div className="stack-l">
      <label className="check">
        <input
          type="checkbox"
          checked={paused}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.checked
            setPaused(next)
            start(() => setPublishPaused(next))
          }}
        />
        <span className="stack-xs">
          <strong>Plaatsen op pauze</strong>
          <span className="tiny muted">De noodstop: zolang dit aan staat, plaatst de cockpit niets, ook niet wat je al goedkeurde.</span>
        </span>
      </label>
      {error ? (
        <p className="tiny" role="alert" style={{ color: 'var(--bad)' }}>
          {error}
        </p>
      ) : null}

      <div className="stack-s" id="channel-linkedin">
        <div className="row between">
          <h3>LinkedIn</h3>
          {view.linkedin.account ? <span className="chip good">Gekoppeld</span> : <span className="chip">Niet gekoppeld</span>}
        </div>
        {view.linkedin.account ? (
          <div className="row">
            <span className="small">
              Als <strong>{view.linkedin.account.name}</strong>, tot {view.linkedin.account.until}
            </span>
            <button type="button" className="button ghost small" disabled={pending} onClick={() => start(() => disconnectLinkedin())}>
              Ontkoppel
            </button>
          </div>
        ) : null}
        <p className="tiny muted">
          linkedin.com/developers → Create app (koppel hem aan een eigen bedrijfspagina) → Products: <strong>Share on LinkedIn</strong> en <strong>Sign In with LinkedIn using OpenID Connect</strong> → Auth: zet dit adres bij Authorized redirect URLs:
        </p>
        <div className="row">
          <code className="codeblock">{view.linkedin.redirect}</code>
          <CopyButton text={view.linkedin.redirect} label="Kopieer" />
        </div>
        <form className="grid tight" onSubmit={li.onSubmit}>
          <label className="field">
            <span className="tiny">Client ID</span>
            <input className="input" name="clientId" defaultValue={view.linkedin.clientId} autoComplete="off" />
          </label>
          <label className="field">
            <span className="tiny">Client Secret</span>
            <input className="input" name="clientSecret" type="password" placeholder={view.linkedin.appSet ? 'Ingesteld; leeg laten om te houden' : ''} autoComplete="off" />
          </label>
          <div className="row" style={{ alignSelf: 'end' }}>
            <button type="submit" className="button secondary small" disabled={li.pending}>
              Bewaren
            </button>
            <Result state={li.state} />
          </div>
        </form>
        {view.linkedin.appSet ? (
          <button type="button" className="button primary small" disabled={pending} onClick={() => login(linkedinLogin, setLiUrl)} style={{ alignSelf: 'start' }}>
            {view.linkedin.account ? 'Opnieuw koppelen' : 'Koppel LinkedIn'}
          </button>
        ) : null}
        {liUrl ? <LoginLink url={liUrl} label="Open LinkedIn om in te loggen" /> : null}
        <p className="tiny muted">LinkedIn laat een koppeling 60 dagen werken; daarna druk je hier op Opnieuw koppelen (de cockpit herinnert je eraan).</p>
      </div>

      <div className="stack-s" id="channel-instagram">
        <div className="row between">
          <h3>Instagram</h3>
          <span className={`chip ${view.instagram.accounts.length && view.instagram.blobSet ? 'good' : ''}`}>{view.instagram.accounts.length ? `${view.instagram.accounts.length} account${view.instagram.accounts.length === 1 ? '' : 's'}` : 'Niet gekoppeld'}</span>
        </div>
        {view.instagram.accounts.length ? (
          <ul className="list" style={{ margin: 0 }}>
            {view.instagram.accounts.map((a) => (
              <li key={a.projectId} className="row between">
                <span className="small">
                  <strong>{a.project}</strong> · @{a.username} · tot {a.until}
                </span>
                <button type="button" className="button ghost small" disabled={pending} onClick={() => start(() => removeInstagram(a.projectId))}>
                  Weg
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="tiny muted">
          Een zakelijk of creator-account. developers.facebook.com → Create app (type Business) → Instagram → <strong>API setup with Instagram login</strong> → voeg je account toe → <strong>Generate token</strong>. Plak dat token hier, per project.
        </p>
        <form className="grid tight" onSubmit={ig.onSubmit}>
          <label className="field">
            <span className="tiny">Project</span>
            <select className="select" name="projectId" defaultValue={view.projects[0]?.id}>
              {view.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="tiny">Instagram-token</span>
            <input className="input" name="token" type="password" autoComplete="off" />
          </label>
          <div className="row" style={{ alignSelf: 'end' }}>
            <button type="submit" className="button secondary small" disabled={ig.pending}>
              Koppel
            </button>
            <Result state={ig.state} />
          </div>
        </form>
        <div className="stack-xs">
          <div className="row between">
            <span className="label">Vercel Blob (tijdelijk openbaar adres)</span>
            {view.instagram.blobSet ? <span className="chip good">Ingesteld</span> : <span className="chip">Nodig voor Instagram</span>}
          </div>
          <p className="tiny muted">Instagram haalt beelden van een openbaar adres. De cockpit zet elk bestand een paar minuten in je eigen Blob-store en haalt het daarna weg. Vercel → Storage → Create → Blob → kopieer het read-write-token.</p>
          <form className="row" onSubmit={blob.onSubmit}>
            <input className="input" name="token" type="password" aria-label="Blob-token" placeholder={view.instagram.blobSet ? 'Ingesteld; plak een nieuw om te vervangen' : 'vercel_blob_rw_…'} autoComplete="off" style={{ maxWidth: 360 }} />
            <button type="submit" className="button secondary small" disabled={blob.pending}>
              Bewaren
            </button>
            {view.instagram.blobSet ? (
              <button type="button" className="button ghost small" disabled={pending} onClick={() => start(() => removeBlobToken())}>
                Weg
              </button>
            ) : null}
            <Result state={blob.state} />
          </form>
        </div>
      </div>

      <div className="stack-s" id="channel-tiktok">
        <div className="row between">
          <h3>TikTok</h3>
          <span className={`chip ${view.tiktok.accounts.length ? 'good' : ''}`}>{view.tiktok.accounts.length ? `${view.tiktok.accounts.length} account${view.tiktok.accounts.length === 1 ? '' : 's'}` : 'Niet gekoppeld'}</span>
        </div>
        {view.tiktok.accounts.length ? (
          <ul className="list" style={{ margin: 0 }}>
            {view.tiktok.accounts.map((a) => (
              <li key={a.projectId} className="row between">
                <span className="small">
                  <strong>{a.project}</strong> · {a.name}
                </span>
                <button type="button" className="button ghost small" disabled={pending} onClick={() => start(() => removeTiktok(a.projectId))}>
                  Weg
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="tiny muted">
          developers.tiktok.com → Manage apps → Connect an app → Products: <strong>Login Kit</strong> (desktop) en <strong>Content Posting API</strong>. Zet dit adres als redirect URI. Video’s komen in je TikTok-concepten; daar kies je het geluid en plaats je hem. Rechtstreeks plaatsen kan pas als TikTok je app heeft goedgekeurd.
        </p>
        <div className="row">
          <code className="codeblock">{view.tiktok.redirect}</code>
          <CopyButton text={view.tiktok.redirect} label="Kopieer" />
        </div>
        <form className="grid tight" onSubmit={tt.onSubmit}>
          <label className="field">
            <span className="tiny">Client key</span>
            <input className="input" name="clientKey" defaultValue={view.tiktok.clientKey} autoComplete="off" />
          </label>
          <label className="field">
            <span className="tiny">Client secret</span>
            <input className="input" name="clientSecret" type="password" placeholder={view.tiktok.appSet ? 'Ingesteld; leeg laten om te houden' : ''} autoComplete="off" />
          </label>
          <div className="row" style={{ alignSelf: 'end' }}>
            <button type="submit" className="button secondary small" disabled={tt.pending}>
              Bewaren
            </button>
            <Result state={tt.state} />
          </div>
        </form>
        {view.tiktok.appSet ? (
          <div className="row">
            <select className="select" aria-label="TikTok voor project" value={ttProject} onChange={(e) => setTtProject(e.target.value)} style={{ maxWidth: 240 }}>
              {view.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button type="button" className="button primary small" disabled={pending} onClick={() => login(() => tiktokLogin(ttProject), setTtUrl)}>
              Koppel TikTok
            </button>
          </div>
        ) : null}
        {ttUrl ? <LoginLink url={ttUrl} label="Open TikTok om in te loggen" /> : null}
      </div>
    </div>
  )
}
