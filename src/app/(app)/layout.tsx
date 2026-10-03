import Link from 'next/link'
import { AppNav } from '@/components/AppNav'
import { Logo } from '@/components/Logo'
import { SignOutButton } from '@/components/SignOutButton'
import { APP_NAME } from '@/lib/site'
import { requireOwner } from '@/server/session'

// AI jobs run after the response (after()); they may take a few minutes. Pages inherit this.
export const maxDuration = 300

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireOwner()
  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/" className="brand">
          <Logo />
          {APP_NAME}
        </Link>
        <div className="grow" />
        <SignOutButton />
      </header>
      <AppNav variant="sidebar" />
      <main id="main" className="main">
        {children}
      </main>
      <AppNav variant="tabbar" />
    </div>
  )
}
