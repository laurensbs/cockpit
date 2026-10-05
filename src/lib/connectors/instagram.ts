// Instagram through Meta's official Graph API: followers of the account and its reach per day. Pure,
// so the parsing can be tested; src/server/connectors/instagram.ts does the requests. A token from
// "Instagram API with Instagram Login" starts with IG and talks to graph.instagram.com; one from
// Facebook Login (a Business account linked to a Page) talks to graph.facebook.com.

export const IG_VERSION = 'v21.0'

export const instagramBase = (token: string) => (token.trim().startsWith('IG') ? 'https://graph.instagram.com' : 'https://graph.facebook.com')

export interface IgProfile {
  followers_count?: number
  media_count?: number
}

export interface IgInsights {
  data?: { name?: string; values?: { value?: number | Record<string, number>; end_time?: string }[] }[]
}

/** Followers today, and reach per day (end_time is the end of the day it counts, in UTC). */
export function instagramPoints(profile: IgProfile, insights: IgInsights | null, today: string): { key: 'followers' | 'reach'; day: string; value: number }[] {
  const out: { key: 'followers' | 'reach'; day: string; value: number }[] = []
  if (typeof profile.followers_count === 'number') out.push({ key: 'followers', day: today, value: profile.followers_count })
  const reach = insights?.data?.find((d) => d.name === 'reach')
  for (const v of reach?.values ?? []) {
    if (typeof v.value !== 'number' || !v.end_time) continue
    // end_time 2026-10-05T07:00:00+0000 closes the day before.
    const end = new Date(v.end_time.replace(/\+0000$/, 'Z'))
    if (Number.isNaN(end.getTime())) continue
    const day = new Date(end.getTime() - 86_400_000).toISOString().slice(0, 10)
    if (day <= today) out.push({ key: 'reach', day, value: v.value })
  }
  return out
}
