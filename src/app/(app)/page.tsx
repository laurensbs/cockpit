import Link from 'next/link'
import { Icon } from '@/components/Icon'
import { greeting } from '@/lib/dates'
import { requireOwner } from '@/server/session'

export default async function TodayPage() {
  const owner = await requireOwner()
  return (
    <div className="stack-l">
      <section className="hero stack-m">
        <p className="eyebrow" style={{ color: '#b5f23d' }}>
          Vandaag
        </p>
        <h1>
          {greeting(new Date())}, {owner.name.split(' ')[0]}
        </h1>
        <p className="muted">Zet je projecten erin. Daarna maakt de cockpit er quests, plannen en concepten van.</p>
        <div className="row">
          <Link href="/projects" className="button xp">
            <Icon name="plus" size={18} /> Projecten toevoegen
          </Link>
          <Link href="/settings" className="button ghost" style={{ color: '#eef0ff' }}>
            Koppelingen
          </Link>
        </div>
      </section>
    </div>
  )
}
