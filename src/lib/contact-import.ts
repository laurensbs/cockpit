import { EMAIL } from './mailto'
import { normalizeUrl } from './urls'

// A pasted list of contacts, one per line, pure so it can be tested. The columns follow the form:
// organisatie, naam, e-mail, website, basis, notitie. Tabs (a paste from a spreadsheet) or semicolons
// separate them; with semicolons, anything after the fifth goes back into the note, so a note may
// hold a semicolon of its own. The addresses stay in the cockpit: this never goes to Claude.

export type ContactBasis = 'business' | 'relation' | 'consent'

export interface ImportedContact {
  line: number
  organization: string
  name: string
  email: string | null
  website: string | null
  basis: ContactBasis
  note: string
}

export interface ImportProblem {
  line: number
  reason: string
}

export const MAX_IMPORT_ROWS = 200

const BASIS: Record<string, ContactBasis> = {
  '': 'business',
  business: 'business',
  zakelijk: 'business',
  'zakelijk adres': 'business',
  relation: 'relation',
  relatie: 'relation',
  'bestaande relatie': 'relation',
  consent: 'consent',
  toestemming: 'consent',
}

export function parseContactList(text: string): { rows: ImportedContact[]; problems: ImportProblem[] } {
  const rows: ImportedContact[] = []
  const problems: ImportProblem[] = []
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  lines.forEach((raw, i) => {
    const line = i + 1
    if (!raw.trim() || raw.trim().startsWith('#')) return
    const cells = raw.includes('\t') ? raw.split('\t') : raw.split(';')
    const [organization = '', name = '', email = '', website = '', basis = '', ...rest] = cells.map((c) => c.trim())
    const note = rest.join(raw.includes('\t') ? ' ' : '; ').trim()
    if (i === 0 && organization.toLowerCase() === 'organisatie') return
    const reason = problemWith({ organization, name, email, website, basis, note })
    if (reason || rows.length >= MAX_IMPORT_ROWS) {
      problems.push({ line, reason: reason ?? `meer dan ${MAX_IMPORT_ROWS} regels` })
      return
    }
    rows.push({ line, organization, name, email: email || null, website: website ? normalizeUrl(website) : null, basis: BASIS[basis.toLowerCase()], note })
  })
  return { rows, problems }
}

function problemWith(c: { organization: string; name: string; email: string; website: string; basis: string; note: string }): string | null {
  if (!c.organization) return 'geen organisatie'
  if (c.organization.length > 120) return 'organisatie langer dan 120 tekens'
  if (c.name.length > 80) return 'naam langer dan 80 tekens'
  if (c.email && (c.email.length > 160 || !EMAIL.test(c.email))) return 'e-mailadres klopt niet'
  if (c.website && (c.website.length > 300 || !normalizeUrl(c.website))) return 'webadres klopt niet'
  if (!Object.hasOwn(BASIS, c.basis.toLowerCase())) return `onbekende basis "${c.basis}" (zakelijk, relatie of toestemming)`
  if (c.note.length > 1000) return 'notitie langer dan 1000 tekens'
  return null
}

/** The same organisation twice, or one that is already in the project: compared without case or spaces. */
export const contactKey = (organization: string) => organization.toLowerCase().replace(/\s+/g, ' ').trim()
