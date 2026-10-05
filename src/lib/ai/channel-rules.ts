// What works per channel in 2026, from research of October 2026 (official sources, studies and what
// practitioners on Reddit report). Claude gets the rules that fit the task as <channel_rules>; "solid"
// rules come from official or independent data, "anecdotal" ones from practitioners and are weighed.

export const CHANNELS = ['instagram', 'tiktok', 'linkedin', 'seo', 'reddit', 'forums', 'email', 'appstore'] as const
export type Channel = (typeof CHANNELS)[number]

export interface ChannelRule {
  channel: Channel
  rule: string
  solid: boolean
  /** Where it comes from, for him to check; not sent to Claude. */
  source: string
}

export const RESEARCHED = '2026-10'

export const CHANNEL_RULES: ChannelRule[] = [
  { channel: 'instagram', rule: 'Design every post around a reason to send it to a friend by DM, because sends per reach is the strongest signal for reaching non-followers.', solid: true, source: 'https://www.dataslayer.ai/blog/instagram-algorithm-2025-complete-guide-for-marketers' },
  { channel: 'instagram', rule: 'Post only content you made or materially edited; accounts that mostly repost others\' photos, videos or carousels are removed from all recommendations since April 30, 2026.', solid: true, source: 'https://techcrunch.com/2026/04/30/instagram-restricts-reach-of-content-aggregators-in-new-crackdown/' },
  { channel: 'instagram', rule: 'Put the payoff of a Reel in the first seconds and judge Reels on average watch time, not raw views.', solid: true, source: 'https://www.dataslayer.ai/blog/instagram-algorithm-2025-complete-guide-for-marketers' },
  { channel: 'instagram', rule: 'Use at most five specific hashtags per post; they help Instagram classify content but do not add reach.', solid: true, source: 'https://later.com/blog/ultimate-guide-to-using-instagram-hashtags/' },
  { channel: 'instagram', rule: 'Test new hooks and formats as Trial Reels shown to non-followers first, and only share winners with followers.', solid: true, source: 'https://about.fb.com/news/2024/12/trial-reels-try-content-non-followers-first-see-what-perfoms-best/' },
  { channel: 'instagram', rule: 'Make slide 2 of every carousel a second hook, because Instagram often re-shows an unswiped carousel starting at slide 2.', solid: true, source: 'https://www.threads.com/@mattnavarra/post/DBgmZcEoiZb' },
  { channel: 'instagram', rule: 'Write captions in the plain words customers search for, since public professional posts appear in Google and can be tracked in Search Console platform properties.', solid: true, source: 'https://developers.google.com/search/blog/2026/07/search-console-social-video-platforms' },
  { channel: 'instagram', rule: 'Prefer raw, real footage of real people, places and work over polished stock images or undisclosed AI visuals.', solid: true, source: 'https://musically.com/2026/01/05/instagram-boss-authenticity-is-becoming-infinitely-reproducible/' },
  { channel: 'instagram', rule: 'Post fewer, better Reels and spend the saved time studying top hooks in the niche and replying to comments.', solid: false, source: 'https://www.reddit.com/r/socialmedia/comments/1sa6wjf/unpopular_opinion_posting_more_on_instagram_wont/' },
  { channel: 'instagram', rule: 'Entertain or teach around the product instead of advertising it; posts that only pitch the product reach fewer people.', solid: false, source: 'https://www.reddit.com/r/InstagramMarketing/comments/1w3srre/authentic_ways_ive_grown_my_instagram_account/' },
  { channel: 'tiktok', rule: 'Post short native clips with the best moment first; TikTok says follower count and past hits are not direct factors, so every video gets a fresh test.', solid: true, source: 'https://newsroom.tiktok.com/en-us/how-tiktok-recommends-videos-for-you' },
  { channel: 'linkedin', rule: 'Post consistently about one professional topic and never use engagement pods or automated comments, which LinkedIn limits to the commenter\'s own connections.', solid: true, source: 'https://www.socialmediatoday.com/news/linkedin-limit-visibility-of-comments-made-via-automation-tools/758207/' },
  { channel: 'seo', rule: 'Write non-commodity pages from first-hand experience (real jobs, real customers, own photos, real numbers); Google calls this the biggest long-term factor for AI Overviews and AI Mode.', solid: true, source: 'https://developers.google.com/search/docs/fundamentals/ai-optimization-guide' },
  { channel: 'seo', rule: 'Complete and verify the Google Business Profile with the real business name, correct categories, hours, service area and photos; local ranking is relevance, distance and prominence and cannot be bought.', solid: true, source: 'https://support.google.com/business/answer/7091' },
  { channel: 'seo', rule: 'Never mass-generate pages per city or per query variation; Google treats this as scaled content or doorway abuse.', solid: true, source: 'https://developers.google.com/search/docs/essentials/spam-policies' },
  { channel: 'seo', rule: 'Ask every customer for a review in the same way, steadily over time; never offer incentives or ask only happy customers.', solid: true, source: 'https://support.google.com/contributionpolicy/answer/7400114' },
  { channel: 'seo', rule: 'Skip llms.txt, content \'chunking\', AI-only markup and bought mentions for Google; it ignores them.', solid: true, source: 'https://developers.google.com/search/docs/fundamentals/ai-optimization-guide' },
  { channel: 'seo', rule: 'Never add keywords, cities or slogans to the Business Profile name, and hide the address only if the business always works at customer locations.', solid: true, source: 'https://support.google.com/business/answer/3038177' },
  { channel: 'seo', rule: 'Measure AI visibility with the Generative AI performance report in Search Console and measure leads, because AI summaries cut clicks (8% vs 15%).', solid: true, source: 'https://www.pewresearch.org/short-reads/2025/07/22/google-users-are-less-likely-to-click-on-links-when-an-ai-summary-appears-in-the-results/' },
  { channel: 'seo', rule: 'Allow OAI-SearchBot in robots.txt and check that the CDN or firewall does not block AI crawlers, or ChatGPT search cannot cite the site.', solid: true, source: 'https://developers.openai.com/api/docs/bots' },
  { channel: 'seo', rule: 'Show prices or price ranges on service pages, since pages with prices get cited more for \'how much does X cost\' questions in AI answers.', solid: false, source: 'https://www.reddit.com/r/SEO/comments/1rm2mpb/experiment_llm_live_search_is_very_different_from/' },
  { channel: 'seo', rule: 'Register the site in Bing Webmaster Tools too, because ChatGPT, Perplexity and Copilot draw on Bing\'s index.', solid: false, source: 'https://www.reddit.com/r/SEO/comments/1rstoyw/geo_for_hospitality_why_bing_now_matters/' },
  { channel: 'reddit', rule: 'Read and follow each subreddit\'s own self-promotion rules before posting; there is no official sitewide 90/10 ratio, the sub\'s rules decide.', solid: true, source: 'https://redditinc.com/policies/content-policy' },
  { channel: 'reddit', rule: 'Never coordinate upvotes, ask friends to vote, or use extra accounts to vote or dodge bans; that is content manipulation under Reddit\'s content policy.', solid: true, source: 'https://redditinc.com/policies/content-policy' },
  { channel: 'reddit', rule: 'Help first: answer questions you truly know, and mention your own product in roughly one in ten comments, only when it fits and with \'I built this\'.', solid: false, source: 'https://www.reddit.com/r/Entrepreneur/comments/1qffxda/how_im_getting_my_first_customers_no_ads_no/' },
  { channel: 'reddit', rule: 'Share a true story with real, checkable numbers and a lesson, keep it unpolished, and reply to every comment including critics.', solid: false, source: 'https://www.reddit.com/r/SaaS/comments/1vyvxo8/one_reddit_post_yesterday_415k_views_1100_users/' },
  { channel: 'reddit', rule: 'Do not post AI-sounding text or drive-by launch posts; many subs now require karma, templates or remove AI-written content.', solid: false, source: 'https://www.reddit.com/r/iOSProgramming/comments/1pnivdy/proposed_update_to_app_saturday_feedback_requested/' },
  { channel: 'forums', rule: 'In Facebook groups and local forums, follow the admin\'s rules, answer questions in your field, and share the product only when someone asks or the group allows it.', solid: false, source: 'https://www.reddit.com/r/Entrepreneur/comments/1qffxda/how_im_getting_my_first_customers_no_ads_no/' },
  { channel: 'email', rule: 'Never send unsolicited commercial email to Spanish businesses or people without prior consent or an existing customer relationship; LSSI art. 21 makes no B2B exception and mass sending is a serious infraction (EUR 30,001-150,000).', solid: true, source: 'https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758' },
  { channel: 'email', rule: 'In the Netherlands, email a business without consent only if it published that address specifically to receive commercial offers, or if it is an existing customer buying similar products; a generic info@ on a contact page does not count.', solid: true, source: 'https://wetten.overheid.nl/BWBR0009950/' },
  { channel: 'email', rule: 'Do not send 100 cold emails at once from a normal mailbox; prospect by phone first and send one personal follow-up email only after the person agrees to receive it.', solid: true, source: 'https://support.google.com/a/answer/81126' },
  { channel: 'email', rule: 'Only mail people who signed up or asked for it, and raise sending volume slowly on any new domain or mailbox.', solid: true, source: 'https://support.google.com/a/answer/81126' },
  { channel: 'email', rule: 'Authenticate every sending domain with SPF, DKIM and a DMARC record (at least p=none) before sending any marketing or bulk mail.', solid: true, source: 'https://senders.yahooinc.com/best-practices/' },
  { channel: 'email', rule: 'Keep the spam complaint rate in Google Postmaster Tools below 0.1% and never let it reach 0.3%.', solid: true, source: 'https://support.google.com/a/answer/81126' },
  { channel: 'email', rule: 'Give every commercial email a clear sender identity, a free working unsubscribe, and one-click List-Unsubscribe headers for newsletters; honour opt-outs immediately.', solid: true, source: 'https://support.google.com/a/answer/81126' },
  { channel: 'email', rule: 'Write short, plain emails about the recipient\'s own problem; generic templates and tricks like \'quick question\' get ignored.', solid: false, source: 'https://www.reddit.com/r/sales/comments/1v4c4jl/a_decade_of_being_coldcalled_did_not_prepare_me/' },
  { channel: 'email', rule: 'When calling a prospect who agreed to an email, open by referring to that email (\'I\'m following up on what I sent Tuesday\') instead of asking if it is a good time.', solid: false, source: 'https://www.reddit.com/r/sales/comments/1rw53i0/cold_calls_work_better_when_they_arent_actually/' },
  { channel: 'email', rule: 'For a new domain or mailbox, send only 5-20 real one-to-one emails a day for the first two weeks, raise volume only while replies, bounces and spam placement stay clean, and expect about 30 days before reputation builds.', solid: false, source: 'https://www.reddit.com/r/Emailmarketing/comments/1ti9807/how_do_i_build_sender_reputation_for_a_brandnew/' },
  { channel: 'appstore', rule: 'Submit a Featuring Nomination in App Store Connect at least two weeks, ideally up to three months, before launch or a major update.', solid: true, source: 'https://developer.apple.com/app-store/getting-featured/' },
  { channel: 'appstore', rule: 'Open pre-orders 2 to 180 days before release so the game downloads automatically for everyone who ordered on launch day.', solid: true, source: 'https://developer.apple.com/app-store/pre-orders/' },
  { channel: 'appstore', rule: 'Use the 30-character name, 30-character subtitle and 100-character keyword field for different search terms; no repeats, plurals, \'game\', or competitor names.', solid: true, source: 'https://developer.apple.com/app-store/search/' },
  { channel: 'appstore', rule: 'Make the first three screenshots and the first seconds of the muted 30-second preview show the core gameplay, because they appear in search results.', solid: true, source: 'https://developer.apple.com/app-store/product-page/' },
  { channel: 'appstore', rule: 'Ask for a rating right after a happy moment such as a won level; the system prompt appears at most three times per 365 days.', solid: true, source: 'https://developer.apple.com/documentation/storekit/requesting-app-store-reviews' },
  { channel: 'appstore', rule: 'Assign keywords to custom product pages so tailored screenshots show in organic search for those terms.', solid: true, source: 'https://developer.apple.com/app-store/custom-product-pages/' },
  { channel: 'appstore', rule: 'Launch first in niche communities where puzzle players already are (following each sub\'s dev-post rules) and pitch small niche YouTubers and streamers personally with a promo code, rather than chasing broad press or broad TikTok.', solid: false, source: 'https://www.reddit.com/r/IndieDev/comments/1uzxpq7/solo_dev_135k_gross_in_6_months_from_a_cozy_idle/' },
]

