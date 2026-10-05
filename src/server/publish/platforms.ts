import 'server-only'
import { readFileSync } from 'node:fs'
import { and, asc, eq } from 'drizzle-orm'
import type { Db } from '@/db'
import * as s from '@/db/schema'
import type { WeekBody } from '@/lib/content-week'
import { littleText } from '@/lib/publish'
import { mediaPath } from '../media'
import { accounts, type TiktokAccount } from './accounts'
import { putTemporary, removeTemporary } from './blob'
import { call, callJson, PublishError } from './http'

// Publishing one approved post on his own account: LinkedIn (his profile), Instagram (the project's
// professional account) and TikTok (the project's account, into his drafts). Each returns where the
// post landed; a failure is a PublishError that says whether trying later may help.

export interface Published {
  remoteId: string
  permalink: string | null
  note?: string
}

export interface PublishInput {
  db: Db
  ownerId: string
  item: typeof s.contentItem.$inferSelect
  body: WeekBody
}

/** A LinkedIn-Version that is live (LinkedIn supports each for about a year); move it on with the app. */
const LINKEDIN_VERSION = '202608'
/** The Instagram Graph API version (each lives about two years). */
export const IG = 'https://graph.instagram.com/v23.0'
export const TIKTOK = 'https://open.tiktokapis.com'

interface MediaFile {
  role: string
  position: number
  data: () => Buffer
  bytes: number
  mime: string
}

async function mediaOf(db: Db, ownerId: string, itemId: string): Promise<MediaFile[]> {
  const rows = await db
    .select({ role: s.mediaAsset.role, position: s.mediaAsset.position, file: s.mediaAsset.file, bytes: s.mediaAsset.bytes, mime: s.mediaAsset.mime })
    .from(s.mediaAsset)
    .where(and(eq(s.mediaAsset.ownerId, ownerId), eq(s.mediaAsset.contentItemId, itemId)))
    .orderBy(asc(s.mediaAsset.position))
  return rows
    .map((r) => ({ ...r, path: mediaPath(r.file) }))
    .filter((r): r is typeof r & { path: string } => Boolean(r.path))
    .map((r) => ({ role: r.role, position: r.position, bytes: r.bytes, mime: r.mime, data: () => readFileSync(r.path) }))
}

const videoOf = (media: MediaFile[]) => media.find((m) => m.role === 'final') ?? media.find((m) => m.role === 'video') ?? null
const noVideo = () => new PublishError('Er is nog geen video: maak hem in CapCut (en exporteer final.mp4), of laat de cockpit hem maken.', false)
const caption = (body: WeekBody) => [body.caption, body.hashtags.join(' ')].filter(Boolean).join('\n\n')

// ---------- LinkedIn ----------

export async function publishLinkedin({ db, ownerId, item, body }: PublishInput): Promise<Published> {
  const account = await accounts.linkedin(db, ownerId)
  if (!account) throw new PublishError('LinkedIn is niet gekoppeld (Instellingen → Kanalen).', false)
  if (Date.parse(account.expiresAt) <= Date.now()) throw new PublishError('De LinkedIn-koppeling is verlopen: koppel opnieuw in Instellingen → Kanalen.', false)
  const author = `urn:li:person:${account.sub}`
  const headers = { Authorization: `Bearer ${account.token}`, 'LinkedIn-Version': LINKEDIN_VERSION, 'X-Restli-Protocol-Version': '2.0.0', 'Content-Type': 'application/json' }
  const media = await mediaOf(db, ownerId, item.id)

  const uploadSingle = async (kind: 'images' | 'documents', file: MediaFile) => {
    const init = await callJson<{ value: { uploadUrl: string; image?: string; document?: string } }>('LinkedIn', `https://api.linkedin.com/rest/${kind}?action=initializeUpload`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ initializeUploadRequest: { owner: author } }),
    })
    await call('LinkedIn', init.value.uploadUrl, { method: 'PUT', headers: { Authorization: `Bearer ${account.token}`, 'Content-Type': file.mime }, body: new Uint8Array(file.data()) })
    return (kind === 'images' ? init.value.image : init.value.document) ?? ''
  }

  let content: Record<string, unknown> | undefined
  const format = body.contentFormat
  if (format === 'image') {
    const slide = media.find((m) => m.role === 'slide')
    if (!slide) throw new PublishError('De afbeelding ontbreekt; teken hem opnieuw.', false)
    content = { media: { id: await uploadSingle('images', slide), altText: body.slides[0]?.title ?? item.title } }
  } else if (format === 'document') {
    const pdf = media.find((m) => m.role === 'pdf')
    if (!pdf) throw new PublishError('De PDF ontbreekt; teken hem opnieuw.', false)
    content = { media: { id: await uploadSingle('documents', pdf), title: item.title.slice(0, 100) } }
  } else if (format === 'reel') {
    const video = videoOf(media)
    if (!video) throw noVideo()
    const data = video.data()
    const init = await callJson<{ value: { video: string; uploadToken?: string; uploadInstructions: { uploadUrl: string; firstByte: number; lastByte: number }[] } }>(
      'LinkedIn',
      'https://api.linkedin.com/rest/videos?action=initializeUpload',
      { method: 'POST', headers, body: JSON.stringify({ initializeUploadRequest: { owner: author, fileSizeBytes: data.length, uploadCaptions: false, uploadThumbnail: false } }) },
    )
    const etags: string[] = []
    for (const part of init.value.uploadInstructions) {
      const res = await call('LinkedIn', part.uploadUrl, { method: 'PUT', headers: { Authorization: `Bearer ${account.token}`, 'Content-Type': 'application/octet-stream' }, body: new Uint8Array(data.subarray(part.firstByte, part.lastByte + 1)) })
      etags.push(res.headers.get('etag') ?? '')
    }
    await call('LinkedIn', 'https://api.linkedin.com/rest/videos?action=finalizeUpload', {
      method: 'POST',
      headers,
      body: JSON.stringify({ finalizeUploadRequest: { video: init.value.video, uploadToken: init.value.uploadToken ?? '', uploadedPartIds: etags } }),
    })
    content = { media: { id: init.value.video, title: item.title.slice(0, 100) } }
  }

  const res = await call('LinkedIn', 'https://api.linkedin.com/rest/posts', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      author,
      commentary: littleText(caption(body)),
      visibility: 'PUBLIC',
      distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
      ...(content ? { content } : {}),
    }),
  })
  const urn = res.headers.get('x-restli-id') ?? ''
  return { remoteId: urn, permalink: urn ? `https://www.linkedin.com/feed/update/${urn}/` : null }
}

