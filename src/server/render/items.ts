import 'server-only'
import { and, eq, gte } from 'drizzle-orm'
import type { Db } from '@/db'
import * as s from '@/db/schema'
import type { ContentFormat } from '@/lib/ai/playbooks'
import { normalizeBrand } from '@/lib/brand'
import type { WeekBody } from '@/lib/content-week'
import { clearRenders, saveMedia } from '../media'
import { renderPng } from './engine'
import { pdfFromPngs } from './pdf'
import { POST_SIZE, reelCover, slideSet, TALL_SIZE } from './templates'
import { renderReelVideo, renderSlideshow } from './video'

// Draws the pictures for the posts of the content week: slides for carousels and images, a PDF for a
// LinkedIn document, a cover for reels and stories. In the background, one item at a time.

const DRAWN: readonly ContentFormat[] = ['image', 'carousel', 'document', 'story', 'reel']

/** Draws one item again, from its current text and the project's current house style. */
export async function renderItem(db: Db, ownerId: string, itemId: string): Promise<{ ok: boolean; count: number; error?: string }> {
  const [row] = await db
    .select({ item: s.contentItem, brand: s.project.brand, color: s.company.color })
    .from(s.contentItem)
    .leftJoin(s.project, eq(s.project.id, s.contentItem.projectId))
    .leftJoin(s.company, eq(s.company.id, s.project.companyId))
    .where(and(eq(s.contentItem.id, itemId), eq(s.contentItem.ownerId, ownerId)))
  if (!row) return { ok: false, count: 0, error: 'Niet gevonden.' }
  const body = row.item.body as WeekBody
  const setRender = (render: WeekBody['render']) => db.update(s.contentItem).set({ body: { ...body, render } }).where(eq(s.contentItem.id, itemId))
  if (!body.week || !DRAWN.includes(body.contentFormat)) {
    await setRender({ status: 'done', at: new Date().toISOString(), count: 0 })
    return { ok: true, count: 0 }
  }
  const brand = normalizeBrand(row.brand, row.color)
  try {
    await clearRenders(db, ownerId, itemId)
    const projectId = row.item.projectId
    let count = 0
    if (body.contentFormat === 'reel') {
      const png = await renderPng(reelCover(brand, body.reel?.coverText || body.hook || row.item.title), TALL_SIZE.width, TALL_SIZE.height)
      await saveMedia(db, ownerId, { projectId, contentItemId: itemId, origin: 'render', role: 'cover', data: png, mime: 'image/png', ...TALL_SIZE })
      count = 1
    } else {
      const size = body.contentFormat === 'story' ? TALL_SIZE : POST_SIZE
      const pngs: Buffer[] = []
      for (const el of slideSet(brand, body.slides ?? [], size)) pngs.push(await renderPng(el, size.width, size.height))
      for (const [position, png] of pngs.entries()) await saveMedia(db, ownerId, { projectId, contentItemId: itemId, origin: 'render', role: 'slide', position, data: png, mime: 'image/png', ...size })
      count = pngs.length
      if (body.contentFormat === 'document') {
        await saveMedia(db, ownerId, { projectId, contentItemId: itemId, origin: 'render', role: 'pdf', data: await pdfFromPngs(pngs, row.item.title), mime: 'application/pdf', ...size })
        count++
      }
    }
    // The video: a reel from the script, or a TikTok carousel as a slideshow. Without ffmpeg the
    // pictures still count; the card says the video is missing.
    let video: NonNullable<WeekBody['render']>['video']
    if (body.contentFormat === 'reel' || (row.item.channel === 'tiktok' && body.contentFormat === 'carousel')) {
      const made = body.contentFormat === 'reel' ? await renderReelVideo(db, ownerId, row.item, body, brand) : await renderSlideshow(db, ownerId, row.item, brand)
      video = made.ok ? 'done' : made.error === 'ffmpeg ontbreekt' ? 'missing' : 'failed'
      if (made.ok) count++
      else if (video === 'failed') console.error('video', made.error)
    }
    await setRender({ status: 'done', at: new Date().toISOString(), count, ...(video ? { video } : {}) })
    return { ok: true, count }
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 200) : 'Tekenen lukte niet.'
    await setRender({ status: 'failed', at: new Date().toISOString(), error: message })
    return { ok: false, count: 0, error: message }
  }
}

/** Everything still waiting to be drawn, one at a time; never two rounds at once. */
export async function renderPending(db: Db, ownerId: string): Promise<number> {
  const state = globalThis as unknown as { __cockpitRendering?: Set<string> }
  state.__cockpitRendering ??= new Set()
  if (state.__cockpitRendering.has(ownerId)) return 0
  state.__cockpitRendering.add(ownerId)
  let done = 0
  try {
    for (let round = 0; round < 5; round++) {
      const since = new Date(Date.now() - 30 * 86_400_000)
      const rows = await db
        .select({ id: s.contentItem.id, body: s.contentItem.body })
        .from(s.contentItem)
        .where(and(eq(s.contentItem.ownerId, ownerId), eq(s.contentItem.kind, 'social'), gte(s.contentItem.createdAt, since)))
      const waiting = rows.filter((r) => (r.body as WeekBody).week && (r.body as WeekBody).render?.status === 'pending')
      if (!waiting.length) break
      for (const r of waiting) {
        await renderItem(db, ownerId, r.id)
        done++
      }
    }
    return done
  } finally {
    state.__cockpitRendering.delete(ownerId)
  }
}
