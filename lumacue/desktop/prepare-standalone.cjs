'use strict'
/**
 * After `next build`, copy the files the standalone server does not include by
 * itself (browser assets and public/) into .next/standalone, so the folder can
 * run on its own. Used by the desktop app and the Docker image.
 */
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
const standalone = path.join(root, '.next', 'standalone')
if (!fs.existsSync(path.join(standalone, 'server.js'))) {
  console.error('No .next/standalone/server.js: run `next build` first (output: "standalone").')
  process.exit(1)
}
fs.cpSync(path.join(root, '.next', 'static'), path.join(standalone, '.next', 'static'), { recursive: true })
fs.cpSync(path.join(root, 'public'), path.join(standalone, 'public'), { recursive: true })
console.log('standalone server ready:', path.relative(root, standalone))