// ---------- Instagram ----------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function publishInstagram({ db, ownerId, item, body }: PublishInput): Promise<Published> {
  if (!item.projectId) throw new PublishError('Dit item hoort bij geen project.', false)
  const account = await accounts.instagram(db, ownerId, item.projectId)
  const blobToken = await accounts.blobToken(db, ownerId)
  if (!account) throw new PublishError('Instagram is niet gekoppeld voor dit project (Instellingen → Kanalen).', false)
  if (!blobToken) throw new PublishError('Instagram haalt bestanden van een openbaar adres: zet je Vercel Blob-token in Instellingen → Kanalen.', false)
  const media = await mediaOf(db, ownerId, item.id)
  const uploaded: string[] = []
  const host = async (file: MediaFile, name: string) => {
    const url = await putTemporary(blobToken, name, file.data(), file.mime)
    uploaded.push(url)
    return url
  }
  const post = (path: string, params: Record<string, string>) =>
    callJson<{ id: string }>('Instagram', `${IG}/${path}`, { method: 'POST', body: new URLSearchParams({ ...params, access_token: account.token }) })
  const ready = async (id: string, video: boolean) => {
    const until = Date.now() + (video ? 10 : 2) * 60_000
    for (;;) {
      const r = await callJson<{ status_code?: string }>('Instagram', `${IG}/${id}?${new URLSearchParams({ fields: 'status_code', access_token: account.token })}`)
      if (r.status_code === 'FINISHED' || !r.status_code) return
      if (r.status_code === 'ERROR' || r.status_code === 'EXPIRED') throw new PublishError('Instagram kon het bestand niet verwerken.', false)
      if (Date.now() > until) throw new PublishError('Instagram was nog niet klaar met verwerken; de cockpit probeert het later opnieuw.', true)
      await sleep(video ? 5000 : 2000)
    }
  }
  try {
    const text = caption(body)
    const format = body.contentFormat
    const jpegs = media.filter((m) => m.role === 'jpeg')
    let container: string
    if (format === 'reel') {
      const video = videoOf(media)
      if (!video) throw noVideo()
      container = (await post(`${account.userId}/media`, { media_type: 'REELS', video_url: await host(video, `${item.id}.mp4`), caption: text, share_to_feed: 'true' })).id
      await ready(container, true)
    } else if (format === 'story') {
      if (!jpegs.length) throw new PublishError('De story-afbeelding ontbreekt; teken hem opnieuw.', false)
      container = (await post(`${account.userId}/media`, { media_type: 'STORIES', image_url: await host(jpegs[0], `${item.id}-story.jpg`) })).id
      await ready(container, false)
    } else if (format === 'carousel' && jpegs.length > 1) {
      const children: string[] = []
      for (const [i, jpeg] of jpegs.slice(0, 10).entries()) {
        const child = (await post(`${account.userId}/media`, { image_url: await host(jpeg, `${item.id}-${i + 1}.jpg`), is_carousel_item: 'true' })).id
        await ready(child, false)
        children.push(child)
      }
      container = (await post(`${account.userId}/media`, { media_type: 'CAROUSEL', children: children.join(','), caption: text })).id
      await ready(container, false)
    } else {
      if (!jpegs.length) throw new PublishError('De afbeelding ontbreekt; teken hem opnieuw.', false)
      container = (await post(`${account.userId}/media`, { image_url: await host(jpegs[0], `${item.id}.jpg`), caption: text })).id
      await ready(container, false)
    }
    const published = await post(`${account.userId}/media_publish`, { creation_id: container })
    const link = await callJson<{ permalink?: string }>('Instagram', `${IG}/${published.id}?${new URLSearchParams({ fields: 'permalink', access_token: account.token })}`).catch(() => ({ permalink: undefined }))
    return { remoteId: published.id, permalink: link.permalink ?? null }
  } finally {
    await removeTemporary(blobToken, uploaded)
  }
}

