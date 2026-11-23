'use strict'
// Exposes only a read-only flag to the page. No Node or Electron APIs reach the renderer.
const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('lumacueDesktop', Object.freeze({ isDesktop: true }))
