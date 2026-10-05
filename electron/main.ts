import { spawn, type ChildProcess } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { appendFileSync, createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { app, BrowserWindow, dialog, Menu, nativeTheme, Notification, session, shell, type MenuItemConstructorOptions } from 'electron'
import { loginShellPath, mergePath } from './path'

// The desktop app (Mac and Windows): a window around the cockpit's own local server. The server
// (Next.js, built as a standalone folder) runs as a child process on 127.0.0.1 with a token only this
// installation knows; Claude Code reaches it on the same address through MCP.

const DEFAULT_PORT = 41414
const TOKEN_COOKIE = 'cockpit'

app.setName('Cockpit')
if (process.platform === 'win32') app.setAppUserModelId('app.cockpit.desktop')
if (process.env.COCKPIT_USER_DATA) app.setPath('userData', process.env.COCKPIT_USER_DATA)

interface Config {
  token: string
  port: number
}

/** The token and port of this installation: made once, kept in the user's data folder. */
function loadConfig(dir: string): Config {
  const file = join(dir, 'config.json')
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as Partial<Config>
    if (typeof parsed.token === 'string' && parsed.token.length >= 16) return { token: parsed.token, port: Number(parsed.port) || DEFAULT_PORT }
  } catch {
    // First start, or an unreadable file: make a new one.
  }
  const config: Config = { token: randomBytes(24).toString('base64url'), port: DEFAULT_PORT }
  mkdirSync(dir, { recursive: true })
  writeFileSync(file, JSON.stringify(config, null, 2))
  return config
}

const canListen = (port: number) =>
  new Promise<boolean>((resolve) => {
    const probe = createServer()
    probe.once('error', () => resolve(false))
    probe.listen(port, '127.0.0.1', () => probe.close(() => resolve(true)))
  })

/** Whether a cockpit server answers at this address. */
async function alive(base: string): Promise<boolean> {
  try {
    const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(1500) })
    return res.ok && ((await res.json()) as { ok?: boolean }).ok === true
  } catch {
    return false
  }
}

/**
 * The usual port first, so a port it moved to once (because an old server was still there) does not stick;
 * then the next free one. A cockpit server still running from before is used as it is.
 */
async function pickPort(config: Config): Promise<{ port: number; reuse: boolean }> {
  for (let port = Math.min(config.port, DEFAULT_PORT), tries = 0; tries < 10; port++, tries++) {
    if (await canListen(port)) return { port, reuse: false }
    if (await alive(`http://127.0.0.1:${port}`)) return { port, reuse: true }
  }
  throw new Error('Geen vrije poort gevonden')
}

/**
 * The binary that runs the server as plain Node. On a Mac that is the app's Helper: started from the
 * main binary, macOS counts the server as a second Cockpit, and one left behind blocks the next start.
 */
function nodeBinary(): string {
  if (process.platform !== 'darwin' || !app.isPackaged) return process.execPath
  const name = app.getName()
  const helper = join(process.execPath, '..', '..', 'Frameworks', `${name} Helper.app`, 'Contents', 'MacOS', `${name} Helper`)
  return existsSync(helper) ? helper : process.execPath
}

function startServer(port: number, config: Config, dataDir: string): ChildProcess {
  const serverDir = app.isPackaged ? join(process.resourcesPath, 'server') : join(app.getAppPath(), 'release', 'server')
  const script = join(serverDir, 'server.js')
  if (!existsSync(script)) throw new Error(`De server ontbreekt: ${script}`)
  const logDir = join(dataDir, 'logs')
  mkdirSync(logDir, { recursive: true })
  const log = createWriteStream(join(logDir, 'server.log'), { flags: 'a' })
  log.write(`\n[${new Date().toISOString()}] start on 127.0.0.1:${port}\n`)
  const child = spawn(nodeBinary(), [script], {
    cwd: serverDir,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      PORT: String(port),
      HOSTNAME: '127.0.0.1',
      COCKPIT_TOKEN: config.token,
      PGLITE_DIR: join(dataDir, 'db'),
      COCKPIT_PACKAGED: app.isPackaged ? '1' : '0',
      COCKPIT_VERSION: app.getVersion(),
    },
  })
  child.stdout?.pipe(log)
  child.stderr?.pipe(log)
  return child
}

