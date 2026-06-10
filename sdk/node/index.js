'use strict'

// dumpio-client (Node) — send faithful, typed value dumps to the Dumpio app.
//
//   const { dumpio, dd, configure } = require('dumpio-client')
//   dumpio(someValue, { label: 'user', flag: 'blue' })
//   dd(a, b)        // dump and stop the process
//
// Transport is HTTP-first (POST /dumps), fire-and-forget, and never throws into
// your application code — a debugging helper must not be able to break the app.

const http = require('node:http')
const path = require('node:path')
const { serialize } = require('./serializer')

const SDK_DIR = __dirname

/**
 * @typedef {object} DumpOpts Common per-dump overrides accepted by every helper.
 * @property {string} [flag] Color category (red|yellow|blue|gray|purple|pink|green).
 * @property {string} [channel] Logical grouping / tab (default "default").
 * @property {number} [timestamp] Epoch milliseconds (default: now).
 *
 * @typedef {DumpOpts & { connection?: string, message?: string }} QueryOpts
 * @typedef {DumpOpts & { message?: string }} CollectionOpts
 * @typedef {DumpOpts & { message?: string }} TableOpts
 * @typedef {DumpOpts & { message?: string }} PerformanceOpts
 */

const config = {
  host: process.env.DUMPIO_HOST || 'localhost',
  port: Number(process.env.DUMPIO_PORT || 21234),
  path: '/dumps',
  token: process.env.DUMPIO_TOKEN || '',
  timeoutMs: 1500,
  enabled: process.env.DUMPIO_DISABLE ? false : true,
  // Serialization limits forwarded to the serializer.
  maxDepth: 6,
  maxItems: 100,
  maxString: 2000
}

/** Merge user options into the module config. */
function configure(options) {
  Object.assign(config, options)
  return config
}

/**
 * Capture the first stack frame outside this SDK, as { file, line, function }.
 */
function captureCaller() {
  const orig = Error.prepareStackTrace
  try {
    Error.prepareStackTrace = (_, stack) => stack
    const err = new Error()
    /** @type {NodeJS.CallSite[]} */
    const stack = err.stack
    for (const frame of stack) {
      const file = frame.getFileName()
      if (!file || file.startsWith('node:')) continue
      if (path.dirname(file) === SDK_DIR) continue
      return {
        file,
        line: frame.getLineNumber() || 0,
        function: frame.getFunctionName() || undefined
      }
    }
  } catch {
    // ignore — caller info is best-effort
  } finally {
    Error.prepareStackTrace = orig
  }
  return undefined
}

/** @type {Set<Promise<void>>} In-flight sends, tracked so `flush()`/`dd()` can wait. */
const inflight = new Set()

/** POST a single dump message, fire-and-forget. Returns a Promise that always resolves. */
function send(message) {
  if (!config.enabled) return Promise.resolve()
  const p = new Promise((resolve) => {
    let body
    try {
      body = Buffer.from(JSON.stringify(message), 'utf-8')
    } catch {
      return resolve()
    }
    const headers = { 'Content-Type': 'application/json', 'Content-Length': body.length }
    if (config.token) headers['X-Dumpio-Token'] = config.token

    const req = http.request(
      { host: config.host, port: config.port, path: config.path, method: 'POST', headers },
      (res) => {
        res.resume()
        res.on('end', resolve)
      }
    )
    req.setTimeout(config.timeoutMs, () => req.destroy())
    req.on('error', () => resolve()) // app not running / refused — stay silent
    req.on('close', resolve)
    req.write(body)
    req.end()
  })
  inflight.add(p)
  p.then(() => inflight.delete(p))
  return p
}

/**
 * Wait for all in-flight dumps to settle. Useful before exiting a short-lived
 * process. Always resolves (never throws).
 * @returns {Promise<void>}
 */
function flush() {
  return Promise.allSettled([...inflight]).then(() => undefined)
}

/**
 * Wrap a payload in the dump envelope and ship it. The single internal funnel
 * every typed helper goes through: it stamps `timestamp`/`flag`/`channel`/
 * `schemaVersion`, lets the caller override any of those via `opts`, and hands
 * the result to {@link send} (fire-and-forget, never throws).
 *
 * @param {Record<string, unknown>} payload The dump body (must carry its own `type`/`message`).
 * @param {{ flag?: string, channel?: string, timestamp?: number }} [opts]
 * @param {string} [defaultFlag] Flag to use when the payload/opts don't set one.
 * @returns {Promise<void>}
 */
function emit(payload, opts, defaultFlag) {
  const o = opts || {}
  const message = Object.assign({}, payload, {
    schemaVersion: 1,
    timestamp: o.timestamp !== undefined ? o.timestamp : Date.now(),
    flag: o.flag || payload.flag || defaultFlag || 'gray',
    channel: o.channel || payload.channel || 'default'
  })
  return send(message)
}

