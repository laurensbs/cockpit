import { AutopilotToggle } from '@/components/AutopilotToggle'
import { ChannelSettings } from '@/components/ChannelSettings'
import { ConnectClaudeButton } from '@/components/ConnectClaudeButton'
import { ContentAutopilotToggle } from '@/components/ContentAutopilotToggle'
import { CopyButton } from '@/components/CopyButton'
import { Icon } from '@/components/Icon'
import { KeepAwakeToggle } from '@/components/KeepAwakeToggle'
import { MailSettingsForm } from '@/components/MailSettingsForm'
import { SettingsForm } from '@/components/SettingsForm'
import { GoogleAccountForm, PullAllButton } from '@/components/SourceSettings'
import { UpdateNowButton } from '@/components/UpdateNowButton'
import { asc, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import Link from 'next/link'
import { dbDir, dbMode, getDb } from '@/db'
import * as s from '@/db/schema'
import { expectedToken } from '@/lib/local'
import { claudeInstallCommand } from '@/lib/terminal'
import { dayLabel, dayOf } from '@/lib/dates'
import { ago } from '@/lib/time'
import { claudeVersion, connectCommand, desktopConfig, mcpUrl } from '@/server/claude'
import { connectorKind } from '@/server/connectors'
import { googleAccountEmail } from '@/server/connectors/google'
import { accounts, connectionStamp } from '@/server/publish/accounts'
import { redirectUri } from '@/server/publish/oauth'
import { isPaused } from '@/server/publish/run'
import { keepAwakeOn, lastAwake } from '@/server/keep-awake'
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
  const [{ token, from }, stored, version, connectedAt, mail, autopilot, contentAutopilot, googleEmail, awake, sources] = await Promise.all([
    githubTokenSource(db, owner.userId),
    getSetting(db, owner.userId, 'github_token'),
    claudeVersion(),
    getSetting(db, owner.userId, 'claude_connected'),
    mailConfig(db, owner.userId),
    getSetting(db, owner.userId, 'autopilot_weekly'),
    getSetting(db, owner.userId, 'autopilot_content'),
    googleAccountEmail(db, owner.userId),
    keepAwakeOn(db, owner.userId),
    db
      .select({ id: s.connector.id, kind: s.connector.kind, lastOkAt: s.connector.lastOkAt, lastError: s.connector.lastError, projectId: s.project.id, project: s.project.name })
      .from(s.connector)
      .innerJoin(s.project, eq(s.project.id, s.connector.projectId))
      .where(eq(s.connector.ownerId, owner.userId))
      .orderBy(asc(s.project.name), asc(s.connector.kind)),
  ])
  const now = new Date()
  const failing = sources.filter((c) => c.lastError).length
  const port = (await headers()).get('host')?.match(/:(\d+)$/)?.[1] ?? process.env.PORT ?? '41414'
  const projects = await db.select({ id: s.project.id, name: s.project.name }).from(s.project).where(eq(s.project.ownerId, owner.userId)).orderBy(asc(s.project.sortOrder), asc(s.project.name))
  const [liApp, liAccount, ttApp, blobToken, paused] = await Promise.all([
    accounts.linkedinApp(db, owner.userId),
    accounts.linkedin(db, owner.userId),
    accounts.tiktokApp(db, owner.userId),
    accounts.blobToken(db, owner.userId),
    isPaused(db, owner.userId),
  ])
  const perProject = await Promise.all(projects.map(async (p) => ({ p, ig: await accounts.instagram(db, owner.userId, p.id), tt: await accounts.tiktok(db, owner.userId, p.id) })))
  const until = (iso: string) => dayLabel(dayOf(new Date(iso)))
  const channels = {
    paused,
    stamp: await connectionStamp(db, owner.userId, projects.map((p) => p.id)),
    projects,
    linkedin: { clientId: liApp?.clientId ?? '', appSet: Boolean(liApp), account: liAccount ? { name: liAccount.name, until: until(liAccount.expiresAt) } : null, redirect: redirectUri('linkedin', port) },
    instagram: { blobSet: Boolean(blobToken), accounts: perProject.filter((x) => x.ig).map((x) => ({ projectId: x.p.id, project: x.p.name, username: x.ig!.username, until: until(x.ig!.expiresAt) })) },
    tiktok: { clientKey: ttApp?.clientKey ?? '', appSet: Boolean(ttApp), accounts: perProject.filter((x) => x.tt).map((x) => ({ projectId: x.p.id, project: x.p.name, name: x.tt!.name })), redirect: redirectUri('tiktok', port) },
  }
  const awakeNow = lastAwake()
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

      <section className="card stack-m" id="claude">
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
          <p className="tiny muted">
            De app koppelt Claude Code vanzelf zodra hij het vindt, en opnieuw als het adres van de cockpit verandert. De knop hieronder doet hetzelfde met de hand.
          </p>
        ) : null}
        {version ? <AutopilotToggle on={autopilot === '1'} /> : null}
        {version ? <ContentAutopilotToggle on={contentAutopilot === '1'} /> : null}
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

      <section className="card stack-m" id="awake">
        <div className="row between">
          <h2 className="row">
            <Icon name="bolt" /> Aan laten staan
          </h2>
          {awakeNow === 'awake' ? (
            <span className="chip good">Blijft wakker</span>
          ) : awakeNow === 'battery' ? (
            <span className="chip warn">Op de accu</span>
          ) : awakeNow === 'off' ? (
            <span className="chip">Uit</span>
          ) : null}
        </div>
        <p className="muted small">
          De dagelijkse ronde, de mails die je goedkeurde en de koppeling met Claude Code draaien op deze computer. Laat de cockpit open en de computer aan de
          stroom, dan gaat het door terwijl jij weg bent.
        </p>
        <KeepAwakeToggle on={awake} />
        {process.platform === 'darwin' ? (
          <p className="tiny muted">Op een MacBook: laat de klep open. Met de klep dicht slaapt hij toch, behalve met een extern scherm, toetsenbord en de stroom erin.</p>
        ) : null}
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
          values={{ host: mail.host, port: mail.port, secure: mail.secure, user: mail.user, hasPass: Boolean(mail.pass), fromName: mail.fromName, fromEmail: mail.fromEmail, cap: mail.cap, enabled: mail.enabled }}
        />
      </section>

      <section className="card stack-m" id="channels">
        <div className="row between">
          <h2 className="row">
            <Icon name="send" /> Kanalen
          </h2>
          {channels.paused ? <span className="chip warn">Op pauze</span> : null}
        </div>
        <p className="muted small">
          Waar de cockpit plaatst wat jij in de Contentweek goedkeurt: op je eigen accounts, op de dag en tijd van de post, overdag, met een maximum per kanaal per dag. Zonder koppeling plaats je zelf, met de knoppen bij de post.
        </p>
        <ChannelSettings view={channels} />
      </section>

      <section className="card stack-m" id="sources">
        <div className="row between">
          <h2 className="row">
            <Icon name="chart" /> Bronnen
          </h2>
          {sources.length ? <span className={`chip ${failing ? 'bad' : 'good'}`}>{failing ? `${failing} met een fout` : `${sources.length} gekoppeld`}</span> : <span className="chip">Nog geen</span>}
        </div>
        <p className="muted small">
          De cijfers die de cockpit elke dag zelf ophaalt: bezoek, zoekverkeer, betalingen, je Discord en je eigen apps. Je koppelt een bron per project, onder
          Cijfers. Elke sleutel kan alleen lezen en blijft op deze computer; de cockpit bewaart alleen tellingen, geen klantgegevens.
        </p>
        {sources.length ? (
          <ul className="list" style={{ margin: 0 }}>
            {sources.map((c) => (
              <li key={c.id} className="row between">
                <span className="row">
                  <Link href={`/projects/${c.projectId}/numbers`}>
                    <strong>{c.project}</strong>
                  </Link>
                  <span>{connectorKind(c.kind)?.label ?? c.kind}</span>
                </span>
                {c.lastError ? (
                  <span className="tiny" style={{ color: 'var(--bad)' }}>
                    {c.lastError}
                  </span>
                ) : c.lastOkAt ? (
                  <span className="tiny muted">opgehaald {ago(c.lastOkAt, now)}</span>
                ) : (
                  <span className="tiny muted">nog niet opgehaald</span>
                )}
              </li>
            ))}
          </ul>
        ) : null}
        {sources.length ? <PullAllButton /> : null}
        <div className="stack-s">
          <div className="row between">
            <span className="label">Google-service-account</span>
            {googleEmail ? <span className="chip good">Ingesteld</span> : <span className="chip">Niet ingesteld</span>}
          </div>
          <p className="tiny muted">
            Eén account voor Google Analytics 4 en Search Console, voor al je projecten. Google Cloud Console → IAM → Serviceaccounts → Account maken → Sleutels →
            Sleutel toevoegen → JSON. Zet in dat project de Google Analytics Data API en de Google Search Console API aan. Geef het e-mailadres van het account daarna
            leesrechten: in GA4 als Kijker, in Search Console als beperkte gebruiker.
          </p>
          <GoogleAccountForm email={googleEmail} />
        </div>
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
