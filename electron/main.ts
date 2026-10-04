import { spawn, type ChildProcess } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { join } from 'node:path'
import { app, BrowserWindow, dialog, Menu, nativeTheme, session, shell } from 'electron'

// The Windows app: a window around the cockpit's own local server. The server (Next.js, built as a
// standalone folder) runs as a child process on 127.0.0.1 with a token only this installation knows;
// Claude Code reaches it on the same address through MCP.

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

function startServer(port: number, config: Config, dataDir: string): ChildProcess {
  const serverDir = app.isPackaged ? join(process.resourcesPath, 'server') : join(app.getAppPath(), 'release', 'server')
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
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: 'Cockpit',
        submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'quit' }],
      },
    ]),
  )

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
}

app.on('window-all-closed', () => app.quit())
app.on('before-quit', () => {
  server?.kill()
})

main().catch((error: unknown) => {
  dialog.showErrorBox('Cockpit kon niet starten', error instanceof Error ? error.message : String(error))
  app.exit(1)
})
