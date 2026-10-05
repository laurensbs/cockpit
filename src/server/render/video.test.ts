import { mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { normalizeBrand } from '@/lib/brand'
import { reelArgs } from '@/lib/reel'

vi.mock('server-only', () => ({}))

// Encodes a real video when ffmpeg is on this machine (the app brings its own).
describe('reel video', () => {
  it('makes an H.264 + AAC video of 1080×1920 from a clip with sound, a photo and text cards', async () => {
    const { ffmpegPath, mediaInfo, runFfmpeg } = await import('../ffmpeg')
    if (!ffmpegPath()) return
    const { renderPng } = await import('./engine')
    const { reelBackground, reelCaption } = await import('./templates')
    const dir = mkdtempSync(join(tmpdir(), 'reel-test-'))
    try {
      const brand = normalizeBrand({ accent: '#ff5a36', style: 'bold', handle: 'rondje' })
      const clip = join(dir, 'clip.mp4')
      expect((await runFfmpeg(['-f', 'lavfi', '-i', 'testsrc=size=640x360:rate=30:duration=2', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2', '-shortest', '-c:v', 'libx264', '-c:a', 'aac', '-y', clip])).ok).toBe(true)
      const photo = join(dir, 'photo.png')
      writeFileSync(photo, await renderPng(reelBackground(brand), 1080, 1920))
      const overlays = []
      for (const [i, text] of ['Je hond wil wandelen', 'Zo vind je een maatje'].entries()) {
        const file = join(dir, `o${i}.png`)
        writeFileSync(file, await renderPng(reelCaption(brand, text), 1080, 1920))
        overlays.push({ file, start: i * 1.5, end: i * 1.5 + 1.5 })
      }
      const output = join(dir, 'out.mp4')
      const run = await runFfmpeg(reelArgs({ sources: [{ file: clip, kind: 'video', hasAudio: true }, { file: photo, kind: 'photo' }], background: photo, padColor: brand.bg, overlays, duration: 3, output }))
      expect(run.ok, run.stderr.slice(-500)).toBe(true)
      const info = await mediaInfo(output)
      expect(info).toMatchObject({ width: 1080, height: 1920, hasAudio: true, isVideo: true })
      expect(Math.abs((info?.durationMs ?? 0) - 3000)).toBeLessThan(200)
      expect(statSync(output).size).toBeGreaterThan(10_000)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }, 120_000)
})
