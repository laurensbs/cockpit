// The coach: one best next step, with why, a few concrete steps, who does it and what it costs. Claude
// writes it after every push (per project) and when he says "ik weet het even niet" (across everything).

import { z } from 'zod'

export const COACH_WHO = ['jij', 'claude', 'samen'] as const

export interface CoachAdvice {
  title: string
  why: string
  steps: string[]
  who: (typeof COACH_WHO)[number]
  cost: string
  /** The checklist step it is about, if any: "Gedaan" then ticks it off. */
  setupKey: string | null
}

export const CoachWire = z.object({
  title: z.string().trim().min(1).max(120),
  why: z.string().trim().min(1).max(400),
  steps: z.array(z.string().trim().min(1).max(200)).min(1).max(5),
  who: z.enum(COACH_WHO),
  cost: z.string().trim().max(80).optional(),
  setupKey: z.string().trim().max(40).optional(),
})

const clip = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/** What was stored, read back defensively. */
export function coachFromJson(content: unknown): CoachAdvice | null {
  if (!content || typeof content !== 'object') return null
  const c = content as Record<string, unknown>
  const title = clip(c.title, 120)
  const why = clip(c.why, 400)
  if (!title || !why) return null
  const steps = Array.isArray(c.steps) ? c.steps.map((x) => clip(x, 200)).filter(Boolean).slice(0, 5) : []
  const who = COACH_WHO.includes(c.who as CoachAdvice['who']) ? (c.who as CoachAdvice['who']) : 'jij'
  return { title, why, steps, who, cost: clip(c.cost, 80), setupKey: clip(c.setupKey, 40) || null }
}
