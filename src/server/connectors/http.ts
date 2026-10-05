import 'server-only'
import type { Fetch } from './types'

/** A failed request, by status; the message never contains the provider's answer (it may echo a key). */
export class ConnectorError extends Error {
  constructor(
    readonly status: number,
    readonly retryAfter: number | null = null,
  ) {
    super(`status ${status}`)
  }
}

/** A problem with what he filled in; its message is meant for him. */
export class ConnectorConfigError extends Error {}

export function connectorErrorText(error: unknown): string {
  if (error instanceof ConnectorConfigError) return error.message
  if (error instanceof ConnectorError) {
    if (error.status === 401 || error.status === 403) return 'De sleutel klopt niet of mag dit niet lezen.'
    if (error.status === 404) return 'Niet gevonden: kijk de instellingen na (site, profiel of property).'
    if (error.status === 429) return 'Te veel verzoeken; de cockpit probeert het later opnieuw.'
    if (error.status === 0) return 'Geen verbinding met de dienst.'
    if (error.status >= 500) return 'De dienst gaf een fout; later opnieuw.'
    return `De dienst weigerde het verzoek (${error.status}).`
  }
  return 'Ophalen lukte niet.'
}

/** A JSON request with a timeout; a non-2xx answer becomes a ConnectorError. */
export async function getJson<T>(fetchFn: Fetch, url: string, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetchFn(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(15_000) })
  } catch {
    throw new ConnectorError(0)
  }
  if (!res.ok) {
    const retry = Number(res.headers.get('retry-after'))
    throw new ConnectorError(res.status, Number.isFinite(retry) && retry > 0 ? retry : null)
  }
  return (await res.json()) as T
}
