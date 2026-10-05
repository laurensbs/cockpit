'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon } from './Icon'
import { MORE, PLACES } from './Sidebar'

// A narrow window has no sidebar: the places he uses daily, Geld, and "Meer" for the settings (Taken sits under the streak, top right).
const TABS = [...PLACES, ...MORE.filter((m) => m.href === '/geld'), { href: '/settings', label: 'Meer', icon: 'settings' as const, tone: 'gray' as const }]

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)
}

/** The places as a tab bar on a narrow window; a wide window has the sidebar. */
export function AppNav({ variant }: { variant: 'tabbar' }) {
  const pathname = usePathname()
  return (
    <nav className={variant} aria-label="Hoofdmenu">
      {TABS.map((tab) => (
        <Link key={tab.href} href={tab.href} className={`tone-${tab.tone}`} aria-current={isActive(pathname, tab.href) ? 'page' : undefined}>
          <span className="nav-ico">
            <Icon name={tab.icon} size={24} />
          </span>
          <span>{tab.label}</span>
        </Link>
      ))}
    </nav>
  )
}
