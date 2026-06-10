import { FileLocation, DumpTypeInfo, DumpMetric } from './types'

function rec(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)

  if (diffSecs < 5) return 'now'
  if (diffSecs < 60) return `${diffSecs}s ago`
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export function getPayloadSize(payload: unknown): number {
  const jsonString = JSON.stringify(payload)
  return new Blob([jsonString ?? '']).size
}

export function extractFileAndLine(payload: unknown): FileLocation | null {
  const p = rec(payload)
  if (typeof p.file === 'string' && typeof p.line === 'number') {
    return { file: p.file, line: p.line }
  }
  if (Array.isArray(p.trace) && p.trace[0]) {
    const first = rec(p.trace[0])
    if (typeof first.file === 'string' && typeof first.line === 'number') {
      return { file: first.file, line: first.line }
    }
  }
  if (typeof p.origin === 'string') {
    const match = p.origin.match(/(.+):(\d+)$/)
    if (match) {
      return { file: match[1], line: parseInt(match[2]) }
    }
  }
  return null
}

export type DumpKind =
  | 'exception'
  | 'var'
  | 'sql'
  | 'http'
  | 'log'
  | 'performance'
  | 'event'
  | 'model'
  | 'collection'
  | 'table'
  | 'measure'
  | 'data'

/**
 * Cheap, allocation-free classification used by the list and type filter.
 * Exception detection mirrors ExceptionParser.isException so the "exceptions"
 * filter stays consistent with what the detail panel parses. The richer Ray-style
 * types (C3) are recognized by their explicit `type` hint only — they have no
 * reliable heuristic and `event`/`log` would otherwise collide (both carry an
 * `event` field).
 */
export function getDumpType(payload: unknown): DumpKind {
  const p = rec(payload)
  const t = typeof p.type === 'string' ? p.type : undefined

  // Unified value tree (C1): explicit, so it never falls into "data".
  if (t === 'var' && p.value && typeof p.value === 'object') return 'var'

  if (t === 'model') return 'model'
  if (t === 'collection') return 'collection'
  if (t === 'table') return 'table'
  if (t === 'measure') return 'measure'
  if (t === 'performance') return 'performance'
  if (t === 'event') return 'event'

  if (
    t === 'exception' ||
    'exception' in p ||
    'error' in p ||
    'stack' in p ||
    'stackTrace' in p ||
    'trace' in p
  ) {
    return 'exception'
  }
  if (t === 'query' || p.sql) return 'sql'
  if (t === 'http' || p.method || p.url) return 'http'
  if (t === 'log' || p.level) return 'log'
  return 'data'
}

const DUMP_TYPE_INFO: Record<DumpKind, DumpTypeInfo> = {
  exception: { icon: 'error', type: 'Exception', color: 'text-red-600 dark:text-red-400' },
  var: { icon: 'var', type: 'Var Dump', color: 'text-teal-600 dark:text-teal-400' },
  sql: { icon: 'sql', type: 'SQL Query', color: 'text-blue-600 dark:text-blue-400' },
  http: { icon: 'http', type: 'HTTP Request', color: 'text-purple-600 dark:text-purple-400' },
  log: { icon: 'log', type: 'Log Entry', color: 'text-amber-600 dark:text-amber-400' },
  performance: {
    icon: 'cpu',
    type: 'Performance',
    color: 'text-cyan-600 dark:text-cyan-400'
  },
  event: { icon: 'event', type: 'Event', color: 'text-emerald-600 dark:text-emerald-400' },
  model: { icon: 'model', type: 'Model', color: 'text-indigo-600 dark:text-indigo-400' },
  collection: {
    icon: 'collection',
    type: 'Collection',
    color: 'text-violet-600 dark:text-violet-400'
  },
  table: { icon: 'table', type: 'Table', color: 'text-sky-600 dark:text-sky-400' },
  measure: { icon: 'clock', type: 'Measure', color: 'text-rose-600 dark:text-rose-400' },
  data: { icon: 'data', type: 'Data Dump', color: 'text-slate-600 dark:text-slate-400' }
}

export function getDumpTypeInfo(payload: unknown): DumpTypeInfo {
  return DUMP_TYPE_INFO[getDumpType(payload)]
}

