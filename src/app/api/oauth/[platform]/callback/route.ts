import { getDb } from '@/db'
import { linkedinCallback, tiktokCallback } from '@/server/publish/oauth'

export const dynamic = 'force-dynamic'

const page = (ok: boolean, message: string) =>
  new Response(
    `<!doctype html><html lang="nl"><head><meta charset="utf-8"><title>Cockpit</title></head><body style="font:16px/1.5 system-ui,sans-serif;padding:3rem 1.5rem;max-width:32rem;margin:auto;color:#1a1c33;background:#f3f4fa"><h1 style="font-size:1.4rem">${ok ? 'Gekoppeld' : 'Dat lukte niet'}</h1><p>${message.replace(/[<>&]/g, '')}</p><p>Je kunt dit tabblad sluiten en teruggaan naar de Cockpit.</p></body></html>`,
    { status: ok ? 200 : 400, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
  )

/**
 * LinkedIn or TikTok sends him back here, in his own browser, with a code. The state ties it to the
 * button he pressed in the cockpit; without a valid state nothing is stored.
 */
export async function GET(request: Request, { params }: { params: Promise<{ platform: string }> }) {
  const { platform } = await params
  const url = new URL(request.url)
  if (url.searchParams.get('error')) return page(false, 'Je gaf geen toestemming, of de app is nog niet goed ingesteld.')
  const db = await getDb()
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (platform === 'linkedin') {
    const r = await linkedinCallback(db, code, state)
    return page(r.ok, r.message)
  }
  if (platform === 'tiktok') {
    const r = await tiktokCallback(db, code, state)
    return page(r.ok, r.message)
  }
  return page(false, 'Onbekend platform.')
}
