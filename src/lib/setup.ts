// What a business needs before it can grow: found on Google, trusted (reviews), reachable on its own
// domain, able to take money, in the app stores. One catalogue for every project; per project the cockpit
// checks what it can itself, Claude fills in what it read in his documents, and he ticks off the rest.
// Pure, so the merge and the advice can be tested; src/server/setup-check.ts does the checking.

import { costOf } from './costs'

export type SetupStatus = 'done' | 'todo' | 'na' | 'unknown'
export type SetupSource = 'jij' | 'auto' | 'claude'
export type SetupGroup = 'basis' | 'vertrouwen' | 'geld' | 'apps'

/** What the project is, as far as this list cares: it decides which steps apply. */
export interface SetupProject {
  /** A website (own or on a hosting subdomain). */
  web: boolean
  /** An app or game for phones. */
  app: boolean
  /** It sells something or will: a price, a subscription, a one-time purchase. */
  paid: boolean
  /** Customers find it locally (a service business, a shop): Google Maps and reviews matter most. */
  local: boolean
}

export interface SetupItem {
  key: string
  group: SetupGroup
  title: string
  /** Why it matters, in one sentence. */
  why: string
  /** How to do it, in a few plain steps. */
  steps: string[]
  /** Who does it: him (accounts, money), Claude (texts, code), or together. */
  who: 'jij' | 'claude' | 'samen'
  /** A key in COSTS, or null when it is free. */
  cost: string | null
  /** About a law or tax: the cockpit only points it out; an adviser decides. */
  legal?: boolean
  /** Steps that must be done first (mail needs a domain, reviews need a Business Profile). */
  needs?: string[]
  applies: (p: SetupProject) => boolean
}

export const SETUP_GROUPS: Record<SetupGroup, string> = {
  basis: 'De basis',
  vertrouwen: 'Gevonden worden en vertrouwen',
  geld: 'Betalen en koppelingen',
  apps: 'In de app stores',
}

