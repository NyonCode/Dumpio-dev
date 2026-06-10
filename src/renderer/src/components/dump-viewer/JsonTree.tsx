// src/renderer/src/components/dump-viewer/JsonTree.tsx
//
// Professional, collapsible value viewer (the "JsonTree" from Phase A4).
// Replaces the in-line ArrayViewer for the master-detail panel: type badges,
// in-payload search with auto-expand + highlight, copy-path / copy-value, and
// expand/collapse all. Large arrays are paginated to stay responsive.

import { useMemo, useState, type JSX, type ReactNode } from 'react'
import { createSearchMatcher } from './utils'

interface JsonTreeProps {
  value: unknown
  /** Depth that starts expanded (root children = depth 0). */
  defaultExpandedDepth?: number
}

const ARRAY_PAGE = 100

type ValueKind = 'string' | 'number' | 'boolean' | 'null' | 'array' | 'object'

interface KindStyle {
  badge: string
  label: string
}

function kindOf(value: unknown): ValueKind {
  if (value === null || value === undefined) return 'null'
  if (Array.isArray(value)) return 'array'
  const t = typeof value
  if (t === 'string') return 'string'
  if (t === 'number') return 'number'
  if (t === 'boolean') return 'boolean'
  return 'object'
}

function kindStyle(value: unknown, kind: ValueKind): KindStyle {
  switch (kind) {
    case 'string':
      return {
        label: 'str',
        badge: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300'
      }
    case 'number':
      return {
        label: (value as number) % 1 !== 0 ? 'float' : 'int',
        badge: 'bg-syntax-number/10 text-syntax-number'
      }
    case 'boolean':
      return {
        label: 'bool',
        badge: 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300'
      }
    case 'null':
      return {
        label: value === undefined ? 'undef' : 'null',
        badge: 'bg-sunken text-muted'
      }
    case 'array':
      return {
        label: `array(${(value as unknown[]).length})`,
        badge: 'bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-300'
      }
    case 'object':
      return {
        label: `object(${Object.keys(value as object).length})`,
        badge: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300'
      }
  }
}

/** Build a copyable accessor path like `user.roles[0].name`. */
function joinPath(parent: string, segment: string | number): string {
  if (typeof segment === 'number') return `${parent}[${segment}]`
  if (!parent) return segment
  return `${parent}.${segment}`
}

