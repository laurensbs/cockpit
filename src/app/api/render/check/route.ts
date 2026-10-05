import { NextResponse } from 'next/server'
import { defaultBrand } from '@/lib/brand'
import { ffmpegPath } from '@/server/ffmpeg'
import { renderPng } from '@/server/render/engine'
import { reelCover } from '@/server/render/templates'
import { bearerOwner, getOwner } from '@/server/session'

export const dynamic = 'force-dynamic'

/** Can this installation draw (fonts, WebAssembly) and make videos (ffmpeg)? One small cover, nothing stored. */
export async function GET(request: Request) {
  const owner = bearerOwner(request) ?? (await getOwner())
  if (!owner) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const started = Date.now()
  try {
    const png = await renderPng(reelCover(defaultBrand(), 'Test'), 270, 480)
    return NextResponse.json({ ok: png.subarray(1, 4).toString() === 'PNG', ms: Date.now() - started, video: Boolean(ffmpegPath()) })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message.slice(0, 200) : 'failed' })
  }
}
