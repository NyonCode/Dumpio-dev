import { logger } from '../logger'
import { isLoopbackHost } from '../security/guards'
import { normalizeDump } from './normalize'
import { HttpTransport } from './transports/http-transport'
import { TcpTransport } from './transports/tcp-transport'
import type {
  Dump,
  IngestServerConfig,
  NormalizeLimits,
  RawDump,
  SecurityOptions,
  TransportStatus
} from './types'

type Transport = HttpTransport | TcpTransport

export interface IngestCallbacks {
  onDump: (dump: Dump) => void
  onError: (serverId: string, message: string) => void
  onStarted: (serverId: string) => void
  onStopped: (serverId: string) => void
}

/**
 * Owns every active transport and feeds the shared
 * Normalization -> Store/UI pipeline. Both HTTP and TCP servers flow through
 * here identically, so policy (loopback enforcement, normalization, limits)
 * lives in one place.
 */
export class IngestManager {
  private readonly transports = new Map<string, Transport>()

  constructor(
    private readonly callbacks: IngestCallbacks,
    private readonly getSecurity: () => SecurityOptions,
    private readonly getLimits: () => NormalizeLimits,
    private readonly appVersion: string
  ) {}

  private createTransport(cfg: IngestServerConfig): Transport {
    return cfg.protocol === 'tcp'
      ? new TcpTransport(cfg, this.getSecurity)
      : new HttpTransport(cfg, this.getSecurity, this.appVersion)
  }

  async startServer(cfg: IngestServerConfig): Promise<void> {
    // Network exposure is a deliberate per-server choice (host = 0.0.0.0). It is
    // only ever allowed with a shared token set — the token is the authentication
    // control once the port is reachable from the LAN. Refuse otherwise so a
    // hand-edited settings.json can't silently expose an unauthenticated port.
    if (!isLoopbackHost(cfg.host)) {
      if (!this.getSecurity().token) {
        const msg = `Refusing to start "${cfg.name}" on network-exposed host ${cfg.host} without a shared token. Set a token in Security settings.`
        logger.warn(msg)
        this.callbacks.onError(cfg.id, msg)
        throw new Error(msg)
      }
      logger.warn(
        `⚠️  "${cfg.name}" is bound to a non-loopback host (${cfg.host}); exposed to the network (token-protected).`
      )
    }

    if (this.transports.has(cfg.id)) {
      await this.stopServer(cfg.id)
    }

    // Reject port collisions across already-running transports.
    for (const transport of this.transports.values()) {
      const status = transport.getStatus()
      if (status.isRunning && status.host === cfg.host && status.port === cfg.port) {
        throw new Error(`Port ${cfg.port} is already in use on ${cfg.host}`)
      }
    }

    const transport = this.createTransport(cfg)

    transport.on('dump', (raw: RawDump) => {
      try {
        const dump = normalizeDump(raw, cfg.id, this.getLimits())
        this.callbacks.onDump(dump)
      } catch (error) {
        logger.error('Normalization failed:', error)
      }
    })

    transport.on('error', (error: Error) => {
      logger.error(`Transport "${cfg.name}" error:`, error)
      this.transports.delete(cfg.id)
      this.callbacks.onError(cfg.id, error.message)
    })

    try {
      await transport.start()
      this.transports.set(cfg.id, transport)
      logger.info(`Ingest "${cfg.name}" started (${cfg.protocol} ${cfg.host}:${cfg.port})`)
      this.callbacks.onStarted(cfg.id)
    } catch (error) {
      this.transports.delete(cfg.id)
      throw error
    }
  }

  async stopServer(serverId: string): Promise<void> {
    const transport = this.transports.get(serverId)
    if (!transport) return
    try {
      await transport.stop()
    } catch (error) {
      logger.error(`Error stopping transport ${serverId}:`, error)
    } finally {
      this.transports.delete(serverId)
      this.callbacks.onStopped(serverId)
    }
  }

  /** Reconcile running transports with the desired (active) server list. */
  async sync(oldActive: IngestServerConfig[], newActive: IngestServerConfig[]): Promise<void> {
    const oldMap = new Map(oldActive.map((s) => [s.id, s]))
    const newMap = new Map(newActive.map((s) => [s.id, s]))

    // Stop removed servers.
    for (const [id] of oldMap) {
      if (!newMap.has(id) && this.transports.has(id)) {
        await this.stopServer(id)
      }
    }

    // Start new / restart changed.
    for (const [id, next] of newMap) {
      const prev = oldMap.get(id)
      const running = this.transports.has(id)
      const changed =
        prev !== undefined &&
        (prev.host !== next.host || prev.port !== next.port || prev.protocol !== next.protocol)

      if (!running || changed) {
        if (running) {
          await this.stopServer(id)
          await new Promise((r) => setTimeout(r, 100)) // let the port release
        }
        try {
          await this.startServer(next)
        } catch (error) {
          logger.error(`Failed to (re)start "${next.name}":`, error)
        }
      }
    }
  }

  getStatuses(): Record<string, TransportStatus> {
    const out: Record<string, TransportStatus> = {}
    for (const [id, transport] of this.transports) {
      out[id] = transport.getStatus()
    }
    return out
  }

  async stopAll(): Promise<void> {
    const stops = Array.from(this.transports.keys()).map((id) => this.stopServer(id))
    await Promise.allSettled(stops)
    this.transports.clear()
  }
}