const POST_CHANNELS: Record<string, Channel[]> = { instagram: ['instagram'], tiktok: ['tiktok'], linkedin: ['linkedin'], discord: ['forums'], x: [] }

/** The channels a task works on; an empty list means the task gets no channel rules. */
export function channelsFor(task: string, platform?: string): Channel[] {
  switch (task) {
    case 'posts':
      return POST_CHANNELS[platform ?? 'instagram'] ?? []
    case 'linkedin':
      return ['linkedin']
    case 'seo':
      return ['seo']
    case 'opportunities':
      return ['reddit', 'forums']
    case 'prospect':
    case 'contact_mail':
    case 'contact_mails':
    case 'emails':
      return ['email']
    case 'plan':
    case 'ideas':
    case 'experiments':
      return [...CHANNELS]
    default:
      return []
  }
}

/**
 * The rules for these channels as one block for the brief, at most `max`: taken in turns per channel, so a
 * broad task hears about every channel, and within a channel the solid ones first (the list is best first).
 */
export function channelRulesBlock(channels: readonly Channel[], rules: readonly ChannelRule[] = CHANNEL_RULES, max = 12): string {
  const queues = channels.map((c) => {
    const of = rules.filter((r) => r.channel === c)
    return [...of.filter((r) => r.solid), ...of.filter((r) => !r.solid)]
  })
  const picked: ChannelRule[] = []
  for (let round = 0; picked.length < max && queues.some((q) => q.length > round); round++)
    for (const q of queues) if (q[round] && picked.length < max) picked.push(q[round])
  if (!picked.length) return ''
  return `<channel_rules>
What works on these channels in 2026 (researched ${RESEARCHED}). "solid" comes from official or independent data: follow it. "anecdotal" comes from practitioners: weigh it.
${picked.map((r) => `- ${r.channel}, ${r.solid ? 'solid' : 'anecdotal'}: ${r.rule}`).join('\n')}
</channel_rules>`
}
