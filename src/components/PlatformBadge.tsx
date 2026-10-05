import { AtSign, Briefcase, Camera, Mail, MessagesSquare, Music2, type LucideIcon } from 'lucide-react'
import type { Tone } from './StepIcon'

const LOOK: Record<string, { icon: LucideIcon; tone: Tone; label: string }> = {
  instagram: { icon: Camera, tone: 'pink', label: 'Instagram' },
  tiktok: { icon: Music2, tone: 'teal', label: 'TikTok' },
  linkedin: { icon: Briefcase, tone: 'blue', label: 'LinkedIn' },
  x: { icon: AtSign, tone: 'gray', label: 'X/Threads' },
  discord: { icon: MessagesSquare, tone: 'violet', label: 'Discord' },
  email: { icon: Mail, tone: 'blue', label: 'Mail' },
}

/** Where a draft goes, at a glance: the platform's colour and icon, and its name. */
export function PlatformBadge({ platform, label }: { platform: string; label?: string }) {
  const look = LOOK[platform] ?? { icon: Mail, tone: 'gray' as const, label: platform }
  const Glyph = look.icon
  return (
    <span className={`platform-badge tone-${look.tone}`}>
      <span className="badge-ico" aria-hidden="true">
        <Glyph size={16} strokeWidth={2.5} />
      </span>
      <strong>{label ?? look.label}</strong>
    </span>
  )
}
