import { createReadStream, statSync } from 'node:fs'
import { Readable } from 'node:stream'
import { and, eq } from 'drizzle-orm'
import { getDb } from '@/db'
import * as s from '@/db/schema'
import { mediaPath } from '@/server/media'
import { bearerOwner, getOwner } from '@/server/session'

export const dynamic = 'force-dynamic'

/**
 * A picture, PDF or video of a project, only for him. Videos can be played from any point (Range);
 * ?download=1 saves it under a readable name.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const owner = bearerOwner(request) ?? (await getOwner())
  if (!owner) return new Response('Unauthorized', { status: 401 })
  const { id } = await params
  const db = await getDb()
  const [row] = await db
    .select({ file: s.mediaAsset.file, mime: s.mediaAsset.mime })
    .from(s.mediaAsset)
    .where(and(eq(s.mediaAsset.id, id), eq(s.mediaAsset.ownerId, owner.userId)))
  const full = row ? mediaPath(row.file) : null
  if (!row || !full) return new Response('Not found', { status: 404 })
  let size: number
  try {
    size = statSync(full).size
  } catch {
    return new Response('Not found', { status: 404 })
  }
  const url = new URL(request.url)
  const headers: Record<string, string> = { 'Content-Type': row.mime, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=3600' }
  const name = url.searchParams.get('name')?.replace(/[^\p{L}\p{N} ._-]/gu, '').slice(0, 80)
  if (url.searchParams.get('download') === '1') headers['Content-Disposition'] = `attachment; filename="${name || row.file.split('/').pop()}"`
  const range = request.headers.get('range')?.match(/^bytes=(\d*)-(\d*)$/)
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]))
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1
    if (start >= size || start > end) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
    const stream = Readable.toWeb(createReadStream(full, { start, end })) as ReadableStream
    return new Response(stream, { status: 206, headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) } })
  }
  return new Response(Readable.toWeb(createReadStream(full)) as ReadableStream, { headers: { ...headers, 'Content-Length': String(size) } })
}