/** Truncate a string for use as a list title. */
function titleEllipsis(str, max) {
  const s = String(str)
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

/**
 * Send one value as a `var` dump (the flagship faithful value tree).
 * @param {unknown} value
 * @param {{ label?: string, flag?: string, channel?: string, timestamp?: number }} [options]
 * @returns {Promise<void>}
 */
function dumpio(value, options) {
  const opts = options || {}
  const tree = serialize(value, {
    maxDepth: config.maxDepth,
    maxItems: config.maxItems,
    maxString: config.maxString
  })
  return emit(
    {
      type: 'var',
      language: 'node',
      label: opts.label,
      message: opts.label,
      caller: captureCaller(),
      value: tree
    },
    opts,
    'blue'
  )
}

/**
 * Send a plain data dump (generic message + arbitrary extra fields). Use this
 * when no typed helper fits but you still want a titled entry in the viewer.
 * @param {string} message List/detail title.
 * @param {Record<string, unknown>} [extra] Extra payload keys, shown in the value tree.
 * @param {DumpOpts} [opts]
 * @returns {Promise<void>}
 */
function dumpioMessage(message, extra, opts) {
  return emit(Object.assign({ message }, extra), opts, 'gray')
}

/**
 * Parse a raw Node stack string into structured frames.
 * @param {string} [stack]
 * @returns {Array<{ function?: string, file: string, line: number, column: number }>}
 */
function parseStack(stack) {
  if (!stack || typeof stack !== 'string') return []
  const frames = []
  const re = /at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?/
  for (const line of stack.split('\n')) {
    const m = re.exec(line.trim())
    if (!m) continue
    frames.push({
      function: m[1] || undefined,
      file: m[2],
      line: Number(m[3]),
      column: Number(m[4])
    })
  }
  return frames
}

/**
 * Send a JS `Error` as an `exception` dump: class name, message, the raw stack
 * string AND a structured `trace[]`, framework `'node'`, plus any extra context.
 * @param {Error} error
 * @param {Record<string, unknown>} [context] Merged into the dump's `context`.
 * @param {DumpOpts} [opts]
 * @returns {Promise<void>}
 */
function dumpioException(error, context, opts) {
  const err = error || {}
  const name = (err.constructor && err.constructor.name) || 'Error'
  const trace = parseStack(err.stack)
  const top = trace[0]
  return emit(
    {
      type: 'exception',
      framework: 'node',
      exception: name,
      message: err.message !== undefined ? String(err.message) : name,
      file: top ? top.file : undefined,
      line: top ? top.line : undefined,
      code: err.code !== undefined ? err.code : undefined,
      stack: typeof err.stack === 'string' ? err.stack : undefined,
      trace,
      context: context || undefined
    },
    opts,
    'red'
  )
}

/**
 * Send a database `query` dump.
 * @param {string} sql The SQL statement.
 * @param {unknown[]} [bindings] Parameter bindings, interpolated in the UI.
 * @param {number} [timeMs] Execution time in milliseconds.
 * @param {QueryOpts} [opts] Standard opts plus optional `connection`/`message`.
 * @returns {Promise<void>}
 */
function dumpioQuery(sql, bindings, timeMs, opts) {
  const o = opts || {}
  return emit(
    {
      type: 'query',
      message: o.message || titleEllipsis(sql, 80),
      sql,
      bindings: bindings || [],
      time: timeMs !== undefined ? timeMs : undefined,
      connection: o.connection
    },
    o,
    'purple'
  )
}

/** Pick an http flag from a status code. */
function httpFlag(status) {
  if (typeof status !== 'number') return 'green'
  if (status >= 500) return 'red'
  if (status >= 400) return 'yellow'
  if (status >= 300) return 'blue'
  return 'green'
}

/**
 * Send an `http` request/response dump. Flag is derived from `status`.
 * @param {{ method: string, url: string, status?: number, headers?: Record<string, unknown>, body?: unknown, responseTime?: number }} req
 * @param {DumpOpts} [opts]
 * @returns {Promise<void>}
 */
function dumpioHttp(req, opts) {
  const r = req || {}
  const method = r.method ? String(r.method).toUpperCase() : 'GET'
  return emit(
    {
      type: 'http',
      message: `${method} ${r.url || ''}`.trim(),
      method,
      url: r.url,
      status: r.status,
      headers: r.headers,
      body: r.body,
      response_time: r.responseTime
    },
    opts,
    httpFlag(r.status)
  )
}

/** Pick a log flag from a level string. */
function logFlag(level) {
  switch (String(level || '').toLowerCase()) {
    case 'error':
    case 'critical':
    case 'fatal':
      return 'red'
    case 'warning':
    case 'warn':
      return 'yellow'
    case 'info':
    case 'notice':
      return 'blue'
    default:
      return 'gray'
  }
}

/**
 * Send a `log` line dump. Flag is derived from `level`.
 * @param {string} level error | warning | info | debug …
 * @param {string} message
 * @param {unknown} [details] Extra structured detail, shown as a value tree.
 * @param {DumpOpts} [opts]
 * @returns {Promise<void>}
 */
function dumpioLog(level, message, details, opts) {
  return emit(
    {
      type: 'log',
      level,
      message,
      details: details !== undefined ? details : undefined
    },
    opts,
    logFlag(level)
  )
}

/**
 * Send a `model` dump (a single domain object — Eloquent/Django/Prisma/struct).
 * @param {string} className
 * @param {{ attributes: Record<string, unknown>, relations?: Record<string, unknown>, exists?: boolean, connection?: string }} data
 * @param {DumpOpts} [opts]
 * @returns {Promise<void>}
 */
function dumpioModel(className, data, opts) {
  const d = data || {}
  return emit(
    {
      type: 'model',
      class: className,
      message: className,
      exists: d.exists,
      connection: d.connection,
      attributes: d.attributes || {},
      relations: d.relations
    },
    opts,
    'gray'
  )
}

/**
 * Send a `collection` dump (a list of items).
 * @param {unknown[]} items
 * @param {CollectionOpts} [opts] Standard opts plus optional `message`.
 * @returns {Promise<void>}
 */
function dumpioCollection(items, opts) {
  const o = opts || {}
  const arr = Array.isArray(items) ? items : []
  return emit(
    {
      type: 'collection',
      message: o.message || `collection (${arr.length})`,
      count: arr.length,
      items: arr
    },
    o,
    'gray'
  )
}

/**
 * Send a `table` dump (explicit columns + rows).
 * @param {string[]} columns
 * @param {Array<unknown[] | Record<string, unknown>>} rows Arrays aligned to columns, or records.
 * @param {TableOpts} [opts] Standard opts plus optional `message`.
 * @returns {Promise<void>}
 */
function dumpioTable(columns, rows, opts) {
  const o = opts || {}
  const r = Array.isArray(rows) ? rows : []
  return emit(
    {
      type: 'table',
      message: o.message || `table (${r.length})`,
      columns: columns || [],
      rows: r
    },
    o,
    'gray'
  )
}

/**
 * Send a `measure` dump (a single timing).
 * @param {string} name
 * @param {number} timeMs Duration in milliseconds.
 * @param {{ memory?: number, context?: Record<string, unknown> }} [data]
 * @param {DumpOpts} [opts]
 * @returns {Promise<void>}
 */
function dumpioMeasure(name, timeMs, data, opts) {
  const d = data || {}
  return emit(
    {
      type: 'measure',
      message: name,
      name,
      time: timeMs,
      memory: d.memory,
      context: d.context
    },
    opts,
    'gray'
  )
}

/**
 * Send a `performance` dump (metric bundle with optional breakdown).
 * @param {{ metrics: Record<string, number>, breakdown?: Record<string, number>, context?: Record<string, unknown> }} data
 * @param {PerformanceOpts} [opts] Standard opts plus optional `message`.
 * @returns {Promise<void>}
 */
function dumpioPerformance(data, opts) {
  const d = data || {}
  const o = opts || {}
  return emit(
    {
      type: 'performance',
      message: o.message || 'performance',
      metrics: d.metrics || {},
      breakdown: d.breakdown,
      context: d.context
    },
    o,
    'gray'
  )
}

/**
 * Send an `event` dump (a business/domain event).
 * @param {string} event Event name (e.g. `order.completed`).
 * @param {{ entity?: string, entityId?: string | number, actor?: unknown, data?: unknown, metadata?: unknown }} [data]
 * @param {DumpOpts} [opts]
 * @returns {Promise<void>}
 */
function dumpioEvent(event, data, opts) {
  const d = data || {}
  return emit(
    {
      type: 'event',
      message: event,
      event,
      entity: d.entity,
      entity_id: d.entityId,
      actor: d.actor,
      data: d.data,
      metadata: d.metadata
    },
    opts,
    'gray'
  )
}

/**
 * Dump every argument, then stop the process ("dump & die"). Waits for all
 * in-flight requests to settle so nothing is lost before exit.
 * @param {...unknown} values
 */
function dd(...values) {
  values.forEach((v) => dumpio(v))
  flush().then(() => process.exit(1))
}

module.exports = {
  // core
  dumpio,
  dd,
  configure,
  serialize,
  flush,
  config,
  // typed helpers
  dumpioMessage,
  dumpioException,
  dumpioQuery,
  dumpioHttp,
  dumpioLog,
  dumpioModel,
  dumpioCollection,
  dumpioTable,
  dumpioMeasure,
  dumpioPerformance,
  dumpioEvent,
  // framework integrations (lazy-required to avoid loading on every import)
  get expressMiddleware() {
    return require('./middleware').expressMiddleware
  },
  get koaMiddleware() {
    return require('./middleware').koaMiddleware
  },
  get fastifyPlugin() {
    return require('./middleware').fastifyPlugin
  },
  get installGlobalErrorHandlers() {
    return require('./middleware').installGlobalErrorHandlers
  }
}
