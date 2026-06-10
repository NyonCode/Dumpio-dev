// Unified, language-agnostic value tree (PLAN-VIEWER C1).
//
// Every SDK (PHP, JS/Node, Python, Go) serializes an arbitrary value into this
// same `VarNode` tree so the receiver can render faithful, typed output for any
// language. The actual structured renderer is `VarDump.tsx` (C2); this module
// only defines the wire contract and a couple of guards the receiver uses to
// recognize and label `var` dumps.

/** Discriminator for a node in the value tree. */
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

export type VarVisibility = 'public' | 'protected' | 'private'

/**
 * A single node in the value tree.
 *
 * - Scalars (`string`/`int`/`float`/`bool`) carry `value`; `null`/`undefined`
 *   carry neither.
 * - Containers (`object`/`array`/`map`/`set`) carry `children` and may carry a
 *   `refId` identifying the node so cyclic references can point back to it.
 * - A `ref` node has only `refId`, pointing at a previously emitted container.
 * - `key`/`visibility` describe how a node sits inside its parent (map key or
 *   object property name, and member visibility where the language has one).
 * - `truncated` marks a node clipped by a depth/count/length limit.
 */
export interface VarNode {
  kind: VarKind
  /** Class / type name for `object`, `resource`, `callable`, typed containers. */
  class?: string
  visibility?: VarVisibility
  /** Property name or map/array key when this node is a child entry. */
  key?: string | number
  /** Scalar payload for `string`/`int`/`float`/`bool`. */
  value?: string | number | boolean | null
  children?: VarNode[]
  /** Identity of a container, or the target of a `ref`. */
  refId?: number
  truncated?: boolean
}

/** Caller site captured by the SDK helper (`file:line`). */
export interface VarCaller {
  file: string
  line: number
  function?: string
}

/** The full `type: 'var'` dump payload as it arrives over the wire. */
export interface VarDumpPayload {
  type: 'var'
  /** Human label / variable name; mirrored into `message` for the list title. */
  label?: string
  /** Producing language, informational: `php` | `node` | `python` | `go`. */
  language?: string
  caller?: VarCaller
  value: VarNode
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** True when a dump payload is a unified `var` tree. */
export function isVarPayload(payload: unknown): payload is VarDumpPayload {
  return isRecord(payload) && payload.type === 'var' && isRecord(payload.value)
}
