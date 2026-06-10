// src/renderer/src/components/dump-viewer/VarDump.tsx
//
// Structured renderer for the unified value tree (Phase C2). Renders a `VarNode`
// var_dump / Symfony-VarDumper style across languages:
//   PHP     App\User {#3 +name: "…", #protected: …, -private: … }
//   JS      User {…}        Map(2) {…}       Set(3) […]
//   Python  dict(3) {…}     MyClass(…)       bytes(…)
//   Go      main.User{…}    map[string]int{…}
//   arrays  array:3 [ … ]
// Collapsible, copy path / copy value, ref links, type-colored scalars, search
// with auto-expand + highlight. Shares the look & interactions of JsonTree (A4).

import { useMemo, useState, type JSX, type ReactNode } from 'react'
import type { VarNode, VarVisibility } from './var-types'
import { createSearchMatcher } from './utils'

interface VarDumpProps {
  root: VarNode
  /** Depth that starts expanded (root container = depth 0). */
  defaultExpandedDepth?: number
}

const CHILD_PAGE = 100

/** Member visibility marker, Symfony-style: +public #protected -private. */
function visibilityMark(v: VarVisibility | undefined): string {
  if (v === 'public') return '+'
  if (v === 'protected') return '#'
  if (v === 'private') return '-'
  return ''
}

function isContainerKind(kind: VarNode['kind']): boolean {
  return kind === 'object' || kind === 'array' || kind === 'map' || kind === 'set'
}

/** Heading + brackets for a container node (`head openBracket … closeBracket`). */
function containerTokens(node: VarNode): {
  head: string
  openBracket: string
  closeBracket: string
} {
  const n = node.children?.length ?? 0
  switch (node.kind) {
    case 'array':
      return { head: `${node.class ?? 'array'}:${n}`, openBracket: '[', closeBracket: ']' }
    case 'set':
      return { head: `${node.class ?? 'set'}(${n})`, openBracket: '[', closeBracket: ']' }
    case 'map':
      return { head: `${node.class ?? 'map'}(${n})`, openBracket: '{', closeBracket: '}' }
    default: {
      // object
      const id = node.refId !== undefined ? ` #${node.refId}` : ''
      return { head: `${node.class ?? 'object'}${id}`, openBracket: '{', closeBracket: '}' }
    }
  }
}

interface ScalarStyle {
  text: string
  className: string
}

/** Render-ready text + color for a non-container node. */
function scalarStyle(node: VarNode): ScalarStyle {
  switch (node.kind) {
    case 'string':
      return {
        text: `"${String(node.value ?? '')}"`,
        className: 'text-syntax-string'
      }
    case 'int':
      return { text: String(node.value), className: 'text-syntax-number' }
    case 'float':
      // Non-finite floats arrive as class:'special' with value NAN/INF/-INF;
      // either way the wire value is already render-ready.
      return { text: String(node.value), className: 'text-syntax-number' }
    case 'bool':
      return {
        text: node.value ? 'true' : 'false',
        className: node.value
          ? 'text-emerald-600 dark:text-emerald-400'
          : 'text-red-600 dark:text-red-400'
      }
    case 'null':
      return { text: 'null', className: 'italic text-subtle' }
    case 'undefined':
      return { text: 'undefined', className: 'italic text-subtle' }
    case 'resource':
      return {
        text: `resource(${node.class ?? '?'})`,
        className: 'text-amber-600 dark:text-amber-400'
      }
    case 'callable':
      return {
        text: `callable(${node.class ?? 'fn'})`,
        className: 'text-purple-600 dark:text-purple-400'
      }
    case 'ref':
      return {
        text: `↩ &${node.refId ?? '?'}`,
        className: 'italic text-sky-600 dark:text-sky-400'
      }
    default:
      return { text: String(node.value ?? ''), className: 'text-muted' }
  }
}

function joinPath(parent: string, segment: string | number | undefined, index: number): string {
  const seg = segment ?? index
  if (typeof seg === 'number') return `${parent}[${seg}]`
  if (!parent) return String(seg)
  return `${parent}.${seg}`
}

