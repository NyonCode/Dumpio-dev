'use strict'

// Serializes an arbitrary JavaScript value into Dumpio's language-agnostic
// `var` tree (PLAN-VIEWER C1). The receiver renders this identically to the
// trees produced by the PHP/Python/Go SDKs.
//
// A node is: { kind, class?, visibility?, key?, value?, children?, refId?, truncated? }
//   kind ∈ object|array|map|set|string|int|float|bool|null|undefined|resource|callable|ref
//
// Cycles are broken by tagging every container with a sequential `refId` and
// emitting a `{ kind:'ref', refId }` node the second time the same object is
// seen. Depth/string/item limits keep the payload bounded.

const DEFAULT_LIMITS = { maxDepth: 6, maxItems: 100, maxString: 2000 }

function numberKind(n) {
  return Number.isInteger(n) ? 'int' : 'float'
}

function ctorName(value) {
  const name =
    value && value.constructor && typeof value.constructor.name === 'string'
      ? value.constructor.name
      : undefined
  return name && name !== 'Object' ? name : undefined
}

/**
 * @param {unknown} root
 * @param {{ maxDepth?: number, maxItems?: number, maxString?: number }} [opts]
 * @returns {object} the root VarNode
 */
function serialize(root, opts) {
  const limits = Object.assign({}, DEFAULT_LIMITS, opts)
  /** @type {Map<object, number>} */
  const seen = new Map()
  let counter = 0

  function scalarString(value, extra) {
    let s = value
    let truncated = false
    if (s.length > limits.maxString) {
      s = s.slice(0, limits.maxString)
      truncated = true
    }
    const node = Object.assign({ kind: 'string', value: s }, extra)
    if (truncated) node.truncated = true
    return node
  }

  function entriesOf(obj) {
    // Own enumerable + non-enumerable string keys (skip symbols for the wire).
    const names = new Set()
    for (const k of Object.getOwnPropertyNames(obj)) names.add(k)
    return [...names]
  }

  function readProp(obj, key) {
    // Guard getters that throw.
    try {
      return { ok: true, value: obj[key] }
    } catch (err) {
      return { ok: false, value: String((err && err.message) || err) }
    }
  }

  function container(kind, value, klass, depth) {
    if (depth >= limits.maxDepth) {
      const stub = { kind, truncated: true }
      if (klass) stub.class = klass
      return stub
    }
    const refId = ++counter
    seen.set(value, refId)
    const node = { kind, refId, children: [] }
    if (klass) node.class = klass
    return node
  }

  function pushChild(node, child, key) {
    if (node.children.length >= limits.maxItems) {
      node.truncated = true
      return false
    }
    if (key !== undefined) child.key = key
    node.children.push(child)
    return true
  }

  function walk(value, depth) {
    if (value === null) return { kind: 'null' }
    if (value === undefined) return { kind: 'undefined' }

    const t = typeof value
    if (t === 'string') return scalarString(value)
    if (t === 'number') return { kind: numberKind(value), value }
    if (t === 'bigint') return { kind: 'int', class: 'bigint', value: value.toString() }
    if (t === 'boolean') return { kind: 'bool', value }
    if (t === 'symbol') return { kind: 'string', class: 'symbol', value: value.toString() }
    if (t === 'function') {
      const name = value.name || '(anonymous)'
      return { kind: 'callable', class: name, value: `function ${value.name || ''}`.trim() }
    }

    // Everything below is an object — cycle check first.
    if (seen.has(value)) return { kind: 'ref', refId: seen.get(value) }

    if (value instanceof Date) {
      const node = container('object', value, 'Date', depth)
      if (node.children) pushChild(node, scalarString(value.toISOString()), 'ISO')
      return node
    }
    if (value instanceof RegExp) {
      const node = container('object', value, 'RegExp', depth)
      if (node.children) pushChild(node, scalarString(value.toString()), 'source')
      return node
    }
    if (value instanceof Error) {
      const node = container('object', value, value.constructor.name || 'Error', depth)
      if (node.children) {
        pushChild(node, scalarString(String(value.message)), 'message')
        if (value.stack) pushChild(node, scalarString(String(value.stack)), 'stack')
      }
      return node
    }
    if (Array.isArray(value) || ArrayBuffer.isView(value)) {
      const klass = ArrayBuffer.isView(value) ? ctorName(value) : undefined
      const node = container('array', value, klass, depth)
      if (node.children) {
        const arr = Array.isArray(value) ? value : Array.from(/** @type {Iterable<unknown>} */ (value))
        for (const item of arr) {
          if (!pushChild(node, walk(item, depth + 1))) break
        }
      }
      return node
    }
    if (value instanceof Map) {
      const node = container('map', value, undefined, depth)
      if (node.children) {
        for (const [k, v] of value) {
          const key = typeof k === 'object' && k !== null ? '[object]' : String(k)
          if (!pushChild(node, walk(v, depth + 1), key)) break
        }
      }
      return node
    }
    if (value instanceof Set) {
      const node = container('set', value, undefined, depth)
      if (node.children) {
        for (const item of value) {
          if (!pushChild(node, walk(item, depth + 1))) break
        }
      }
      return node
    }

    // Plain object or class instance.
    const node = container('object', value, ctorName(value), depth)
    if (node.children) {
      for (const key of entriesOf(value)) {
        const read = readProp(value, key)
        const child = read.ok
          ? walk(read.value, depth + 1)
          : Object.assign(scalarString(read.value), { class: 'throws' })
        // JS has no member visibility; mark a leading underscore as a hint.
        if (key.startsWith('_')) child.visibility = 'protected'
        if (!pushChild(node, child, key)) break
      }
    }
    return node
  }

  return walk(root, 0)
}

module.exports = { serialize, DEFAULT_LIMITS }
