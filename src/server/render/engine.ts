import 'server-only'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { initWasm, Resvg } from '@resvg/resvg-wasm'
import { encode as encodeJpeg } from 'jpeg-js'
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
// resvg is loaded once per process (it is an external package), but this module may be bundled more
// than once (routes, actions); keep its start on globalThis so it happens exactly once.
const shared = globalThis as unknown as { __cockpitResvg?: Promise<void> }

/** The folder with the fonts: next to the server (the app), or in the project (development and tests). */
const fontDir = () => process.env.COCKPIT_FONTS_DIR ?? join(process.cwd(), 'assets', 'fonts')

function loadFonts(): Font[] {
  fonts ??= FONT_FILES.map((f) => ({ name: f.name, weight: f.weight, style: 'normal' as const, data: readFileSync(join(fontDir(), f.file)) }))
  return fonts
}

function ready(): Promise<void> {
  shared.__cockpitResvg ??= (async () => {
    const require = createRequire(join(process.cwd(), 'package.json'))
    try {
      await initWasm(readFileSync(require.resolve('@resvg/resvg-wasm/index_bg.wasm')))
    } catch (error) {
      if (!(error instanceof Error && /already initialized/i.test(error.message))) throw error
    }
  })()
  return shared.__cockpitResvg
}

/** One image, as PNG and as raw pixels (for a JPEG). */
export async function renderRaster(element: El, width: number, height: number): Promise<{ png: Buffer; rgba: Uint8Array; width: number; height: number }> {
  await ready()
  const svg = await satori(element as unknown as Parameters<typeof satori>[0], { width, height, fonts: loadFonts() })
  const image = new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render()
  return { png: Buffer.from(image.asPng()), rgba: image.pixels, width: image.width, height: image.height }
}

/** One image, as PNG. */
export async function renderPng(element: El, width: number, height: number): Promise<Buffer> {
  return (await renderRaster(element, width, height)).png
}

/** Raw pixels as a JPEG (Instagram takes nothing else), on white where a pixel is see-through. */
export function jpegFrom(raster: { rgba: Uint8Array; width: number; height: number }, quality = 90): Buffer {
  const data = Buffer.from(raster.rgba)
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] === 255) continue
    const a = data[i] / 255
    for (let c = 1; c <= 3; c++) data[i - c] = Math.round(data[i - c] * a + 255 * (1 - a))
    data[i] = 255
  }
  return Buffer.from(encodeJpeg({ data, width: raster.width, height: raster.height }, quality).data)
}
