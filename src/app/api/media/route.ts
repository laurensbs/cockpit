import { createWriteStream, rmSync, statSync } from 'node:fs'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { and, eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { getDb } from '@/db'
import * as s from '@/db/schema'
import { mediaInfo, runFfmpeg } from '@/server/ffmpeg'
import { mediaPath, newMediaFile, thumbFile, UPLOAD_TYPES } from '@/server/media'
import { isLoopbackHost } from '@/lib/local'
import { getOwner } from '@/server/session'

export const dynamic = 'force-dynamic'

const MAX_BYTES = 1024 * 1024 * 1024

/**
 * One of his own clips or photos for a project, sent as the raw file (headers: x-project, x-filename,
 * x-description). Stored in the media folder; a video gets a small preview picture.
 */
export async function POST(request: Request) {
  // Outside the proxy (see src/proxy.ts), so the same checks here: a loopback name, and his token.
  if (!isLoopbackHost(request.headers.get('host'))) return new Response('Forbidden', { status: 403 })
  const owner = await getOwner()
  if (!owner) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const mime = (request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
  const role = UPLOAD_TYPES[mime]
  if (!role) return NextResponse.json({ error: 'Alleen MP4, MOV, JPEG, PNG of WebP.' }, { status: 415 })
  if (Number(request.headers.get('content-length')) > MAX_BYTES) return NextResponse.json({ error: 'Groter dan 1 GB.' }, { status: 413 })
  const db = await getDb()
  const projectId = request.headers.get('x-project') ?? ''
  const [project] = await db
    .select({ id: s.project.id })
    .from(s.project)
    .where(and(eq(s.project.id, projectId), eq(s.project.ownerId, owner.userId)))
  if (!project || !request.body) return NextResponse.json({ error: 'Kies een project.' }, { status: 400 })
  const { id, file, full } = newMediaFile(project.id, mime)
  let size = 0
  const limit = new Transform({
    transform(chunk: Buffer, _enc, done) {
      size += chunk.length
      done(size > MAX_BYTES ? new Error('too big') : null, chunk)
    },
  })
  try {
    await pipeline(Readable.fromWeb(request.body as never), limit, createWriteStream(full))
  } catch {
    rmSync(full, { force: true })
    return NextResponse.json({ error: size > MAX_BYTES ? 'Groter dan 1 GB.' : 'Uploaden lukte niet.' }, { status: 400 })
  }
  const info = await mediaInfo(full)
  if (role === 'clip') {
    const thumb = mediaPath(thumbFile(file))
    if (thumb) await runFfmpeg(['-ss', '0.5', '-i', full, '-frames:v', '1', '-vf', 'scale=360:-2', '-y', thumb], 60_000)
  }
  const name = decodeURIComponent(request.headers.get('x-filename') ?? '').slice(0, 120)
  const description = decodeURIComponent(request.headers.get('x-description') ?? '').trim().slice(0, 300) || name.replace(/\.[a-z0-9]+$/i, '')
  await db.insert(s.mediaAsset).values({
    id,
    ownerId: owner.userId,
    projectId: project.id,
    origin: 'upload',
    role,
    file,
    mime,
    bytes: statSync(full).size,
    width: info?.width ?? null,
    height: info?.height ?? null,
    durationMs: info?.durationMs ?? null,
    description,
  })
  return NextResponse.json({ ok: true, id })
}
