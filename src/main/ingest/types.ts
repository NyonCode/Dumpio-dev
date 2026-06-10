/**
 * Shared types for the ingest pipeline:
 *   Transport (HTTP/TCP)  ->  Normalization  ->  Store  ->  UI bridge
 *
 * Transports stay dumb: they accept bytes and emit a `RawDump`. All business
 * shaping (id/timestamp/flag/channel, validation, limits) happens in the
 * normalization layer, so both protocols behave identically downstream.
 */

export type Protocol = 'http' | 'tcp'

export const FLAGS = ['red', 'yellow', 'blue', 'gray', 'purple', 'pink', 'green'] as const
export type Flag = (typeof FLAGS)[number]

/** Configuration of a single ingest endpoint (subset of a settings `Server`). */
export interface IngestServerConfig {
  id: string
  name: string
  host: string
  port: number
  protocol: Protocol
}

/** Security policy applied by every transport. */
export interface SecurityOptions {
  /** Optional shared token; empty string disables auth. */
  token: string
  /** Hard cap on a single request/message body. */
  maxPayloadBytes: number
  /** Max accepted messages per second per client/connection. */
  rateLimitPerSec: number
}

/** Limits enforced while normalizing a payload (renderer protection). */
export interface NormalizeLimits {
  maxDepth: number
  maxStringLength: number
  maxKeys: number
}

/** What a transport emits for every received message. */
export interface RawDump {
  /** Parsed JSON value, or the raw string when parsing failed. */
  payload: unknown
  /** Remote identity, e.g. "127.0.0.1:54213". */
  origin: string
  receivedAt: number
  /** Set when the body could not be parsed as JSON. */
  parseError?: string
}

export interface TransportStatus {
  isRunning: boolean
  host: string
  port: number
  protocol: Protocol
  activeConnections: number
}

/** A fully normalized, renderer-ready dump. */
export interface Dump {
  id: string
  serverId: string
  timestamp: number
  origin: string
  payload: unknown
  flag: Flag
  channel: string
  schemaVersion: number
}
