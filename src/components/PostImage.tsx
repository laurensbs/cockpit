'use client'

import { useEffect, useState } from 'react'

const W = 1080
const H = 1350

/** Lines of text that fit a width, breaking on words; a word longer than the width gets its own line. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width > width && line) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  return lines
}

/** A post image in the project's colour (Instagram's 4:5), drawn on this computer: no upload, no account. */
export function drawPostImage(hook: string, project: string, color: string): string | null {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const bg = ctx.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, color)
  bg.addColorStop(1, '#14112e')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  // A soft round shape for depth, the way the app's cards feel.
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  ctx.beginPath()
  ctx.arc(W - 120, 180, 260, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  let size = 92
  let lines: string[] = []
  // The longest text that still fits in at most seven lines.
  for (; size >= 52; size -= 6) {
    ctx.font = `800 ${size}px "Instrument Sans Variable", "Space Grotesk Variable", system-ui, sans-serif`
    lines = wrap(ctx, hook.trim(), W - 180)
    if (lines.length <= 7) break
  }
  const lineHeight = size * 1.12
  let y = H / 2 - ((lines.length - 1) * lineHeight) / 2
  for (const l of lines.slice(0, 8)) {
    ctx.fillText(l, 90, y)
    y += lineHeight
  }
  ctx.font = '700 40px "Instrument Sans Variable", system-ui, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.fillText(project, 90, H - 110)
  ctx.fillStyle = '#b5f23d'
  ctx.fillRect(90, H - 170, 120, 10)
  return canvas.toDataURL('image/png')
}

export function PostImage({ hook, project, color, onSaved }: { hook: string; project: string; color: string; onSaved?: () => void }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    // Drawing needs the browser's canvas, so it happens after the first render.
    const url = drawPostImage(hook, project, color)
    const timer = setTimeout(() => setSrc(url), 0)
    return () => clearTimeout(timer)
  }, [hook, project, color])
  if (!src) return <div className="post-image placeholder" aria-hidden="true" />
  const name = `${project || 'post'}-${new Date().toISOString().slice(0, 10)}.png`.replace(/\s+/g, '-').toLowerCase()
  return (
    <figure className="post-image stack-xs">
      {/* eslint-disable-next-line @next/next/no-img-element -- a local data URL drawn on this computer */}
      <img src={src} alt={`Postbeeld: ${hook}`} width={W / 4} height={H / 4} />
      <a className="button secondary small" href={src} download={name} onClick={onSaved}>
        Bewaar beeld
      </a>
    </figure>
  )
}
