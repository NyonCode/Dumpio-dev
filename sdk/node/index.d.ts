// Type definitions for dumpio-client (Node).

export type VarKind =
  | 'object'
  | 'array'
  | 'map'
  | 'set'
  | 'string'
  | 'int'
  | 'float'
  | 'bool'
  | 'null'
  | 'undefined'
  | 'resource'
  | 'callable'
  | 'ref'

export interface VarNode {
  kind: VarKind
  class?: string
  visibility?: 'public' | 'protected' | 'private'
  key?: string | number
  value?: string | number | boolean | null
  children?: VarNode[]
  refId?: number
  truncated?: boolean
}

/** The fixed set of color categories the viewer understands. */
export type Flag = 'red' | 'yellow' | 'blue' | 'gray' | 'purple' | 'pink' | 'green'

/** Structured message types the viewer renders with a dedicated view. */
export type DumpType =
  | 'var'
  | 'exception'
  | 'query'
  | 'http'
  | 'log'
  | 'model'
  | 'collection'
  | 'table'
  | 'measure'
  | 'performance'
  | 'event'

export interface SerializeLimits {
  maxDepth?: number
  maxItems?: number
  maxString?: number
}

export interface DumpioConfig {
  host: string
  port: number
  path: string
  token: string
  timeoutMs: number
  enabled: boolean
  maxDepth: number
  maxItems: number
  maxString: number
}

/** Common per-dump overrides accepted by every typed helper. */
export interface DumpOpts {
  flag?: Flag
  channel?: string
  /** Epoch milliseconds; defaults to `Date.now()`. */
  timestamp?: number
}

export interface DumpOptions extends DumpOpts {
  /** Title for a `var` dump (mirrored into `message`). */
  label?: string
}

export interface QueryOpts extends DumpOpts {
  /** Connection name (e.g. `mysql`). */
  connection?: string
  /** Override the list title (defaults to a truncated SQL string). */
  message?: string
}

export interface CollectionOpts extends DumpOpts {
  message?: string
}

export interface TableOpts extends DumpOpts {
  message?: string
}

export interface PerformanceOpts extends DumpOpts {
  message?: string
}

/** A single structured stack frame parsed from `Error.stack`. */
export interface StackFrame {
  function?: string
  file: string
  line: number
  column: number
}

export interface HttpRequestInput {
  method: string
  url: string
  status?: number
  headers?: Record<string, unknown>
  body?: unknown
  /** Response time in milliseconds. */
  responseTime?: number
}

export interface ModelData {
  attributes: Record<string, unknown>
  relations?: Record<string, unknown>
  exists?: boolean
  connection?: string
}

export interface MeasureData {
  /** Memory in bytes. */
  memory?: number
  context?: Record<string, unknown>
}

export interface PerformanceData {
  metrics: Record<string, number>
  /** Millisecond slices rendered as a stacked bar. */
  breakdown?: Record<string, number>
  context?: Record<string, unknown>
}

export interface EventData {
  entity?: string
  entityId?: string | number
  actor?: unknown
  data?: unknown
  metadata?: unknown
}

// --- core ---

export function serialize(value: unknown, opts?: SerializeLimits): VarNode
export function configure(options: Partial<DumpioConfig>): DumpioConfig
export function dumpio(value: unknown, options?: DumpOptions): Promise<void>
export function dd(...values: unknown[]): void
/** Wait for all in-flight dumps to settle. Always resolves. */
export function flush(): Promise<void>
export const config: DumpioConfig

// --- typed helpers (all fire-and-forget, never throw) ---

export function dumpioMessage(
  message: string,
  extra?: Record<string, unknown>,
  opts?: DumpOpts
): Promise<void>

export function dumpioException(
  error: Error,
  context?: Record<string, unknown>,
  opts?: DumpOpts
): Promise<void>

export function dumpioQuery(
  sql: string,
  bindings?: unknown[],
  timeMs?: number,
  opts?: QueryOpts
): Promise<void>

export function dumpioHttp(req: HttpRequestInput, opts?: DumpOpts): Promise<void>

export function dumpioLog(
  level: string,
  message: string,
  details?: unknown,
  opts?: DumpOpts
): Promise<void>

export function dumpioModel(
  className: string,
  data: ModelData,
  opts?: DumpOpts
): Promise<void>

export function dumpioCollection(items: unknown[], opts?: CollectionOpts): Promise<void>

export function dumpioTable(
  columns: string[],
  rows: Array<unknown[] | Record<string, unknown>>,
  opts?: TableOpts
): Promise<void>

export function dumpioMeasure(
  name: string,
  timeMs: number,
  data?: MeasureData,
  opts?: DumpOpts
): Promise<void>

export function dumpioPerformance(data: PerformanceData, opts?: PerformanceOpts): Promise<void>

export function dumpioEvent(event: string, data?: EventData, opts?: DumpOpts): Promise<void>

// --- framework integrations (also available from 'dumpio-client/middleware') ---

export interface HttpMiddlewareOptions {
  /** Channel to tag emitted `http` dumps with. */
  channel?: string
  /** Include request/response headers (default false). */
  headers?: boolean
  /** Return true to skip a request. */
  skip?: (req: unknown) => boolean
}

export function expressMiddleware(
  options?: HttpMiddlewareOptions
): (req: unknown, res: unknown, next: () => void) => void

export function koaMiddleware(
  options?: HttpMiddlewareOptions
): (ctx: unknown, next: () => Promise<void>) => Promise<void>

export function fastifyPlugin(
  fastify: unknown,
  options?: HttpMiddlewareOptions,
  done?: (err?: Error) => void
): void

/** Returns an uninstall function that removes the listeners. */
export function installGlobalErrorHandlers(options?: { channel?: string }): () => void
