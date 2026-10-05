// A vertical video (1080×1920) from his clips and photos, or from the house style's background, with
// a text card on screen for every beat. This builds the ffmpeg arguments; it runs nothing. Pure, so
// the plan can be tested without encoding a single frame.

export const REEL = { width: 1080, height: 1920, fps: 30 } as const

export interface ReelSource {
  file: string
  /** video: a clip (cut to fill the screen); photo: a still (cut to fill); slide: a still shown whole on the background colour. */
  kind: 'video' | 'photo' | 'slide'
  hasAudio?: boolean
}

export interface ReelOverlay {
  file: string
  start: number
  end: number
}

export interface ReelPlanInput {
  sources: ReelSource[]
  /** The house style's background, used when there are no sources. */
  background: string
  /** The colour around a slide that does not fill the screen (#rrggbb). */
  padColor: string
  overlays: ReelOverlay[]
  /** Total length in seconds; with slides, each slide gets an equal share. */
  duration: number
  output: string
}

const round = (n: number) => Math.round(n * 100) / 100

/** How long each source plays: an equal share, the last one takes what is left. */
export function shares(count: number, duration: number): number[] {
  if (count <= 0) return []
  const each = round(duration / count)
  return Array.from({ length: count }, (_, i) => (i === count - 1 ? round(duration - each * (count - 1)) : each))
}

export function reelArgs(plan: ReelPlanInput): string[] {
  const { width: W, height: H, fps } = REEL
  const sources: ReelSource[] = plan.sources.length ? plan.sources : [{ file: plan.background, kind: 'photo' }]
  const lengths = shares(sources.length, plan.duration)
  const inputs: string[] = []
  const filters: string[] = []
  const fill = `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}`
  const fit = `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=${plan.padColor.replace('#', '0x')}`
  sources.forEach((src, i) => {
    const len = lengths[i]
    if (src.kind === 'video') inputs.push('-stream_loop', '-1', '-i', src.file)
    else inputs.push('-loop', '1', '-framerate', String(fps), '-t', String(len), '-i', src.file)
    filters.push(`[${i}:v]trim=duration=${len},setpts=PTS-STARTPTS,${src.kind === 'slide' ? fit : fill},setsar=1,fps=${fps},format=yuv420p[v${i}]`)
    filters.push(
      src.kind === 'video' && src.hasAudio
        ? `[${i}:a]atrim=duration=${len},asetpts=PTS-STARTPTS,aresample=44100,aformat=sample_fmts=fltp:channel_layouts=stereo[a${i}]`
        : `anullsrc=r=44100:cl=stereo,atrim=duration=${len},aformat=sample_fmts=fltp:channel_layouts=stereo[a${i}]`,
    )
  })
  filters.push(`${sources.map((_, i) => `[v${i}][a${i}]`).join('')}concat=n=${sources.length}:v=1:a=1[vc][ac]`)
  let last = 'vc'
  plan.overlays.forEach((o, k) => {
    const index = sources.length + k
    inputs.push('-loop', '1', '-framerate', String(fps), '-t', String(plan.duration), '-i', o.file)
    const out = `o${k}`
    filters.push(`[${last}][${index}:v]overlay=0:0:enable='between(t,${round(o.start)},${round(o.end)})'[${out}]`)
    last = out
  })
  return [
    ...inputs,
    '-filter_complex',
    filters.join(';'),
    '-map',
    `[${last}]`,
    '-map',
    '[ac]',
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '21',
    '-pix_fmt',
    'yuv420p',
    '-r',
    String(fps),
    '-c:a',
    'aac',
    '-b:a',
    '128k',
    '-ar',
    '44100',
    '-movflags',
    '+faststart',
    '-t',
    String(plan.duration),
    '-y',
    plan.output,
  ]
}

/** When each beat's text is on screen: from its second until the next beat (the last until the end). */
export function beatWindows(beats: { sec: number }[], duration: number): { start: number; end: number }[] {
  return beats.map((b, i) => ({ start: Math.min(b.sec, duration), end: Math.min(i < beats.length - 1 ? beats[i + 1].sec : duration, duration) })).filter((w) => w.end > w.start)
}

/** Subtitles in SRT for CapCut: one cue per beat. */
export function srt(beats: { sec: number; text: string }[], duration: number): string {
  const stamp = (s: number) => {
    const ms = Math.round(s * 1000)
    const h = Math.floor(ms / 3_600_000)
    const m = Math.floor((ms % 3_600_000) / 60_000)
    const sec = Math.floor((ms % 60_000) / 1000)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`
  }
  const windows = beatWindows(beats, duration)
  return `${beats
    .slice(0, windows.length)
    .map((b, i) => `${i + 1}\n${stamp(windows[i].start)} --> ${stamp(windows[i].end)}\n${b.text}\n`)
    .join('\n')}`
}
