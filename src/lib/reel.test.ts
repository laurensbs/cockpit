import { describe, expect, it } from 'vitest'
import { beatWindows, reelArgs, shares, srt } from './reel'

describe('reel plan', () => {
  it('shares the length over the sources and keeps the total exact', () => {
    expect(shares(3, 10)).toEqual([3.33, 3.33, 3.34])
    expect(shares(0, 10)).toEqual([])
  })
  it('cuts clips to fill the screen, keeps their sound, and puts a text card on screen per beat', () => {
    const args = reelArgs({
      sources: [
        { file: 'clip.mov', kind: 'video', hasAudio: true },
        { file: 'photo.jpg', kind: 'photo' },
      ],
      background: 'bg.png',
      padColor: '#faf8f4',
      overlays: [
        { file: 'o1.png', start: 0, end: 2 },
        { file: 'o2.png', start: 2, end: 6 },
      ],
      duration: 6,
      output: 'out.mp4',
    })
    const graph = args[args.indexOf('-filter_complex') + 1]
    expect(args.slice(0, 4)).toEqual(['-stream_loop', '-1', '-i', 'clip.mov'])
    expect(graph).toContain('[0:a]atrim=duration=3')
    expect(graph).toContain('anullsrc=r=44100:cl=stereo,atrim=duration=3')
    expect(graph).toContain('force_original_aspect_ratio=increase,crop=1080:1920')
    expect(graph).toContain('concat=n=2:v=1:a=1[vc][ac]')
    expect(graph).toContain("[vc][2:v]overlay=0:0:enable='between(t,0,2)'[o0]")
    expect(graph).toContain("[o0][3:v]overlay=0:0:enable='between(t,2,6)'[o1]")
    expect(args).toContain('[o1]')
    expect(args.slice(-3)).toEqual(['6', '-y', 'out.mp4'])
  })
  it('shows slides whole on the background colour, and falls back to the house style without sources', () => {
    const slides = reelArgs({ sources: [{ file: 's1.png', kind: 'slide' }], background: 'bg.png', padColor: '#101014', overlays: [], duration: 3, output: 'o.mp4' })
    expect(slides.join(' ')).toContain('pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=0x101014')
    const bare = reelArgs({ sources: [], background: 'bg.png', padColor: '#000000', overlays: [], duration: 5, output: 'o.mp4' })
    expect(bare).toContain('bg.png')
    expect(bare).toContain('[vc]')
  })
  it('times beats and writes SRT subtitles for CapCut', () => {
    expect(beatWindows([{ sec: 0 }, { sec: 2.5 }, { sec: 9 }], 7)).toEqual([
      { start: 0, end: 2.5 },
      { start: 2.5, end: 7 },
    ])
    expect(srt([{ sec: 0, text: 'Hoi' }, { sec: 2.5, text: 'Kijk' }], 4)).toBe('1\n00:00:00,000 --> 00:00:02,500\nHoi\n\n2\n00:00:02,500 --> 00:00:04,000\nKijk\n')
  })
})
