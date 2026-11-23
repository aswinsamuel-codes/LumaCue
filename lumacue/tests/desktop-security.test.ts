import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const policy = require('../desktop/security.cjs')
const APP = 'http://127.0.0.1:51234'

describe('desktop security policy', () => {
  it('only treats our own local server as the app', () => {
    expect(policy.isAppUrl(`${APP}/`, APP)).toBe(true)
    expect(policy.isAppUrl(`${APP}/api/firmware?board=nano`, APP)).toBe(true)
    expect(policy.isAppUrl('http://127.0.0.1:51235/', APP)).toBe(false)       // other local port
    expect(policy.isAppUrl('http://localhost.evil.com:51234/', APP)).toBe(false)
    expect(policy.isAppUrl('https://example.com', APP)).toBe(false)
    expect(policy.isAppUrl('not a url', APP)).toBe(false)
    expect(policy.isAppUrl(`${APP}/`, '')).toBe(false)                         // before the server is up
  })

  it('hands only plain https links to the system browser', () => {
    expect(policy.isSafeExternal('https://github.com/aswinsamuel-codes/LumaCue')).toBe(true)
    for (const bad of ['file:///C:/Windows/System32/calc.exe', 'ms-msdt:/id', 'smb://host/share',
      'javascript:alert(1)', 'http://example.com', 'https://user:pass@example.com', 'vscode://x']) {
      expect(policy.isSafeExternal(bad), bad).toBe(false)
    }
  })

  it('grants only the permissions Show Studio needs, and only to the app', () => {
    expect(policy.isAllowedPermission('serial', `${APP}/`, APP)).toBe(true)
    expect(policy.isAllowedPermission('clipboard-sanitized-write', `${APP}/`, APP)).toBe(true)
    for (const p of ['media', 'geolocation', 'notifications', 'openExternal', 'hid', 'usb', 'midiSysex']) {
      expect(policy.isAllowedPermission(p, `${APP}/`, APP), p).toBe(false)
    }
    expect(policy.isAllowedPermission('serial', 'https://www.youtube.com/embed/x', APP)).toBe(false)
  })

  it('allows only YouTube and the app itself inside frames', () => {
    expect(policy.isAllowedFrame('https://www.youtube.com/embed/abc', APP)).toBe(true)
    expect(policy.isAllowedFrame('about:blank', APP)).toBe(true)
    expect(policy.isAllowedFrame('https://evil.example/', APP)).toBe(false)
    expect(policy.isAllowedFrame('http://www.youtube.com/embed/abc', APP)).toBe(false)
  })

  it('blocks DNS-rebinding requests by Host header', () => {
    expect(policy.isAllowedHost('127.0.0.1:51234', 51234)).toBe(true)
    expect(policy.isAllowedHost('localhost:51234', 51234)).toBe(true)
    expect(policy.isAllowedHost('attacker.example:51234', 51234)).toBe(false)
    expect(policy.isAllowedHost(undefined, 51234)).toBe(false)
    expect(policy.isAllowedHost('127.0.0.1:80', 51234)).toBe(false)
  })

  it('locks down every window', () => {
    const w = policy.WEB_PREFERENCES
    expect(w).toMatchObject({ contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true,
      webviewTag: false, allowRunningInsecureContent: false })
    expect(Object.isFrozen(w)).toBe(true)
  })

  it('main process binds the server to loopback and never enables Node in pages', () => {
    const main = readFileSync(path.join(__dirname, '..', 'desktop', 'main.cjs'), 'utf8')
    expect(main).toMatch(/listen\(0, '127\.0\.0\.1'/)
    expect(main).not.toMatch(/nodeIntegration:\s*true/)
    expect(main).not.toMatch(/contextIsolation:\s*false/)
    expect(main).not.toMatch(/webSecurity:\s*false/)
    expect(main).toMatch(/enableSandbox\(\)/)
  })
})

describe('no hard-coded access code left in the app', () => {
  it('LoginPage no longer contains a plaintext password', () => {
    const src = readFileSync(path.join(__dirname, '..', 'components', 'LoginPage.tsx'), 'utf8')
    expect(src).not.toContain('admin.lumacue')
    expect(src).not.toMatch(/password\s*===\s*['"]/)
  })
})