function highlight(text: string, matcher: ((t: string) => boolean) | null, raw: string): ReactNode {
  if (!matcher || !raw || !matcher(text)) return text
  // Case-insensitive substring highlight for the plain-text path; regex mode
  // just tints the whole token (we can't reliably segment an arbitrary regex).
  const idx = text.toLowerCase().indexOf(raw.toLowerCase())
  if (idx === -1) {
    return <mark className="rounded bg-amber-200/70 text-inherit dark:bg-amber-500/30">{text}</mark>
  }
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-amber-200/70 dark:bg-amber-500/30 text-inherit">
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

export function JsonTree({ value, defaultExpandedDepth = 1 }: JsonTreeProps): JSX.Element {
  const [search, setSearch] = useState('')
  const [useRegex, setUseRegex] = useState(false)
  // `null` = follow defaults; a Set = explicit user overrides via expand/collapse all
  const [override, setOverride] = useState<{ mode: 'all' | 'none' } | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [pages, setPages] = useState<Record<string, number>>({})

  const matcher = useMemo(
    () => (search ? createSearchMatcher(search, useRegex) : null),
    [search, useRegex]
  )

  // Paths that must be force-expanded because a descendant matches the search.
  const matchPaths = useMemo(() => {
    if (!matcher) return null
    const set = new Set<string>()
    const visit = (val: unknown, path: string, budget: { n: number }): boolean => {
      if (budget.n <= 0) return false
      budget.n--
      const kind = kindOf(val)
      if (kind === 'array' || kind === 'object') {
        let hit = false
        const entries =
          kind === 'array'
            ? (val as unknown[]).map((v, i) => [i, v] as const)
            : Object.entries(val as Record<string, unknown>)
        for (const [k, v] of entries) {
          const keyHit = typeof k === 'string' && matcher(k)
          const childHit = visit(v, joinPath(path, k), budget)
          if (keyHit || childHit) hit = true
        }
        if (hit) set.add(path)
        return hit
      }
      if (val === null) return matcher('null')
      if (val === undefined) return matcher('undefined')
      return matcher(String(val))
    }
    visit(value, '$', { n: 8000 })
    return set
  }, [matcher, value])

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

  const renderNode = (
    label: string | number,
    val: unknown,
    path: string,
    depth: number
  ): ReactNode => {
    const kind = kindOf(val)
    const style = kindStyle(val, kind)
    const isContainer = kind === 'array' || kind === 'object'
    const open = isContainer && isOpen(path, depth)
    const keyText = typeof label === 'number' ? `${label}` : label

    let entries: Array<readonly [string | number, unknown]> = []
    let total = 0
    if (isContainer && open) {
      if (kind === 'array') {
        const arr = val as unknown[]
        total = arr.length
        const limit = pages[path] ?? ARRAY_PAGE
        entries = arr.slice(0, limit).map((v, i) => [i, v] as const)
      } else {
        const obj = Object.entries(val as Record<string, unknown>)
        total = obj.length
        entries = obj
      }
    }

    return (
      <div key={path} className="leading-relaxed">
        <div className="group -mx-1 flex items-start gap-2 rounded px-1 hover:bg-elevated">
          {/* expander */}
          <button
            type="button"
            onClick={() => isContainer && toggle(path, open)}
            className={`mt-[3px] flex h-4 w-4 flex-shrink-0 items-center justify-center rounded text-subtle ${
              isContainer ? 'hover:bg-elevated' : 'invisible'
            }`}
            tabIndex={-1}
          >
            <span className="text-[10px]">{open ? '▾' : '▸'}</span>
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2">
              {/* key */}
              <span className="font-mono text-xs font-semibold text-syntax-key">
                {highlight(keyText, matcher, search)}
              </span>
              <span
                className={`rounded px-1 py-px font-mono text-[10px] font-medium ${style.badge}`}
              >
                {style.label}
              </span>

              {/* primitive value (inline) */}
              {!isContainer && (
                <PrimitiveValue value={val} kind={kind} matcher={matcher} raw={search} />
              )}

              {/* container preview when collapsed */}
              {isContainer && !open && (
                <span className="font-mono text-xs text-subtle">
                  {kind === 'array' ? `[ … ]` : `{ … }`}
                </span>
              )}

              {/* copy actions */}
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
                  onClick={() => copy(typeof val === 'string' ? val : JSON.stringify(val, null, 2))}
                  className="rounded px-1 py-px text-[10px] text-subtle hover:bg-elevated hover:text-fg"
                  title="Copy value"
                >
                  value
                </button>
              </span>
            </div>

            {/* children */}
            {isContainer && open && (
              <div className="mt-0.5 space-y-0.5 border-l border-line pl-3">
                {entries.length === 0 ? (
                  <div className="font-mono text-xs text-subtle">
                    {kind === 'array' ? 'empty array' : 'empty object'}
                  </div>
                ) : (
                  entries.map(([k, v]) => renderNode(k, v, joinPath(path, k), depth + 1))
                )}
                {kind === 'array' && total > entries.length && (
                  <button
                    type="button"
                    onClick={() =>
                      setPages((prev) => ({
                        ...prev,
                        [path]: (prev[path] ?? ARRAY_PAGE) + ARRAY_PAGE
                      }))
                    }
                    className="rounded px-2 py-0.5 text-xs font-medium text-accent hover:bg-accent/10"
                  >
                    Show {Math.min(ARRAY_PAGE, total - entries.length)} more of {total}…
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // The root: render either object props, array items, or a single primitive.
  const rootKind = kindOf(value)

  return (
    <div className="font-mono text-sm">
      {/* toolbar */}
      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search keys & values…"
            className="w-full rounded-md border border-line bg-sunken px-2.5 py-1 text-xs text-fg placeholder-subtle focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
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

      {/* tree */}
      <div className="space-y-0.5">
        {rootKind === 'object' ? (
          Object.entries(value as Record<string, unknown>).map(([k, v]) =>
            renderNode(k, v, joinPath('$', k), 0)
          )
        ) : rootKind === 'array' ? (
          (value as unknown[]).length === 0 ? (
            <div className="text-xs text-subtle">empty array</div>
          ) : (
            (value as unknown[])
              .slice(0, pages['$'] ?? ARRAY_PAGE)
              .map((v, i) => renderNode(i, v, joinPath('$', i), 0))
          )
        ) : (
          renderNode('value', value, '$', 0)
        )}
      </div>
    </div>
  )
}

function PrimitiveValue({
  value,
  kind,
  matcher,
  raw
}: {
  value: unknown
  kind: ValueKind
  matcher: ((t: string) => boolean) | null
  raw: string
}): JSX.Element {
  if (kind === 'null') {
    return <span className="italic text-subtle">{value === undefined ? 'undefined' : 'null'}</span>
  }
  if (kind === 'string') {
    const str = value as string
    const isUrl = /^https?:\/\//.test(str)
    if (isUrl) {
      return (
        <button
          type="button"
          onClick={() => window.api.openExternal(str)}
          className="break-all text-left text-syntax-string underline decoration-syntax-string/40 underline-offset-2 hover:decoration-syntax-string"
        >
          &quot;{highlight(str, matcher, raw)}&quot;
        </button>
      )
    }
    return (
      <span className="break-all text-syntax-string">
        &quot;{highlight(str, matcher, raw)}&quot;
      </span>
    )
  }
  if (kind === 'number') {
    return (
      <span className="font-semibold text-syntax-number">
        {highlight(String(value), matcher, raw)}
      </span>
    )
  }
  // boolean
  return (
    <span
      className={`font-semibold ${
        value ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
      }`}
    >
      {String(value)}
    </span>
  )
}
