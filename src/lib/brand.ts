// A project's house style for the images and videos the cockpit draws: three colours, a pair of
// typefaces, a style and the handle that goes on every slide. Pure, so the renderer and the form agree.

export const BRAND_FONTS = {
  grotesk: { label: 'Grotesk: strak en technisch', display: 'Space Grotesk', body: 'Instrument Sans' },
  sans: { label: 'Sans: rustig en zakelijk', display: 'Inter', body: 'Inter' },
  serif: { label: 'Serif: warm en redactioneel', display: 'Fraunces', body: 'Instrument Sans' },
} as const
export type BrandFont = keyof typeof BRAND_FONTS
export const BRAND_FONT_KEYS = Object.keys(BRAND_FONTS) as [BrandFont, ...BrandFont[]]

export const BRAND_STYLES = {
  clean: 'Rustig: veel ruimte, kleine accenten',
  bold: 'Opvallend: grote letters, vlakken in de accentkleur',
} as const
export type BrandStyle = keyof typeof BRAND_STYLES
export const BRAND_STYLE_KEYS = Object.keys(BRAND_STYLES) as [BrandStyle, ...BrandStyle[]]

export interface Brand {
  bg: string
  fg: string
  accent: string
  font: BrandFont
  style: BrandStyle
  /** Shown on every slide, e.g. "@webstability". Empty for none. */
  handle: string
}

const DEFAULT_ACCENT = '#8b7bff'

/** "#abc" → "#aabbcc"; anything that is not a colour → null. */
export function hexColor(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const v = value.trim().toLowerCase()
  if (/^#[0-9a-f]{6}$/.test(v)) return v
  if (/^#[0-9a-f]{3}$/.test(v)) return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`
  return null
}

export function defaultBrand(accent?: string | null): Brand {
  return { bg: '#faf8f4', fg: '#17161c', accent: hexColor(accent) ?? DEFAULT_ACCENT, font: 'grotesk', style: 'clean', handle: '' }
}

/** Whatever is stored or typed in, as a brand that always draws. */
export function normalizeBrand(input: unknown, accent?: string | null): Brand {
  const base = defaultBrand(accent)
  if (!input || typeof input !== 'object') return base
  const b = input as Record<string, unknown>
  const handle = typeof b.handle === 'string' ? b.handle.trim().replace(/^@+/, '').replace(/[^\p{L}\p{N}._-]/gu, '').slice(0, 30) : ''
  return {
    bg: hexColor(b.bg) ?? base.bg,
    fg: hexColor(b.fg) ?? base.fg,
    accent: hexColor(b.accent) ?? base.accent,
    font: typeof b.font === 'string' && b.font in BRAND_FONTS ? (b.font as BrandFont) : base.font,
    style: typeof b.style === 'string' && b.style in BRAND_STYLES ? (b.style as BrandStyle) : base.style,
    handle: handle ? `@${handle}` : '',
  }
}

function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

/** The WCAG contrast ratio of two colours (1 to 21). */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** Text that stays readable on a colour: near-black or white. */
export function inkOn(bg: string): string {
  return contrast(bg, '#ffffff') >= contrast(bg, '#17161c') ? '#ffffff' : '#17161c'
}

/** What would make the slides hard to read, in his words. */
export function brandIssues(b: Brand): string[] {
  const out: string[] = []
  if (contrast(b.bg, b.fg) < 4.5) out.push('Tekst en achtergrond verschillen te weinig; kies een lichtere of donkerdere tekstkleur.')
  if (contrast(b.bg, b.accent) < 1.6) out.push('De accentkleur valt weg tegen de achtergrond.')
  return out
}
