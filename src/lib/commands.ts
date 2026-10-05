// The command bar (Cmd+K): places, projects and Claude jobs, filtered as he types. Pure, so the
// matching and the order are testable.

export type Command =
  | { id: string; group: 'Vraag Claude'; label: string; hint?: string; kind: 'ask'; projectId: string | null; question: string }
  | { id: string; group: 'Ga naar' | 'Projecten'; label: string; hint?: string; kind: 'go'; href: string }
  | { id: string; group: 'Laat Claude doen'; label: string; hint?: string; kind: 'claude'; task: string; projectId: string | null; options?: Record<string, unknown> }

export interface CommandProject {
  id: string
  name: string
}

export const PLACES: { label: string; href: string; hint?: string }[] = [
  { label: 'Vandaag', href: '/' },
  { label: 'Projecten', href: '/projects' },
  { label: 'Marketing', href: '/studio', hint: 'concepten, mails, artikelen, experimenten' },
  { label: 'Taken', href: '/quests' },
  { label: 'Geld', href: '/geld', hint: 'vaste lasten, prijzen, data om op te letten' },
  { label: 'GitHub', href: '/github', hint: 'alles binnenhalen' },
  { label: 'Instellingen', href: '/settings', hint: 'Claude, mailbox, GitHub' },
]

/** The jobs Claude Code can do for one project, as the buttons elsewhere offer them. */
export const PROJECT_JOBS: { task: string; label: string; options?: Record<string, unknown> }[] = [
  { task: 'profile', label: 'Maak het marketingprofiel' },
  { task: 'plan', label: 'Maak het plan voor 90 dagen' },
  { task: 'posts', label: 'Maak posts voor Instagram', options: { platform: 'instagram' } },
  { task: 'posts', label: 'Maak posts voor LinkedIn', options: { platform: 'linkedin' } },
  { task: 'ideas', label: 'Bedenk ideeën' },
  { task: 'opportunities', label: 'Zoek kansen op het web' },
  { task: 'seo', label: 'Zoekwoorden en een artikel' },
  { task: 'experiments', label: 'Bedenk groei-experimenten' },
  { task: 'linkedin', label: 'Maak het LinkedIn-plan' },
  { task: 'contact_mails', label: 'Schrijf mails aan nieuwe contacten' },
]

const fold = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

/** Every word he typed appears somewhere in the label or hint. */
export function matches(query: string, ...texts: (string | undefined)[]): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean)
  const haystack = fold(texts.filter(Boolean).join(' '))
  return words.every((w) => haystack.includes(w))
}

/**
 * What the bar shows for a query: places, projects and jobs that match, a few of each; with text,
 * asking Claude about it comes after them (about the project he is on, and about everything). A real
 * question matches nothing else, so there Enter asks Claude.
 */
export function buildCommands(query: string, projects: CommandProject[], current: CommandProject | null, limit = 6): Command[] {
  const q = query.trim()
  const ask: Command[] = []
  if (q) {
    if (current) ask.push({ id: `ask-${current.id}`, group: 'Vraag Claude', label: q, hint: `over ${current.name}`, kind: 'ask', projectId: current.id, question: q })
    ask.push({ id: 'ask-all', group: 'Vraag Claude', label: q, hint: 'over al je projecten', kind: 'ask', projectId: null, question: q })
  }
  const places = PLACES.filter((p) => !q || matches(q, p.label, p.hint)).map<Command>((p) => ({ id: `go-${p.href}`, group: 'Ga naar', label: p.label, hint: p.hint, kind: 'go', href: p.href }))
  const projectRows = projects
    .filter((p) => !q || matches(q, p.name))
    .map<Command>((p) => ({ id: `project-${p.id}`, group: 'Projecten', label: p.name, kind: 'go', href: `/projects/${p.id}` }))
  // Jobs for the project he is on first; with a query, jobs of any project that match.
  const scope = q ? [...(current ? [current] : []), ...projects.filter((p) => p.id !== current?.id)] : current ? [current] : []
  const jobs: Command[] = []
  if (!q || matches(q, 'focus van de week weekfocus alle projecten')) jobs.push({ id: 'weekly', group: 'Laat Claude doen', label: 'Maak de focus van de week', hint: 'alle projecten', kind: 'claude', task: 'weekly', projectId: null })
  for (const p of scope)
    for (const job of PROJECT_JOBS)
      if (!q || matches(q, job.label, p.name)) jobs.push({ id: `${job.task}-${JSON.stringify(job.options ?? {})}-${p.id}`, group: 'Laat Claude doen', label: job.label, hint: p.name, kind: 'claude', task: job.task, projectId: p.id, options: job.options })
  return [...places.slice(0, limit), ...projectRows.slice(0, limit), ...jobs.slice(0, limit), ...ask]
}
