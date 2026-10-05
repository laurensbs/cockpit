// The craft of organic marketing in 2026, from his own research (~/Projecten/Cockpit/onderzoek/organisch-2026.md:
// Instagram's and Google's own guidance, checked October 2026), as rules Claude follows and a gate the cockpit
// enforces. Value first: a post must be worth saving or sending; an article must say what only he can say.
// The gate is deterministic, so a cliché or a repeat never reaches his day, whatever the model wrote.

/** What a post is for. Mostly teaching and behind the scenes; an offer at most once in five. */
export const POST_PILLARS = {
  teach: 'teaches one useful thing the audience can use today',
  behind: 'behind the scenes: what he built, shipped or learned this week, with one real detail (build in public)',
  proof: 'proof: a real result, a before and after, or a client situation (only when it is in the information; anonymised)',
  community: 'asks or answers: a real question from the audience, a poll, a reaction to something in their world',
  offer: 'a soft offer: what it is, for whom, one small next step',
} as const
export type PostPillar = keyof typeof POST_PILLARS
export const isPillar = (v: unknown): v is PostPillar => typeof v === 'string' && v in POST_PILLARS

/** The pillar in his words, for a chip on the post. */
export const PILLAR_LABEL: Record<PostPillar, string> = { teach: 'Leert iets', behind: 'Achter de schermen', proof: 'Bewijs', community: 'Gesprek', offer: 'Aanbod' }

export const CONTENT_CRAFT = `<craft>
What works organically in 2026 (Instagram's and Google's own guidance, and what held up in his research). Follow it:
- Value first. Every piece must pass one test: would someone in this audience save it, or send it to a friend? On Instagram sends and saves weigh most; likes weigh little. A piece that only announces or sells fails.
- Non-interchangeable. Each piece holds at least one thing only he can say: a real detail from <recent_work> (what he built or shipped), <numbers>, <lessons>, his own product on screen, his place and market. Generic tips any account could post ("5 tips voor meer klanten") are out. Name that detail in proof.
- One idea per piece. Concrete beats clever: the names of things, the steps, a number from the information, a screenshot.
- Own work only: accounts that mostly repost others are no longer recommended.
- The hook (first line, or the first two seconds) says what the viewer gets or shows the surprising concrete thing. Under 120 characters. No question-bait, no clickbait, no hype.
- One call to action that fits: save it, send it to someone who…, comment one word, reply by DM, or visit. "Link in bio" only for an offer.
- Hashtags: 3–5 specific ones (the topic plus the market or place). Never generic ones (#marketing, #business, #ondernemer, #motivation, #fyp…).
- Over a week: mostly teach and behind the scenes, one community piece, at most one soft offer in five.
- His voice: plain, warm, first person, as he talks. No corporate tone, no hype ("game changer", "naar een hoger niveau", "revolucionario"), no fake urgency ("laatste kans", "nog maar 3 plekken").
- Before you save, score every piece 1–5 on value, specificity and originality, and rewrite each one that scores under 4 on any of them. The cockpit refuses clichés, hype, generic hashtags, long hooks and repeats of earlier posts, and says why.
</craft>`

export const SEO_CRAFT = `<seo_craft>
What works in search in 2026 (Google's own guidance from July 2026, and what held up in his research). Follow it:
- SEO is still SEO: AI Overviews and AI Mode run on Google's normal ranking. "Optimising for AI" means being the best answer to a real question, from first-hand experience. Ignore llms.txt and "chunking for AI": Google says they do nothing.
- Non-interchangeable content wins: his own examples and screenshots, his prices or price ranges, steps from his own work, the questions his customers really ask. Never filler any site could have.
- One strong page per real audience or service. Never a page per town or per keyword variant: that is doorway or scaled-content spam and it sinks whole sites. A town page only when there is something truly local to say.
- Intent first: per topic, say what the searcher wants (learn, compare, act) and match the page to it. A page that should bring customers shows prices and one clear next step.
- Local: the Google Business Profile carries the map and AI answers: his real name, every category that fits, a service area or a real address, photos, reviews from all customers, steadily over time. The same name, address and phone everywhere, also in Bing Places.
- Basics that matter: a title and meta description per page, one H1, internal links within a cluster, the sitemap in Search Console and Bing Webmaster Tools, and robots.txt or a firewall that does not block Googlebot, Bingbot or OAI-SearchBot.
- AI answers take clicks: measure requests and leads, not only visitors, and check every month whether he is named for the 15–25 questions customers really ask (in Google, ChatGPT and Perplexity).
</seo_craft>`