function highlight(text: string, matcher: ((t: string) => boolean) | null, raw: string): ReactNode {
  if (!matcher || !raw || !matcher(text)) return text
  const idx = text.toLowerCase().indexOf(raw.toLowerCase())
  if (idx === -1) {
    return <mark className="rounded bg-amber-200/70 text-inherit dark:bg-amber-500/30">{text}</mark>
  }
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-amber-200/70 text-inherit dark:bg-amber-500/30">
        {text.slice(idx, idx + raw.length)}
      </mark>
      {text.slice(idx + raw.length)}
    </>
  )
}

async function copy(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
  } catch (err) {
    console.error('Copy failed:', err)
  }
}

/** A plain JS value capturing a node's content, for "copy value". */
function nodeToPlain(node: VarNode, budget = { n: 5000 }): unknown {
  if (budget.n <= 0) return '…'
  budget.n--
  if (node.kind === 'ref') return `&${node.refId}`
  if (!isContainerKind(node.kind)) {
    if (node.kind === 'null') return null
    if (node.kind === 'undefined') return undefined
    return node.value ?? null
  }
  const children = node.children ?? []
  if (node.kind === 'array' || node.kind === 'set') {
    return children.map((c) => nodeToPlain(c, budget))
  }
  const out: Record<string, unknown> = {}
  for (const c of children) out[String(c.key ?? '')] = nodeToPlain(c, budget)
  return out
}

