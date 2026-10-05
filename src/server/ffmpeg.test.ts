import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

describe('ffmpeg info', () => {
  it('reads length, size (rotated phone video upright) and sound', async () => {
    const { parseInfo } = await import('./ffmpeg')
    const phone = `Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'IMG_1234.MOV':
  Duration: 00:00:12.48, start: 0.000000, bitrate: 8000 kb/s
  Stream #0:0[0x1](und): Video: hevc (Main) (hvc1 / 0x31637668), yuv420p(tv), 1920x1080, 7900 kb/s, 29.97 fps
      Side data:
        displaymatrix: rotation of -90.00 degrees
  Stream #0:1[0x2](und): Audio: aac (LC) (mp4a / 0x6134706D), 44100 Hz, stereo, fltp, 96 kb/s`
    expect(parseInfo(phone)).toEqual({ durationMs: 12480, width: 1080, height: 1920, hasAudio: true, isVideo: true })
    const photo = `Input #0, png_pipe, from 'slide.png':
  Duration: N/A, bitrate: N/A
  Stream #0:0: Video: png, rgba(pc), 1080x1350, 25 fps`
    expect(parseInfo(photo)).toEqual({ durationMs: null, width: 1080, height: 1350, hasAudio: false, isVideo: false })
  })
})
