import Link from 'next/link'
import { AppNav } from '@/components/AppNav'
import { CelebrationProvider } from '@/components/CelebrationProvider'
import { Logo } from '@/components/Logo'
import { SignOutButton } from '@/components/SignOutButton'
import { TopStats } from '@/components/TopStats'
import { getDb } from '@/db'
import { playerStats } from '@/server/game'
import { APP_NAME } from '@/lib/site'
import { requireOwner } from '@/server/session'

// AI jobs run after the response (after()); they may take a few minutes. Pages inherit this.
export const maxDuration = 300

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const owner = await requireOwner()
  const stats = await playerStats(await getDb(), owner.userId)
  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/" className="brand">
          <Logo />
          {APP_NAME}
        </Link>
        <div className="grow" />
        <TopStats stats={stats} />
        <SignOutButton />
      </header>
      <AppNav variant="sidebar" />
      <main id="main" className="main">
        <CelebrationProvider>{children}</CelebrationProvider>
      </main>
      <AppNav variant="tabbar" />
    </div>
  )
}
