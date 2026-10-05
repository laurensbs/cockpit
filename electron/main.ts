import { spawn, type ChildProcess } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { app, BrowserWindow, dialog, Menu, nativeTheme, powerMonitor, powerSaveBlocker, session, shell, type MenuItemConstructorOptions } from 'electron'
import { type AwakeStatus, awakeStatus } from './keep-awake'
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

/** The configured port, or the next free one. A cockpit server still running from before is used as it is. */
async function pickPort(config: Config): Promise<{ port: number; reuse: boolean }> {
  for (let port = config.port, tries = 0; tries < 10; port++, tries++) {
    if (await canListen(port)) return { port, reuse: false }
    if (await alive(`http://127.0.0.1:${port}`)) return { port, reuse: true }
  }
  throw new Error('Geen vrije poort gevonden')
}

/** The ffmpeg that ships with the app (for videos), if this build has one. */
function bundledFfmpeg(): string | null {
  const dir = app.isPackaged ? join(process.resourcesPath, 'ffmpeg') : join(app.getAppPath(), 'release', 'ffmpeg')
  const exe = join(dir, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg')
  return existsSync(exe) ? exe : null
}

function startServer(port: number, config: Config, dataDir: string): ChildProcess {
  const serverDir = app.isPackaged ? join(process.resourcesPath, 'server') : join(app.getAppPath(), 'release', 'server')
  const ffmpeg = bundledFfmpeg()
  const script = join(serverDir, 'server.js')
  if (!existsSync(script)) throw new Error(`De server ontbreekt: ${script}`)
  const logDir = join(dataDir, 'logs')
  mkdirSync(logDir, { recursive: true })
  const log = createWriteStream(join(logDir, 'server.log'), { flags: 'a' })
  log.write(`\n[${new Date().toISOString()}] start on 127.0.0.1:${port}\n`)
  const child = spawn(process.execPath, [script], {
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
      ...(ffmpeg ? { COCKPIT_FFMPEG: ffmpeg } : {}),
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

let server: ChildProcess | null = null
let win: BrowserWindow | null = null

async function main() {
  if (!app.requestSingleInstanceLock()) {
    app.quit()
    return
  }
  app.on('second-instance', () => {
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.focus()
  })
  await app.whenReady()
  // On a Mac the Edit menu is what makes Cmd+C, Cmd+V and Cmd+A work in the window.
  const view: MenuItemConstructorOptions = {
    label: 'Weergave',
    submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }],
  }
  Menu.setApplicationMenu(
    Menu.buildFromTemplate(
      process.platform === 'darwin'
        ? [{ role: 'appMenu' }, { role: 'editMenu' }, view, { role: 'windowMenu' }]
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

  win = await openWindow(base, token)
  win.on('closed', () => {
    win = null
  })

  // The daily round: shortly after the start, then every twelve hours while the app is open.
  const daily = () => fetch(`${base}/api/daily`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => undefined)
  setTimeout(daily, 15_000)
  setInterval(daily, 12 * 60 * 60 * 1000)

  keepAwake(base, token)
}

/**
 * "Aan laten staan": every minute, and whenever the power source changes, the app asks the cockpit
 * whether he wants the computer awake and tells it what it does. On mains power the computer then does
 * not go to sleep (the display may); on the battery it sleeps as usual.
 */
function keepAwake(base: string, token: string) {
  let wanted = true
  let blocker: number | null = null
  let reported: AwakeStatus | null = null
  const apply = () => {
    const status = awakeStatus(wanted, powerMonitor.isOnBatteryPower())
    if (status === 'awake' && blocker == null) blocker = powerSaveBlocker.start('prevent-app-suspension')
    if (status !== 'awake' && blocker != null) {
      powerSaveBlocker.stop(blocker)
      blocker = null
    }
    return status
  }
  const check = async () => {
    try {
      const res = await fetch(`${base}/api/keep-awake`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: reported ?? awakeStatus(wanted, powerMonitor.isOnBatteryPower()) }),
      })
      if (res.ok) wanted = Boolean(((await res.json()) as { on?: unknown }).on)
    } catch {
      // The server is restarting; keep the last choice.
    }
    const status = apply()
    if (status !== reported) {
      reported = status
      void check()
    }
  }
  void check()
  setInterval(() => void check(), 60_000)
  powerMonitor.on('on-ac', () => void check())
  powerMonitor.on('on-battery', () => void check())
}

app.on('window-all-closed', () => app.quit())
app.on('before-quit', () => {
  server?.kill()
})

main().catch((error: unknown) => {
  dialog.showErrorBox('Cockpit kon niet starten', error instanceof Error ? error.message : String(error))
  app.exit(1)
})
