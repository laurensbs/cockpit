import 'server-only'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { and, eq } from 'drizzle-orm'
import { type Db, dbDir } from '@/db'
import * as s from '@/db/schema'

// Pictures, PDFs and videos of the projects live in a folder next to the database: the app's own data
// folder on his computer. The table says what each file is; the page gets them through /api/media.

export type MediaRole = 'slide' | 'jpeg' | 'cover' | 'pdf' | 'video' | 'final' | 'photo' | 'clip'
export type MediaRow = typeof s.mediaAsset.$inferSelect

export function mediaDir(): string {
  if (process.env.COCKPIT_MEDIA_DIR) return resolve(process.env.COCKPIT_MEDIA_DIR)
  const db = dbDir()
  return db ? join(dirname(resolve(db)), 'media') : join(tmpdir(), `cockpit-media-${process.pid}`)
}

/** The file on disk for a row; never outside the media folder. */
export function mediaPath(file: string): string | null {
  const root = mediaDir()
  const full = resolve(root, file)
  const rel = relative(root, full)
  return rel && !rel.startsWith('..') && !isAbsolute(rel) ? full : null
}

const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'application/pdf': 'pdf', 'video/mp4': 'mp4', 'video/quicktime': 'mov' }

/** A new place in the media folder for a file of this type (the folder exists afterwards). */
export function newMediaFile(projectId: string | null, mime: string): { id: string; file: string; full: string } {
  const id = crypto.randomUUID()
  const file = `${projectId ?? 'general'}/${id}.${EXT[mime] ?? 'bin'}`
  const full = join(mediaDir(), file)
  mkdirSync(dirname(full), { recursive: true })
  return { id, file, full }
}

export const UPLOAD_TYPES: Record<string, 'clip' | 'photo'> = { 'video/mp4': 'clip', 'video/quicktime': 'clip', 'image/jpeg': 'photo', 'image/png': 'photo', 'image/webp': 'photo' }

/** Where a video's small preview picture sits, next to the video. */
export const thumbFile = (file: string) => `${file}.thumb.jpg`

/** Writes a file and records it. */
export async function saveMedia(
  db: Db,
  ownerId: string,
  input: { projectId: string | null; contentItemId?: string | null; origin: 'upload' | 'render'; role: MediaRole; position?: number; data: Buffer; mime: string; width?: number; height?: number; durationMs?: number; description?: string },
): Promise<MediaRow> {
  const { id, file, full } = newMediaFile(input.projectId, input.mime)
  writeFileSync(full, input.data)
  const [row] = await db
    .insert(s.mediaAsset)
    .values({
      id,
      ownerId,
      projectId: input.projectId,
      contentItemId: input.contentItemId ?? null,
      origin: input.origin,
      role: input.role,
      position: input.position ?? 0,
      file,
      mime: input.mime,
      bytes: input.data.length,
      width: input.width ?? null,
      height: input.height ?? null,
      durationMs: input.durationMs ?? null,
      description: input.description ?? '',
    })
    .returning()
  return row
}

/** Removes what the cockpit drew for an item (before drawing it again), files included. */
export async function clearRenders(db: Db, ownerId: string, contentItemId: string): Promise<void> {
  const rows = await db
    .select({ id: s.mediaAsset.id, file: s.mediaAsset.file })
    .from(s.mediaAsset)
    .where(and(eq(s.mediaAsset.ownerId, ownerId), eq(s.mediaAsset.contentItemId, contentItemId), eq(s.mediaAsset.origin, 'render')))
  for (const r of rows) {
    const full = mediaPath(r.file)
    if (full) rmSync(full, { force: true })
    await db.delete(s.mediaAsset).where(eq(s.mediaAsset.id, r.id))
  }
}

/** Removes one file of his and its preview. */
export async function deleteMediaRow(db: Db, ownerId: string, id: string): Promise<boolean> {
  const [row] = await db
    .select({ file: s.mediaAsset.file })
    .from(s.mediaAsset)
    .where(and(eq(s.mediaAsset.id, id), eq(s.mediaAsset.ownerId, ownerId)))
  if (!row) return false
  for (const f of [row.file, thumbFile(row.file)]) {
    const full = mediaPath(f)
    if (full) rmSync(full, { force: true })
  }
  await db.delete(s.mediaAsset).where(eq(s.mediaAsset.id, id))
  return true
}
