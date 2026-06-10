// src/renderer/src/components/dump-viewer/DumpDetail.tsx
//
// Detail panel. Meta header + type-aware body:
//   exception → ExceptionDumpItem (reused, always-expanded)
//   sql       → formatted query (sql-formatter) + interpolated bindings + timing
//   http      → method/url/status, headers, body, copy-as-cURL
//   var       → structured VarDump tree
//   data/log  → JsonTree
// Styled on the semantic token layer.

import { useState, type JSX } from 'react'
import { format as formatSql } from 'sql-formatter'
import { Dump, Server } from '../../App'
import type { ParsedException } from '../../utils/exceptionParser'
import { ExceptionDumpItem } from './ExceptionDumpItem'
import { JsonTree } from './JsonTree'
import { VarDump } from './VarDump'
import { CodeBlock } from './CodeBlock'
import { isVarPayload } from './var-types'
import { EditorLink } from './EditorLink'
import {
  PerformanceView,
  EventView,
  ModelView,
  CollectionView,
  TableView,
  MeasureView
} from './TypeViews'
import { SERVER_COLORS, FLAG_COLORS } from './types'
import { getDumpType, getDumpTitle, getPayloadSize, formatBytes } from './utils'

interface DumpDetailProps {
  dump: Dump | null
  server: Server | undefined
  parsedException: ParsedException | null
}

function rec(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function buildCurl(p: Record<string, unknown>): string {
  const method = typeof p.method === 'string' ? p.method.toUpperCase() : 'GET'
  const url = typeof p.url === 'string' ? p.url : ''
  const parts = [`curl -X ${method} ${JSON.stringify(url)}`]
  const headers = rec(p.headers)
  for (const [k, v] of Object.entries(headers)) {
    parts.push(`  -H ${JSON.stringify(`${k}: ${String(v)}`)}`)
  }
  if (p.body !== undefined && p.body !== null && method !== 'GET') {
    const body = typeof p.body === 'string' ? p.body : JSON.stringify(p.body)
    parts.push(`  -d ${JSON.stringify(body)}`)
  }
  return parts.join(' \\\n')
}

function interpolateBindings(sql: string, bindings: unknown[]): string {
  let i = 0
  return sql.replace(/\?/g, () => {
    if (i >= bindings.length) return '?'
    const b = bindings[i++]
    if (b === null) return 'NULL'
    if (typeof b === 'number' || typeof b === 'boolean') return String(b)
    return `'${String(b).replace(/'/g, "''")}'`
  })
}

// Small section heading reused across the type-aware bodies.
function SectionTitle({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-subtle">
      {children}
    </h4>
  )
}

const PANEL = 'rounded-lg border border-line bg-panel'

export function DumpDetail({ dump, server, parsedException }: DumpDetailProps): JSX.Element {
  const [copied, setCopied] = useState<'json' | 'curl' | null>(null)

  if (!dump) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-subtle">
        <svg className="h-14 w-14 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <p className="text-sm">Select a dump to inspect it.</p>
        <p className="text-xs text-subtle/80">Use j / k or the arrow keys to navigate.</p>
      </div>
    )
  }

  const p = rec(dump.payload)
  const type = getDumpType(dump.payload)
  const serverStyle = server
    ? (SERVER_COLORS[server.color as keyof typeof SERVER_COLORS] ?? SERVER_COLORS.gray)
    : SERVER_COLORS.gray
  const flagStyle = FLAG_COLORS[dump.flag || 'gray']

  const copy = async (what: 'json' | 'curl', text: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(what)
      setTimeout(() => setCopied(null), 2000)
    } catch (err) {
      console.error('Copy failed:', err)
    }
  }

  const copyBtn =
    'rounded-md border border-line bg-sunken px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:bg-elevated hover:text-fg'

  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface">
      {/* Meta header */}
      <div className="flex flex-shrink-0 items-center gap-3 border-b border-line bg-panel px-4 py-2.5">
        <span className={`h-2.5 w-2.5 rounded-full ${flagStyle.dot}`} title={dump.flag || 'gray'} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-fg">
              {getDumpTitle(dump.payload)}
            </span>
            {typeof p.count === 'number' && p.count > 1 && (
              <span
                title={`Sent ${p.count} times`}
                className="shrink-0 rounded-full bg-accent/15 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-accent"
              >
                ×{p.count}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-subtle">
            {server && (
              <span className={`inline-flex items-center gap-1 ${serverStyle.text}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${serverStyle.bg}`} />
                {server.name}
              </span>
            )}
            <span className="uppercase tracking-wide">{type}</span>
            {dump.channel && dump.channel !== 'default' && (
              <span className="font-mono">#{dump.channel}</span>
            )}
            {dump.origin && <span className="font-mono">{dump.origin}</span>}
            <span>{new Date(dump.timestamp).toLocaleString()}</span>
            <span className="tabular-nums">{formatBytes(getPayloadSize(dump.payload))}</span>
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-1.5">
          {type === 'http' && (
            <button type="button" onClick={() => copy('curl', buildCurl(p))} className={copyBtn}>
              {copied === 'curl' ? 'Copied!' : 'Copy cURL'}
            </button>
          )}
          <button
            type="button"
            onClick={() => copy('json', JSON.stringify(dump.payload, null, 2))}
            className={copyBtn}
          >
            {copied === 'json' ? 'Copied!' : 'Copy JSON'}
          </button>
        </div>
      </div>

      {/* Body */}
      <div key={dump.id} className="flex-1 animate-fade-in overflow-y-auto p-4">
        {p.type === 'raw' ? (
          <RawBody payload={p} />
        ) : type === 'exception' && parsedException ? (
          <ExceptionDumpItem
            dump={dump}
            server={server}
            parsedException={parsedException}
            isExpanded={true}
            onToggleExpand={() => {}}
          />
        ) : type === 'sql' ? (
          <SqlBody payload={p} />
        ) : type === 'http' ? (
          <HttpBody payload={p} />
        ) : type === 'var' ? (
          <VarBody payload={p} />
        ) : type === 'performance' ? (
          <PerformanceView payload={p} />
        ) : type === 'event' ? (
          <EventView payload={p} />
        ) : type === 'model' ? (
          <ModelView payload={p} />
        ) : type === 'collection' ? (
          <CollectionView payload={p} />
        ) : type === 'table' ? (
          <TableView payload={p} />
        ) : type === 'measure' ? (
          <MeasureView payload={p} />
        ) : (
          <ValueBody value={dump.payload} />
        )}
      </div>
    </div>
  )
}

