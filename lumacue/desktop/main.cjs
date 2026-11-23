'use strict'
/**
 * LumaCue desktop: runs Show Studio as a native app.
 *
 * 1. Shows the animated splash at once.
 * 2. Starts the Next.js production server inside this process, bound to
 *    127.0.0.1 on a free port (never reachable from the network).
 * 3. Opens Show Studio in a sandboxed window and closes the splash.
 *
 * Dev mode: run `npm run dev`, then `npm run desktop:dev` (loads http://localhost:3000).
 */
const { app, BrowserWindow, Menu, dialog, session, shell } = require('electron')
const http = require('node:http')
const path = require('node:path')
const policy = require('./security.cjs')

const APP_DIR = path.join(__dirname, '..')
// Dev mode only from an unpackaged checkout, so an installed app can't be pointed at another server.
const DEV_URL = app.isPackaged ? '' : (process.env.LUMACUE_DEV_URL || (process.argv.includes('--dev') ? 'http://localhost:3000' : ''))
const MIN_SPLASH_MS = 2200

let appOrigin = ''
let mainWindow = null
let splash = null
let server = null

if (!app.requestSingleInstanceLock()) {
  app.quit()
}
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})
app.enableSandbox()

function createSplash() {
  splash = new BrowserWindow({
    width: 460, height: 460, frame: false, transparent: true, resizable: false, movable: true,
    alwaysOnTop: true, skipTaskbar: true, show: false, backgroundColor: '#00000000',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: { ...policy.WEB_PREFERENCES },
  })
  splash.loadFile(path.join(__dirname, 'splash.html'))
  splash.once('ready-to-show', () => splash && splash.show())
}

async function startServer() {
  process.env.LUMACUE_FIRMWARE_DIR = app.isPackaged
    ? path.join(process.resourcesPath, 'firmware')
    : path.join(APP_DIR, '..', 'firmware')
  if (DEV_URL) return DEV_URL

  process.env.NODE_ENV = 'production'
  // The trimmed Next.js standalone server: bundled as resources/app-server in the
  // installer, or .next/standalone after `npm run build:standalone` in a checkout.
  const dir = app.isPackaged ? path.join(process.resourcesPath, 'app-server') : path.join(APP_DIR, '.next', 'standalone')
  const { config } = JSON.parse(require('node:fs').readFileSync(path.join(dir, '.next', 'required-server-files.json'), 'utf8'))
  process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(config)
  const next = require(path.join(dir, 'node_modules', 'next'))
  const nextApp = next({ dev: false, dir, hostname: '127.0.0.1', conf: config })
  await nextApp.prepare()
  const handle = nextApp.getRequestHandler()
  let port = 0
  server = http.createServer((req, res) => {
    if (!policy.isAllowedHost(req.headers.host, port)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' })
      res.end('Forbidden')
      return
    }
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Referrer-Policy', 'no-referrer')
    handle(req, res)
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  port = server.address().port
  return `http://127.0.0.1:${port}`
}

function hardenSession(ses) {
  ses.setPermissionRequestHandler((wc, permission, callback, details) => {
    callback(policy.isAllowedPermission(permission, details.requestingUrl || wc.getURL(), appOrigin))
  })
  ses.setPermissionCheckHandler((wc, permission, requestingOrigin) =>
    policy.isAllowedPermission(permission, requestingOrigin, appOrigin))
  ses.setDevicePermissionHandler((details) => details.deviceType === 'serial' && details.origin === appOrigin)

  // Web Serial: let the operator pick the base station's USB port.
  ses.on('select-serial-port', async (event, portList, wc, callback) => {
    event.preventDefault()
    if (!portList.length) {
      dialog.showMessageBox(mainWindow, { type: 'warning', message: 'No USB serial devices found.',
        detail: 'Plug in the base station and press CONNECT USB again.' })
      callback('')
      return
    }
    const labels = portList.map((p) => p.displayName ? `${p.displayName} (${p.portName})` : p.portName)
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'question', title: 'Connect base station', message: 'Which USB port is the base station on?',
      buttons: [...labels, 'Cancel'], cancelId: labels.length, noLink: true,
    })
    callback(response < portList.length ? portList[response].portId : '')
  })
}

