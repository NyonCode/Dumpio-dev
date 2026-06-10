import { useState } from 'react'
import { JsonViewerProps } from './types'

export function JsonViewer({ value, depth = 0, expanded = false }: JsonViewerProps) {
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
                <JsonViewer value={item} depth={depth + 1} />
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
                <JsonViewer value={value[key]} depth={depth + 1} />
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return <span className="text-slate-600 dark:text-slate-400">{String(value)}</span>
}
