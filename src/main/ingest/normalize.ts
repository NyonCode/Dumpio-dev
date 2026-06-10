import { randomUUID } from 'node:crypto'
import { FLAGS, type Dump, type Flag, type NormalizeLimits, type RawDump } from './types'

/** Current internal dump schema version. Bump on breaking shape changes. */
export const SCHEMA_VERSION = 1

/** Default renderer-protection limits. */
export const DEFAULT_LIMITS: NormalizeLimits = {
  maxDepth: 32,
  maxStringLength: 100_000,
  maxKeys: 2_000
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFlag(value: unknown): value is Flag {
  return typeof value === 'string' && (FLAGS as readonly string[]).includes(value)
}

/**
 * Defensively clamp an arbitrary JSON value so a hostile or accidental payload
 * (extreme depth, huge strings, thousands of keys) cannot wedge the renderer.
 * Returns a structurally similar but bounded copy.
 */
export function clampJson(value: unknown, limits: NormalizeLimits, depth = 0): unknown {
  if (depth > limits.maxDepth) {
    return '[Max depth exceeded]'
  }

  if (typeof value === 'string') {
    return value.length > limits.maxStringLength
      ? value.slice(0, limits.maxStringLength) + '…[truncated]'
      : value
  }

  if (Array.isArray(value)) {
    const clamped = value.slice(0, limits.maxKeys).map((item) => clampJson(item, limits, depth + 1))
    if (value.length > limits.maxKeys) {
      clamped.push(`…[${value.length - limits.maxKeys} more items truncated]`)
    }
    return clamped
  }

  if (isRecord(value)) {
    const out: Record<string, unknown> = {}
    const keys = Object.keys(value)
    for (const key of keys.slice(0, limits.maxKeys)) {
      out[key] = clampJson(value[key], limits, depth + 1)
    }
    if (keys.length > limits.maxKeys) {
      out['…truncated'] = `${keys.length - limits.maxKeys} more keys truncated`
    }
    return out
  }

  // number | boolean | null | undefined and anything else
  return value
}

/**
 * Turn a transport `RawDump` into a validated, renderer-ready `Dump`.
 * Unparseable input is preserved as a red-flagged `raw` dump rather than dropped.
 */
export function normalizeDump(
  raw: RawDump,
  serverId: string,
  limits: NormalizeLimits = DEFAULT_LIMITS
): Dump {
  const id = randomUUID()

  // Parse failure -> keep the raw text, flag red.
  if (raw.parseError !== undefined) {
    return {
      id,
      serverId,
      timestamp: raw.receivedAt,
      origin: raw.origin,
      payload: { type: 'raw', data: clampJson(raw.payload, limits), error: raw.parseError },
      flag: 'red',
      channel: 'default',
      schemaVersion: SCHEMA_VERSION
    }
  }

  const obj = isRecord(raw.payload) ? raw.payload : undefined

  const timestamp =
    obj && typeof obj.timestamp === 'number' && Number.isFinite(obj.timestamp)
      ? obj.timestamp
      : raw.receivedAt

  const origin = obj && typeof obj.origin === 'string' ? obj.origin : raw.origin
  const channel = obj && typeof obj.channel === 'string' && obj.channel ? obj.channel : 'default'
  const flag: Flag = obj && isFlag(obj.flag) ? obj.flag : 'gray'
  const schemaVersion =
    obj && typeof obj.schemaVersion === 'number' ? obj.schemaVersion : SCHEMA_VERSION

  return {
    id,
    serverId,
    timestamp,
    origin,
    payload: clampJson(raw.payload, limits),
    flag,
    channel,
    schemaVersion
  }
}
