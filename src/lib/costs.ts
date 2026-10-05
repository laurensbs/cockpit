// What the steps of the growth checklist cost, from the official price pages (checked 5 October 2026:
// Apple, Google Play, Trustpilot and Stripe on their own pages; the rest are ranges to check).
// Amounts in euros where the page gives euros; the text says how and when you pay. Money is always his
// decision: the cockpit shows the price and the value, never pays.

export interface Cost {
  /** Short, for a chip: "€99 per jaar". */
  text: string
  /** Per year, for adding up; a one-time amount counts once. */
  amount: number
  period: 'once' | 'year' | 'month' | 'transaction'
  /** One sentence: what you get for it, or the catch. */
  note: string
  source: string
}

export const COSTS: Record<string, Cost> = {
  domain: { text: '± €10–15 per jaar', amount: 12, period: 'year', note: 'Per domeinnaam; .com, .eu, .nl en .es zitten allemaal rond dit bedrag.', source: 'https://www.cloudflare.com/products/registrar/' },
  mailbox: { text: '± €1–7 per maand', amount: 36, period: 'year', note: 'Een mailbox bij je hosting is het goedkoopst; Google Workspace kost meer maar geeft ook agenda en Drive.', source: 'https://workspace.google.com/pricing' },
  analytics: { text: 'gratis (Vercel) of ± €9 per maand (Plausible)', amount: 0, period: 'month', note: 'Vercel Web Analytics heeft een gratis basis; Plausible is zonder cookies en heel eenvoudig.', source: 'https://plausible.io/#pricing' },
  stripe: { text: '1,5% + €0,25 per betaling', amount: 0, period: 'transaction', note: 'Geen maand- of opstartkosten; dit is het tarief voor Europese kaarten (Britse 2,5%, overige 3,15%). Live gaan vraagt een bedrijfsverificatie.', source: 'https://stripe.com/es/pricing' },
  trustpilot: { text: 'gratis', amount: 0, period: 'month', note: 'Het gratis plan geeft 50 uitnodigingen per maand; betaald begint bij $99 per maand en heb je in het begin niet nodig.', source: 'https://business.trustpilot.com/plans' },
  'google-oauth': { text: 'gratis', amount: 0, period: 'once', note: 'De Google-API\'s zelf zijn gratis binnen de limieten; verificatie kost tijd, geen geld (behalve bij beperkte rechten).', source: 'https://support.google.com/cloud/answer/13463073' },
  business: { text: 'vraag je gestor', amount: 0, period: 'month', note: 'Als autónomo betaal je een maandelijkse bijdrage; starters krijgen de eerste periode een verlaagd tarief.', source: 'https://www.seg-social.es' },
  'apple-developer': { text: '99 USD per jaar', amount: 92, period: 'year', note: 'Eén lidmaatschap voor al je apps (Rondje Mee, Teampje, Short Stack); je betaalt in euro, rond €99. Als organisatie heb je een D-U-N-S-nummer nodig (gratis); als persoon staat je eigen naam als verkoper. Op verkopen houdt Apple 15% in (kleine-bedrijvenprogramma).', source: 'https://developer.apple.com/programs/enroll/' },
  'google-play': { text: '$25 eenmalig', amount: 23, period: 'once', note: 'Eén keer betalen voor al je apps. Een nieuw persoonlijk account moet een app eerst 14 dagen met 12 testers testen voordat hij live mag.', source: 'https://support.google.com/googleplay/android-developer/answer/6112435' },
}

export const costOf = (key: string | null) => (key ? (COSTS[key] ?? null) : null)

/** Accounts you pay for once for all your projects (an Apple or Google Play developer account). */
const SHARED = new Set(['apple-developer', 'google-play'])

export interface CostLine {
  cost: string
  /** The steps it is for, per project: "Rondje Mee: In de App Store". */
  for: string[]
}

export interface CostSummary {
  /** One line per account that covers several projects. */
  shared: CostLine[]
  /** Per project, what only that project needs. */
  projects: { name: string; lines: CostLine[] }[]
  /** Euros the first year: one-time costs plus a year of the yearly and monthly ones. */
  firstYear: number
  /** Euros every year after that. */
  perYear: number
}

/** Adds up what the open steps cost, an account shared by several apps only once. */
export function costSummary(projects: readonly { name: string; open: readonly { title: string; cost: string | null }[] }[]): CostSummary {
  const shared = new Map<string, string[]>()
  const own: CostSummary['projects'] = []
  const counted: Cost[] = []
  for (const p of projects) {
    const lines: CostLine[] = []
    for (const step of p.open) {
      const c = step.cost ? COSTS[step.cost] : null
      if (!c || (c.amount === 0 && c.period !== 'transaction')) continue
      if (SHARED.has(step.cost!)) {
        if (!shared.has(step.cost!)) counted.push(c)
        shared.set(step.cost!, [...(shared.get(step.cost!) ?? []), `${p.name}: ${step.title}`])
      } else {
        lines.push({ cost: step.cost!, for: [step.title] })
        counted.push(c)
      }
    }
    if (lines.length) own.push({ name: p.name, lines })
  }
  const yearly = (c: Cost) => (c.period === 'year' ? c.amount : c.period === 'month' ? c.amount * 12 : 0)
  return {
    shared: [...shared.entries()].map(([cost, list]) => ({ cost, for: list })),
    projects: own,
    firstYear: Math.round(counted.reduce((t, c) => t + yearly(c) + (c.period === 'once' ? c.amount : 0), 0)),
    perYear: Math.round(counted.reduce((t, c) => t + yearly(c), 0)),
  }
}
