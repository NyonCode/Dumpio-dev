import { createServer, type Server, type Socket } from 'node:net'
import { EventEmitter } from 'node:events'
import { logger } from '../../logger'
import { RateLimiter, checkTcpToken, resolveBindHost } from '../../security/guards'
import type { IngestServerConfig, RawDump, SecurityOptions, TransportStatus } from '../types'

/**
 * Legacy TCP ingest transport. Buffers bytes per connection and extracts
 * complete JSON objects by brace-counting (string/escape aware), so
 * pretty-printed multi-line JSON works. Emits a `RawDump` per message and
 * `error` on fatal listen errors.
 *
 * Security: bound to the configured (loopback) host, per-connection buffer cap
 * to prevent unbounded memory growth, rate limiting, and optional token.
 */
export class TcpTransport extends EventEmitter {
  private server: Server | null = null
  private isRunning = false
  private isShuttingDown = false
  private readonly connectionBuffers = new Map<string, string>()
  private readonly rateLimiter: RateLimiter

  constructor(
    private readonly config: IngestServerConfig,
    private readonly getSecurity: () => SecurityOptions
  ) {
    super()
    this.rateLimiter = new RateLimiter(getSecurity().rateLimitPerSec)
  }

  async start(): Promise<void> {
    if (this.isRunning) throw new Error('Server is already running')
    if (this.isShuttingDown) throw new Error('Server is shutting down')

    return new Promise((resolve, reject) => {
      this.server = createServer((socket) => this.handleConnection(socket))

      this.server.on('error', (error: NodeJS.ErrnoException) => {
        logger.error(`TCP server error on ${this.config.host}:${this.config.port}:`, error)
        if (error.code === 'EADDRINUSE') {
          const msg = `Port ${this.config.port} is already in use on ${this.config.host}`
          this.emit('error', new Error(msg))
          reject(new Error(msg))
        } else if (error.code === 'EADDRNOTAVAIL') {
          const msg = `Address ${this.config.host} is not available`
          this.emit('error', new Error(msg))
          reject(new Error(msg))
        } else {
          this.emit('error', error)
          reject(error)
        }
      })

      const bindHost = resolveBindHost(this.config.host)
      this.server.listen(this.config.port, bindHost, () => {
        this.isRunning = true
        logger.info(`✅ TCP transport listening on ${bindHost}:${this.config.port}`)
        resolve()
      })
    })
  }

  async stop(): Promise<void> {
    if (!this.isRunning || !this.server) return
    this.isShuttingDown = true
    return new Promise((resolve) => {
      this.server!.close(() => {
        this.isRunning = false
        this.isShuttingDown = false
        this.server = null
        this.connectionBuffers.clear()
        this.rateLimiter.clear()
        logger.info(`TCP transport stopped on ${this.config.host}:${this.config.port}`)
        resolve()
      })
    })
  }

  getStatus(): TransportStatus {
    return {
      isRunning: this.isRunning,
      host: this.config.host,
      port: this.config.port,
      protocol: 'tcp',
      activeConnections: this.connectionBuffers.size
    }
  }

  private handleConnection(socket: Socket): void {
    const connectionId = `${socket.remoteAddress}:${socket.remotePort}`
    this.connectionBuffers.set(connectionId, '')

    socket.on('data', (data) => {
      try {
        const maxBytes = this.getSecurity().maxPayloadBytes
        let buffer = (this.connectionBuffers.get(connectionId) || '') + data.toString()

        // Buffer cap: drop the connection rather than grow memory unbounded.
        if (buffer.length > maxBytes) {
          logger.warn(`TCP buffer cap exceeded from ${connectionId}; closing connection`)
          this.connectionBuffers.delete(connectionId)
          socket.destroy()
          return
        }

        const { complete, remaining } = this.extractCompleteMessages(buffer)
        for (const message of complete) {
          this.processMessage(message, connectionId)
        }
        buffer = remaining
        this.connectionBuffers.set(connectionId, buffer)
      } catch (error) {
        logger.error('Error handling TCP data:', error)
      }
    })

    socket.on('error', () => this.connectionBuffers.delete(connectionId))
    socket.on('close', () => {
      this.connectionBuffers.delete(connectionId)
      this.rateLimiter.reset(connectionId)
    })

    socket.write(
      JSON.stringify({ type: 'welcome', message: 'Connected to Dumpio', timestamp: Date.now() }) +
        '\n'
    )
  }

  private processMessage(message: string, connectionId: string): void {
    if (!this.rateLimiter.allow(connectionId)) {
      logger.warn(`Rate limit exceeded for ${connectionId}; message dropped`)
      return
    }

    const receivedAt = Date.now()
    const security = this.getSecurity()

    let parsed: unknown
    try {
      parsed = JSON.parse(message)
    } catch (error) {
      const raw: RawDump = {
        payload: message,
        origin: connectionId,
        receivedAt,
        parseError: error instanceof Error ? error.message : 'JSON parse failed'
      }
      this.emit('dump', raw)
      return
    }

    if (!checkTcpToken(parsed, security)) {
      logger.warn(`Invalid/missing token from ${connectionId}; message rejected`)
      return
    }

    const raw: RawDump = { payload: parsed, origin: connectionId, receivedAt }
    this.emit('dump', raw)
  }

  private extractCompleteMessages(buffer: string): { complete: string[]; remaining: string } {
    const complete: string[] = []
    let remaining = buffer
    let braceCount = 0
    let inString = false
    let escaped = false
    let messageStart = 0

    for (let i = 0; i < buffer.length; i++) {
      const char = buffer[i]
      if (char === '"' && !escaped) inString = !inString
      escaped = char === '\\' && !escaped

      if (!inString) {
        if (char === '{') {
          if (braceCount === 0) messageStart = i
          braceCount++
        } else if (char === '}') {
          braceCount--
          if (braceCount === 0) {
            const message = buffer.substring(messageStart, i + 1).trim()
            if (message) complete.push(message)
            messageStart = i + 1
          }
        }
      }
    }

    // Single-line JSON fallback (non pretty-printed)
    if (complete.length === 0 && braceCount === 0) {
      const lines = buffer.split('\n')
      remaining = lines.pop() || ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed && (trimmed.startsWith('{') || trimmed.startsWith('['))) {
          try {
            JSON.parse(trimmed)
            complete.push(trimmed)
          } catch {
            remaining = trimmed + '\n' + remaining
          }
        }
      }
    } else {
      remaining = buffer.substring(messageStart).trim()
    }

    return { complete, remaining }
  }
}
