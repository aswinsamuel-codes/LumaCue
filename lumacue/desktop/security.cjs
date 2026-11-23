'use strict'
/**
 * Security policy for the LumaCue desktop shell, kept as pure functions so it
 * can be unit-tested (tests/desktop-security.test.ts).
 */

/** Browser permissions Show Studio needs. Everything else (camera, mic, geolocation, notifications…) is refused. */
const ALLOWED_PERMISSIONS = new Set(['serial', 'clipboard-sanitized-write', 'fullscreen'])

/** Hosts the app may show inside the window (YouTube's embedded player for the music dock). */
const ALLOWED_FRAME_HOSTS = new Set(['www.youtube.com', 'www.youtube-nocookie.com', 'youtube.com'])

function parse(url) {
  try {
    return new URL(url)
  } catch {
    return null
  }
}

/** True only for URLs served by our own local Show Studio server. */
function isAppUrl(url, appOrigin) {
  const u = parse(url)
  return !!u && !!appOrigin && u.origin === appOrigin
}

/** Links that may be handed to the system browser: plain https only (no file:, smb:, ms-*: or custom protocols). */
function isSafeExternal(url) {
  const u = parse(url)
  return !!u && u.protocol === 'https:' && !u.username && !u.password
}

function isAllowedPermission(permission, requestingUrl, appOrigin) {
  return ALLOWED_PERMISSIONS.has(permission) && isAppUrl(requestingUrl, appOrigin)
}

function isAllowedFrame(url, appOrigin) {
  const u = parse(url)
  if (!u) return false
  if (u.protocol === 'about:') return true
  return isAppUrl(url, appOrigin) || (u.protocol === 'https:' && ALLOWED_FRAME_HOSTS.has(u.hostname))
}

/**
 * The local server only answers requests addressed to itself. This blocks DNS
 * rebinding, where a web page in some other browser points its own domain at
 * 127.0.0.1 to read our responses.
 */
function isAllowedHost(hostHeader, port) {
  return hostHeader === `127.0.0.1:${port}` || hostHeader === `localhost:${port}`
}

const WEB_PREFERENCES = Object.freeze({
  contextIsolation: true,
  nodeIntegration: false,
  nodeIntegrationInSubFrames: false,
  sandbox: true,
  webSecurity: true,
  allowRunningInsecureContent: false,
  experimentalFeatures: false,
  webviewTag: false,
  spellcheck: false,
})

module.exports = {
  ALLOWED_PERMISSIONS,
  WEB_PREFERENCES,
  isAppUrl,
  isSafeExternal,
  isAllowedPermission,
  isAllowedFrame,
  isAllowedHost,
}
