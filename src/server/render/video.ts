import 'server-only'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { and, asc, eq, inArray } from 'drizzle-orm'
import type { Db } from '@/db'
import * as s from '@/db/schema'
import type { Brand } from '@/lib/brand'
import type { WeekBody } from '@/lib/content-week'
import { beatWindows, REEL, reelArgs, type ReelSource } from '@/lib/reel'
import { ffmpegPath, mediaInfo, runFfmpeg } from '../ffmpeg'
import { mediaPath, saveMedia } from '../media'
import { renderPng } from './engine'
import { reelBackground, reelCaption } from './templates'

// The videos of the content week: a reel from his clips (or the house style) with a text card per beat,
// and, for TikTok, a carousel as a slideshow. Made with ffmpeg, in a temporary folder.

export type VideoResult = { ok: true } | { ok: false; error: string }

const SLIDE_SECONDS = 2.5

async function encode(args: (dir: string) => Promise<{ args: string[]; output: string; duration: number }>, save: (data: Buffer, duration: number) => Promise<void>): Promise<VideoResult> {
  if (!ffmpegPath()) return { ok: false, error: 'ffmpeg ontbreekt' }
  const dir = mkdtempSync(join(tmpdir(), 'cockpit-reel-'))
  try {
    const plan = await args(dir)
    const run = await runFfmpeg(plan.args)
    if (!run.ok) return { ok: false, error: `ffmpeg: ${run.stderr.trim().split('\n').slice(-2).join(' ').slice(0, 200)}` }
    await save(readFileSync(plan.output), plan.duration)
    return { ok: true }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/** A reel or TikTok from the beats: his clips and photos when Claude chose some, else the house style. */
export async function renderReelVideo(db: Db, ownerId: string, item: { id: string; projectId: string | null }, body: WeekBody, brand: Brand): Promise<VideoResult> {
  const reel = body.reel
  if (!reel) return { ok: false, error: 'Geen script.' }
  return encode(
    async (dir) => {
      const duration = reel.durationSec
      const sources: ReelSource[] = []
      if (reel.mediaIds.length && item.projectId) {
        const rows = await db
          .select({ id: s.mediaAsset.id, file: s.mediaAsset.file, mime: s.mediaAsset.mime })
          .from(s.mediaAsset)
          .where(and(eq(s.mediaAsset.ownerId, ownerId), eq(s.mediaAsset.projectId, item.projectId), eq(s.mediaAsset.origin, 'upload'), inArray(s.mediaAsset.id, reel.mediaIds)))
        for (const id of reel.mediaIds) {
          const row = rows.find((r) => r.id === id)
          const file = row ? mediaPath(row.file) : null
          if (!row || !file) continue
          const video = row.mime.startsWith('video/')
          sources.push({ file, kind: video ? 'video' : 'photo', hasAudio: video ? Boolean((await mediaInfo(file))?.hasAudio) : false })
        }
      }
      const background = join(dir, 'bg.png')
      writeFileSync(background, await renderPng(reelBackground(brand), REEL.width, REEL.height))
      const windows = beatWindows(reel.beats, duration)
      const overlays = []
      for (const [i, w] of windows.entries()) {
        const file = join(dir, `beat-${i}.png`)
        writeFileSync(file, await renderPng(reelCaption(brand, reel.beats[i].text), REEL.width, REEL.height))
        overlays.push({ file, ...w })
      }
      const output = join(dir, 'reel.mp4')
      return { args: reelArgs({ sources, background, padColor: brand.bg, overlays, duration, output }), output, duration }
    },
    async (data, duration) => {
      await saveMedia(db, ownerId, { projectId: item.projectId, contentItemId: item.id, origin: 'render', role: 'video', data, mime: 'video/mp4', ...REEL, durationMs: duration * 1000 })
    },
  )
}

/** A carousel for TikTok: every slide in turn, whole, on the house style's background. */
export async function renderSlideshow(db: Db, ownerId: string, item: { id: string; projectId: string | null }, brand: Brand): Promise<VideoResult> {
  return encode(
    async (dir) => {
      const slides = await db
        .select({ file: s.mediaAsset.file })
        .from(s.mediaAsset)
        .where(and(eq(s.mediaAsset.ownerId, ownerId), eq(s.mediaAsset.contentItemId, item.id), eq(s.mediaAsset.role, 'slide')))
        .orderBy(asc(s.mediaAsset.position))
      const sources = slides.map((r) => mediaPath(r.file)).filter((f): f is string => Boolean(f)).map((file) => ({ file, kind: 'slide' as const }))
      const duration = Math.min(30, sources.length * SLIDE_SECONDS)
      const output = join(dir, 'slides.mp4')
      return { args: reelArgs({ sources, background: '', padColor: brand.bg, overlays: [], duration, output }), output, duration }
    },
    async (data, duration) => {
      await saveMedia(db, ownerId, { projectId: item.projectId, contentItemId: item.id, origin: 'render', role: 'video', data, mime: 'video/mp4', ...REEL, durationMs: duration * 1000 })
    },
  )
}
