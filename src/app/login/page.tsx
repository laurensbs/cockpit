import { count } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { AuthForm } from '@/components/AuthForm'
import { Logo } from '@/components/Logo'
import { getDb } from '@/db'
import * as s from '@/db/schema'
import { APP_NAME, safeNext } from '@/lib/site'
import { getOwner } from '@/server/session'

export const metadata = { title: 'Inloggen' }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next)
  if (await getOwner()) redirect(next)
  const db = await getDb()
  const [{ n }] = await db.select({ n: count() }).from(s.user)
  return (
    <div className="auth">
      <div className="card stack-l">
        <div className="stack-s">
          <Logo size={48} />
          <h1>{APP_NAME}</h1>
          <p className="muted">Al je projecten, marketing en quests op één plek.</p>
        </div>
        <AuthForm next={next} firstTime={n === 0} />
      </div>
    </div>
  )
}
