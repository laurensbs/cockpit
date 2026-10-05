// Where a project stands, read from its own STAND.md (the compass Laurens keeps per project): the phase,
// the goal of the phase and the open criteria. Pure, so it can be tested; src/server/compass.ts reads the file.

export interface Compass {
  /** "2 · Prototype", short enough for a chip. */
  phase: string | null
  /** What this phase is for, one sentence. */
  goal: string | null
  /** Criteria for the next phase that are not met yet (⬜). */
  open: string[]
  /** The start of the file for Claude, without secrets (the caller redacts). */
  excerpt: string
}

const clean = (s: string) => s.replace(/\*\*/g, '').replace(/`/g, '').replace(/\s+/g, ' ').trim()

export function compassFrom(markdown: string, max = 4000): Compass {
  const phaseLine = markdown.match(/^\*\*Fase:\*\*\s*(.+)$/im)?.[1] ?? null
  // "2 · Prototype → volgende: 3 · MVP live" or "2 · Prototype. Volgende fase: …": keep the current phase.
  const phase = phaseLine ? clean(phaseLine.split(/→|\.\s*Volgende|, oftewel/i)[0]).replace(/[.,]$/, '').slice(0, 40) : null
  const goalLine = markdown.match(/^\*\*Doel van deze fase:\*\*\s*(.+)$/im)?.[1] ?? null
  const goal = goalLine ? clean(goalLine).split(/(?<=[.!?])\s/)[0].slice(0, 220) : null
  const open = [...markdown.matchAll(/^\s*[-*]\s*⬜\s*(.+)$/gm)].map((m) => clean(m[1]).split(/(?<=[.!?])\s/)[0].slice(0, 140)).slice(0, 6)
  return { phase, goal, open, excerpt: markdown.slice(0, max) }
}
