import 'server-only'
import { fixtureFetch } from '../connectors/fixtures'
import { fixturesAllowed } from '../status'

/** A refusal or failure of a platform; `retryable` when trying again later may work. Never the platform's own text. */
export class PublishError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message)
  }
}

export const publishFetch = (): typeof fetch => (fixturesAllowed() && process.env.COCKPIT_FAKE_CONNECTORS === '1' ? fixtureFetch : fetch)

/** What a failed answer means for him, by status. */
export function failure(platform: string, status: number): PublishError {
  if (status === 401) return new PublishError(`${platform} kent de koppeling niet meer: koppel opnieuw in Instellingen → Kanalen.`, false)
  if (status === 403) return new PublishError(`${platform} staat dit niet toe met deze koppeling (rechten of review van je app).`, false)
  if (status === 429) return new PublishError(`${platform} wil even rust (te veel verzoeken); de cockpit probeert het later opnieuw.`, true)
  if (status === 0 || status >= 500) return new PublishError(`${platform} gaf geen antwoord; de cockpit probeert het later opnieuw.`, true)
  return new PublishError(`${platform} weigerde de post (${status}).`, false)
}

/** A request with a timeout; a non-2xx answer becomes a PublishError. */
export async function call(platform: string, url: string, init: RequestInit = {}, timeoutMs = 60_000): Promise<Response> {
  let res: Response
  try {
    res = await publishFetch()(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(timeoutMs) })
  } catch {
    throw failure(platform, 0)
  }
  if (!res.ok) throw failure(platform, res.status)
  return res
}

export async function callJson<T>(platform: string, url: string, init: RequestInit = {}): Promise<T> {
  return (await (await call(platform, url, init)).json()) as T
}
