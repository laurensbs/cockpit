import { ConnectClaudeButton } from '@/components/ConnectClaudeButton'
import { CopyButton } from '@/components/CopyButton'
import { Icon } from '@/components/Icon'
import { SettingsForm } from '@/components/SettingsForm'
import { UpdateNowButton } from '@/components/UpdateNowButton'
import { dbDir, dbMode, getDb } from '@/db'
import { expectedToken } from '@/lib/local'
import { claudeVersion, connectCommand, desktopConfig, mcpUrl } from '@/server/claude'
import { requireOwner } from '@/server/session'
import { getSetting, githubToken } from '@/server/settings'
import { githubStatus, type ServiceStatus } from '@/server/status'

export const metadata = { title: 'Instellingen' }

function StatusChip({ status }: { status: ServiceStatus }) {
  if (status === 'live') return <span className="chip good">Gekoppeld</span>
  if (status === 'fixtures') return <span className="chip warn">Testdata</span>
  return <span className="chip">Niet ingesteld</span>
}

export default async function SettingsPage() {
  const owner = await requireOwner('/settings')
  const db = await getDb()
  const [token, stored, version, connectedAt] = await Promise.all([
    githubToken(db, owner.userId),
    getSetting(db, owner.userId, 'github_token'),
    claudeVersion(),
    getSetting(db, owner.userId, 'claude_connected'),
  ])
  const github = githubStatus(token)
  const appToken = expectedToken() ?? ''
  const steps = [
    { done: Boolean(owner.name), label: 'Je naam' },
    { done: github !== 'off', label: 'GitHub-token' },
    { done: Boolean(connectedAt), label: 'Claude Code gekoppeld' },
  ]
  const todo = steps.filter((s) => !s.done)

  return (
    <div className="stack-l">
      <header className="stack-s">
        <h1>Instellingen</h1>
        <p className="lede">Alles staat op deze computer. Claude Code werkt met je eigen account; de cockpit stuurt zelf nergens iets heen.</p>
      </header>

      {todo.length ? (
        <section className="notice stack-xs">
          <strong>Nog {todo.length === 1 ? 'één stap' : `${todo.length} stappen`} en de cockpit is compleet</strong>
          <ul className="row" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {steps.map((s) => (
              <li key={s.label} className={`chip${s.done ? ' good' : ''}`}>
                {s.done ? '✓ ' : ''}
                {s.label}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="card stack-m">
        <div className="row between">
          <h2 className="row">
            <Icon name="cpu" /> Claude Code
          </h2>
          {version ? <span className="chip good">Gevonden · {version}</span> : <span className="chip warn">Niet gevonden</span>}
        </div>
        <p className="muted small">
          Claude Code is het brein van de cockpit. Elke knop (profiel, plan, mails, posts, ideeën, kansen, weekfocus) opent Claude Code met de
          taak; Claude leest het project via de cockpit en zet het resultaat hier terug. Dat loopt op je eigen Claude-abonnement, zonder
          API-kosten.
        </p>
        {version ? (
          <ConnectClaudeButton connectedAt={connectedAt} />
        ) : (
          <p className="notice warn small">
            Installeer Claude Code (in PowerShell: <code>irm https://claude.ai/install.ps1 | iex</code>), log in met je Claude-account, en open deze
            pagina daarna opnieuw.
          </p>
        )}
        <details>
          <summary className="label">Zelf koppelen, of de Claude-desktop-app</summary>
          <div className="stack-m" style={{ marginTop: '0.8rem' }}>
            <div className="stack-xs">
              <p className="tiny muted">Claude Code, in een terminal:</p>
              <code className="codeblock">{connectCommand(appToken)}</code>
              <CopyButton text={connectCommand(appToken)} label="Kopieer het commando" />
            </div>
            <div className="stack-xs">
              <p className="tiny muted">
                Claude-desktop-app: Instellingen → Developer → Edit config, en voeg dit toe aan <code>claude_desktop_config.json</code>:
              </p>
              <code className="codeblock">{desktopConfig(appToken)}</code>
              <CopyButton text={desktopConfig(appToken)} label="Kopieer de configuratie" />
            </div>
            <p className="tiny muted">
              Adres van de cockpit: <code>{mcpUrl()}</code>. De toegangscode hoort bij deze installatie en blijft op deze computer.
            </p>
          </div>
        </details>
      </section>

      <section className="card stack-m">
        <h2 className="row">
          <Icon name="key" /> Jij en GitHub
        </h2>
        <SettingsForm name={owner.name} hasToken={Boolean(stored)} status={<StatusChip status={github} />} />
        <p className="muted small">
          Een fine-grained token, alleen-lezen: GitHub → Settings → Developer settings → Fine-grained tokens → Generate new token. Kies je eigen
          account, Repository access: All repositories, en bij Permissions alleen <strong>Contents: Read-only</strong> (Metadata gaat vanzelf mee).
          De token blijft op deze computer.
        </p>
      </section>

      <section className="card stack-m">
        <div className="row between">
          <h2 className="row">
            <Icon name="shield" /> Gegevens
          </h2>
          <span className="chip good">Lokaal</span>
        </div>
        <p className="muted small">
          {dbMode() === 'memory' ? (
            'De database staat in het geheugen (test): niets blijft bewaard.'
          ) : (
            <>
              Je gegevens staan in <code>{dbDir()}</code>. Maak daar af en toe een kopie van.
            </>
          )}
        </p>
        <UpdateNowButton />
      </section>
    </div>
  )
}
