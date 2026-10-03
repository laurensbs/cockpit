import Link from 'next/link'

export type ProjectTab = 'overview' | 'quests'

const TABS: { key: ProjectTab; label: string; path: string }[] = [
  { key: 'overview', label: 'Overzicht', path: '' },
  { key: 'quests', label: 'Quests', path: '/quests' },
]

/** The parts of a project page. */
export function ProjectTabs({ projectId, active }: { projectId: string; active: ProjectTab }) {
  if (TABS.length < 2) return null
  return (
    <nav className="segmented" aria-label="Onderdelen" style={{ overflowX: 'auto', maxWidth: '100%' }}>
      {TABS.map((t) => (
        <Link key={t.key} href={`/projects/${projectId}${t.path}`} aria-current={t.key === active ? 'page' : undefined}>
          {t.label}
        </Link>
      ))}
    </nav>
  )
}