export function VarDump({ root, defaultExpandedDepth = 2 }: VarDumpProps): JSX.Element {
  const [search, setSearch] = useState('')
  const [useRegex, setUseRegex] = useState(false)
  const [override, setOverride] = useState<{ mode: 'all' | 'none' } | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [pages, setPages] = useState<Record<string, number>>({})

  const matcher = useMemo(
    () => (search ? createSearchMatcher(search, useRegex) : null),
    [search, useRegex]
  )

  // Paths whose subtree contains a match (so we force-expand to reveal it).
  const matchPaths = useMemo(() => {
    if (!matcher) return null
    const set = new Set<string>()
    const visit = (node: VarNode, path: string, budget: { n: number }): boolean => {
      if (budget.n <= 0) return false
      budget.n--
      const keyHit = node.key !== undefined && matcher(String(node.key))
      const classHit = node.class !== undefined && matcher(node.class)
      let hit = keyHit || classHit
      if (isContainerKind(node.kind)) {
        const children = node.children ?? []
        children.forEach((c, i) => {
          if (visit(c, joinPath(path, c.key, i), budget)) hit = true
        })
        if (hit) set.add(path)
        return hit
      }
      if (matcher(scalarStyle(node).text)) hit = true
      return hit
    }
    visit(root, '$', { n: 8000 })
    return set
  }, [matcher, root])

  const isOpen = (path: string, depth: number): boolean => {
    if (matchPaths) return matchPaths.has(path)
    if (expanded.has(path)) return true
    if (collapsed.has(path)) return false
    if (override?.mode === 'all') return true
    if (override?.mode === 'none') return false
    return depth < defaultExpandedDepth
  }

  const toggle = (path: string, currentlyOpen: boolean): void => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (currentlyOpen) next.delete(path)
      else next.add(path)
      return next
    })
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (currentlyOpen) next.add(path)
      else next.delete(path)
      return next
    })
  }

  const expandAll = (): void => {
    setOverride({ mode: 'all' })
    setExpanded(new Set())
    setCollapsed(new Set())
  }
  const collapseAll = (): void => {
    setOverride({ mode: 'none' })
    setExpanded(new Set())
    setCollapsed(new Set())
  }

  const renderNode = (node: VarNode, path: string, depth: number): ReactNode => {
    const container = isContainerKind(node.kind)
    const open = container && isOpen(path, depth)
    const keyLabel = node.key !== undefined ? String(node.key) : undefined
    const mark = visibilityMark(node.visibility)

    let entries: VarNode[] = []
    let total = 0
    if (container && open) {
      const children = node.children ?? []
      total = children.length
      entries = children.slice(0, pages[path] ?? CHILD_PAGE)
    }

    const tokens = container ? containerTokens(node) : null
    const scalar = container ? null : scalarStyle(node)

    return (
      <div key={path} className="leading-relaxed">
        <div className="group -mx-1 flex items-start gap-2 rounded px-1 hover:bg-elevated">
          <button
            type="button"
            onClick={() => container && toggle(path, open)}
            className={`mt-[3px] flex h-4 w-4 flex-shrink-0 items-center justify-center rounded text-subtle ${
              container ? 'hover:bg-elevated' : 'invisible'
            }`}
            tabIndex={-1}
          >
            <span className="text-[10px]">{open ? '▾' : '▸'}</span>
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2">
              {keyLabel !== undefined && (
                <span className="font-mono text-xs font-semibold text-syntax-key">
                  {mark && <span className="text-subtle">{mark}</span>}
                  {highlight(keyLabel, matcher, search)}
                  <span className="text-subtle">:</span>
                </span>
              )}

              {container ? (
                <span className="font-mono text-xs text-muted">
                  {highlight(tokens!.head, matcher, search)}{' '}
                  {open ? tokens!.openBracket : `${tokens!.openBracket} … ${tokens!.closeBracket}`}
                </span>
              ) : (
                <span className={`break-all font-mono text-xs ${scalar!.className}`}>
                  {highlight(scalar!.text, matcher, search)}
                </span>
              )}

              {node.truncated && (
                <span className="rounded bg-amber-100 px-1 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                  truncated
                </span>
              )}

              <span className="ml-auto flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => copy(path.replace(/^\$\.?/, ''))}
                  className="rounded px-1 py-px text-[10px] text-subtle hover:bg-elevated hover:text-fg"
                  title="Copy path"
                >
                  path
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const plain = nodeToPlain(node)
                    copy(typeof plain === 'string' ? plain : JSON.stringify(plain, null, 2))
                  }}
                  className="rounded px-1 py-px text-[10px] text-subtle hover:bg-elevated hover:text-fg"
                  title="Copy value"
                >
                  value
                </button>
              </span>
            </div>

            {container && open && (
              <div className="mt-0.5 space-y-0.5 border-l border-line pl-3">
                {entries.length === 0 ? (
                  <div className="font-mono text-xs text-subtle">empty</div>
                ) : (
                  entries.map((c, i) => renderNode(c, joinPath(path, c.key, i), depth + 1))
                )}
                {total > entries.length && (
                  <button
                    type="button"
                    onClick={() =>
                      setPages((prev) => ({
                        ...prev,
                        [path]: (prev[path] ?? CHILD_PAGE) + CHILD_PAGE
                      }))
                    }
                    className="rounded px-2 py-0.5 text-xs font-medium text-accent hover:bg-accent/10"
                  >
                    Show {Math.min(CHILD_PAGE, total - entries.length)} more of {total}…
                  </button>
                )}
                <span className="block font-mono text-xs text-subtle">{tokens!.closeBracket}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="font-mono text-sm">
      <div className="mb-3 flex items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search keys, classes & values…"
          className="flex-1 rounded-md border border-line bg-sunken px-2.5 py-1 text-xs text-fg placeholder-subtle focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <button
          type="button"
          onClick={() => setUseRegex((v) => !v)}
          className={`rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
            useRegex
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-line text-muted hover:bg-elevated hover:text-fg'
          }`}
          title="Toggle regular expression search"
        >
          .*
        </button>
        <button
          type="button"
          onClick={expandAll}
          className="rounded-md border border-line px-2 py-1 text-xs font-medium text-muted transition-colors hover:bg-elevated hover:text-fg"
        >
          Expand all
        </button>
        <button
          type="button"
          onClick={collapseAll}
          className="rounded-md border border-line px-2 py-1 text-xs font-medium text-muted transition-colors hover:bg-elevated hover:text-fg"
        >
          Collapse all
        </button>
      </div>

      <div className="space-y-0.5">{renderNode(root, '$', 0)}</div>
    </div>
  )
}
