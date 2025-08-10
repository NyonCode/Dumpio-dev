import { useState, useMemo } from 'react'
import { Dump, Server } from '../App'

interface DumpViewerProps {
  dumps: Dump[]
  servers: Server[]
  onOpenInIde: (file: string, line: number) => void
}

interface DumpItemProps {
  dump: Dump
  server: Server | undefined
  onOpenInIde: (file: string, line: number) => void
  isExpanded: boolean
  onToggleExpand: () => void
}

const FLAG_COLORS = {
  yellow: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800/50',
    dot: 'bg-amber-500',
    accent: 'border-l-amber-500'
  },
  red: {
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800/50',
    dot: 'bg-red-500',
    accent: 'border-l-red-500'
  },
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-800/50',
    dot: 'bg-blue-500',
    accent: 'border-l-blue-500'
  },
  gray: {
    bg: 'bg-gray-50 dark:bg-gray-950/30',
    border: 'border-gray-200 dark:border-gray-700/50',
    dot: 'bg-gray-500',
    accent: 'border-l-gray-500'
  },
  purple: {
    bg: 'bg-purple-50 dark:bg-purple-950/30',
    border: 'border-purple-200 dark:border-purple-800/50',
    dot: 'bg-purple-500',
    accent: 'border-l-purple-500'
  },
  pink: {
    bg: 'bg-pink-50 dark:bg-pink-950/30',
    border: 'border-pink-200 dark:border-pink-800/50',
    dot: 'bg-pink-500',
    accent: 'border-l-pink-500'
  },
  green: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-200 dark:border-emerald-800/50',
    dot: 'bg-emerald-500',
    accent: 'border-l-emerald-500'
  }
}

const SERVER_COLORS = {
  blue: {
    bg: 'bg-blue-500',
    text: 'text-blue-700 dark:text-blue-300',
    bgLight: 'bg-blue-100 dark:bg-blue-900/30'
  },
  red: {
    bg: 'bg-red-500',
    text: 'text-red-700 dark:text-red-300',
    bgLight: 'bg-red-100 dark:bg-red-900/30'
  },
  green: {
    bg: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-300',
    bgLight: 'bg-emerald-100 dark:bg-emerald-900/30'
  },
  yellow: {
    bg: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-300',
    bgLight: 'bg-amber-100 dark:bg-amber-900/30'
  },
  purple: {
    bg: 'bg-purple-500',
    text: 'text-purple-700 dark:text-purple-300',
    bgLight: 'bg-purple-100 dark:bg-purple-900/30'
  },
  pink: {
    bg: 'bg-pink-500',
    text: 'text-pink-700 dark:text-pink-300',
    bgLight: 'bg-pink-100 dark:bg-pink-900/30'
  },
  gray: {
    bg: 'bg-gray-500',
    text: 'text-gray-700 dark:text-gray-300',
    bgLight: 'bg-gray-100 dark:bg-gray-900/30'
  }
}