const EXTERNAL = /^(https?:|mailto:)/i

async function openWindow(base: string, token: string): Promise<BrowserWindow> {
  // The window carries the token in a cookie, the way the page's own requests expect it.
  await session.defaultSession.cookies.set({
    url: base,
    name: TOKEN_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'strict',
    expirationDate: Math.floor(Date.now() / 1000) + 365 * 86_400,
  })
  // Tells the pages they live in the Mac window, so the top bar makes room for the traffic lights.
  const mac = process.platform === 'darwin'
  await session.defaultSession.cookies.set({ url: base, name: 'cockpit_shell', value: mac ? 'mac' : 'desktop', sameSite: 'strict', expirationDate: Math.floor(Date.now() / 1000) + 365 * 86_400 })
  const icon = join(app.getAppPath(), 'resources', 'icon.png')
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 720,
    minHeight: 560,
    title: 'Cockpit',
    show: false,
    autoHideMenuBar: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0a0c1b' : '#f3f4fa',
    // On the Mac the traffic lights sit in the cockpit's own top bar, like a native app.
    ...(mac ? { titleBarStyle: 'hiddenInset' as const, trafficLightPosition: { x: 18, y: 23 } } : {}),
    ...(existsSync(icon) ? { icon } : {}),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  win.once('ready-to-show', () => win.show())
  // Anything outside the cockpit (a project's site, "Open in mail") opens in the system's own apps.
  const outside = (url: string) => {
    if (url.startsWith(`${base}/`) || url === base) return false
    if (EXTERNAL.test(url)) void shell.openExternal(url)
    return true
  }
  win.webContents.setWindowOpenHandler(({ url }) => {
    outside(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (outside(url)) event.preventDefault()
  })
  await win.loadURL(`${base}/`)
  return win
}

/** A line in logs/app.log: what the window process did, for when something goes wrong. */
function appLog(message: string): void {
  try {
    const dir = join(app.getPath('userData'), 'logs')
    mkdirSync(dir, { recursive: true })
    appendFileSync(join(dir, 'app.log'), `[${new Date().toISOString()}] ${message}\n`)
  } catch {
    // Logging must never stop the app.
  }
}

let server: ChildProcess | null = null
let win: BrowserWindow | null = null
/** Where the window points, kept so the Dock icon can open it again after he closed it. */
let opened: { base: string; token: string } | null = null

/** A window being made, so a second click (Dock, notification) waits for it instead of making another. */
let opening: Promise<BrowserWindow> | null = null

/** Open the window (again): on a Mac, closing it leaves Cockpit running in the Dock, reading on. */
async function showWindow(path?: string) {
  if (win) {
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  } else {
    if (!opened) return
    if (!opening) {
      opening = openWindow(opened.base, opened.token)
        .then((made) => {
          win = made
          made.on('closed', () => {
            win = null
          })
          return made
        })
        .finally(() => {
          opening = null
        })
    }
    await opening
  }
  if (path && opened && win) await win.loadURL(`${opened.base}${path}`)
}

/** Shown notifications, held on to: one that is garbage collected forgets its click. */
const notes = new Set<Notification>()

/**
 * The daily nudge: the server says when (a working day, his time, day goal still open, once a day); the
 * app shows it as a Mac notification. A click opens the lesson.
 */
async function remind(base: string, token: string) {
  try {
    const res = await fetch(`${base}/api/reminder`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return
    const data = (await res.json()) as { show: boolean; title?: string; body?: string; sound?: boolean }
    if (!data.show || !Notification.isSupported()) return
    const note = new Notification({ title: data.title ?? 'Cockpit', body: data.body ?? '', silent: !data.sound })
    notes.add(note)
    note.on('click', () => {
      notes.delete(note)
      void showWindow('/dag')
    })
    note.on('close', () => notes.delete(note))
    note.show()
    appLog('reminder shown')
  } catch {
    // A missed minute is fine: the next one asks again.
  }
}

async function main() {
  if (!app.requestSingleInstanceLock()) {
    app.quit()
    return
  }
  app.on('second-instance', () => void showWindow())
  app.on('activate', () => void showWindow())
  await app.whenReady()
  // On a Mac the Edit menu is what makes Cmd+C, Cmd+V and Cmd+A work in the window.
  const view: MenuItemConstructorOptions = {
    label: 'Weergave',
    submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }],
  }
  // Starting with the Mac keeps Cockpit up to date all day; he switches it on himself, here.
  const appMenu: MenuItemConstructorOptions = {
    label: 'Cockpit',
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      {
        label: 'Start bij inloggen',
        type: 'checkbox',
        checked: app.getLoginItemSettings().openAtLogin,
        click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
      },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideOthers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' },
    ],
  }
  Menu.setApplicationMenu(
    Menu.buildFromTemplate(
      process.platform === 'darwin'
        ? [appMenu, { role: 'editMenu' }, view, { role: 'windowMenu' }]
        : [{ label: 'Cockpit', submenu: [{ role: 'quit' }] }, { role: 'editMenu' }, view],
    ),
  )
  // A Mac app started from Finder has a bare PATH; give the server the one a terminal has, so it finds claude and gh.
  if (process.platform === 'darwin') process.env.PATH = mergePath(homedir(), await loginShellPath(), process.env.PATH)

  const dataDir = app.getPath('userData')
  const config = loadConfig(dataDir)
  let base: string
  let token: string
  if (process.env.COCKPIT_DEV_URL) {
    // Development: `next dev` is already running; just open it.
    base = process.env.COCKPIT_DEV_URL.replace(/\/$/, '')
    token = process.env.COCKPIT_TOKEN ?? 'dev'
  } else {
    const { port, reuse } = await pickPort(config)
    if (port !== config.port) {
      config.port = port
      writeFileSync(join(dataDir, 'config.json'), JSON.stringify(config, null, 2))
    }
    base = `http://127.0.0.1:${port}`
    token = config.token
    if (!reuse) server = startServer(port, config, dataDir)
    const started = Date.now()
    while (!(await alive(base))) {
      if ((server && server.exitCode != null) || Date.now() - started > 60_000) {
        dialog.showErrorBox('Cockpit kon niet starten', `De lokale server reageert niet. Kijk in ${join(dataDir, 'logs', 'server.log')}.`)
        app.exit(1)
        return
      }
      await new Promise((resolve) => setTimeout(resolve, 300))
    }
  }

  opened = { base, token }
  await showWindow()

  // The daily round: shortly after the start, then every twelve hours while the app is open.
  const daily = () => fetch(`${base}/api/daily`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => undefined)
  setTimeout(daily, 15_000)
  setInterval(daily, 12 * 60 * 60 * 1000)
  // The daily reminder: asked every minute, shown at most once a day.
  setTimeout(() => void remind(base, token), 45_000)
  setInterval(() => void remind(base, token), 60_000)
}