function SqlBody({ payload }: { payload: Record<string, unknown> }): JSX.Element {
  const sql = typeof payload.sql === 'string' ? payload.sql : ''
  const bindings = Array.isArray(payload.bindings) ? payload.bindings : []
  let pretty = sql
  try {
    pretty = sql ? formatSql(sql) : ''
  } catch {
    pretty = sql
  }
  const time = payload.time !== undefined ? parseFloat(String(payload.time)) : undefined
  const timeColor =
    time === undefined
      ? ''
      : time > 1000
        ? 'text-dump-red'
        : time > 100
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-emerald-600 dark:text-emerald-400'

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-sm">
        {time !== undefined && <span className={`font-medium ${timeColor}`}>⏱ {time} ms</span>}
        {bindings.length > 0 && <span className="text-muted">{bindings.length} bindings</span>}
      </div>

      <div>
        <SectionTitle>Query</SectionTitle>
        <CodeBlock code={pretty} lang="sql" />
      </div>

      {bindings.length > 0 && (
        <div>
          <SectionTitle>Interpolated</SectionTitle>
          <CodeBlock
            code={(() => {
              try {
                return formatSql(interpolateBindings(sql, bindings))
              } catch {
                return interpolateBindings(sql, bindings)
              }
            })()}
            lang="sql"
          />
        </div>
      )}
    </div>
  )
}

