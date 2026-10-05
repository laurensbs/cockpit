import { dayOf, hourOf, weekdayOf } from './dates'

// The rules of automatic sending, pure so they can be tested: when, how many, and what every mail
// must carry. The sender in src/server/outbox.ts applies them.

export const DEFAULT_DAILY_CAP = 20
export const MAX_DAILY_CAP = 50
/** At least this long between two mails, so a batch never goes out as one burst. */
export const MIN_GAP_MS = 3 * 60_000
/** Office hours in Amsterdam, Monday to Friday: [from, until). */
export const WINDOW = { from: 9, until: 17 } as const
/** Days between a first mail and its follow-ups (each counted from the mail before). */
export const FOLLOWUP_GAPS = [4, 7] as const

const OPT_OUT_LINES: Record<string, string> = {
  nl: 'Liever geen mail meer hierover? Laat het even weten, dan stop ik.',
  en: 'Rather not hear from me about this again? Just let me know and I will stop.',
  es: '¿Preferís no recibir más correos sobre esto? Decídmelo y paro.',
  fr: 'Vous préférez ne plus recevoir de message à ce sujet ? Dites-le-moi et j’arrête.',
  de: 'Lieber keine weiteren E-Mails dazu? Sag einfach Bescheid, dann höre ich auf.',
}

// Also the way he writes it himself: "Geen interesse? Zeg het gerust, dan stuur ik niets meer." and
// "Si no os interesa, decídmelo y no os escribo más." Without these a mail would end on two opt-outs.
const OPT_OUT_PATTERN =
  /geen (mail|e-mail|berichten) meer|(stuur|mail) ik (je |jullie )?niets meer|afmelden|uitschrijven|unsubscribe|not hear from me|no more (emails|mails)|no recibir|no (os|te|le|les) (escribo|escribiré) más|darte de baja|ne plus recevoir|désinscri|keine (weiteren )?(e-?mails|nachrichten)|abmelden/i

/** The mail as it goes out: the body, the PS, and an opt-out line when the text has none of its own. */
export function finalBody(body: string, ps: string, language: string): string {
  const text = [body.trim(), ps.trim() ? `PS ${ps.trim().replace(/^p\.?s\.?:?\s*/i, '')}` : ''].filter(Boolean).join('\n\n')
  return OPT_OUT_PATTERN.test(text) ? text : `${text}\n\n${OPT_OUT_LINES[language] ?? OPT_OUT_LINES.nl}`
}

/** Whether mails may go out at this moment: a weekday, within office hours, in Amsterdam. */
export function inSendWindow(now: Date): boolean {
  const weekday = weekdayOf(dayOf(now))
  const hour = hourOf(now)
  return weekday <= 5 && hour >= WINDOW.from && hour < WINDOW.until
}

/** How many more mails may go out now, given today's count, the cap and the last send. */
export function allowance(input: { sentToday: number; cap: number; lastSentAt: Date | null; now: Date; gapMs?: number }): number {
  const gap = input.gapMs ?? MIN_GAP_MS
  const left = Math.max(0, input.cap - input.sentToday)
  if (!left) return 0
  if (gap <= 0) return left
  if (input.lastSentAt && input.now.getTime() - input.lastSentAt.getTime() < gap) return 0
  return 1
}

/** A new mailbox warms up: at most 10 a day in its first week, 20 in the second, 35 in the third. */
const WARMUP = [10, 20, 35] as const

/** The cap for today: his own, but lower while the mailbox is new (counted from its first sent mail). */
export function warmCap(cap: number, firstSentAt: Date | null, now: Date): number {
  const week = firstSentAt ? Math.floor((now.getTime() - firstSentAt.getTime()) / (7 * 86_400_000)) : 0
  return Math.min(cap, WARMUP[week] ?? cap)
}

/** A sane daily cap from whatever was stored. */
export function dailyCap(value: string | null | undefined): number {
  const n = Number(value)
  return Number.isInteger(n) && n >= 1 ? Math.min(n, MAX_DAILY_CAP) : DEFAULT_DAILY_CAP
}

/** When the follow-up after this step may go out, counted from the moment this one was sent. */
export function nextFollowupAt(step: number, sentAt: Date): Date | null {
  const gap = FOLLOWUP_GAPS[step]
  return gap === undefined ? null : new Date(sentAt.getTime() + gap * 86_400_000)
}

export interface SmtpPreset {
  label: string
  host: string
  port: number
  secure: boolean
  note: string
}

/** The mail providers he is likely to use, with their SMTP settings. */
export const SMTP_PRESETS: Record<string, SmtpPreset> = {
  gmail: { label: 'Gmail / Google Workspace', host: 'smtp.gmail.com', port: 465, secure: true, note: 'Gebruik een app-wachtwoord (Google-account → Beveiliging → App-wachtwoorden).' },
  outlook: { label: 'Microsoft 365 (zakelijk)', host: 'smtp.office365.com', port: 587, secure: false, note: 'SMTP-authenticatie moet aan staan voor je mailbox.' },
  transip: { label: 'TransIP', host: 'smtp.transip.email', port: 465, secure: true, note: 'Je volledige e-mailadres als gebruikersnaam.' },
  strato: { label: 'Strato', host: 'smtp.strato.com', port: 465, secure: true, note: 'Je volledige e-mailadres als gebruikersnaam.' },
  hostinger: { label: 'Hostinger', host: 'smtp.hostinger.com', port: 465, secure: true, note: 'Je volledige e-mailadres als gebruikersnaam, en het wachtwoord van die mailbox.' },
  custom: { label: 'Andere mailserver', host: '', port: 587, secure: false, note: 'De gegevens staan bij je hostingpartij.' },
}
