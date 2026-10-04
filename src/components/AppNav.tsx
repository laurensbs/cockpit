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

/** The same five places as a tab bar on the phone and a sidebar on a wide screen. */
export function AppNav({ variant }: { variant: 'tabbar' | 'sidebar' }) {
  const pathname = usePathname()
  const tabs = variant === 'sidebar' ? [...TABS, { href: '/settings', label: 'Instellingen', icon: 'settings' as const }] : TABS
  return (
    <nav className={variant} aria-label="Hoofdmenu">
      {tabs.map((tab) => (
        <Link key={tab.href} href={tab.href} aria-current={isActive(pathname, tab.href) ? 'page' : undefined}>
          <Icon name={tab.icon} size={variant === 'tabbar' ? 22 : 20} />
          <span>{tab.label}</span>
        </Link>
      ))}
    </nav>
  )
}
