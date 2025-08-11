import { useState } from 'react'

interface SimpleArrayViewerProps {
  value: any
  expanded?: boolean
}

export function SimpleArrayViewer({ value, expanded = true }: SimpleArrayViewerProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  // Extrahuj pouze 'data' property pokud existuje, jinak celý objekt
  const dataToShow = value?.data || value

  const toggleItem = (key: string) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(key)) {
        newSet.delete(key)
      } else {
        newSet.add(key)
      }
      return newSet
    })
  }

  const renderValue = (val: any, key: string, level: number = 0): React.ReactNode => {
    if (val === null) {
      return <span className="text-slate-400 italic">null</span>
    }

    if (val === undefined) {
      return <span className="text-slate-400 italic">undefined</span>
    }

    if (typeof val === 'string') {
      const isUrl = /^https?:\/\//.test(val)
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)

      if (isUrl) {
        return (
          <span
            className="text-blue-600 dark:text-blue-400 underline cursor-pointer hover:text-blue-800 dark:hover:text-blue-300"
            onClick={() => window.open(val)}
          >
            "{val}"
          </span>
        )
      }

      if (isEmail) {
        return <span className="text-purple-600 dark:text-purple-400">"{val}"</span>
      }

      return <span className="text-emerald-600 dark:text-emerald-400">"{val}"</span>
    }

    if (typeof val === 'number') {
      return <span className="text-blue-600 dark:text-blue-400 font-medium">{val}</span>
    }

    if (typeof val === 'boolean') {
      return (
        <span className="text-purple-600 dark:text-purple-400 font-medium">{val.toString()}</span>
      )
    }

    if (Array.isArray(val)) {
      const isExpanded = expandedItems.has(key)

      if (val.length === 0) {
        return <span className="text-slate-500">[]</span>
      }

      return (
        <div>
          <button
            onClick={() => toggleItem(key)}
            className="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium"
          >
            [{isExpanded ? '−' : '+'}] Array ({val.length})
          </button>
          {isExpanded && (
            <div className="ml-4 mt-1 border-l border-slate-200 dark:border-slate-700 pl-3 space-y-1">
              {val.map((item, index) => (
                <div key={index} className="flex gap-3">
                  <span className="text-slate-500 font-mono text-sm w-8">[{index}]</span>
                  <div className="flex-1">{renderValue(item, `${key}[${index}]`, level + 1)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }

    if (typeof val === 'object') {
      const keys = Object.keys(val)
      const isExpanded = expandedItems.has(key)

      if (keys.length === 0) {
        return <span className="text-slate-500">{'{}'}</span>
      }

      return (
        <div>
          <button
            onClick={() => toggleItem(key)}
            className="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-medium"
          >
            {isExpanded ? '{−}' : '{+}'} Object ({keys.length})
          </button>
          {isExpanded && (
            <div className="ml-4 mt-1 border-l border-slate-200 dark:border-slate-700 pl-3 space-y-1">
              {keys.map((objKey) => (
                <div key={objKey} className="flex gap-3">
                  <span className="text-blue-600 dark:text-blue-400 font-mono text-sm min-w-fit">
                    "{objKey}":
                  </span>
                  <div className="flex-1">
                    {renderValue(val[objKey], `${key}.${objKey}`, level + 1)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }

    return <span className="text-slate-600 dark:text-slate-400">{String(val)}</span>
  }

  // Pokud je dataToShow objekt, rozbal ho na první úrovni
  if (typeof dataToShow === 'object' && dataToShow !== null && !Array.isArray(dataToShow)) {
    const keys = Object.keys(dataToShow)

    return (
      <div className="space-y-2 font-mono text-sm">
        {keys.map((key) => (
          <div
            key={key}
            className="flex gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 rounded px-2 py-1 -mx-2"
          >
            <span className="text-blue-600 dark:text-blue-400 font-medium min-w-fit">"{key}":</span>
            <div className="flex-1">{renderValue(dataToShow[key], key)}</div>
          </div>
        ))}
      </div>
    )
  }

  // Pro jednoduché hodnoty nebo pole
  return <div className="font-mono text-sm">{renderValue(dataToShow, 'root')}</div>
}
