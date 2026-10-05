// Where a project stands, read from its own STAND.md (the compass Laurens keeps per project): the phase,
// the goal of the phase and the open criteria. Pure, so it can be tested; src/server/compass.ts reads the file.

export interface Compass {
  /** "2 · Prototype", short enough for a chip. */
  phase: string | null
  /** What this phase is for, one sentence. */
  goal: string | null
  /** Criteria for the next phase that are not met yet (⬜). */
  open: string[]
  /** For Claude: the start of the file (phase, criteria, scoreboard) and the newest of the logbook. */
  excerpt: string
}

const clean = (s: string) => s.replace(/\*\*/g, '').replace(/`/g, '').replace(/\s+/g, ' ').trim()

/**
 * The start of the file and the newest logbook lines: the start says where the project stands, the logbook
 * (newest first, as he keeps it) what changed since: a new name, what went live. Without the logbook the
 * cockpit would miss exactly what is new.
 */
export function compassExcerpt(markdown: string, head = 3000, log = 3000): string {
  const at = markdown.search(/^##\s*Logboek\b.*$/m)
  if (at === -1) return markdown.slice(0, head + log)
  const before = markdown.slice(0, at)
  const rest = markdown.slice(at).replace(/^##.*\n/, '')
  const next = rest.search(/^##\s/m)
  const entries = (next === -1 ? rest : rest.slice(0, next)).trim()
  const top = before.length > head ? `${before.slice(0, head).trimEnd()}\n…` : before.trimEnd()
  return `${top}\n\n## Logboek (nieuwste eerst)\n${entries.length > log ? `${entries.slice(0, log).trimEnd()}\n…` : entries}`
}

export function compassFrom(markdown: string): Compass {
  const phaseLine = markdown.match(/^\*\*Fase:\*\*\s*(.+)$/im)?.[1] ?? null
  // "2 · Prototype → volgende: 3 · MVP live" or "2 · Prototype. Volgende fase: …": keep the current phase.
  const phase = phaseLine ? clean(phaseLine.split(/→|\.\s*Volgende|, oftewel/i)[0]).replace(/[.,]$/, '').slice(0, 40) : null
  const goalLine = markdown.match(/^\*\*Doel van deze fase:\*\*\s*(.+)$/im)?.[1] ?? null
  const goal = goalLine ? clean(goalLine).split(/(?<=[.!?])\s/)[0].slice(0, 220) : null
  const open = [...markdown.matchAll(/^\s*[-*]\s*⬜\s*(.+)$/gm)].map((m) => clean(m[1]).split(/(?<=[.!?])\s/)[0].slice(0, 140)).slice(0, 6)
  return { phase, goal, open, excerpt: compassExcerpt(markdown) }
}
