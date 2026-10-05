// The content factory's rules per channel: which formats it takes, how often, and what works there.
// LinkedIn gives value, Instagram does what works, TikTok grabs attention, forums help first. The
// playbooks go into Claude's brief word for word; the labels are for his screens. Pure.

import type { Stage } from '../options'

export const CONTENT_CHANNELS = ['linkedin', 'instagram', 'tiktok', 'forum'] as const
export type ContentChannel = (typeof CONTENT_CHANNELS)[number]
export const isContentChannel = (v: unknown): v is ContentChannel => typeof v === 'string' && (CONTENT_CHANNELS as readonly string[]).includes(v)

export const CONTENT_FORMATS = ['text', 'image', 'carousel', 'document', 'reel', 'story', 'answer'] as const
export type ContentFormat = (typeof CONTENT_FORMATS)[number]

export const CHANNEL_LABELS: Record<ContentChannel, string> = { linkedin: 'LinkedIn', instagram: 'Instagram', tiktok: 'TikTok', forum: 'Forums' }
export const FORMAT_LABELS: Record<ContentFormat, string> = {
  text: 'Tekstpost',
  image: 'Beeldpost',
  carousel: 'Carrousel',
  document: 'PDF-carrousel',
  reel: 'Video',
  story: 'Story',
  answer: 'Forumantwoord',
}

/** Which formats a channel takes. */
export const CHANNEL_FORMATS: Record<ContentChannel, readonly ContentFormat[]> = {
  linkedin: ['text', 'image', 'document', 'reel'],
  instagram: ['carousel', 'reel', 'image', 'story'],
  tiktok: ['reel', 'carousel'],
  forum: ['answer'],
}

/** Formats the cockpit draws as images (slides); reels get a cover and, later, a video. */
export const VISUAL_FORMATS: readonly ContentFormat[] = ['image', 'carousel', 'document', 'story', 'reel']

/** A good default time per channel (Amsterdam time), when Claude gives none. */
export const DEFAULT_TIME: Record<ContentChannel, string> = { linkedin: '08:15', instagram: '19:00', tiktok: '18:30', forum: '12:00' }

/** Limits per channel: caption length and number of hashtags. */
export const CHANNEL_LIMITS: Record<ContentChannel, { text: number; hashtags: number }> = {
  linkedin: { text: 3000, hashtags: 3 },
  instagram: { text: 2200, hashtags: 8 },
  tiktok: { text: 2200, hashtags: 5 },
  forum: { text: 4000, hashtags: 0 },
}

export type Rhythm = Record<ContentChannel, number>

/** Posts per channel per week by stage. LinkedIn is his own profile, so it stays modest per project. */
export function defaultRhythm(stage: Stage | string): Rhythm {
  if (stage === 'launch' || stage === 'growth') return { linkedin: 1, instagram: 3, tiktok: 3, forum: 2 }
  if (stage === 'maintain') return { linkedin: 1, instagram: 2, tiktok: 1, forum: 1 }
  if (stage === 'build') return { linkedin: 1, instagram: 1, tiktok: 1, forum: 1 }
  return { linkedin: 0, instagram: 0, tiktok: 0, forum: 0 }
}

export const RHYTHM_MAX = 7
/** LinkedIn is one personal profile for all projects: never more than this per week in total. */
export const LINKEDIN_WEEK_MAX = 5

/** A stored rhythm, or the default for the stage; every number within 0–7. */
export function normalizeRhythm(input: unknown, stage: Stage | string): Rhythm {
  const base = defaultRhythm(stage)
  if (!input || typeof input !== 'object') return base
  const r = input as Record<string, unknown>
  const out = { ...base }
  for (const c of CONTENT_CHANNELS) {
    const n = Number(r[c])
    if (Number.isFinite(n)) out[c] = Math.max(0, Math.min(RHYTHM_MAX, Math.round(n)))
  }
  return out
}

export const PLAYBOOKS: Record<ContentChannel, string> = {
  linkedin: [
    'LinkedIn — principle: give value. It is his personal profile, so he speaks as himself (first person), as the maker behind the project.',
    '- Formats: text posts (the default), a single image, a PDF document carousel (5–8 slides, one idea per slide) and now and then a short vertical video.',
    '- The first line is the hook and must stand alone (it is all people see before "…meer"): a concrete claim, a number, a mistake, a before/after. No "Excited to announce".',
    '- Then: short paragraphs, one thought per line, a concrete lesson, example or how-to the reader can use today. Teach, show the work, share what went wrong.',
    '- End with a real question or a soft pointer; never "comment YES", never engagement bait, never tagging people for reach.',
    '- No link in the post body (the reach drops); if a link matters, say "link in de eerste reactie" and put it in the text as the last line after "Link:".',
    '- 0–3 hashtags, at the end. Length 600–1300 characters works best.',
  ].join('\n'),
  instagram: [
    'Instagram — principle: do what works. Saves and shares count most, then watch time.',
    '- Reels (most reach): the hook in the first 1–2 seconds, as big text on screen and as the first line spoken; 7–20 seconds; one idea; on-screen text in every beat because most people watch muted; end with a reason to save or share ("bewaar dit voor…").',
    '- Carousels (most saves): slide 1 is a promise or a list title, slides 2–7 deliver, the last slide is a summary or call to action; few words per slide (max ~25), big type.',
    '- Single images and stories for news, behind the scenes, polls.',
    '- Caption: the first line repeats the hook, then 2–5 short lines of value, then a call to action. 3–8 specific hashtags (niche and local, not #love).',
    '- Shoot or show the real product, real people, the real place; native and personal beats polished ads.',
  ].join('\n'),
  tiktok: [
    'TikTok — principle: grab attention with what works there. Native, fast, personal.',
    '- Hook in the very first second: a bold statement, a question, a visible result, or "POV:". Pattern interrupt; no logo intro.',
    '- 9–30 seconds; a cut or new text every 1–2 seconds; text on screen for every beat.',
    '- Formats that work: "3 dingen die…", before/after, a mistake and the fix, a day in the life, reacting to a common myth, a quick tutorial.',
    '- TikTok is a search engine: put the words people search for in the on-screen text and the caption.',
    '- Caption short, 3–5 hashtags mixing broad and niche. He adds a trending sound himself in the app; never rely on copyrighted music.',
  ].join('\n'),
  forum: [
    'Forums and communities — principle: help first. 90% helping, 10% pointing to his project.',
    '- Use web search to find real, current places and threads where his audience asks questions the project answers: subreddits, Tweakers, Higherlevel.nl, Indie Hackers, Hacker News (Show HN only for a real launch), Product Hunt, Discord servers, Facebook and LinkedIn groups, niche forums (for a RuneScape private server: Rune-Server, RSPS toplists and their forums).',
    '- Only list a place you actually found, with its URL; prefer a specific open thread over a front page.',
    '- The answer helps on its own, in the language of the place, without the link if the rules forbid it; mention the project only where it truly answers the question, and always say it is his own ("Disclaimer: ik heb dit zelf gemaakt").',
    '- Respect each place\'s rules on self-promotion. Never the same text in two places. He posts it himself.',
  ].join('\n'),
}