function HttpBody({ payload }: { payload: Record<string, unknown> }): JSX.Element {
  const method = typeof payload.method === 'string' ? payload.method.toUpperCase() : undefined
  const url = typeof payload.url === 'string' ? payload.url : undefined
  const status = payload.status !== undefined ? parseInt(String(payload.status)) : undefined
  const headers = rec(payload.headers)
  const statusColor =
    status === undefined
      ? 'bg-sunken text-muted'
      : status >= 500
        ? 'bg-dump-red/15 text-dump-red'
        : status >= 400
          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
          : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {method && (
          <span className="rounded bg-accent/15 px-2 py-0.5 text-xs font-bold text-accent">
            {method}
          </span>
        )}
        {status !== undefined && (
          <span className={`rounded px-2 py-0.5 text-xs font-bold ${statusColor}`}>{status}</span>
        )}
        {url && <span className="break-all font-mono text-sm text-fg">{url}</span>}
      </div>

      {Object.keys(headers).length > 0 && (
        <div>
          <SectionTitle>Headers</SectionTitle>
          <div className={`overflow-hidden ${PANEL}`}>
            {Object.entries(headers).map(([k, v]) => (
              <div
                key={k}
                className="flex gap-3 border-b border-line px-3 py-1.5 text-xs last:border-0"
              >
                <span className="font-mono font-medium text-muted">{k}</span>
                <span className="break-all font-mono text-fg">{String(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <SectionTitle>Body</SectionTitle>
        {typeof payload.body === 'string' ? (
          <StringBody text={payload.body} />
        ) : payload.body !== undefined ? (
          <ValueBody value={payload.body} />
        ) : (
          <ValueBody value={payload} />
        )}
      </div>
    </div>
  )
}

/**
 * Renderer for the unified value tree. Surfaces the caller site, then renders
 * the root `VarNode` via the structured var_dump-style `VarDump`. When the
 * payload is not a proper `var` tree it falls back to the generic value viewer.
 */
function VarBody({ payload }: { payload: Record<string, unknown> }): JSX.Element {
  const caller = rec(payload.caller)
  const file = typeof caller.file === 'string' ? caller.file : undefined
  const line = typeof caller.line === 'number' ? caller.line : undefined
  const language = typeof payload.language === 'string' ? payload.language : undefined
  const root = isVarPayload(payload) ? payload.value : null

  return (
    <div className="space-y-3">
      {(file || language) && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
          {language && (
            <span className="rounded bg-accent/15 px-2 py-0.5 font-medium uppercase text-accent">
              {language}
            </span>
          )}
          {file && <EditorLink file={file} line={line} className="break-all font-mono" />}
        </div>
      )}
      {root ? (
        <div className={`p-4 ${PANEL}`}>
          <VarDump root={root} />
        </div>
      ) : (
        <ValueBody value={payload.value ?? payload} />
      )}
    </div>
  )
}

function ValueBody({ value }: { value: unknown }): JSX.Element {
  return (
    <div className={`p-4 ${PANEL}`}>
      <JsonTree value={value} />
    </div>
  )
}

/** Is this string valid JSON we can pretty-print and highlight as JSON? */
function asPrettyJson(text: string): string | null {
  const t = text.trim()
  if (!t || (t[0] !== '{' && t[0] !== '[')) return null
  try {
    return JSON.stringify(JSON.parse(t), null, 2)
  } catch {
    return null
  }
}

/** A highlighted code view for a string body (JSON when it parses, else text). */
function StringBody({ text }: { text: string }): JSX.Element {
  const pretty = asPrettyJson(text)
  return <CodeBlock code={pretty ?? text} lang={pretty ? 'json' : 'text'} />
}

/** Unparseable ingest input — show the original text, highlighted, plus why. */
function RawBody({ payload }: { payload: Record<string, unknown> }): JSX.Element {
  const data = payload.data
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
  const error = typeof payload.error === 'string' ? payload.error : undefined
  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-lg border border-dump-red/30 bg-dump-red/10 px-3 py-2 text-xs text-dump-red">
          Could not parse as JSON — {error}
        </div>
      )}
      <div>
        <SectionTitle>Raw payload</SectionTitle>
        <StringBody text={text} />
      </div>
    </div>
  )
}