function createMainWindow(url) {
  mainWindow = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1100, minHeight: 700, show: false,
    backgroundColor: '#0A0A0A', title: 'LumaCue', icon: path.join(__dirname, 'icon.png'),
    webPreferences: { ...policy.WEB_PREFERENCES, preload: path.join(__dirname, 'preload.cjs') },
  })
  mainWindow.on('closed', () => { mainWindow = null })
  return mainWindow.loadURL(url)
}

// Applies to every window and frame the app ever creates.
app.on('web-contents-created', (_e, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    if (policy.isSafeExternal(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  contents.on('will-navigate', (event, url) => {
    if (!policy.isAppUrl(url, appOrigin) && !url.startsWith('file://')) {
      event.preventDefault()
      if (policy.isSafeExternal(url)) shell.openExternal(url)
    }
  })
  contents.on('will-frame-navigate', (event) => {
    if (!event.isMainFrame && !policy.isAllowedFrame(event.url, appOrigin)) event.preventDefault()
  })
  contents.on('will-attach-webview', (event) => event.preventDefault())
})

function buildMenu() {
  const view = [{ role: 'reload' }, { role: 'togglefullscreen' }, { type: 'separator' },
    { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }]
  if (!app.isPackaged) view.push({ type: 'separator' }, { role: 'toggleDevTools' })
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'File', submenu: [{ role: 'quit' }] },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' },
      { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'View', submenu: view },
    { label: 'Help', submenu: [
      { label: 'LumaCue on GitHub', click: () => shell.openExternal('https://github.com/aswinsamuel-codes/LumaCue') },
      { label: `Version ${app.getVersion()}`, enabled: false },
    ] },
  ]))
}

// Smoke test: LUMACUE_SMOKE_DIR=<folder> saves screenshots of the
// splash and the main window, then quits. Used to check a build without a person watching.
const SMOKE_DIR = process.env.LUMACUE_SMOKE_DIR || ''
async function shoot(win, name) {
  if (!SMOKE_DIR || !win || win.isDestroyed()) return
  const img = await win.webContents.capturePage()
  require('node:fs').writeFileSync(path.join(SMOKE_DIR, `${name}.png`), img.toPNG())
}

app.whenReady().then(async () => {
  const started = Date.now()
  createSplash()
  if (SMOKE_DIR) setTimeout(() => shoot(splash, 'splash'), 1400)
  buildMenu()
  try {
    const url = await startServer()
    appOrigin = new URL(url).origin
    hardenSession(session.defaultSession)
    await createMainWindow(url)
    const wait = Math.max(0, MIN_SPLASH_MS - (Date.now() - started))
    setTimeout(() => {
      if (mainWindow) mainWindow.show()
      if (splash) { splash.close(); splash = null }
      if (SMOKE_DIR) {
        setTimeout(async () => {
          await shoot(mainWindow, 'login')
          const r = await mainWindow.webContents.executeJavaScript(
            `JSON.stringify({ title: document.title, desktop: !!window.lumacueDesktop, node: typeof require,
               serial: 'serial' in navigator, text: document.body.innerText.slice(0, 200) })`)
          const fw = await mainWindow.webContents.executeJavaScript(
            `fetch('/api/firmware?board=nano').then(r => r.status + ':' + Object.keys(r.ok ? {} : {}).length)`)
          const rebind = await new Promise((resolve) => {
            const req = http.get({ host: '127.0.0.1', port: new URL(appOrigin).port, path: '/', headers: { Host: 'evil.example' } },
              (res) => { res.resume(); resolve(res.statusCode) })
            req.on('error', (e) => resolve(String(e)))
          })
          require('node:fs').writeFileSync(path.join(SMOKE_DIR, 'report.json'),
            JSON.stringify({ page: JSON.parse(r), firmware: fw, dnsRebindingStatus: rebind, origin: appOrigin }, null, 2))
          app.quit()
        }, 4500)
      }
    }, wait)
  } catch (err) {
    if (splash) { splash.close(); splash = null }
    dialog.showErrorBox('LumaCue could not start', String(err && err.stack || err))
    app.quit()
  }
})

app.on('window-all-closed', () => {
  if (server) server.close()
  app.quit()
})
