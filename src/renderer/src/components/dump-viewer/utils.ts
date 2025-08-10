import { FileLocation, DumpTypeInfo, DumpMetric } from './types'

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

export function getPayloadSize(payload: any): number {
  const jsonString = JSON.stringify(payload)
  return new Blob([jsonString]).size
}

export function extractFileAndLine(payload: any): FileLocation | null {
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

export function getDumpTypeInfo(payload: any): DumpTypeInfo {
  if (payload.type === 'query' || payload.sql) {
    return {
      icon: 'sql',
      type: 'SQL Query',
      color: 'text-blue-600 dark:text-blue-400'
    }
  }

  if (payload.type === 'exception' || payload.error || payload.exception) {
    return {
      icon: 'error',
      type: 'Exception',
      color: 'text-red-600 dark:text-red-400'
    }
  }

  if (payload.type === 'log' || payload.level) {
    return {
      icon: 'log',
      type: 'Log Entry',
      color: 'text-amber-600 dark:text-amber-400'
    }
  }

  if (payload.type === 'http' || payload.method || payload.url) {
    return {
      icon: 'http',
      type: 'HTTP Request',
      color: 'text-purple-600 dark:text-purple-400'
    }
  }

  return {
    icon: 'data',
    type: 'Data Dump',
    color: 'text-slate-600 dark:text-slate-400'
  }
}

export function getDumpTitle(payload: any): string {
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

export function getDumpMetrics(payload: any): DumpMetric[] {
  const metrics: DumpMetric[] = []

  if (payload.sql && payload.time) {
    const time = parseFloat(payload.time)
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

  if (payload.bindings && payload.bindings.length > 0) {
    metrics.push({
      label: 'Bindings',
      value: payload.bindings.length.toString(),
      color: 'text-blue-600 dark:text-blue-400',
      icon: 'hash'
    })
  }

  if (payload.level) {
    const levelColors = {
      error: 'text-red-600 dark:text-red-400',
      warning: 'text-amber-600 dark:text-amber-400',
      info: 'text-blue-600 dark:text-blue-400',
      debug: 'text-slate-600 dark:text-slate-400'
    }
    metrics.push({
      label: 'Level',
      value: payload.level.toUpperCase(),
      color:
        levelColors[payload.level as keyof typeof levelColors] ||
        'text-slate-600 dark:text-slate-400',
      icon: 'check'
    })
  }

  if (payload.status) {
    const status = parseInt(payload.status)
    const statusColor =
      status >= 500
        ? 'text-red-600 dark:text-red-400'
        : status >= 400
          ? 'text-amber-600 dark:text-amber-400'
          : status >= 300
            ? 'text-blue-600 dark:text-blue-400'
            : 'text-emerald-600 dark:text-emerald-400'
    metrics.push({
      label: 'Status',
      value: status.toString(),
      color: statusColor,
      icon: 'check'
    })
  }

  if (payload.memory) {
    const memory = parseInt(payload.memory)
    metrics.push({
      label: 'Memory',
      value: formatBytes(memory),
      color: 'text-purple-600 dark:text-purple-400',
      icon: 'cpu'
    })
  }

  // Add payload size
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
