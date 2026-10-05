'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon, type IconName } from './Icon'

// Three places up front; the rest is one tap away under "Meer" (and always in ⌘K).
const PLACES: { href: string; label: string; icon: IconName }[] = [
  { href: '/', label: 'Vandaag', icon: 'today' },
  { href: '/projects', label: 'Projecten', icon: 'projects' },
  { href: '/studio', label: 'Marketing', icon: 'studio' },
]
const MORE: { href: string; label: string; icon: IconName }[] = [
  { href: '/quests', label: 'Quests', icon: 'quests' },
  { href: '/companies', label: 'Bedrijven', icon: 'companies' },
]

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
  const status = claude.connected ? { tone: 'good', text: 'Claude Code gekoppeld' } : claude.installed ? { tone: 'warn', text: 'Koppel Claude Code' } : { tone: 'warn', text: 'Installeer Claude Code' }
  return (
    <nav className="sidebar" aria-label="Hoofdmenu">
      <div className="sidebar-group">
        {PLACES.map((p) => (
          <Link key={p.href} href={p.href} aria-current={isActive(pathname, p.href) ? 'page' : undefined}>
            <Icon name={p.icon} size={18} />
            <span>{p.label}</span>
          </Link>
        ))}
        <details className="sidebar-more" open={MORE.some((p) => isActive(pathname, p.href)) || undefined}>
          <summary>Meer</summary>
          {MORE.map((p) => (
            <Link key={p.href} href={p.href} aria-current={isActive(pathname, p.href) ? 'page' : undefined}>
              <Icon name={p.icon} size={18} />
              <span>{p.label}</span>
            </Link>
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
        <Link href="/settings" aria-current={isActive(pathname, '/settings') ? 'page' : undefined}>
          <Icon name="settings" size={18} />
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
