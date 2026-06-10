// src/renderer/src/components/dump-viewer/TypeViews.tsx
//
// Rich, framework-agnostic type renderers (Phase C3). Each consumes the raw dump
// payload (a plain record off the wire) and renders a focused view; nested values
// fall back to JsonTree so everything stays inspectable. The generic Ray-style
// types — model / collection / table / measure — are language-neutral targets that
// SDKs map their framework objects into (Eloquent, Django, Sequelize/Prisma, Go
// structs).

import type { JSX, ReactNode } from 'react'
import { JsonTree } from './JsonTree'
import { formatBytes } from './utils'

function rec(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function num(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : parseFloat(String(value))
  return Number.isFinite(n) ? n : undefined
}

function Section({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <div>
      <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-subtle">
        {title}
      </h4>
      {children}
    </div>
  )
}

/** ms timing color matching the SQL timing thresholds used elsewhere. */
function timeColor(ms: number): string {
  if (ms > 1000) return 'text-red-600 dark:text-red-400'
  if (ms > 100) return 'text-amber-600 dark:text-amber-400'
  return 'text-emerald-600 dark:text-emerald-400'
}

function Tree({ value }: { value: unknown }): JSX.Element {
  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <JsonTree value={value} />
    </div>
  )
}

// --- performance -----------------------------------------------------------

const BREAKDOWN_COLORS = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-purple-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-indigo-500'
]

/** A metric whose value is a byte count gets human-formatted. */
function formatMetric(key: string, value: unknown): string {
  const n = num(value)
  if (n === undefined) return String(value)
  if (/memory|bytes|size/i.test(key)) return formatBytes(n)
  if (/time|duration|latency|ms/i.test(key)) return `${n} ms`
  if (/cpu|usage|percent/i.test(key)) return `${n}%`
  return String(n)
}

