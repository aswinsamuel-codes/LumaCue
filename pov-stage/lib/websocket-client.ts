/**
 * WebSocket client for hardware communication
 * Connects LumaCue dashboard to Raspberry Pi hardware controller
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
  [key: string]: any
}

export type WSCallback = (message: WSMessage) => void

class WebSocketClient {
  private ws: WebSocket | null = null
  private url: string
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 3000
  private callbacks: Set<WSCallback> = new Set()
  private pingInterval: NodeJS.Timeout | null = null
  private isConnecting = false

  constructor(url: string = 'ws://localhost:8080') {
    this.url = url
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve()
        return
      }

      if (this.isConnecting) {
        reject(new Error('Connection already in progress'))
        return
      }

      this.isConnecting = true

      try {
        this.ws = new WebSocket(this.url)

        this.ws.onopen = () => {
          this.reconnectAttempts = 0
          this.isConnecting = false
          this.startPing()
          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            const message: WSMessage = JSON.parse(event.data)
            this.handleMessage(message)
          } catch (error) {
            // Silently ignore parse errors
          }
        }

        this.ws.onerror = (error) => {
          // Silently handle connection errors - they're expected when hardware is offline
          this.isConnecting = false
        }

        this.ws.onclose = () => {
          this.isConnecting = false
          this.stopPing()
          // Silently attempt reconnect without console spam
          this.attemptReconnect()
        }
      } catch (error) {
        this.isConnecting = false
        reject(error)
      }
    })
  }

  private handleMessage(message: WSMessage) {
    // Broadcast to all registered callbacks
    this.callbacks.forEach(callback => {
      try {
        callback(message)
      } catch (error) {
        // Silently ignore callback errors
      }
    })
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      // Max attempts reached, stop trying silently
      return
    }

    this.reconnectAttempts++

    setTimeout(() => {
      this.connect().catch(() => {
        // Silently fail - hardware may not be available
      })
    }, this.reconnectDelay)
  }

  private startPing() {
    this.pingInterval = setInterval(() => {
      this.send({ action: 'ping', zone: '' })
    }, 30000) // 30 seconds
  }

  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
  }

  send(command: WSCommand): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      // Silently fail if not connected - hardware is optional
      return false
    }

    try {
      this.ws.send(JSON.stringify(command))
      return true
    } catch (error) {
      return false
    }
  }

  onMessage(callback: WSCallback) {
    this.callbacks.add(callback)
    return () => this.callbacks.delete(callback)
  }

  disconnect() {
    this.stopPing()
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  getConnectionState(): string {
    if (!this.ws) return 'disconnected'
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'connecting'
      case WebSocket.OPEN: return 'connected'
      case WebSocket.CLOSING: return 'closing'
      case WebSocket.CLOSED: return 'disconnected'
      default: return 'unknown'
    }
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
