import { dbMode } from '@/db'
import { AddPasskeyButton } from '@/components/AddPasskeyButton'
import { Icon } from '@/components/Icon'
import { aiStatus, emailStatus, githubStatus, monthlyBudgetUsd, type ServiceStatus } from '@/server/status'

export const metadata = { title: 'Instellingen' }

function StatusChip({ status }: { status: ServiceStatus | 'neon' | 'postgres' | 'pglite' }) {
  if (status === 'live' || status === 'neon' || status === 'postgres') return <span className="chip good">Verbonden</span>
  if (status === 'fixtures') return <span className="chip warn">Testdata</span>
  if (status === 'pglite') return <span className="chip warn">Tijdelijk</span>
  return <span className="chip">Niet ingesteld</span>
}

export default function SettingsPage() {
  const db = dbMode()
  return (
    <div className="stack-l">
      <header className="stack-s">
        <h1>Instellingen</h1>
        <p className="lede">Wat er gekoppeld is. Sleutels staan alleen in Vercel, nooit in de database of in je browser.</p>
      </header>

      <section className="card stack-m">
        <div className="row between">
          <h2 className="row">
            <Icon name="branch" /> GitHub
          </h2>
          <StatusChip status={githubStatus()} />
        </div>
        <p className="muted small">
          Een fine-grained token, alleen-lezen: GitHub → Settings → Developer settings → Fine-grained tokens → Generate new token. Kies je
          eigen account, Repository access: All repositories, en bij Permissions alleen <strong>Contents: Read-only</strong> (Metadata gaat
          vanzelf mee). Zet hem in Vercel als <code>GITHUB_TOKEN</code>.
        </p>
      </section>

      <section className="card stack-m">
        <div className="row between">
          <h2 className="row">
            <Icon name="cpu" /> Claude (AI)
          </h2>
          <StatusChip status={aiStatus()} />
        </div>
        <p className="muted small">
          Maakt marketingplannen, mails, posts en ideeën. Harde limiet: <strong className="num">${monthlyBudgetUsd().toFixed(2)}</strong> per maand (
          <code>AI_MONTHLY_BUDGET_USD</code>). Zet je key als <code>ANTHROPIC_API_KEY</code> in Vercel, en stel in de Anthropic Console ook een
          maandlimiet in als tweede slot.
        </p>
      </section>

      <section className="card stack-m">
        <div className="row between">
          <h2 className="row">
            <Icon name="mail" /> E-mail (optioneel)
          </h2>
          <StatusChip status={emailStatus()} />
        </div>
        <p className="muted small">
          Voor de weekmail aan jezelf op maandag. Concepten voor anderen open je in je eigen mailapp; de cockpit verstuurt niets namens jou.
        </p>
      </section>

      <section className="card stack-m">
        <div className="row between">
          <h2 className="row">
            <Icon name="shield" /> Database
          </h2>
          <StatusChip status={db} />
        </div>
        {db === 'pglite' ? (
          <p className="notice warn small">Er is geen database gekoppeld: wat je invult, blijft niet bewaard. Zet DATABASE_URL in Vercel.</p>
        ) : (
          <p className="muted small">Je gegevens staan in je eigen Postgres-database.</p>
        )}
      </section>

      <section className="card stack-m">
        <h2 className="row">
          <Icon name="key" /> Inloggen
        </h2>
        <p className="muted small">Voeg Face ID of je vingerafdruk toe, dan hoef je geen wachtwoord meer te typen.</p>
        <AddPasskeyButton />
      </section>
    </div>
  )
}
