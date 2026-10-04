// The "what now?" of the marketing hub: organic growth first, from what is (not yet) there. Pure, so
// the order is predictable and testable.

export interface GrowthState {
  hasProfile: boolean
  hasPlan: boolean
  hasLinkedin: boolean
  hasKeywords: boolean
  experimentsRunning: number
  experimentsBacklog: number
  articlesThisMonth: number
  newContactsWithEmail: number
  readyDrafts: number
  postsDoneThisWeek: number
  postsPlannedThisWeek: number
  mailReady: boolean
  /** Contacts in the project at all. */
  contacts: number
}

export type HubTab = 'brain' | 'drafts' | 'mails' | 'articles' | 'experiments' | 'calendar' | 'ideas' | 'opportunities' | 'contacts' | 'settings'

export interface GrowthAction {
  key: string
  title: string
  why: string
  tab: HubTab
}

const WEEKLY_POSTS = 3

/** At most five next steps, the most important first. */
export function nextActions(g: GrowthState): GrowthAction[] {
  const out: GrowthAction[] = []
  if (!g.hasProfile) out.push({ key: 'profile', title: 'Maak het marketingprofiel', why: 'Alles daarna (posts, mails, artikelen) wordt er scherper van.', tab: 'brain' })
  if (g.readyDrafts) out.push({ key: 'approve', title: `Keur ${g.readyDrafts} mail${g.readyDrafts === 1 ? '' : 's'} goed`, why: 'Ze staan klaar; daarna gaan ze vanzelf de deur uit.', tab: 'contacts' })
  if (g.readyDrafts && !g.mailReady) out.push({ key: 'mailbox', title: 'Koppel je mailbox', why: 'Dan versturen goedgekeurde mails zichzelf, binnen je daglimiet.', tab: 'settings' })
  if (!g.experimentsRunning)
    out.push(
      g.experimentsBacklog
        ? { key: 'start-experiment', title: 'Start een groei-experiment', why: 'Er liggen experimenten klaar; één tegelijk, twee weken, dan meten.', tab: 'experiments' }
        : { key: 'experiments', title: 'Bedenk groei-experimenten', why: 'Organische groei komt uit kleine proeven die je meet.', tab: 'experiments' },
    )
  if (g.postsDoneThisWeek + g.postsPlannedThisWeek < WEEKLY_POSTS)
    out.push({ key: 'posts', title: `Plan ${WEEKLY_POSTS - g.postsDoneThisWeek - g.postsPlannedThisWeek} post${WEEKLY_POSTS - g.postsDoneThisWeek - g.postsPlannedThisWeek === 1 ? '' : 's'} deze week`, why: 'Vaste regelmaat wint het van af en toe veel.', tab: 'drafts' })
  if (g.newContactsWithEmail) out.push({ key: 'outreach', title: `Schrijf mails voor ${g.newContactsWithEmail} nieuw${g.newContactsWithEmail === 1 ? ' contact' : 'e contacten'}`, why: 'Persoonlijk en kort: één klik, Claude schrijft, jij keurt goed.', tab: 'contacts' })
  if (!g.articlesThisMonth) out.push({ key: 'seo', title: g.hasKeywords ? 'Schrijf het artikel van deze maand' : 'Zoek waar je doelgroep op zoekt', why: 'Eén goed artikel per maand blijft jarenlang bezoekers brengen.', tab: 'articles' })
  if (!g.contacts) out.push({ key: 'opportunities', title: 'Zoek kansen: communities, gidsen, partners', why: 'Waar je doelgroep al samenkomt, groei je het snelst.', tab: 'opportunities' })
  if (!g.hasLinkedin) out.push({ key: 'linkedin', title: 'Maak je LinkedIn-plan', why: 'Je profiel en vijf posts: daar zoeken partners en klanten je eerst.', tab: 'brain' })
  if (g.hasProfile && !g.hasPlan) out.push({ key: 'plan', title: 'Maak het plan voor 90 dagen', why: 'Van losse acties naar een ritme met quests.', tab: 'brain' })
  return out.slice(0, 5)
}