// ---------- TikTok ----------

/** A TikTok access token lasts a day; the refresh token a year. Renews when needed. */
export async function freshTiktok(db: Db, ownerId: string, projectId: string): Promise<TiktokAccount> {
  const account = await accounts.tiktok(db, ownerId, projectId)
  if (!account) throw new PublishError('TikTok is niet gekoppeld voor dit project (Instellingen → Kanalen).', false)
  if (Date.parse(account.expiresAt) - Date.now() > 5 * 60_000) return account
  if (Date.parse(account.refreshExpiresAt) <= Date.now()) throw new PublishError('De TikTok-koppeling is verlopen: koppel opnieuw in Instellingen → Kanalen.', false)
  const app = await accounts.tiktokApp(db, ownerId)
  if (!app) throw new PublishError('De TikTok-app ontbreekt in Instellingen → Kanalen.', false)
  const r = await callJson<{ access_token?: string; expires_in?: number; refresh_token?: string; refresh_expires_in?: number }>('TikTok', `${TIKTOK}/v2/oauth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_key: app.clientKey, client_secret: app.clientSecret, grant_type: 'refresh_token', refresh_token: account.refreshToken }),
  })
  if (!r.access_token) throw new PublishError('TikTok gaf geen nieuwe toegang: koppel opnieuw in Instellingen → Kanalen.', false)
  const next: TiktokAccount = {
    ...account,
    accessToken: r.access_token,
    refreshToken: r.refresh_token ?? account.refreshToken,
    expiresAt: new Date(Date.now() + (r.expires_in ?? 86_400) * 1000).toISOString(),
    refreshExpiresAt: r.refresh_expires_in ? new Date(Date.now() + r.refresh_expires_in * 1000).toISOString() : account.refreshExpiresAt,
  }
  await accounts.setTiktok(db, ownerId, projectId, next)
  return next
}

/** Into his TikTok drafts: he gets a notification and finishes it in the app (sound, text). */
export async function publishTiktok({ db, ownerId, item }: PublishInput): Promise<Published> {
  if (!item.projectId) throw new PublishError('Dit item hoort bij geen project.', false)
  const account = await freshTiktok(db, ownerId, item.projectId)
  const video = videoOf(await mediaOf(db, ownerId, item.id))
  if (!video) throw noVideo()
  const data = video.data()
  if (data.length > 64 * 1024 * 1024) throw new PublishError('De video is groter dan 64 MB; exporteer hem kleiner.', false)
  const headers = { Authorization: `Bearer ${account.accessToken}`, 'Content-Type': 'application/json; charset=UTF-8' }
  const init = await callJson<{ data?: { publish_id?: string; upload_url?: string } }>('TikTok', `${TIKTOK}/v2/post/publish/inbox/video/init/`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ source_info: { source: 'FILE_UPLOAD', video_size: data.length, chunk_size: data.length, total_chunk_count: 1 } }),
  })
  const publishId = init.data?.publish_id
  const uploadUrl = init.data?.upload_url
  if (!publishId || !uploadUrl) throw new PublishError('TikTok gaf geen uploadadres.', true)
  await call('TikTok', uploadUrl, { method: 'PUT', headers: { 'Content-Type': video.mime, 'Content-Range': `bytes 0-${data.length - 1}/${data.length}` }, body: new Uint8Array(data) }, 5 * 60_000)
  for (let i = 0; i < 20; i++) {
    const status = await callJson<{ data?: { status?: string; fail_reason?: string } }>('TikTok', `${TIKTOK}/v2/post/publish/status/fetch/`, { method: 'POST', headers, body: JSON.stringify({ publish_id: publishId }) })
    const st = status.data?.status
    if (st === 'SEND_TO_USER_INBOX' || st === 'PUBLISH_COMPLETE') return { remoteId: publishId, permalink: null, note: 'Staat in je TikTok-concepten: maak hem af in de app.' }
    if (st === 'FAILED') throw new PublishError('TikTok kon de video niet verwerken.', false)
    await sleep(3000)
  }
  return { remoteId: publishId, permalink: null, note: 'Verstuurd naar TikTok; hij verschijnt zo in je concepten.' }
}
