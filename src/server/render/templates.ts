import 'server-only'
import { BRAND_FONTS, type Brand, inkOn } from '@/lib/brand'
import type { Slide } from '@/lib/content-week'
import { type El, h } from './engine'

// The slides the cockpit draws, in the project's house style: a cover, content slides and a closing
// slide for carousels and PDF documents (1080×1350), stories and reel covers (1080×1920, with room for
// the app's own buttons at the top and bottom).

export const POST_SIZE = { width: 1080, height: 1350 } as const
export const TALL_SIZE = { width: 1080, height: 1920 } as const

/** Two colours mixed: share 0 is a, 1 is b. */
export function mix(a: string, b: string, share: number): string {
  const ch = (hex: string, i: number) => parseInt(hex.slice(i, i + 2), 16)
  const out = [1, 3, 5].map((i) => Math.round(ch(a, i) * (1 - share) + ch(b, i) * share))
  return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

interface Palette {
  bg: string
  fg: string
  muted: string
  accent: string
  onAccent: string
  display: string
  body: string
  displayWeight: number
}

function palette(brand: Brand): Palette {
  const fonts = BRAND_FONTS[brand.font]
  return {
    bg: brand.bg,
    fg: brand.fg,
    muted: mix(brand.fg, brand.bg, 0.35),
    accent: brand.accent,
    onAccent: inkOn(brand.accent),
    display: fonts.display,
    body: fonts.body,
    displayWeight: brand.font === 'sans' ? 800 : 700,
  }
}

/** A size that keeps longer titles inside the slide. */
const fit = (text: string, sizes: [number, number, number, number]) => (text.length <= 28 ? sizes[0] : text.length <= 52 ? sizes[1] : text.length <= 80 ? sizes[2] : sizes[3])

function footer(p: Palette, brand: Brand, index: number, total: number, color: string, track: string): El {
  return h(
    { justifyContent: 'space-between', alignItems: 'center', width: '100%', fontFamily: p.body, fontSize: 30, fontWeight: 600, color },
    h({}, brand.handle || ' '),
    total > 1
      ? h(
          { alignItems: 'center', gap: 18 },
          h({ width: 220, height: 8, borderRadius: 8, background: track }, h({ width: `${Math.round(((index + 1) / total) * 100)}%`, height: 8, borderRadius: 8, background: p.accent })),
          h({}, `${index + 1}/${total}`),
        )
      : null,
  )
}

/** The first slide: the promise, big. */
export function coverSlide(brand: Brand, slide: Slide, total: number, size: { width: number; height: number } = POST_SIZE, tag = ''): El {
  const p = palette(brand)
  const bold = brand.style === 'bold'
  const bg = bold ? p.accent : p.bg
  const ink = bold ? p.onAccent : p.fg
  const soft = bold ? mix(p.onAccent, p.accent, 0.3) : p.muted
  const tall = size.height > 1500
  return h(
    { width: '100%', height: '100%', background: bg, color: ink, flexDirection: 'column', justifyContent: 'space-between', padding: tall ? '260px 90px 380px' : '90px', position: 'relative' },
    bold ? h({ position: 'absolute', right: -180, top: -180, width: 620, height: 620, borderRadius: 620, background: mix(p.accent, p.onAccent, 0.12) }) : h({ position: 'absolute', left: 90, top: tall ? 200 : 60, width: 120, height: 14, borderRadius: 14, background: p.accent }),
    h(
      { flexDirection: 'column', gap: 34, flexGrow: 1, justifyContent: 'center' },
      tag ? h({ fontFamily: p.body, fontSize: 30, fontWeight: 600, letterSpacing: 3, textTransform: 'uppercase', color: bold ? soft : p.accent }, tag) : null,
      h({ fontFamily: p.display, fontWeight: p.displayWeight, fontSize: fit(slide.title, tall ? [128, 108, 90, 74] : [116, 96, 80, 66]), lineHeight: 1.04, letterSpacing: -2 }, slide.title),
      slide.body ? h({ fontFamily: p.body, fontSize: 42, lineHeight: 1.35, color: soft }, slide.body) : null,
    ),
    h(
      { justifyContent: 'space-between', alignItems: 'center', width: '100%', fontFamily: p.body, fontSize: 32, fontWeight: 600, color: soft },
      h({}, brand.handle || ' '),
      total > 1 ? h({ alignItems: 'center', gap: 14, color: ink }, 'Swipe', h({ width: 64, height: 6, background: bold ? p.onAccent : p.accent, borderRadius: 6 })) : null,
    ),
  )
}

/** A slide in the middle: a number, a point, a sentence. */
export function contentSlide(brand: Brand, slide: Slide, index: number, total: number, size: { width: number; height: number } = POST_SIZE): El {
  const p = palette(brand)
  const tall = size.height > 1500
  const last = index === total - 1
  const bold = brand.style === 'bold' && last
  const bg = bold ? p.accent : p.bg
  const ink = bold ? p.onAccent : p.fg
  return h(
    { width: '100%', height: '100%', background: bg, color: ink, flexDirection: 'column', justifyContent: 'space-between', padding: tall ? '260px 90px 380px' : '90px' },
    h(
      { flexDirection: 'column', gap: 30, flexGrow: 1, justifyContent: 'center' },
      h({ fontFamily: p.display, fontWeight: p.displayWeight, fontSize: 132, lineHeight: 1, color: bold ? p.onAccent : p.accent, letterSpacing: -4 }, String(index + 1).padStart(2, '0')),
      h({ fontFamily: p.display, fontWeight: p.displayWeight, fontSize: fit(slide.title, [92, 80, 68, 58]), lineHeight: 1.08, letterSpacing: -1.5 }, slide.title),
      slide.body ? h({ fontFamily: p.body, fontSize: slide.body.length > 160 ? 36 : 42, lineHeight: 1.4, color: bold ? mix(p.onAccent, p.accent, 0.25) : p.muted }, slide.body) : null,
    ),
    footer(p, brand, index, total, bold ? p.onAccent : p.muted, bold ? mix(p.onAccent, p.accent, 0.6) : mix(p.fg, p.bg, 0.85)),
  )
}

/** All slides of a carousel, document or story, in order. */
export function slideSet(brand: Brand, slides: Slide[], size: { width: number; height: number } = POST_SIZE, tag = ''): El[] {
  return slides.map((s, i) => (i === 0 ? coverSlide(brand, s, slides.length, size, tag) : contentSlide(brand, s, i, slides.length, size)))
}

/** The cover of a reel or TikTok: the hook, big, in the safe middle of the screen. */
export function reelCover(brand: Brand, text: string): El {
  const p = palette(brand)
  const bold = brand.style === 'bold'
  const bg = bold ? p.accent : p.bg
  const ink = bold ? p.onAccent : p.fg
  return h(
    { width: '100%', height: '100%', background: bg, color: ink, flexDirection: 'column', justifyContent: 'center', padding: '300px 90px 420px', gap: 40 },
    h({ width: 140, height: 16, borderRadius: 16, background: bold ? p.onAccent : p.accent }),
    h({ fontFamily: p.display, fontWeight: p.displayWeight, fontSize: fit(text, [132, 112, 92, 78]), lineHeight: 1.04, letterSpacing: -2 }, text),
    brand.handle ? h({ fontFamily: p.body, fontSize: 36, fontWeight: 600, color: bold ? mix(p.onAccent, p.accent, 0.3) : p.muted }, brand.handle) : null,
  )
}

/** A text card for one beat of a video: on a transparent screen, in the safe middle, in the house style. */
export function reelCaption(brand: Brand, text: string): El {
  const p = palette(brand)
  const bold = brand.style === 'bold'
  return h(
    { width: '100%', height: '100%', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '0 70px 380px' },
    h(
      {
        background: bold ? p.accent : p.bg,
        color: bold ? p.onAccent : p.fg,
        borderRadius: 32,
        padding: '34px 46px',
        maxWidth: 940,
        fontFamily: p.display,
        fontWeight: p.displayWeight,
        fontSize: fit(text, [86, 74, 64, 56]),
        lineHeight: 1.12,
        letterSpacing: -1,
        textAlign: 'center',
        boxShadow: '0 18px 50px rgba(0,0,0,0.28)',
      },
      text,
    ),
  )
}

/** The screen behind a video without clips: the house style, with a quiet accent. */
export function reelBackground(brand: Brand): El {
  const p = palette(brand)
  const bold = brand.style === 'bold'
  return h(
    { width: '100%', height: '100%', background: bold ? p.accent : p.bg, position: 'relative' },
    h({ position: 'absolute', right: -260, top: 220, width: 760, height: 760, borderRadius: 760, background: bold ? mix(p.accent, p.onAccent, 0.12) : mix(p.bg, p.accent, 0.12) }),
    h({ position: 'absolute', left: -200, bottom: 160, width: 520, height: 520, borderRadius: 520, background: bold ? mix(p.accent, p.fg, 0.1) : mix(p.bg, p.accent, 0.07) }),
    brand.handle ? h({ position: 'absolute', left: 90, top: 200, fontFamily: p.body, fontSize: 36, fontWeight: 600, color: bold ? p.onAccent : p.muted }, brand.handle) : null,
  )
}
