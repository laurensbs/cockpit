// One look per kind of step, everywhere: the same icon and colour on the path, in the lesson and at the
// end, so he recognises a step before he reads it.

import { Building2, HandHeart, Hammer, Megaphone, MessageCircle, Phone, Rocket, TrendingUp, type LucideIcon } from 'lucide-react'
import type { DayStep } from '@/lib/today'

export type StepKind = DayStep['kind'] | 'prospect'
export type Tone = 'blue' | 'violet' | 'green' | 'pink' | 'gold' | 'orange' | 'teal' | 'lime' | 'gray'

export const STEP_LOOK: Record<StepKind, { icon: LucideIcon; tone: Tone }> = {
  call: { icon: Phone, tone: 'blue' },
  prospects: { icon: Building2, tone: 'violet' },
  prospect: { icon: Building2, tone: 'violet' },
  reply: { icon: MessageCircle, tone: 'green' },
  give: { icon: HandHeart, tone: 'pink' },
  checkin: { icon: TrendingUp, tone: 'gold' },
  post: { icon: Megaphone, tone: 'orange' },
  build: { icon: Hammer, tone: 'teal' },
  growth: { icon: Rocket, tone: 'violet' },
}

/** A round, raised button-like disc with the step's icon: the node on the path, the badge in the lesson. */
export function StepDisc({ kind, size = 64, className = '' }: { kind: StepKind; size?: number; className?: string }) {
  const { icon: Glyph, tone } = STEP_LOOK[kind]
  return (
    <span className={`disc tone-${tone} ${className}`} style={{ width: size, height: size }} aria-hidden="true">
      <Glyph size={Math.round(size * 0.44)} strokeWidth={2.5} />
    </span>
  )
}
