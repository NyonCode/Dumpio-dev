import { timingSafeEqual } from 'node:crypto'
import type { IncomingMessage } from 'node:http'
import type { SecurityOptions } from '../ingest/types'

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0:0:0:0:0:0:0:1'])

/**
 * Constant-time token comparison. Bails on a length mismatch (that only leaks the
 * length, which is acceptable) and otherwise avoids the early-exit timing leak of
 * `===` so a network attacker can't recover the token byte-by-byte.
 */
function tokensMatch(provided: string | undefined, expected: string): boolean {
  if (typeof provided !== 'string') return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/** True when the configured host is a loopback address. */
export function isLoopbackHost(host: string): boolean {
  return LOOPBACK_HOSTS.has(host.trim().toLowerCase())
}

/** Map a user-facing host to the address we actually bind to (prefer IPv4 loopback). */
export function resolveBindHost(host: string): string {
  return host === 'localhost' ? '127.0.0.1' : host
}

/** Extract the hostname from a `Host` header value, stripping the port and IPv6 brackets. */
function hostnameFromHeader(hostHeader: string): string {
  const value = hostHeader.trim()
  // IPv6 literal: [::1]:1234
  if (value.startsWith('[')) {
    const end = value.indexOf(']')
    return end > 0 ? value.slice(1, end) : value
  }
  const colon = value.indexOf(':')
  return colon >= 0 ? value.slice(0, colon) : value
}

export interface GuardResult {
  ok: boolean
  status?: number
  message?: string
}

/**
 * Security gate for an inbound HTTP request. Blocks the classic "malicious web
 * page POSTs to a localhost service" / DNS-rebinding vector and enforces the
 * optional shared token.
 *
 * `enforceLoopbackHost` is the per-server signal: loopback-bound servers pin the
 * `Host` header to a loopback value (the browser DNS-rebinding defense). A server
 * the user has deliberately exposed to the network (`0.0.0.0`) receives legitimate
 * LAN requests whose `Host` is the machine's IP, so that pin is dropped and the
 * shared token becomes the primary control instead.
 */
export function checkHttpRequest(
  req: IncomingMessage,
  security: SecurityOptions,
  enforceLoopbackHost: boolean
): GuardResult {
  // 1) DNS-rebinding: on a loopback-bound server the Host header must resolve to
  //    loopback. Skipped for network-exposed servers (it would reject LAN clients).
  if (enforceLoopbackHost) {
    const hostHeader = req.headers.host
    if (!hostHeader || !isLoopbackHost(hostnameFromHeader(hostHeader))) {
      return { ok: false, status: 403, message: 'Invalid Host header' }
    }
  }

  // 2) Cross-origin: legitimate SDK/curl clients never send Origin; browsers do.
  if (typeof req.headers.origin === 'string' && req.headers.origin.length > 0) {
    return { ok: false, status: 403, message: 'Cross-origin requests are not allowed' }
  }
  if (req.headers['sec-fetch-site'] === 'cross-site') {
    return { ok: false, status: 403, message: 'Cross-site requests are not allowed' }
  }

  // 3) Optional shared token.
  if (security.token) {
    const auth = req.headers['authorization']
    const headerToken = req.headers['x-dumpio-token']
    const bearer =
      typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice(7) : undefined
    const provided = bearer ?? (typeof headerToken === 'string' ? headerToken : undefined)
    if (!tokensMatch(provided, security.token)) {
      return { ok: false, status: 401, message: 'Missing or invalid token' }
    }
  }

  return { ok: true }
}

/** Validate the optional token for a TCP message payload. */
export function checkTcpToken(payload: unknown, security: SecurityOptions): boolean {
  if (!security.token) return true
  if (typeof payload !== 'object' || payload === null) return false
  const token = (payload as Record<string, unknown>).token
  return tokensMatch(typeof token === 'string' ? token : undefined, security.token)
}

/** Simple fixed-window rate limiter keyed by client/connection id. */
export class RateLimiter {
  private readonly hits = new Map<string, { count: number; windowStart: number }>()

  constructor(private readonly perSec: number) {}

  allow(key: string): boolean {
    if (this.perSec <= 0) return true
    const now = Date.now()
    const entry = this.hits.get(key)
    if (!entry || now - entry.windowStart >= 1000) {
      this.hits.set(key, { count: 1, windowStart: now })
      return true
    }
    if (entry.count >= this.perSec) return false
    entry.count++
    return true
  }

  reset(key: string): void {
    this.hits.delete(key)
  }

  clear(): void {
    this.hits.clear()
  }
}
