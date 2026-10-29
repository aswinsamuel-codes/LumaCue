/**
 * WebSocket client for hardware communication
 * Connects LumaCue dashboard to the hand band hardware controller.
 * Reconnects on its own (forever, with back-off) and reports its status,
 * so the UI always shows the real link state.
 */

export type WSCommand = {
  zone: string
  action: 'setMode' | 'setColor' | 'toggle' | 'setSpeed' | 'emergencyOff' | 'syncAll' | 'getStatus' | 'ping'
  mode?: 'Static' | 'Pulse' | 'Flash'
  color?: string
  speed?: number
  enabled?: boolean
}

export type WSMessage = {
  type: 'connection' | 'response' | 'error' | 'log' | 'gpio_status' | 'pong'
  [key: string]: unknown
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

export type WSCallback = (message: WSMessage) => void
export type StatusCallback = (status: ConnectionStatus) => void

const PING_INTERVAL_MS = 10000
const SILENCE_LIMIT_MS = 25000     // no message (not even a pong) for this long = dead link
const RECONNECT_MIN_MS = 2000
const RECONNECT_MAX_MS = 15000

class WebSocketClient {
  private ws: WebSocket | null = null
  private url: string
  private reconnectAttempts = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private callbacks: Set<WSCallback> = new Set()
  private statusCallbacks: Set<StatusCallback> = new Set()
  private pingInterval: ReturnType<typeof setInterval> | null = null
  private lastMessageAt = 0
  private status: ConnectionStatus = 'disconnected'
  private stopped = false

  constructor(url: string = 'ws://localhost:8080') {
    this.url = url
  }

  /** Starts connecting; keeps retrying in the background until disconnect() is called. */
  connect() {
    this.stopped = false
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return

    this.clearReconnectTimer()
    this.setStatus('connecting')

    let ws: WebSocket
    try {
      ws = new WebSocket(this.url)
    } catch {
      this.scheduleReconnect()
      return
    }
    this.ws = ws

    ws.onopen = () => {
      this.reconnectAttempts = 0
      this.lastMessageAt = Date.now()
      this.startPing()
      this.setStatus('connected')
    }

    ws.onmessage = (event) => {
      this.lastMessageAt = Date.now()
      let message: WSMessage
      try {
        message = JSON.parse(event.data)
      } catch {
        return
      }
      this.callbacks.forEach((callback) => {
        try {
          callback(message)
        } catch {
          // A failing listener must not break the others.
        }
      })
    }

    // Errors are always followed by onclose, which handles the reconnect.
    ws.onerror = () => {}

    ws.onclose = () => {
      if (this.ws !== ws) return
      this.ws = null
      this.stopPing()
      this.setStatus('disconnected')
      if (!this.stopped) this.scheduleReconnect()
    }
  }

  /** Skip the back-off wait and try again now (e.g. user clicked the status badge). */
  reconnectNow() {
    this.reconnectAttempts = 0
    this.connect()
  }

  private scheduleReconnect() {
    this.clearReconnectTimer()
    const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_MIN_MS * 2 ** Math.min(this.reconnectAttempts, 3))
    this.reconnectAttempts++
    this.reconnectTimer = setTimeout(() => this.connect(), delay)
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private startPing() {
    this.stopPing()
    this.pingInterval = setInterval(() => {
      // Wi-Fi drops often don't fire onclose for a long time; treat silence as a dead link.
      if (Date.now() - this.lastMessageAt > SILENCE_LIMIT_MS) {
        this.ws?.close()
        return
      }
      this.send({ action: 'ping', zone: '' })
    }, PING_INTERVAL_MS)
  }

  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
  }

  private setStatus(status: ConnectionStatus) {
    if (status === this.status) return
    this.status = status
    this.statusCallbacks.forEach((callback) => callback(status))
  }

  send(command: WSCommand): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false
    try {
      this.ws.send(JSON.stringify(command))
      return true
    } catch {
      return false
    }
  }

  onMessage(callback: WSCallback) {
    this.callbacks.add(callback)
    return () => this.callbacks.delete(callback)
  }

  onStatusChange(callback: StatusCallback) {
    this.statusCallbacks.add(callback)
    return () => this.statusCallbacks.delete(callback)
  }

  disconnect() {
    this.stopped = true
    this.clearReconnectTimer()
    this.stopPing()
    this.ws?.close()
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  getConnectionState(): ConnectionStatus {
    return this.status
  }
}

// Singleton instance
let wsClient: WebSocketClient | null = null

export function getWebSocketClient(url?: string): WebSocketClient {
  if (!wsClient) {
    wsClient = new WebSocketClient(url)
  }
  return wsClient
}

export default WebSocketClient
