import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http'
import { EventEmitter } from 'node:events'
import { logger } from '../../logger'
import {
  RateLimiter,
  checkHttpRequest,
  isLoopbackHost,
  resolveBindHost
} from '../../security/guards'
import type { IngestServerConfig, RawDump, SecurityOptions, TransportStatus } from '../types'

/**
 * HTTP-first ingest transport (the recommended way to send dumps).
 *
 *   POST /dumps   JSON object or array (batch)  -> 202 { accepted }
 *   GET  /health                                 -> 200 { ok, version }
 *
 * Security: configurable bind (loopback by default), Host/Origin guard (anti
 * DNS-rebinding & browser cross-origin — the Host pin relaxes when the server is
 * network-exposed), optional token, per-IP rate limit and a hard body-size cap.
 */
export class HttpTransport extends EventEmitter {
  private server: Server | null = null
  private isRunning = false
  private activeConnections = 0
  private readonly rateLimiter: RateLimiter

  constructor(
    private readonly config: IngestServerConfig,
    private readonly getSecurity: () => SecurityOptions,
    private readonly appVersion: string
  ) {
    super()
    this.rateLimiter = new RateLimiter(getSecurity().rateLimitPerSec)
  }

  async start(): Promise<void> {
    if (this.isRunning) throw new Error('Server is already running')

    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => this.handleRequest(req, res))

      this.server.on('connection', (socket) => {
        this.activeConnections++
        socket.on('close', () => {
          this.activeConnections = Math.max(0, this.activeConnections - 1)
        })
      })

      this.server.on('error', (error: NodeJS.ErrnoException) => {
        logger.error(`HTTP server error on ${this.config.host}:${this.config.port}:`, error)
        if (error.code === 'EADDRINUSE') {
          const msg = `Port ${this.config.port} is already in use on ${this.config.host}`
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
        logger.info(`✅ HTTP transport listening on http://${bindHost}:${this.config.port}`)
        resolve()
      })
    })
  }

  async stop(): Promise<void> {
    if (!this.isRunning || !this.server) return
    return new Promise((resolve) => {
      this.server!.close(() => {
        this.isRunning = false
        this.server = null
        this.activeConnections = 0
        this.rateLimiter.clear()
        logger.info(`HTTP transport stopped on ${this.config.host}:${this.config.port}`)
        resolve()
      })
    })
  }

  getStatus(): TransportStatus {
    return {
      isRunning: this.isRunning,
      host: this.config.host,
      port: this.config.port,
      protocol: 'http',
      activeConnections: this.activeConnections
    }
  }

  private json(res: ServerResponse, status: number, body: unknown): void {
    const data = JSON.stringify(body)
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    })
    res.end(data)
  }

  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    const url = (req.url || '').split('?')[0]

    // Health check (loopback-bound; no token required).
    if (req.method === 'GET' && url === '/health') {
      this.json(res, 200, { ok: true, version: this.appVersion })
      return
    }

    if (req.method !== 'POST' || url !== '/dumps') {
      this.json(res, 404, { error: 'Not found' })
      return
    }

    // Security gate (Host/Origin/token). Pin the Host header to loopback only when
    // this server is itself loopback-bound; a network-exposed server must accept
    // LAN Host headers and leans on the token instead.
    const guard = checkHttpRequest(req, this.getSecurity(), isLoopbackHost(this.config.host))
    if (!guard.ok) {
      this.json(res, guard.status ?? 403, { error: guard.message ?? 'Forbidden' })
      return
    }

    const clientKey = req.socket.remoteAddress ?? 'unknown'
    if (!this.rateLimiter.allow(clientKey)) {
      this.json(res, 429, { error: 'Rate limit exceeded' })
      return
    }

    this.readBody(req, res)
  }

  private readBody(req: IncomingMessage, res: ServerResponse): void {
    const maxBytes = this.getSecurity().maxPayloadBytes
    const origin = `${req.socket.remoteAddress}:${req.socket.remotePort}`
    const chunks: Buffer[] = []
    let size = 0
    let aborted = false

    req.on('data', (chunk: Buffer) => {
      if (aborted) return
      size += chunk.length
      if (size > maxBytes) {
        aborted = true
        this.json(res, 413, { error: 'Payload too large' })
        req.destroy()
        return
      }
      chunks.push(chunk)
    })

    req.on('end', () => {
      if (aborted) return
      const body = Buffer.concat(chunks).toString('utf-8').trim()
      const receivedAt = Date.now()

      if (!body) {
        this.json(res, 400, { error: 'Empty body' })
        return
      }

      let parsed: unknown
      try {
        parsed = JSON.parse(body)
      } catch (error) {
        // Keep the raw text as a red-flagged dump rather than dropping it.
        this.emit('dump', {
          payload: body,
          origin,
          receivedAt,
          parseError: error instanceof Error ? error.message : 'JSON parse failed'
        } satisfies RawDump)
        this.json(res, 202, { accepted: 1 })
        return
      }

      const items = Array.isArray(parsed) ? parsed : [parsed]
      for (const item of items) {
        this.emit('dump', { payload: item, origin, receivedAt } satisfies RawDump)
      }
      this.json(res, 202, { accepted: items.length })
    })
  }
}
