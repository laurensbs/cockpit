import 'server-only'
import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'

// Videos are made with ffmpeg: the one that ships with the app (COCKPIT_FFMPEG), or one on the PATH
// (brew install ffmpeg). Without it, the cockpit still draws the cover and makes the CapCut package.

let found: string | null | undefined

export function ffmpegPath(): string | null {
  if (found !== undefined) return found
  const bundled = process.env.COCKPIT_FFMPEG
  if (bundled && existsSync(bundled)) return (found = bundled)
  const probe = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore', timeout: 5000, windowsHide: true })
  found = probe.status === 0 ? 'ffmpeg' : null
  return found
}

export interface RunResult {
  ok: boolean
  stderr: string
}

/** Runs ffmpeg with arguments (never through a shell), with a time limit. */
export function runFfmpeg(args: string[], timeoutMs = 10 * 60_000): Promise<RunResult> {
  const exe = ffmpegPath()
  if (!exe) return Promise.resolve({ ok: false, stderr: 'ffmpeg ontbreekt' })
  return new Promise((resolve) => {
    const child = spawn(exe, ['-hide_banner', '-nostdin', ...args], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true })
    let stderr = ''
    child.stderr.on('data', (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-20_000)
    })
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs)
    child.on('error', () => {
      clearTimeout(timer)
      resolve({ ok: false, stderr: 'ffmpeg kon niet starten' })
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ ok: code === 0, stderr })
    })
  })
}

export interface MediaInfo {
  durationMs: number | null
  width: number | null
  height: number | null
  hasAudio: boolean
  isVideo: boolean
}

/** What ffmpeg says about a file: length, size as shown (rotation included), and whether it has sound. */
export function parseInfo(stderr: string): MediaInfo {
  const d = stderr.match(/Duration: (\d+):(\d{2}):(\d{2}(?:\.\d+)?)/)
  const durationMs = d ? Math.round((Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3])) * 1000) : null
  const video = stderr.match(/Stream #\d+:\d+[^\n]*: Video: [^\n]*?(\d{2,5})x(\d{2,5})/)
  const rotation = stderr.match(/rotation of (-?\d+(?:\.\d+)?) degrees/)
  let width = video ? Number(video[1]) : null
  let height = video ? Number(video[2]) : null
  if (rotation && Math.abs(Math.round(Number(rotation[1]))) % 180 === 90) [width, height] = [height, width]
  const still = /Video: (png|mjpeg|webp|bmp|gif)/.test(stderr) && (durationMs == null || durationMs <= 100)
  return { durationMs: still ? null : durationMs, width, height, hasAudio: /Stream #\d+:\d+[^\n]*: Audio:/.test(stderr), isVideo: Boolean(video) && !still }
}

export async function mediaInfo(file: string): Promise<MediaInfo | null> {
  const r = await runFfmpeg(['-i', file], 30_000)
  // Without an output ffmpeg "fails", but it has printed what it found.
  return /Stream #/.test(r.stderr) ? parseInfo(r.stderr) : null
}
