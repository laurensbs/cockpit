'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { describeMedia, removeMedia } from '@/server/actions/content-week'
import { Icon } from './Icon'

export interface MediaView {
  id: string
  projectId: string
  kind: 'clip' | 'photo'
  description: string
  seconds: number | null
  portrait: boolean | null
}

/** His own clips and photos per project: Claude uses them in reels when one fits. */
export function MediaLibrary({ projects, media }: { projects: { id: string; name: string }[]; media: MediaView[] }) {
  const router = useRouter()
  const [project, setProject] = useState(projects[0]?.id ?? '')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  const upload = async (files: FileList | null) => {
    if (!files?.length || !project) return
    setBusy(true)
    setMessage(null)
    let done = 0
    for (const file of Array.from(files)) {
      const res = await fetch('/api/media', {
        method: 'POST',
        headers: { 'content-type': file.type, 'x-project': project, 'x-filename': encodeURIComponent(file.name), 'x-description': encodeURIComponent(description) },
        body: file,
      }).catch(() => null)
      if (res?.ok) done++
      else {
        const error = res ? ((await res.json().catch(() => ({}))) as { error?: string }).error : null
        setMessage({ ok: false, text: `${file.name}: ${error ?? 'uploaden lukte niet'}` })
      }
    }
    setBusy(false)
    if (done) {
      setMessage({ ok: true, text: `${done} bestand${done === 1 ? '' : 'en'} toegevoegd.` })
      setDescription('')
      router.refresh()
    }
  }
  const shown = media.filter((m) => m.projectId === project)
  return (
    <div className="stack-m">
      <div className="grid tight">
        <label className="field">
          <span className="tiny">Project</span>
          <select className="select" value={project} onChange={(e) => setProject(e.target.value)}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="tiny">Wat is er te zien?</span>
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} placeholder="Bijv. ik loop met Bobbie door het park" />
        </label>
        <label className="field">
          <span className="tiny">Clips of foto’s</span>
          <input className="input" type="file" multiple accept="video/mp4,video/quicktime,image/jpeg,image/png,image/webp" disabled={busy} onChange={(e) => void upload(e.target.files)} />
        </label>
      </div>
      {busy ? <p className="tiny muted">Bezig met uploaden…</p> : null}
      {message ? (
        <p className="tiny" role="status" style={{ color: message.ok ? 'var(--good)' : 'var(--bad)' }}>
          {message.text}
        </p>
      ) : null}
      {shown.length ? (
        <ul className="media-grid" aria-label="Je media">
          {shown.map((m) => (
            <li key={m.id} className="stack-xs">
              {/* Local files from the cockpit's own media folder. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.kind === 'clip' ? `/api/media/${m.id}?thumb=1` : `/api/media/${m.id}`} alt={m.description} loading="lazy" />
              <span className="tiny muted">
                {m.kind === 'clip' ? `Clip${m.seconds ? ` · ${m.seconds} s` : ''}` : 'Foto'}
                {m.portrait == null ? '' : m.portrait ? ' · staand' : ' · liggend'}
              </span>
              <input className="input small" defaultValue={m.description} aria-label="Beschrijving" maxLength={300} onBlur={(e) => e.target.value !== m.description && start(() => describeMedia(m.id, e.target.value))} />
              <button type="button" className="button ghost small" disabled={pending} onClick={() => start(() => removeMedia(m.id))}>
                <Icon name="trash" size={14} /> Weg
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="tiny muted">Nog geen clips of foto’s voor dit project. Claude gebruikt ze in reels; zonder maakt de cockpit een video in je huisstijl.</p>
      )}
    </div>
  )
}
