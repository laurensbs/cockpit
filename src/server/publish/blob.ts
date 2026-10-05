import 'server-only'
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { del, put } from '@vercel/blob'
import { fixturesAllowed } from '../status'
import { PublishError } from './http'

// Instagram fetches pictures and videos from a public address; the cockpit lives on his computer.
// So a file goes to his own Vercel Blob store for a moment, under a random name, and is removed as
// soon as Instagram has it. In tests the "store" is a file that lists what was put.

const fake = () => (fixturesAllowed() ? process.env.COCKPIT_FAKE_BLOB : undefined)

export async function putTemporary(token: string, name: string, data: Buffer, contentType: string): Promise<string> {
  const file = fake()
  if (file) {
    mkdirSync(dirname(file), { recursive: true })
    const url = `https://blob.fixture.test/cockpit/${crypto.randomUUID()}-${name}`
    appendFileSync(file, `${JSON.stringify({ put: url, bytes: data.length, contentType })}\n`)
    return url
  }
  try {
    const blob = await put(`cockpit/${name}`, data, { access: 'public', token, contentType, addRandomSuffix: true })
    return blob.url
  } catch {
    throw new PublishError('Vercel Blob nam het bestand niet aan: kijk je Blob-token na in Instellingen → Kanalen.', false)
  }
}

export async function removeTemporary(token: string, urls: string[]): Promise<void> {
  if (!urls.length) return
  const file = fake()
  if (file) {
    appendFileSync(file, `${JSON.stringify({ del: urls })}\n`)
    return
  }
  await del(urls, { token }).catch(() => undefined)
}