// On a Mac the app stays in the Dock when the window closes, so GitHub, the outbox and the daily round
// keep going; Cmd+Q quits. Elsewhere closing the window quits.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
// Wait for the server to close its database before the app goes; force it after five seconds. The
// quit is held once and then finished with app.exit: on a Mac a second app.quit() after a held quit
// is cancelled by the system, and the window would stay without its server.
app.on('before-quit', (event) => {
  const child = server
  appLog(`before-quit (server ${child ? `pid ${child.pid}, exit ${child.exitCode}, signal ${child.signalCode}` : 'none'})`)
  if (!child || child.exitCode != null || child.signalCode != null) return
  event.preventDefault()
  server = null
  const force = setTimeout(() => {
    appLog('server still running after 5 s: SIGKILL')
    child.kill('SIGKILL')
  }, 5000)
  child.once('exit', (code, signal) => {
    clearTimeout(force)
    appLog(`server stopped (code ${code}, signal ${signal}); app.exit`)
    app.exit(0)
    // After a held quit macOS can keep the window process alive even after app.exit: end it ourselves.
    setTimeout(() => process.exit(0), 1000).unref()
  })
  appLog(`SIGTERM to server: ${child.kill('SIGTERM')}`)
})
app.on('will-quit', () => appLog('will-quit'))

main().catch((error: unknown) => {
  dialog.showErrorBox('Cockpit kon niet starten', error instanceof Error ? error.message : String(error))
  app.exit(1)
})