export const SETUP_ITEMS: SetupItem[] = [
  {
    key: 'domain',
    group: 'basis',
    title: 'Eigen domeinnaam',
    why: 'Een eigen adres (geen .vercel.app) wekt vertrouwen, geeft je mail op je naam en telt mee in Google.',
    steps: ['Kies een korte naam (.com of de landextensie van je klanten)', 'Koop hem bij een registrar', 'Laat Claude hem aan je site koppelen (DNS)'],
    who: 'samen',
    cost: 'domain',
    applies: (p) => p.web,
  },
  {
    key: 'mail',
    group: 'basis',
    title: 'Mail op je eigen domein',
    why: 'hallo@jouwnaam oogt betrouwbaar, en zonder eigen mailbox kan de cockpit niets voor je versturen.',
    steps: ['Maak een mailbox aan bij je hosting of mailprovider', 'Zet de MX-records bij je domein', 'Koppel hem in Cockpit onder Instellingen → Mails versturen'],
    who: 'jij',
    cost: 'mailbox',
    needs: ['domain'],
    applies: (p) => p.web,
  },
  {
    key: 'mail-auth',
    group: 'basis',
    title: 'Mail die niet in spam valt (SPF en DMARC)',
    why: 'Gmail en Outlook weigeren of verstoppen mail van domeinen zonder SPF en DMARC.',
    steps: ['Zet het SPF-record van je mailprovider', 'Zet DKIM aan bij je mailprovider', 'Voeg een DMARC-record toe (p=none is een prima start)'],
    who: 'samen',
    cost: null,
    needs: ['mail'],
    applies: (p) => p.web,
  },
  {
    key: 'privacy',
    group: 'basis',
    title: 'Privacyverklaring en voorwaarden op de site',
    why: 'Verplicht zodra je gegevens verzamelt, en Apple en Google vragen er een link naar.',
    steps: ['Laat Claude een concept maken op basis van wat je app echt doet', 'Laat het nakijken', 'Zet de link in de footer en in de app'],
    who: 'samen',
    cost: null,
    legal: true,
    applies: (p) => p.web || p.app,
  },
  {
    key: 'analytics',
    group: 'basis',
    title: 'Bezoekers meten (privacyvriendelijk)',
    why: 'Zonder cijfers weet je niet welke post of pagina werkt; Plausible of Vercel Analytics doet het zonder cookiebanner.',
    steps: ['Kies Vercel Web Analytics of Plausible', 'Laat Claude het script toevoegen', 'Koppel de bron in Cockpit onder Cijfers'],
    who: 'samen',
    cost: 'analytics',
    applies: (p) => p.web,
  },
  {
    key: 'gbp',
    group: 'vertrouwen',
    title: 'Google Bedrijfsprofiel',
    why: 'Zo sta je in Google Maps en in de zoekresultaten van je regio, met je recensies erbij. Gratis.',
    steps: ['Ga naar business.google.com en maak een profiel', 'Kies "servicegebied" als je geen winkel hebt', 'Rond de verificatie af (video of code)', 'Vul categorieën, uren, foto\'s en je site in'],
    who: 'jij',
    cost: null,
    applies: (p) => p.local,
  },
  {
    key: 'google-reviews',
    group: 'vertrouwen',
    title: 'De eerste 5 Google-recensies',
    why: 'Recensies wegen zwaar: mensen kiezen het bedrijf met sterren, en Google ook.',
    steps: ['Kopieer je recensielink uit je Bedrijfsprofiel', 'Vraag elke tevreden klant, steeds op dezelfde manier', 'Nooit iets ervoor geven en niet alleen blije klanten vragen (regels van Google)'],
    who: 'jij',
    cost: null,
    needs: ['gbp'],
    applies: (p) => p.local,
  },
  {
    key: 'trustpilot',
    group: 'vertrouwen',
    title: 'Trustpilot-profiel',
    why: 'Voor een online dienst of app zonder winkel is Trustpilot de plek waar nieuwe klanten naar recensies kijken.',
    steps: ['Claim je bedrijf op business.trustpilot.com (gratis)', 'Verifieer met je mail op je eigen domein', 'Nodig je eerste gebruikers uit'],
    who: 'jij',
    cost: 'trustpilot',
    needs: ['domain'],
    applies: (p) => p.web && !p.local,
  },
  {
    key: 'socials',
    group: 'vertrouwen',
    title: 'Socials gekoppeld',
    why: 'Waar je doelgroep scrolt, moet je naam staan; Cockpit plant dan je posts voor je.',
    steps: ['Maak of claim je Instagram (en LinkedIn voor zakelijk)', 'Plak de link in Cockpit bij het project'],
    who: 'jij',
    cost: null,
    applies: () => true,
  },
  {
    key: 'search-console',
    group: 'vertrouwen',
    title: 'Google Search Console met sitemap',
    why: 'Je ziet waarop mensen je vinden, en Google leest nieuwe pagina\'s sneller.',
    steps: ['Voeg je domein toe op search.google.com/search-console', 'Bevestig via een DNS-record', 'Dien je sitemap.xml in'],
    who: 'samen',
    cost: null,
    applies: (p) => p.web,
  },
  {
    key: 'stripe',
    group: 'geld',
    title: 'Online betalen live (Stripe)',
    why: 'Zonder live betaalsleutels kan niemand betalen; testsleutels werken alleen voor jezelf.',
    steps: ['Rond de bedrijfsverificatie af in Stripe', 'Zet de live-sleutels in je productieomgeving (vraag Claude om het script, nooit in de chat)', 'Doe één echte betaling van €1 en betaal hem terug'],
    who: 'samen',
    cost: 'stripe',
    applies: (p) => p.paid && p.web,
  },
  {
    key: 'env-keys',
    group: 'geld',
    title: 'Alle sleutels in productie',
    why: 'Wat in .env.example staat maar niet in productie, werkt live niet (Google-login, mail, betalen…).',
    steps: ['Kijk welke namen Cockpit hieronder mist', 'Zet ze met het geheim-script in Vercel (nooit in de chat)', 'Laat Claude de site daarna controleren'],
    who: 'jij',
    cost: null,
    applies: (p) => p.web,
  },
  {
    key: 'google-oauth',
    group: 'geld',
    title: 'Google-login of agenda live (OAuth-verificatie)',
    why: 'Zolang de app niet is geverifieerd, ziet elke gebruiker een waarschuwingsscherm van Google.',
    steps: ['Vul het OAuth-toestemmingsscherm in (naam, logo, privacylink)', 'Vraag verificatie aan als je gevoelige rechten gebruikt (zoals de agenda)', 'Zet de productie-sleutels in je omgeving'],
    who: 'samen',
    cost: 'google-oauth',
    applies: () => false,
  },
  {
    key: 'business',
    group: 'geld',
    title: 'Ingeschreven als ondernemer, met facturen',
    why: 'Nodig om te factureren en voor Stripe en Apple als organisatie. Laat je hierover adviseren.',
    steps: ['Vraag een gestor of boekhouder wat past (autónomo in Spanje)', 'Regel facturen met btw-nummer'],
    who: 'jij',
    cost: 'business',
    legal: true,
    applies: (p) => p.paid,
  },
  {
    key: 'apple-dev',
    group: 'apps',
    title: 'Apple Developer-account',
    why: 'Eén account voor al je apps: daarmee kun je in de App Store en via TestFlight testers uitnodigen.',
    steps: ['Kies persoonlijk of als organisatie (die vraagt een D-U-N-S-nummer)', 'Meld je aan op developer.apple.com/programs', 'Betaal het jaarbedrag'],
    who: 'jij',
    cost: 'apple-developer',
    applies: (p) => p.app,
  },
  {
    key: 'app-store',
    group: 'apps',
    title: 'In de App Store',
    why: 'Hier zoeken mensen een app; zonder vermelding besta je niet op de iPhone.',
    steps: ['Zet de app in App Store Connect met schermafbeeldingen', 'Vul privacy en leeftijd in', 'Stuur hem in voor review'],
    who: 'samen',
    cost: null,
    needs: ['apple-dev'],
    applies: (p) => p.app,
  },
  {
    key: 'google-play',
    group: 'apps',
    title: 'In Google Play',
    why: 'De helft van je doelgroep heeft Android.',
    steps: ['Maak een Play Console-account', 'Test eerst met 12 testers gedurende 14 dagen (nieuwe persoonlijke accounts)', 'Zet de app live'],
    who: 'samen',
    cost: 'google-play',
    applies: (p) => p.app,
  },
]