export function getDumpTitle(payload: unknown): string {
  if (typeof payload === 'string') return payload.substring(0, 100)
  const p = rec(payload)
  const message = asString(p.message)
  if (message) return message
  const label = asString(p.label)
  if (label) return label
  const title = asString(p.title)
  if (title) return title
  const name = asString(p.name)
  if (name) return name
  const event = asString(p.event)
  if (event) return event
  const sql = asString(p.sql)
  if (sql) return sql.substring(0, 80) + (sql.length > 80 ? '...' : '')
  const exception = asString(p.exception)
  if (exception) return exception
  const error = asString(p.error)
  if (error) return error
  const url = asString(p.url)
  const method = asString(p.method)
  if (url && method) return `${method} ${url}`
  const type = asString(p.type)
  if (type) return type.charAt(0).toUpperCase() + type.slice(1)
  return 'Data Dump'
}

export function getDumpMetrics(payload: unknown): DumpMetric[] {
  const p = rec(payload)
  const metrics: DumpMetric[] = []

  if (p.sql && p.time !== undefined) {
    const time = parseFloat(String(p.time))
    metrics.push({
      label: 'Query Time',
      value: `${time}ms`,
      color:
        time > 1000
          ? 'text-red-600 dark:text-red-400'
          : time > 100
            ? 'text-amber-600 dark:text-amber-400'
            : 'text-emerald-600 dark:text-emerald-400',
      icon: 'clock'
    })
  }

  if (Array.isArray(p.bindings) && p.bindings.length > 0) {
    metrics.push({
      label: 'Bindings',
      value: p.bindings.length.toString(),
      color: 'text-blue-600 dark:text-blue-400',
      icon: 'hash'
    })
  }

  const level = asString(p.level)
  if (level) {
    const levelColors: Record<string, string> = {
      error: 'text-red-600 dark:text-red-400',
      warning: 'text-amber-600 dark:text-amber-400',
      info: 'text-blue-600 dark:text-blue-400',
      debug: 'text-slate-600 dark:text-slate-400'
    }
    metrics.push({
      label: 'Level',
      value: level.toUpperCase(),
      color: levelColors[level] || 'text-slate-600 dark:text-slate-400',
      icon: 'log'
    })
  }

  if (p.status !== undefined) {
    const status = parseInt(String(p.status))
    const statusColor =
      status >= 500
        ? 'text-red-600 dark:text-red-400'
        : status >= 400
          ? 'text-amber-600 dark:text-amber-400'
          : status >= 300
            ? 'text-blue-600 dark:text-blue-400'
            : 'text-emerald-600 dark:text-emerald-400'
    metrics.push({ label: 'Status', value: status.toString(), color: statusColor, icon: 'http' })
  }

  if (p.memory !== undefined) {
    const memory = parseInt(String(p.memory))
    metrics.push({
      label: 'Memory',
      value: formatBytes(memory),
      color: 'text-purple-600 dark:text-purple-400',
      icon: 'cpu'
    })
  }

  const payloadSize = getPayloadSize(payload)
  if (payloadSize > 0) {
    metrics.push({
      label: 'Size',
      value: formatBytes(payloadSize),
      color:
        payloadSize > 1024 * 100
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-slate-600 dark:text-slate-400',
      icon: 'database'
    })
  }

  return metrics
}

export type SearchScope = 'all' | 'keys' | 'values'

/**
 * Build a reusable matcher for the fulltext filter. For regex mode an invalid
 * pattern yields a matcher that never matches (so the user just sees no
 * results rather than a crash). Plain mode is case-insensitive substring.
 */
export function createSearchMatcher(query: string, regex: boolean): (text: string) => boolean {
  if (regex) {
    try {
      const re = new RegExp(query, 'i')
      return (text) => re.test(text)
    } catch {
      return () => false
    }
  }
  const q = query.toLowerCase()
  return (text) => text.toLowerCase().includes(q)
}

/**
 * Walk a payload testing keys and/or values against `matcher`. Bounded by a
 * node budget so filtering thousands of large dumps on each keystroke stays
 * responsive; once the budget is exhausted the dump is treated as non-matching.
 */
export function payloadMatches(
  value: unknown,
  matcher: (text: string) => boolean,
  scope: SearchScope,
  budget: { n: number } = { n: 4000 }
): boolean {
  if (budget.n <= 0) return false
  budget.n--

  if (value === null) return scope !== 'keys' && matcher('null')
  if (value === undefined) return scope !== 'keys' && matcher('undefined')

  const t = typeof value
  if (t === 'string') return scope !== 'keys' && matcher(value as string)
  if (t === 'number' || t === 'boolean') return scope !== 'keys' && matcher(String(value))

  if (Array.isArray(value)) {
    for (const item of value) {
      if (payloadMatches(item, matcher, scope, budget)) return true
    }
    return false
  }

  if (t === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (scope !== 'values' && matcher(k)) return true
      if (payloadMatches(v, matcher, scope, budget)) return true
    }
  }
  return false
}
