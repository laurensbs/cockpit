import 'server-only'
import { appPoints, checkAppUrl } from '@/lib/connectors/app'
import { ConnectorConfigError, ConnectorError } from './http'
import type { ConnectorKind, PulledPoint } from './types'

const MAX_BYTES = 256 * 1024

/** Reads at most MAX_BYTES of the answer; a bigger one is a mistake in the app, not something to wait for. */
async function readCapped(res: Response): Promise<string> {
  if (Number(res.headers.get('content-length')) > MAX_BYTES) throw new ConnectorConfigError('Het antwoord van de app is groter dan 256 KB.')
  if (!res.body) return ''
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_BYTES) {
      await reader.cancel()
      throw new ConnectorConfigError('Het antwoord van de app is groter dan 256 KB.')
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks).toString('utf8')
}

/**
 * His own app (Rondje and the like): a small stats address that answers with its numbers. The key is
 * optional; with one, it goes along as a Bearer token.
 */
export const app: ConnectorKind = {
  kind: 'app',
  label: 'Eigen app',
  source: 'app',
  delivers: ['users', 'active_users', 'signups'],
  fields: [{ name: 'url', label: 'Stats-adres', placeholder: 'https://jouwapp.nl/api/stats', hint: 'Antwoordt met { "metrics": { "users": 412, "signups": 9 } }; elk cijfer uit de lijst van de cockpit mag.', required: true }],
  secret: { label: 'Geheim (optioneel)', placeholder: '…', hint: 'Gaat mee als Authorization: Bearer …; zet hetzelfde geheim in de app.', optional: true },
  checkSecret: (key) => (key.length >= 12 ? null : 'Kies een geheim van minstens 12 tekens.'),
  checkConfig: (c) => checkAppUrl((c.url ?? '').trim()),
  window: { first: 120, again: 10 },
  async pull(ctx) {
    const url = (ctx.config.url ?? '').trim()
    const problem = checkAppUrl(url)
    if (problem) throw new ConnectorConfigError(problem)
    let res: Response
    try {
      res = await ctx.fetch(url, {
        headers: { Accept: 'application/json', ...(ctx.secret ? { Authorization: `Bearer ${ctx.secret}` } : {}) },
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
      })
    } catch {
      throw new ConnectorError(0)
    }
    if (!res.ok) throw new ConnectorError(res.status)
    let data: unknown
    try {
      data = JSON.parse(await readCapped(res))
    } catch (error) {
      if (error instanceof ConnectorConfigError) throw error
      throw new ConnectorConfigError('De app antwoordt niet met JSON.')
    }
    const read = appPoints(data, ctx.today)
    if ('error' in read) throw new ConnectorConfigError(read.error)
    const note = read.unknown.length ? `Niet herkend: ${read.unknown.slice(0, 8).join(', ')}${read.unknown.length > 8 ? ' …' : ''}.` : undefined
    return { points: read.points as PulledPoint[], note }
  },
}
