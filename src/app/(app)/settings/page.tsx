import { AutopilotToggle } from '@/components/AutopilotToggle'
import { ConnectClaudeButton } from '@/components/ConnectClaudeButton'
import { CopyButton } from '@/components/CopyButton'
import { Icon } from '@/components/Icon'
import { MailSettingsForm } from '@/components/MailSettingsForm'
import { ReminderSettings } from '@/components/ReminderSettings'
import { SoundToggle } from '@/components/SoundToggle'
import { SettingsForm } from '@/components/SettingsForm'
import { UpdateNowButton } from '@/components/UpdateNowButton'
import { dbDir, dbMode, getDb } from '@/db'
import { expectedToken } from '@/lib/local'
import { reminderTime } from '@/lib/reminder'
import { claudeInstallCommand } from '@/lib/terminal'
import { claudeVersion, connectCommand, desktopConfig, mcpUrl } from '@/server/claude'
import { mailConfig } from '@/server/outbox'
import { requireOwner } from '@/server/session'
import { getSetting, githubTokenSource } from '@/server/settings'
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
  const [{ token, from }, stored, version, connectedAt, mail, autopilot, coldMail, reminder, reminderSound] = await Promise.all([
    githubTokenSource(db, owner.userId),
    getSetting(db, owner.userId, 'github_token'),
    claudeVersion(),
    getSetting(db, owner.userId, 'claude_connected'),
    mailConfig(db, owner.userId),
    getSetting(db, owner.userId, 'autopilot_weekly'),
    getSetting(db, owner.userId, 'cold_mail_ok'),
    getSetting(db, owner.userId, 'reminder_time'),
    getSetting(db, owner.userId, 'reminder_sound'),
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
        <p className="lede">Alles staat op deze computer. Cockpit verstuurt alleen mails die jij goedkeurde, vanaf je eigen mailbox.</p>
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

      <section className="card stack-m" id="claude">
        <div className="row between">
          <h2 className="row">
            <Icon name="cpu" /> Claude Code
          </h2>
          {version ? <span className="chip good">Gevonden · {version}</span> : <span className="chip warn">Niet gevonden</span>}
        </div>
        <p className="muted small">Claude doet het denkwerk, op je eigen Claude-abonnement. Zonder koppeling werkt geen enkele Claude-knop.</p>
        {version ? (
          <p className="tiny muted">
            De app koppelt Claude Code vanzelf zodra hij het vindt, en opnieuw als het adres van de cockpit verandert. De knop hieronder doet hetzelfde met de hand.
          </p>
        ) : null}
        {version ? <AutopilotToggle on={autopilot !== '0'} /> : null}
        <SoundToggle />
        <ReminderSettings time={reminderTime(reminder)} sound={reminderSound === '1'} />
        {version ? (
          <ConnectClaudeButton connectedAt={connectedAt} />
        ) : (
          <p className="notice warn small">
            Installeer Claude Code ({process.platform === 'win32' ? 'in PowerShell' : 'in Terminal'}: <code>{claudeInstallCommand(process.platform)}</code>), log in met je Claude-account, en open deze
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

      <section className="card stack-m" id="mail">
        <div className="row between">
          <h2 className="row">
            <Icon name="mail" /> Mails versturen
          </h2>
          {mail.ready && mail.enabled ? <span className="chip good">Aan</span> : mail.ready ? <span className="chip warn">Uit</span> : <span className="chip">Niet ingesteld</span>}
        </div>
        <p className="muted small">
          De cockpit verstuurt alleen mails die jij hebt goedgekeurd, vanaf je eigen mailbox, naar zakelijke adressen van organisaties of mensen die
          ermee instemden. Elke mail heeft een afmeldregel. Het wachtwoord blijft op deze computer; gebruik waar het kan een app-wachtwoord.
        </p>
        <MailSettingsForm
          values={{ host: mail.host, port: mail.port, secure: mail.secure, user: mail.user, hasPass: Boolean(mail.pass), fromName: mail.fromName, fromEmail: mail.fromEmail, cap: mail.cap, enabled: mail.enabled, coldMail: coldMail === '1' }}
        />
      </section>

      <section className="card stack-m" id="you">
        <h2 className="row">
          <Icon name="key" /> Jij en GitHub
        </h2>
        <SettingsForm name={owner.name} hasToken={Boolean(stored)} status={<StatusChip status={github} />} />
        {from === 'gh' ? <p className="tiny muted">De cockpit gebruikt nu je login van de GitHub CLI (gh). Een eigen token hierboven gaat voor.</p> : null}
        <p className="muted small">
          Een fine-grained token, alleen-lezen: GitHub → Settings → Developer settings → Fine-grained tokens → Generate new token. Kies je eigen
          account, Repository access: All repositories, en bij Permissions alleen <strong>Contents: Read-only</strong> (Metadata gaat vanzelf mee).
          De token blijft op deze computer. Heb je de GitHub CLI (<code>gh</code>) en ben je daar ingelogd, dan werkt het ook zonder token.
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