function JsonValue({
  value,
  depth = 0,
  expanded = false
}: {
  value: any
  depth?: number
  expanded?: boolean
}) {
  const [isExpanded, setIsExpanded] = useState(expanded || depth < 2)

  if (value === null) {
    return <span className="text-slate-400 italic font-medium">null</span>
  }

  if (value === undefined) {
    return <span className="text-slate-400 italic font-medium">undefined</span>
  }

  if (typeof value === 'string') {
    const isUrl = /^https?:\/\//.test(value)
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    const isPath = /^[\/\\]/.test(value) || /[\/\\]/.test(value)

    if (isUrl) {
      return (
        <span
          className="text-blue-600 dark:text-blue-400 underline cursor-pointer hover:text-blue-800 dark:hover:text-blue-300"
          onClick={() => window.open(value)}
        >
          "{value}"
        </span>
      )
    }

    if (isEmail) {
      return <span className="text-purple-600 dark:text-purple-400 font-medium">"{value}"</span>
    }

    if (isPath) {
      return (
        <span className="text-orange-600 dark:text-orange-400 font-mono text-sm">"{value}"</span>
      )
    }

    return <span className="text-emerald-600 dark:text-emerald-400">"{value}"</span>
  }

  if (typeof value === 'number') {
    return <span className="text-orange-600 dark:text-orange-400 font-medium">{value}</span>
  }

  if (typeof value === 'boolean') {
    return (
      <span className="text-purple-600 dark:text-purple-400 font-medium">{value.toString()}</span>
    )
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-slate-500 font-mono">[]</span>
    }

    return (
      <div className="inline">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-mono font-medium"
        >
          [{isExpanded ? '−' : '+'}] Array<span className="text-slate-400">({value.length})</span>
        </button>
        {isExpanded && (
          <div className="ml-4 mt-2 border-l-2 border-slate-200 dark:border-slate-700 pl-4 space-y-1">
            {value.map((item, index) => (
              <div key={index} className="flex items-start gap-3">
                <span className="text-slate-500 font-mono text-sm min-w-[2rem] text-right">
                  {index}:
                </span>
                <JsonValue value={item} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value)

    if (keys.length === 0) {
      return <span className="text-slate-500 font-mono">{'{}'}</span>
    }

    return (
      <div className="inline">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-mono font-medium"
        >
          {isExpanded ? '{−}' : '{+}'} Object<span className="text-slate-400">({keys.length})</span>
        </button>
        {isExpanded && (
          <div className="ml-4 mt-2 border-l-2 border-slate-200 dark:border-slate-700 pl-4 space-y-1">
            {keys.map((key) => (
              <div key={key} className="flex items-start gap-3">
                <span className="text-blue-600 dark:text-blue-400 font-mono text-sm font-medium min-w-fit">
                  "{key}":
                </span>
                <JsonValue value={value[key]} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return <span className="text-slate-600 dark:text-slate-400">{String(value)}</span>
}

function DumpItem({ dump, server, onOpenInIde, isExpanded, onToggleExpand }: DumpItemProps) {
  const [copySuccess, setCopySuccess] = useState(false)

  const formatTimestamp = (timestamp: number) => {
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

  const extractFileAndLine = (payload: any) => {
    if (payload.file && payload.line) {
      return { file: payload.file, line: payload.line }
    }
    if (payload.trace && Array.isArray(payload.trace) && payload.trace[0]) {
      const firstTrace = payload.trace[0]
      if (firstTrace.file && firstTrace.line) {
        return { file: firstTrace.file, line: firstTrace.line }
      }
    }
    if (payload.origin && typeof payload.origin === 'string') {
      const match = payload.origin.match(/(.+):(\d+)$/)
      if (match) {
        return { file: match[1], line: parseInt(match[2]) }
      }
    }
    return null
  }

  const getDumpTypeInfo = (payload: any) => {
    if (payload.type === 'query' || payload.sql) {
      return {
        icon: (
          <svg
            className="w-5 h-5 text-blue-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 7v10c0 2.21 1.79 4 4 4h8c2.21 0 4-1.79 4-4V7c0-2.21-1.79-4-4-4H8c-2.21 0-4 1.79-4 4z"
            />
          </svg>
        ),
        type: 'SQL Query',
        color: 'text-blue-600 dark:text-blue-400'
      }
    }

    if (payload.type === 'exception' || payload.error || payload.exception) {
      return {
        icon: (
          <svg
            className="w-5 h-5 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        ),
        type: 'Exception',
        color: 'text-red-600 dark:text-red-400'
      }
    }

    if (payload.type === 'log' || payload.level) {
      return {
        icon: (
          <svg
            className="w-5 h-5 text-amber-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        ),
        type: 'Log Entry',
        color: 'text-amber-600 dark:text-amber-400'
      }
    }

    if (payload.type === 'http' || payload.method || payload.url) {
      return {
        icon: (
          <svg
            className="w-5 h-5 text-purple-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9"
            />
          </svg>
        ),
        type: 'HTTP Request',
        color: 'text-purple-600 dark:text-purple-400'
      }
    }

    return {
      icon: (
        <svg
          className="w-5 h-5 text-slate-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z"
          />
        </svg>
      ),
      type: 'Data Dump',
      color: 'text-slate-600 dark:text-slate-400'
    }
  }

  const getDumpTitle = (payload: any) => {
    if (payload.message) return payload.message
    if (payload.title) return payload.title
    if (payload.sql) return payload.sql.substring(0, 80) + (payload.sql.length > 80 ? '...' : '')
    if (payload.exception) return payload.exception
    if (payload.error) return payload.error
    if (payload.url && payload.method) return `${payload.method} ${payload.url}`
    if (payload.type) return payload.type.charAt(0).toUpperCase() + payload.type.slice(1)
    if (typeof payload === 'string') return payload.substring(0, 100)
    return 'Data Dump'
  }

  const getDumpMetrics = (payload: any) => {
    const metrics = []

    if (payload.sql && payload.time) {
      metrics.push({
        label: 'Query Time',
        value: `${payload.time}ms`,
        color: payload.time > 100 ? 'text-red-600' : 'text-emerald-600'
      })
    }

    if (payload.bindings && payload.bindings.length > 0) {
      metrics.push({
        label: 'Bindings',
        value: payload.bindings.length.toString(),
        color: 'text-blue-600'
      })
    }

    if (payload.level) {
      const levelColors = {
        error: 'text-red-600',
        warning: 'text-amber-600',
        info: 'text-blue-600',
        debug: 'text-slate-600'
      }
      metrics.push({
        label: 'Level',
        value: payload.level.toUpperCase(),
        color: levelColors[payload.level as keyof typeof levelColors] || 'text-slate-600'
      })
    }

    if (payload.status) {
      const statusColor =
        payload.status >= 400
          ? 'text-red-600'
          : payload.status >= 300
            ? 'text-amber-600'
            : 'text-emerald-600'
      metrics.push({ label: 'Status', value: payload.status.toString(), color: statusColor })
    }

    if (payload.memory) {
      metrics.push({
        label: 'Memory',
        value: `${Math.round(payload.memory / 1024 / 1024)}MB`,
        color: 'text-purple-600'
      })
    }

    return metrics
  }

  const fileLocation = extractFileAndLine(dump.payload)
  const flagStyle = FLAG_COLORS[dump.flag || 'gray']
  const serverStyle = server
    ? SERVER_COLORS[server.color as keyof typeof SERVER_COLORS]
    : SERVER_COLORS.gray
  const typeInfo = getDumpTypeInfo(dump.payload)
  const metrics = getDumpMetrics(dump.payload)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(dump.payload, null, 2))
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div
      className={`group border-l-4 ${flagStyle.accent} bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-r-lg shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden`}
    >
      {/* Header with Server Info */}
      <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Server Badge */}
            {server && (
              <div
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${serverStyle.bgLight} ${serverStyle.text}`}
              >
                <div className={`w-2 h-2 rounded-full ${serverStyle.bg} mr-2`}></div>
                {server.name}
                <span className="ml-2 text-xs opacity-75">
                  {server.host}:{server.port}
                </span>
              </div>
            )}

            {/* Channel */}
            {dump.channel && dump.channel !== 'default' && (
              <div className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                #{dump.channel}
              </div>
            )}

            {/* Timestamp */}
            <div className="flex items-center text-sm text-slate-500 dark:text-slate-400">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {formatTimestamp(dump.timestamp)}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Flag indicator */}
            <div
              className={`w-3 h-3 rounded-full ${flagStyle.dot} opacity-80`}
              title={`Flag: ${dump.flag || 'gray'}`}
            ></div>

            {/* Origin info */}
            <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              {dump.origin}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div
        className="px-6 py-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
        onClick={onToggleExpand}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-4 flex-1 min-w-0">
            {/* Type Icon */}
            <div className="flex-shrink-0 mt-1">{typeInfo.icon}</div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-3 mb-2">
                <span className={`text-sm font-medium ${typeInfo.color}`}>{typeInfo.type}</span>

                {/* Metrics */}
                {metrics.length > 0 && (
                  <div className="flex items-center space-x-3">
                    {metrics.map((metric, index) => (
                      <span key={index} className="text-xs">
                        <span className="text-slate-500 dark:text-slate-400">{metric.label}:</span>
                        <span className={`ml-1 font-medium ${metric.color}`}>{metric.value}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <h3 className="font-medium text-slate-900 dark:text-slate-100 leading-tight mb-2">
                {getDumpTitle(dump.payload)}
              </h3>

              {/* File location */}
              {fileLocation && (
                <div className="flex items-center space-x-2 text-sm text-slate-600 dark:text-slate-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <span className="font-mono text-xs">
                    {fileLocation.file.split('/').pop()}:{fileLocation.line}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            {fileLocation && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onOpenInIde(fileLocation.file, fileLocation.line)
                }}
                className="p-2 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                title="Open in IDE"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </button>
            )}

            <svg
              className={`w-4 h-4 text-slate-400 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <div className="p-6">
            {/* Quick Info Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="space-y-1">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  ID
                </span>
                <p className="font-mono text-sm text-slate-700 dark:text-slate-300 truncate">
                  {dump.id}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Timestamp
                </span>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  {new Date(dump.timestamp).toLocaleString()}
                </p>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Origin
                </span>
                <p className="text-sm text-slate-700 dark:text-slate-300 truncate">{dump.origin}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Flag
                </span>
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full ${flagStyle.dot}`}></div>
                  <span className="text-sm text-slate-700 dark:text-slate-300 capitalize">
                    {dump.flag || 'gray'}
                  </span>
                </div>
              </div>
            </div>

            {/* Payload */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Payload Data
                </h4>
                <button
                  onClick={handleCopy}
                  className={`inline-flex items-center px-4 py-2 border text-sm font-medium rounded-lg transition-all ${
                    copySuccess
                      ? 'border-emerald-300 dark:border-emerald-600 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20'
                      : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600'
                  }`}
                >
                  {copySuccess ? (
                    <>
                      <svg
                        className="w-4 h-4 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-4 h-4 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                      Copy JSON
                    </>
                  )}
                </button>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-6 overflow-x-auto">
                <div className="font-mono text-sm leading-relaxed">
                  <JsonValue value={dump.payload} expanded={true} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function DumpViewer({ dumps, servers, onOpenInIde }: DumpViewerProps) {
  const [expandedDump, setExpandedDump] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'detailed' | 'compact'>('detailed')

  const getServerById = (serverId: string) => {
    return servers.find((s) => s.id === serverId)
  }

  const toggleExpand = (dumpId: string) => {
    setExpandedDump(expandedDump === dumpId ? null : dumpId)
  }

  const dumpStats = useMemo(() => {
    const stats = {
      total: dumps.length,
      byServer: {} as Record<string, number>,
      byFlag: {} as Record<string, number>,
      byType: {} as Record<string, number>
    }

    dumps.forEach((dump) => {
      // By server
      const server = getServerById(dump.serverId)
      const serverName = server?.name || 'Unknown Server'
      stats.byServer[serverName] = (stats.byServer[serverName] || 0) + 1

      // By flag
      const flag = dump.flag || 'gray'
      stats.byFlag[flag] = (stats.byFlag[flag] || 0) + 1

      // By type
      let type = 'Data'
      if (dump.payload?.type === 'query' || dump.payload?.sql) type = 'SQL'
      else if (dump.payload?.type === 'exception' || dump.payload?.error) type = 'Error'
      else if (dump.payload?.type === 'log' || dump.payload?.level) type = 'Log'
      else if (dump.payload?.method || dump.payload?.url) type = 'HTTP'

      stats.byType[type] = (stats.byType[type] || 0) + 1
    })

    return stats
  }, [dumps, servers])

  if (dumps.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center max-w-lg">
          {/* Empty State Icon */}
          <div className="mx-auto h-32 w-32 text-slate-300 dark:text-slate-600 mb-8">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={0.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>

          <h3 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-3">
            No dumps yet
          </h3>
          <p className="text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
            Start your TCP servers and begin sending data to see dumps appear here.
            <br />
            Configure your servers in Settings to get started.
          </p>

          {/* Getting Started Card */}
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-xl p-6 text-left">
            <div className="flex items-center mb-4">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center mr-3">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h4 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                Getting Started
              </h4>
            </div>

            <div className="space-y-3 text-sm text-blue-800 dark:text-blue-200">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-blue-700 dark:text-blue-300 text-xs font-bold">1</span>
                </div>
                <p>Configure your TCP servers in the Settings panel</p>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-blue-700 dark:text-blue-300 text-xs font-bold">2</span>
                </div>
                <p>Send JSON data to the configured host:port</p>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-blue-700 dark:text-blue-300 text-xs font-bold">3</span>
                </div>
                <div>
                  <p>Use flags to categorize your dumps:</p>
                  <code className="bg-blue-100 dark:bg-blue-900/50 px-2 py-1 rounded text-xs mt-1 inline-block">
                    {`{ "message": "Hello", "flag": "red" }`}
                  </code>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Enhanced Toolbar */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            {/* Stats Overview */}
            <div className="flex items-center space-x-4">
              <div className="text-sm">
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {dumpStats.total}
                </span>
                <span className="text-slate-500 dark:text-slate-400 ml-1">
                  {dumpStats.total === 1 ? 'dump' : 'dumps'}
                </span>
              </div>

              {/* Server breakdown */}
              <div className="flex items-center space-x-2">
                {Object.entries(dumpStats.byServer)
                  .slice(0, 3)
                  .map(([serverName, count]) => {
                    const server = servers.find((s) => s.name === serverName)
                    const serverStyle = server
                      ? SERVER_COLORS[server.color as keyof typeof SERVER_COLORS]
                      : SERVER_COLORS.gray

                    return (
                      <div key={serverName} className="flex items-center space-x-1 text-xs">
                        <div className={`w-2 h-2 rounded-full ${serverStyle.bg}`}></div>
                        <span className="text-slate-600 dark:text-slate-400">{count}</span>
                      </div>
                    )
                  })}
                {Object.keys(dumpStats.byServer).length > 3 && (
                  <span className="text-xs text-slate-400">
                    +{Object.keys(dumpStats.byServer).length - 3} more
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Type filter indicators */}
            <div className="flex items-center space-x-2 text-xs">
              {Object.entries(dumpStats.byType).map(([type, count]) => (
                <div
                  key={type}
                  className="flex items-center space-x-1 px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded-md"
                >
                  <span className="text-slate-600 dark:text-slate-400">{type}</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">{count}</span>
                </div>
              ))}
            </div>

            {/* View Mode Toggle */}
            <div className="flex rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden bg-slate-50 dark:bg-slate-700">
              <button
                onClick={() => setViewMode('detailed')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  viewMode === 'detailed'
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 10h16M4 14h16M4 18h16"
                  />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('compact')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors border-l border-slate-300 dark:border-slate-600 ${
                  viewMode === 'compact'
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
        <div className="max-w-7xl mx-auto py-6 px-6">
          <div className={viewMode === 'compact' ? 'space-y-2' : 'space-y-6'}>
            {dumps.map((dump) => {
              const server = getServerById(dump.serverId)
              const isExpanded = expandedDump === dump.id

              return (
                <DumpItem
                  key={dump.id}
                  dump={dump}
                  server={server}
                  onOpenInIde={onOpenInIde}
                  isExpanded={isExpanded}
                  onToggleExpand={() => toggleExpand(dump.id)}
                />
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
