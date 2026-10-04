'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon, type IconName } from './Icon'

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: '/', label: 'Vandaag', icon: 'today' },
  { href: '/projects', label: 'Projecten', icon: 'projects' },
  { href: '/studio', label: 'Marketing', icon: 'studio' },
  { href: '/quests', label: 'Quests', icon: 'quests' },
  { href: '/companies', label: 'Bedrijven', icon: 'companies' },
]

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)
}

/** The five places as a tab bar on a narrow window; a wide window has the sidebar. */
export function AppNav({ variant }: { variant: 'tabbar' }) {
  const pathname = usePathname()
  return (
    <nav className={variant} aria-label="Hoofdmenu">
      {TABS.map((tab) => (
        <Link key={tab.href} href={tab.href} aria-current={isActive(pathname, tab.href) ? 'page' : undefined}>
          <Icon name={tab.icon} size={22} />
          <span>{tab.label}</span>
        </Link>
      ))}
    </nav>
  )
}
