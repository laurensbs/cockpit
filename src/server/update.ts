import 'server-only'
import { DOWNLOADS_URL } from '@/lib/terminal'
import { isNewer } from '@/lib/version'

export interface Update {
  version: string
  notes: string
}

const EVERY_MS = 6 * 60 * 60_000
let cache: { at: number; latest: Update | null } | null = null

/** Only the packaged Mac app updates itself this way; it knows its own version. */
const canUpdate = () => process.env.COCKPIT_PACKAGED === '1' && process.platform === 'darwin' && Boolean(process.env.COCKPIT_VERSION) && process.env.COCKPIT_NO_UPDATE_CHECK !== '1'

async function fetchLatest(): Promise<Update | null> {
  try {
    const res = await fetch(`${DOWNLOADS_URL}/version.json`, { cache: 'no-store', signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null
    const data = (await res.json()) as { version?: unknown; notes?: unknown }
    return typeof data.version === 'string' && /^\d+\.\d+\.\d+$/.test(data.version) ? { version: data.version, notes: typeof data.notes === 'string' ? data.notes.slice(0, 400) : '' } : null
  } catch {
    return null
  }
}

/**
 * A newer version on GitHub, or null. Looks at most every six hours and never makes a page wait: the
 * first look runs in the background and the banner shows from the next page on.
 */
export async function availableUpdate(): Promise<Update | null> {
  if (!canUpdate()) return null
  if (!cache || Date.now() - cache.at > EVERY_MS) {
    const previous = cache?.latest ?? null
    cache = { at: Date.now(), latest: previous }
    void fetchLatest().then((latest) => {
      if (cache) cache.latest = latest ?? previous
    })
  }
  const latest = cache.latest
  return latest && isNewer(latest.version, process.env.COCKPIT_VERSION ?? '0.0.0') ? latest : null
}
