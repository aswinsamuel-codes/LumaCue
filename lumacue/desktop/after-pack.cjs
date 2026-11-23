'use strict'
/**
 * electron-builder skips node_modules folders inside extraResources, but the
 * Next.js standalone server needs its own small traced node_modules. Copy it
 * into resources/app-server after packing, on every platform.
 */
const fs = require('node:fs')
const path = require('node:path')

exports.default = async function afterPack(context) {
  const { appOutDir, electronPlatformName, packager } = context
  const resources = electronPlatformName === 'darwin'
    ? path.join(appOutDir, `${packager.appInfo.productFilename}.app`, 'Contents', 'Resources')
    : path.join(appOutDir, 'resources')
  const from = path.join(__dirname, '..', '.next', 'standalone', 'node_modules')
  const to = path.join(resources, 'app-server', 'node_modules')
  if (!fs.existsSync(from)) throw new Error(`Missing ${from}: run npm run build:standalone first`)
  fs.cpSync(from, to, { recursive: true, dereference: true })
  if (!fs.existsSync(path.join(to, 'next', 'package.json'))) throw new Error('Next.js was not copied into app-server')
  console.log(`  • copied standalone node_modules  to=${path.relative(appOutDir, to)}`)
}