export function PerformanceView({ payload }: { payload: Record<string, unknown> }): JSX.Element {
  const metrics = rec(payload.metrics)
  const breakdown = rec(payload.breakdown)
  const context = rec(payload.context)

  const breakdownEntries = Object.entries(breakdown)
    .map(([k, v]) => [k, num(v) ?? 0] as const)
    .filter(([, v]) => v > 0)
  const breakdownTotal = breakdownEntries.reduce((acc, [, v]) => acc + v, 0)

  return (
    <div className="space-y-4">
      {Object.keys(metrics).length > 0 && (
        <Section title="Metrics">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Object.entries(metrics).map(([k, v]) => (
              <div key={k} className="rounded-lg border border-line bg-panel px-3 py-2">
                <div className="text-[11px] uppercase tracking-wide text-subtle">
                  {k.replace(/_/g, ' ')}
                </div>
                <div className="text-sm font-semibold text-fg">{formatMetric(k, v)}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {breakdownEntries.length > 0 && (
        <Section title="Breakdown">
          <div className="space-y-2">
            <div className="flex h-3 overflow-hidden rounded-full bg-sunken">
              {breakdownEntries.map(([k, v], i) => (
                <div
                  key={k}
                  className={BREAKDOWN_COLORS[i % BREAKDOWN_COLORS.length]}
                  style={{ width: `${(v / breakdownTotal) * 100}%` }}
                  title={`${k}: ${v} ms`}
                />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {breakdownEntries.map(([k, v], i) => (
                <div key={k} className="flex items-center gap-1.5 text-xs">
                  <span
                    className={`h-2.5 w-2.5 flex-shrink-0 rounded-sm ${BREAKDOWN_COLORS[i % BREAKDOWN_COLORS.length]}`}
                  />
                  <span className="text-muted">{k.replace(/_/g, ' ')}</span>
                  <span className="ml-auto font-medium text-fg">{v} ms</span>
                </div>
              ))}
            </div>
          </div>
        </Section>
      )}

      {Object.keys(context).length > 0 && (
        <Section title="Context">
          <Tree value={context} />
        </Section>
      )}
    </div>
  )
}

// --- event -----------------------------------------------------------------

export function EventView({ payload }: { payload: Record<string, unknown> }): JSX.Element {
  const event = typeof payload.event === 'string' ? payload.event : undefined
  const entity = typeof payload.entity === 'string' ? payload.entity : undefined
  const entityId = payload.entity_id ?? payload.entityId
  const actor = rec(payload.actor)
  const data = payload.data
  const metadata = rec(payload.metadata)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {event && (
          <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
            {event}
          </span>
        )}
        {entity && (
          <span className="text-sm text-muted">
            {entity}
            {entityId !== undefined && (
              <span className="font-mono text-subtle"> #{String(entityId)}</span>
            )}
          </span>
        )}
      </div>

      {Object.keys(actor).length > 0 && (
        <Section title="Actor">
          <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-lg border border-line bg-panel px-3 py-2 text-xs">
            {Object.entries(actor).map(([k, v]) => (
              <span key={k}>
                <span className="text-subtle">{k}: </span>
                <span className="font-medium text-fg">{String(v)}</span>
              </span>
            ))}
          </div>
        </Section>
      )}

      {data !== undefined && (
        <Section title="Data">
          <Tree value={data} />
        </Section>
      )}

      {Object.keys(metadata).length > 0 && (
        <Section title="Metadata">
          <Tree value={metadata} />
        </Section>
      )}
    </div>
  )
}

// --- model -----------------------------------------------------------------

export function ModelView({ payload }: { payload: Record<string, unknown> }): JSX.Element {
  const className =
    (typeof payload.class === 'string' && payload.class) ||
    (typeof payload.model === 'string' && payload.model) ||
    'Model'
  const attributes = rec(payload.attributes)
  const relations = rec(payload.relations)
  const connection = typeof payload.connection === 'string' ? payload.connection : undefined
  const exists = typeof payload.exists === 'boolean' ? payload.exists : undefined

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">
          {className}
        </span>
        {exists !== undefined && (
          <span
            className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
              exists
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                : 'bg-elevated text-muted'
            }`}
          >
            {exists ? 'persisted' : 'new'}
          </span>
        )}
        {connection && <span className="text-xs text-subtle">on {connection}</span>}
      </div>

      {Object.keys(attributes).length > 0 && (
        <Section title="Attributes">
          <KeyValueTable record={attributes} />
        </Section>
      )}

      {Object.keys(relations).length > 0 && (
        <Section title="Relations">
          <Tree value={relations} />
        </Section>
      )}
    </div>
  )
}

/** Two-column attribute table; scalars inline, nested values via JsonTree. */
function KeyValueTable({ record }: { record: Record<string, unknown> }): JSX.Element {
  return (
    <div className="overflow-hidden rounded-lg border border-line">
      {Object.entries(record).map(([k, v]) => {
        const nested = v !== null && typeof v === 'object'
        return (
          <div
            key={k}
            className="flex gap-3 border-b border-line px-3 py-1.5 text-xs last:border-0"
          >
            <span className="w-40 flex-shrink-0 font-mono font-medium text-muted">{k}</span>
            {nested ? (
              <div className="min-w-0 flex-1">
                <JsonTree value={v} defaultExpandedDepth={0} />
              </div>
            ) : (
              <span className="break-all font-mono text-fg">{v === null ? 'null' : String(v)}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// --- table / collection ----------------------------------------------------

/** Render rows of records as an HTML table; columns inferred from keys order. */
function RecordTable({
  rows,
  columns
}: {
  rows: Record<string, unknown>[]
  columns: string[]
}): JSX.Element {
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-sunken">
            {columns.map((c) => (
              <th
                key={c}
                className="border-b border-line px-3 py-1.5 text-left font-semibold text-muted"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="even:bg-sunken/50">
              {columns.map((c) => {
                const v = row[c]
                const text =
                  v === null || v === undefined
                    ? ''
                    : typeof v === 'object'
                      ? JSON.stringify(v)
                      : String(v)
                return (
                  <td
                    key={c}
                    className="border-b border-line px-3 py-1 font-mono text-fg last:border-0"
                  >
                    {text}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function TableView({ payload }: { payload: Record<string, unknown> }): JSX.Element {
  const rawRows = Array.isArray(payload.rows) ? payload.rows : []
  const explicitCols = Array.isArray(payload.columns)
    ? payload.columns.map((c) => String(c))
    : undefined

  // Rows can be arrays (aligned to `columns`) or records (keys = columns).
  if (rawRows.length > 0 && Array.isArray(rawRows[0])) {
    const cols = explicitCols ?? (rawRows[0] as unknown[]).map((_, i) => `#${i}`)
    const rows = (rawRows as unknown[][]).map((arr) => {
      const r: Record<string, unknown> = {}
      cols.forEach((c, i) => (r[c] = arr[i]))
      return r
    })
    return <RecordTable rows={rows} columns={cols} />
  }

  const records = rawRows.filter(
    (r): r is Record<string, unknown> => r !== null && typeof r === 'object' && !Array.isArray(r)
  )
  const cols = explicitCols ?? inferColumns(records)
  if (records.length === 0) return <Tree value={payload} />
  return <RecordTable rows={records} columns={cols} />
}

function inferColumns(rows: Record<string, unknown>[]): string[] {
  const seen = new Set<string>()
  for (const r of rows) for (const k of Object.keys(r)) seen.add(k)
  return [...seen]
}

export function CollectionView({ payload }: { payload: Record<string, unknown> }): JSX.Element {
  const items = Array.isArray(payload.items)
    ? payload.items
    : Array.isArray(payload.data)
      ? payload.data
      : []
  const count = num(payload.count) ?? items.length

  const records = items.filter(
    (i): i is Record<string, unknown> => i !== null && typeof i === 'object' && !Array.isArray(i)
  )
  const tabular = records.length === items.length && items.length > 0

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted">{count} items</div>
      {tabular ? (
        <RecordTable rows={records} columns={inferColumns(records)} />
      ) : (
        <Tree value={items} />
      )}
    </div>
  )
}

// --- measure ---------------------------------------------------------------

export function MeasureView({ payload }: { payload: Record<string, unknown> }): JSX.Element {
  const name = typeof payload.name === 'string' ? payload.name : 'Measure'
  const ms = num(payload.time) ?? num(payload.duration)
  const memory = num(payload.memory)
  const context = rec(payload.context)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="text-sm font-semibold text-fg">{name}</span>
        {ms !== undefined && <span className={`text-2xl font-bold ${timeColor(ms)}`}>{ms} ms</span>}
        {memory !== undefined && (
          <span className="text-sm text-purple-600 dark:text-purple-400">
            {formatBytes(memory)}
          </span>
        )}
      </div>
      {Object.keys(context).length > 0 && (
        <Section title="Context">
          <Tree value={context} />
        </Section>
      )}
    </div>
  )
}
