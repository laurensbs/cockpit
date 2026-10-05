'use client'

import { ChevronDown, Ellipsis } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon, type IconName } from './Icon'
import type { Tone } from './StepIcon'

// Three places up front; the rest is one tap away under "Meer" (and always in ⌘K). Each has its colour.
export const PLACES: { href: string; label: string; icon: IconName; tone: Tone }[] = [
  { href: '/', label: 'Vandaag', icon: 'today', tone: 'orange' },
  { href: '/projects', label: 'Projecten', icon: 'projects', tone: 'blue' },
  { href: '/studio', label: 'Marketing', icon: 'studio', tone: 'violet' },
]
export const MORE: { href: string; label: string; icon: IconName; tone: Tone }[] = [
  { href: '/quests', label: 'Quests', icon: 'quests', tone: 'green' },
  { href: '/companies', label: 'Bedrijven', icon: 'companies', tone: 'gold' },
  { href: '/geld', label: 'Geld', icon: 'coins', tone: 'teal' },
]

function Place({ place, active }: { place: (typeof PLACES)[number]; active: boolean }) {
  return (
    <Link href={place.href} className={`tone-${place.tone}`} aria-current={active ? 'page' : undefined}>
      <span className="nav-ico">
        <Icon name={place.icon} size={24} />
      </span>
      <span>{place.label}</span>
    </Link>
  )
}

export interface SidebarProject {
  id: string
  name: string
  color: string | null
}

export interface SidebarClaude {
  installed: boolean
  connected: boolean
}

const isActive = (pathname: string, href: string) => (href === '/' ? pathname === '/' : href === '/projects' ? pathname === '/projects' || pathname === '/projects/new' : pathname === href || pathname.startsWith(`${href}/`))

/** The places, every active project, and whether Claude Code is ready: the source list of the app. */
export function Sidebar({ projects, claude, version }: { projects: SidebarProject[]; claude: SidebarClaude; version: string | null }) {
  const pathname = usePathname()
  const status = claude.connected ? { tone: 'good', text: 'Claude staat klaar' } : claude.installed ? { tone: 'warn', text: 'Claude koppelen' } : { tone: 'warn', text: 'Claude installeren' }
  return (
    <nav className="sidebar" aria-label="Hoofdmenu">
      <div className="sidebar-group">
        {PLACES.map((p) => (
          <Place key={p.href} place={p} active={isActive(pathname, p.href)} />
        ))}
        <details className="sidebar-more" open={MORE.some((p) => isActive(pathname, p.href)) || undefined}>
          <summary>
            <span className="nav-ico tone-gray">
              <Ellipsis size={24} strokeWidth={2.25} aria-hidden="true" />
            </span>
            <span className="grow">Meer</span>
            <ChevronDown className="chev" size={18} strokeWidth={2.5} aria-hidden="true" />
          </summary>
          {MORE.map((p) => (
            <Place key={p.href} place={p} active={isActive(pathname, p.href)} />
          ))}
        </details>
      </div>
      {projects.length ? (
        <div className="sidebar-group sidebar-projects">
          <div className="sidebar-title">
            <span>Projecten</span>
            <Link href="/projects/new" className="sidebar-add" aria-label="Project toevoegen" title="Project toevoegen">
              <Icon name="plus" size={14} />
            </Link>
          </div>
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} aria-current={pathname === `/projects/${p.id}` || pathname.startsWith(`/projects/${p.id}/`) ? 'page' : undefined}>
              <span className="dot" style={{ background: p.color ?? 'var(--accent)' }} aria-hidden="true" />
              <span className="sidebar-name">{p.name}</span>
            </Link>
          ))}
        </div>
      ) : null}
      <div className="sidebar-foot">
        <Link href="/settings" className="tone-gray" aria-current={isActive(pathname, '/settings') ? 'page' : undefined}>
          <span className="nav-ico">
            <Icon name="settings" size={22} />
          </span>
          <span>Instellingen</span>
        </Link>
        <Link href="/settings#claude" className={`claude-status ${status.tone}`}>
          <span className="status-dot" aria-hidden="true" />
          <span>{status.text}</span>
        </Link>
        {version ? <p className="sidebar-version tiny faint">Cockpit {version}</p> : null}
      </div>
    </nav>
  )
}
