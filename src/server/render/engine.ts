import 'server-only'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { initWasm, Resvg } from '@resvg/resvg-wasm'
import satori from 'satori'

// Draws slides without a browser: an element tree → SVG (satori) → PNG (resvg, as WebAssembly, so the
// same code runs on the Mac, on Windows and in the tests). Fonts come from assets/fonts.

export interface El {
  type: string
  props: { style?: Record<string, unknown>; children?: (El | string)[] | El | string; src?: string; width?: number; height?: number }
}

/** A box: <div style>{children}</div>, as satori takes it. Every box is a flex box. */
export function h(style: Record<string, unknown>, ...children: (El | string | null | false | undefined)[]): El {
  const kids = children.filter((c): c is El | string => Boolean(c))
  return { type: 'div', props: { style: { display: 'flex', ...style }, children: kids.length === 1 ? kids[0] : kids } }
}

const FONT_FILES = [
  { name: 'Space Grotesk', weight: 700, file: 'space-grotesk-latin-700-normal.woff' },
  { name: 'Inter', weight: 400, file: 'inter-latin-400-normal.woff' },
  { name: 'Inter', weight: 700, file: 'inter-latin-700-normal.woff' },
  { name: 'Inter', weight: 800, file: 'inter-latin-800-normal.woff' },
  { name: 'Instrument Sans', weight: 400, file: 'instrument-sans-latin-400-normal.woff' },
  { name: 'Instrument Sans', weight: 600, file: 'instrument-sans-latin-600-normal.woff' },
  { name: 'Fraunces', weight: 700, file: 'fraunces-latin-700-normal.woff' },
] as const

type Font = { name: string; data: Buffer; weight: 400 | 600 | 700 | 800; style: 'normal' }
let fonts: Font[] | null = null
let wasm: Promise<void> | null = null

/** The folder with the fonts: next to the server (the app), or in the project (development and tests). */
const fontDir = () => process.env.COCKPIT_FONTS_DIR ?? join(process.cwd(), 'assets', 'fonts')

function loadFonts(): Font[] {
  fonts ??= FONT_FILES.map((f) => ({ name: f.name, weight: f.weight, style: 'normal' as const, data: readFileSync(join(fontDir(), f.file)) }))
  return fonts
}

function ready(): Promise<void> {
  wasm ??= (async () => {
    const require = createRequire(join(process.cwd(), 'package.json'))
    await initWasm(readFileSync(require.resolve('@resvg/resvg-wasm/index_bg.wasm')))
  })()
  return wasm
}

/** One image, as PNG. */
export async function renderPng(element: El, width: number, height: number): Promise<Buffer> {
  await ready()
  const svg = await satori(element as unknown as Parameters<typeof satori>[0], { width, height, fonts: loadFonts() })
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng()
  return Buffer.from(png)
}