// Hype, filler and fake urgency in his three languages: words that make a post sound like everyone else's.
const CLICHES = [
  // English
  "in today's fast-paced",
  'game changer',
  'game-changer',
  'unlock the power',
  'unleash',
  'next level',
  'revolutionize',
  'revolutionise',
  'elevate your',
  'cutting-edge',
  'in the digital age',
  'look no further',
  "let's dive in",
  'dive into',
  'embark on',
  'harness the power',
  'skyrocket',
  'supercharge',
  'ever-evolving',
  "it's no secret",
  'world-class',
  'act now',
  'only a few spots left',
  // Dutch
  'in deze snelle wereld',
  'in de huidige snelle',
  'naar een hoger niveau',
  'naar het volgende niveau',
  'ontdek de kracht',
  'ontketen',
  'revolutionair',
  'baanbrekend',
  'in het digitale tijdperk',
  'zoek niet verder',
  'laten we erin duiken',
  'duik in de wereld',
  'mis het niet',
  'laatste kans',
  'nu of nooit',
  'nog maar een paar plekken',
  // Spanish
  'en el mundo actual',
  'siguiente nivel',
  'revolucionario',
  'revolucionaria',
  'sin precedentes',
  'descubre el poder',
  'no busques más',
  'sumérgete',
  'de vanguardia',
  'en la era digital',
  'última oportunidad',
  'últimas plazas',
]

/** Hashtags that sort a post nowhere: dropped, never a reason to refuse. */
const GENERIC_TAGS = new Set(
  [
    'marketing',
    'business',
    'entrepreneur',
    'entrepreneurship',
    'success',
    'motivation',
    'inspiration',
    'instagood',
    'love',
    'follow',
    'followme',
    'like4like',
    'followforfollow',
    'photooftheday',
    'instadaily',
    'viral',
    'fyp',
    'foryou',
    'foryoupage',
    'explore',
    'explorepage',
    'trending',
    'socialmedia',
    'ondernemer',
    'ondernemen',
    'succes',
    'inspiratie',
    'emprendedor',
    'emprendimiento',
    'exito',
    'éxito',
    'motivacion',
    'motivación',
  ].map((t) => t.toLowerCase()),
)

const lower = (text: string) => text.toLowerCase().replace(/[’‘]/g, "'")

/** The clichés in a text, as they appear in the list. */
export function clichesIn(text: string): string[] {
  const t = lower(text)
  return CLICHES.filter((c) => t.includes(c))
}

/** The hashtags worth keeping: specific ones, without the generic reach-bait. */
export function specificTags(tags: readonly string[]): { kept: string[]; dropped: string[] } {
  const kept: string[] = []
  const dropped: string[] = []
  for (const tag of tags) (GENERIC_TAGS.has(tag.replace(/^#/, '').toLowerCase()) ? dropped : kept).push(tag)
  return { kept, dropped }
}

const EMOJI = /\p{Extended_Pictographic}/gu
const words = (text: string) => lower(text).replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean)

/** How alike two short texts are (shared words over all words), 0–1. */
export function overlap(a: string, b: string): number {
  const wa = new Set(words(a))
  const wb = new Set(words(b))
  if (!wa.size || !wb.size) return 0
  let shared = 0
  for (const w of wa) if (wb.has(w)) shared++
  return shared / new Set([...wa, ...wb]).size
}

export interface PostCheck {
  hook: string
  caption: string
  title: string
}

/**
 * Why a post may not go into his day, in plain words for Claude to fix; empty when it is fine. Hooks that
 * are (nearly) the same as an earlier post's count as a repeat.
 */
export function postProblems(post: PostCheck, earlierHooks: readonly string[] = []): string[] {
  const problems: string[] = []
  const found = clichesIn(`${post.hook}\n${post.caption}`)
  if (found.length) problems.push(`hype or clichés (${found.map((c) => `"${c}"`).join(', ')}): say the concrete thing instead`)
  if (post.hook.length > 150) problems.push(`the hook is ${post.hook.length} characters: keep it under 120`)
  if (!post.hook.trim()) problems.push('no hook')
  if (post.caption.trim().length < 40) problems.push('the caption is too thin to give anything of value')
  const emoji = (post.caption.match(EMOJI) ?? []).length
  if (emoji > 8) problems.push(`${emoji} emoji in the caption: at most a few, where they help`)
  const shouting = post.caption.split(/\s+/).filter((w) => w.length >= 4 && /^\p{Lu}+$/u.test(w)).length
  if (shouting > 3) problems.push('too many words in capitals')
  const repeat = earlierHooks.find((h) => overlap(h, post.hook) >= 0.7)
  if (repeat) problems.push(`repeats an earlier post ("${repeat.slice(0, 60)}"): find a new angle`)
  return problems
}

export interface ArticleCheck {
  title: string
  metaDescription: string
  markdown: string
}

/** Why an article is not good enough yet; only the written-out one is checked on its body. */
export function articleProblems(article: ArticleCheck): string[] {
  const problems: string[] = []
  const found = clichesIn(`${article.title}\n${article.markdown}`)
  if (found.length) problems.push(`hype or clichés (${found.map((c) => `"${c}"`).join(', ')})`)
  if (article.metaDescription.length > 160) problems.push('meta description over 160 characters')
  if (article.markdown) {
    const count = words(article.markdown).length
    if (count < 600) problems.push(`only ${count} words: write 800–1200 that really answer the question`)
    const h2 = (article.markdown.match(/^## /gm) ?? []).length
    if (h2 < 3) problems.push('fewer than three H2 sections')
  }
  return problems
}
