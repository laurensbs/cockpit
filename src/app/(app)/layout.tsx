import { asc, eq } from 'drizzle-orm'
import Link from 'next/link'
import { AppNav } from '@/components/AppNav'
import { CelebrationProvider } from '@/components/CelebrationProvider'
import { CommandBar } from '@/components/CommandBar'
import { Logo } from '@/components/Logo'
import { Sidebar } from '@/components/Sidebar'
import { TopStats } from '@/components/TopStats'
import { UpdateBanner } from '@/components/UpdateBanner'
import { getDb } from '@/db'
import * as s from '@/db/schema'
import { ACTIVE_STAGES, isStage } from '@/lib/options'
import { APP_NAME } from '@/lib/site'
import { playerStats } from '@/server/game'
import { requireOwner } from '@/server/session'
import { claudeState } from '@/server/setup'
import { availableUpdate } from '@/server/update'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const owner = await requireOwner()
  const db = await getDb()
  const [stats, rows, claude, update] = await Promise.all([
    playerStats(db, owner.userId),
    db
      .select({ id: s.project.id, name: s.project.name, stage: s.project.stage, color: s.company.color })
      .from(s.project)
      .leftJoin(s.company, eq(s.company.id, s.project.companyId))
      .where(eq(s.project.ownerId, owner.userId))
      .orderBy(asc(s.project.sortOrder), asc(s.project.name)),
    claudeState(db, owner.userId),
    availableUpdate(),
  ])
  const projects = rows.filter((p) => isStage(p.stage) && ACTIVE_STAGES.includes(p.stage)).map(({ id, name, color }) => ({ id, name, color }))
  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/" className="brand">
          <Logo />
          {APP_NAME}
        </Link>
        <CommandBar projects={projects.map(({ id, name }) => ({ id, name }))} />
        <div className="grow" />
        <TopStats stats={stats} />
      </header>
      <Sidebar projects={projects} claude={claude} version={process.env.COCKPIT_VERSION ?? null} />
      <main id="main" className="main">
        {update ? <UpdateBanner update={update} /> : null}
        <CelebrationProvider>{children}</CelebrationProvider>
      </main>
      <AppNav variant="tabbar" />
    </div>
  )
}
