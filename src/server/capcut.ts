import 'server-only'
import { spawn } from 'node:child_process'
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, extname, join } from 'node:path'
import { and, asc, eq, inArray } from 'drizzle-orm'
import type { Db } from '@/db'
import * as s from '@/db/schema'
import { normalizeBrand } from '@/lib/brand'
import type { WeekBody } from '@/lib/content-week'
import { REEL, srt } from '@/lib/reel'
import { mediaInfo } from './ffmpeg'
import { mediaPath, saveMedia } from './media'
import { renderPng } from './render/engine'
import { reelCaption } from './render/templates'
import { fixturesAllowed } from './status'

// For the videos he makes himself (talking to the camera, filming the real place): a folder he opens
// in CapCut, with the script, the subtitles, the text cards, the cover and his clips. When he exports
// final.mp4 into that folder, the cockpit takes it as the video of the post.

export function capcutRoot(): string {
  if (process.env.COCKPIT_CAPCUT_DIR) return process.env.COCKPIT_CAPCUT_DIR
  return join(homedir(), process.platform === 'darwin' ? 'Movies' : 'Videos', 'Cockpit')
}

const safe = (name: string) => name.replace(/[^\p{L}\p{N} ._-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 60) || 'video'

function readme(title: string, hasClips: boolean): string {
  return `# ${title}

Zo maak je deze video af in CapCut:

1. Nieuw project, formaat 9:16.
2. ${hasClips ? 'Importeer de clips uit deze map (clip-1, clip-2, …) en zet ze in volgorde.' : 'Film wat in shots.md staat (of gebruik een schermopname) en importeer het.'}
3. Tekst → Ondertitels → Lokale ondertitels: kies captions.srt. Praat je zelf? Gebruik dan Automatische ondertitels.
4. Leg de tekstkaarten (map tekstkaarten) als overlay op het moment uit script.md, of gebruik de ondertitels als tekst in beeld.
5. Kies een geluid uit de bibliotheek van CapCut (voor TikTok kun je ook in de app een trending geluid kiezen).
6. Exporteer als **final.mp4** naar deze map.
7. In de Cockpit: Contentweek → deze post → **Ik heb hem geëxporteerd**. Daarna kun je hem goedkeuren.
`
}

/** Makes (or makes again) the CapCut folder for a reel. */
export async function buildCapcutPackage(db: Db, ownerId: string, itemId: string): Promise<{ ok: boolean; dir?: string; error?: string }> {
  const [row] = await db
    .select({ item: s.contentItem, project: s.project.name, brand: s.project.brand, color: s.company.color })
    .from(s.contentItem)
    .leftJoin(s.project, eq(s.project.id, s.contentItem.projectId))
    .leftJoin(s.company, eq(s.company.id, s.project.companyId))
    .where(and(eq(s.contentItem.id, itemId), eq(s.contentItem.ownerId, ownerId)))
  const body = row?.item.body as WeekBody | undefined
  if (!row || !body?.reel) return { ok: false, error: 'Alleen voor video’s.' }
  const reel = body.reel
  const dir = body.capcut?.dir && existsSync(body.capcut.dir) ? body.capcut.dir : join(capcutRoot(), safe(row.project ?? 'Project'), `${row.item.plannedFor ?? ''} ${safe(row.item.title)}`.trim())
  mkdirSync(join(dir, 'tekstkaarten'), { recursive: true })
  const brand = normalizeBrand(row.brand, row.color)
  writeFileSync(join(dir, 'captions.srt'), srt(reel.beats, reel.durationSec))
  for (const [i, beat] of reel.beats.entries()) writeFileSync(join(dir, 'tekstkaarten', `${String(i + 1).padStart(2, '0')}.png`), await renderPng(reelCaption(brand, beat.text), REEL.width, REEL.height))
  const media = await db
    .select({ id: s.mediaAsset.id, file: s.mediaAsset.file, role: s.mediaAsset.role, contentItemId: s.mediaAsset.contentItemId, mime: s.mediaAsset.mime })
    .from(s.mediaAsset)
    .where(and(eq(s.mediaAsset.ownerId, ownerId), reel.mediaIds.length ? inArray(s.mediaAsset.id, [...reel.mediaIds]) : eq(s.mediaAsset.contentItemId, itemId)))
    .orderBy(asc(s.mediaAsset.position))
  let clips = 0
  for (const id of reel.mediaIds) {
    const m = media.find((x) => x.id === id)
    const from = m ? mediaPath(m.file) : null
    if (!m || !from) continue
    clips++
    copyFileSync(from, join(dir, `clip-${clips}${extname(m.file)}`))
  }
  const [cover] = await db
    .select({ file: s.mediaAsset.file })
    .from(s.mediaAsset)
    .where(and(eq(s.mediaAsset.contentItemId, itemId), eq(s.mediaAsset.role, 'cover')))
  const coverPath = cover ? mediaPath(cover.file) : null
  if (coverPath) copyFileSync(coverPath, join(dir, 'cover.png'))
  writeFileSync(
    join(dir, 'script.md'),
    [
      `# ${row.item.title}`,
      `Hook: ${body.hook}`,
      `Lengte: ${reel.durationSec} seconden`,
      '',
      '## Beats',
      ...reel.beats.map((b, i) => `${i + 1}. ${b.sec}s: ${b.text}${b.shot ? ` (in beeld: ${b.shot})` : ''}`),
      ...(reel.voiceover ? ['', '## Voice-over', reel.voiceover] : []),
      '',
      '## Tekst bij de post',
      body.caption,
      body.hashtags.join(' '),
    ].join('\n'),
  )
  writeFileSync(join(dir, 'shots.md'), ['# Wat je filmt', ...reel.beats.map((b, i) => `${i + 1}. ${b.shot || `iets dat past bij: ${b.text}`}`)].join('\n'))
  writeFileSync(join(dir, 'LEESMIJ.md'), readme(row.item.title, clips > 0))
  await db
    .update(s.contentItem)
    .set({ body: { ...body, capcut: { dir, at: new Date().toISOString() } } })
    .where(eq(s.contentItem.id, itemId))
  return { ok: true, dir }
}

/** Opens a folder in Finder or Explorer (in tests, writes down which folder). */
export function openFolder(dir: string): boolean {
  const fake = fixturesAllowed() ? process.env.COCKPIT_FAKE_TERMINAL : undefined
  if (fake) {
    mkdirSync(dirname(fake), { recursive: true })
    appendFileSync(fake, `${JSON.stringify({ open: dir, at: new Date().toISOString() })}\n`)
    return true
  }
  try {
    const [cmd, args] = process.platform === 'darwin' ? ['open', [dir]] : process.platform === 'win32' ? ['explorer', [dir]] : ['xdg-open', [dir]]
    spawn(cmd as string, args as string[], { detached: true, stdio: 'ignore' }).unref()
    return true
  } catch {
    return false
  }
}

/** His export: final.mp4 (or the newest other video he put in the folder after the package was made). */
export function findExport(dir: string, since: string | undefined): string | null {
  if (!existsSync(dir)) return null
  const videos = readdirSync(dir)
    .filter((f) => /\.(mp4|mov)$/i.test(f) && !/^clip-\d+\./i.test(f))
    .map((f) => ({ f, at: statSync(join(dir, f)).mtimeMs }))
  const final = videos.find((v) => /^final\.(mp4|mov)$/i.test(v.f))
  if (final) return join(dir, final.f)
  const after = since ? Date.parse(since) : 0
  const newest = videos.filter((v) => v.at >= after).sort((a, b) => b.at - a.at)[0]
  return newest ? join(dir, newest.f) : null
}

/** Takes his exported video as the video of the post. */
export async function importExport(db: Db, ownerId: string, itemId: string): Promise<{ ok: boolean; error?: string }> {
  const [item] = await db
    .select()
    .from(s.contentItem)
    .where(and(eq(s.contentItem.id, itemId), eq(s.contentItem.ownerId, ownerId)))
  const body = item?.body as WeekBody | undefined
  if (!item || !body?.capcut) return { ok: false, error: 'Maak eerst het CapCut-pakket.' }
  const file = findExport(body.capcut.dir, body.capcut.at)
  if (!file) return { ok: false, error: 'Geen final.mp4 gevonden in de map.' }
  const info = await mediaInfo(file)
  const old = await db
    .select({ id: s.mediaAsset.id })
    .from(s.mediaAsset)
    .where(and(eq(s.mediaAsset.contentItemId, itemId), eq(s.mediaAsset.role, 'final')))
  const { deleteMediaRow } = await import('./media')
  for (const o of old) await deleteMediaRow(db, ownerId, o.id)
  await saveMedia(db, ownerId, {
    projectId: item.projectId,
    contentItemId: itemId,
    origin: 'upload',
    role: 'final',
    data: readFileSync(file),
    mime: file.toLowerCase().endsWith('.mov') ? 'video/quicktime' : 'video/mp4',
    width: info?.width ?? undefined,
    height: info?.height ?? undefined,
    durationMs: info?.durationMs ?? undefined,
    description: 'Zijn eigen versie uit CapCut',
  })
  return { ok: true }
}