export const setupItem = (key: string) => SETUP_ITEMS.find((i) => i.key === key) ?? null

/** What a project is, from its intake: the words in what it does, its price and its red lines. */
export function setupProjectFrom(project: { what: string; oneLiner: string; siteUrl: string | null; localPath: string | null }): SetupProject {
  const text = `${project.oneLiner} ${project.what}`.toLowerCase()
  return {
    web: Boolean(project.siteUrl || project.localPath),
    app: /\b(iphone|ios|app store|android|testflight|game)\b|iphone-app|puzzelgame/.test(text),
    paid: /€|\bprijs\b|abonnement|per maand|eenmalig|betaal|stripe|pro\b|aankoop/.test(text),
    local: /servicebedrijv|garage|installateur|monteur|kapper|winkel|lokale|regio|costa brava|werkbon/.test(text),
  }
}

export interface SetupRow {
  key: string
  source: SetupSource
  status: SetupStatus
  note: string
}

export interface SetupView {
  item: SetupItem
  status: SetupStatus
  source: SetupSource | null
  note: string
}

const RANK: Record<SetupSource, number> = { jij: 3, auto: 2, claude: 1 }

/**
 * The list for one project: only what applies (unless Claude or he says it does), each with the word that
 * counts most: his own, then what the cockpit checked, then what Claude read. A step nobody knows is "unknown".
 */
export function setupView(project: SetupProject, rows: readonly SetupRow[]): SetupView[] {
  const out: SetupView[] = []
  for (const item of SETUP_ITEMS) {
    const own = rows.filter((r) => r.key === item.key).sort((a, b) => RANK[b.source] - RANK[a.source])
    const best = own.find((r) => r.status !== 'unknown') ?? own[0]
    // A step that does not apply by its rule still shows when someone said something about it.
    if (!item.applies(project) && !own.some((r) => r.status === 'done' || r.status === 'todo')) continue
    out.push({ item, status: best?.status ?? 'unknown', source: best?.source ?? null, note: best?.note ?? '' })
  }
  return out.filter((v) => v.status !== 'na')
}

/** Done out of all that apply, for the ring. */
export function setupProgress(view: readonly SetupView[]): { done: number; total: number } {
  return { done: view.filter((v) => v.status === 'done').length, total: view.length }
}

/**
 * The next step to take: open ones first (todo before unknown), free before paid (a paid one is a decision),
 * the basis before the rest, his own steps before what Claude does anyway.
 */
export function nextSetupStep(view: readonly SetupView[]): SetupView | null {
  const groupOrder: SetupGroup[] = ['basis', 'vertrouwen', 'geld', 'apps']
  const done = new Set(view.filter((v) => v.status === 'done').map((v) => v.item.key))
  const ready = (v: SetupView) => (v.item.needs ?? []).every((k) => done.has(k) || !view.some((x) => x.item.key === k))
  const open = view.filter((v) => (v.status === 'todo' || v.status === 'unknown') && ready(v))
  const paid = (v: SetupView) => (costOf(v.item.cost)?.amount ?? 0) > 0
  const score = (v: SetupView) => (v.status === 'todo' ? 0 : 10) + (paid(v) ? 5 : 0) + groupOrder.indexOf(v.item.group) + (v.item.who === 'claude' ? 3 : 0)
  return [...open].sort((a, b) => score(a) - score(b))[0] ?? null
}

/** The checklist as three short lists for Claude: "Eigen domeinnaam (rondjemee.nl)". */
export function setupLines(view: readonly SetupView[]): { done: string[]; todo: string[]; unknown: string[] } {
  const line = (v: SetupView) => `${v.item.title}${v.note ? ` (${v.note})` : ''}`
  return {
    done: view.filter((v) => v.status === 'done').map(line),
    todo: view.filter((v) => v.status === 'todo').map(line),
    unknown: view.filter((v) => v.status === 'unknown').map((v) => v.item.title),
  }
}
