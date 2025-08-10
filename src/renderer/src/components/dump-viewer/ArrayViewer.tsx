import React, { useState } from 'react'

interface ArrayViewerProps {
  value: any
  expanded?: boolean
}

export function ArrayViewer({ value, expanded = true }: ArrayViewerProps) {
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

  const getTypeInfo = (val: any) => {
    if (val === null)
      return {
        type: 'null',
        info: '',
        color: 'text-slate-500 dark:text-slate-400',
        bgColor: 'bg-slate-100 dark:bg-slate-800',
        icon: '∅'
      }
    if (val === undefined)
      return {
        type: 'undefined',
        info: '',
        color: 'text-slate-500 dark:text-slate-400',
        bgColor: 'bg-slate-100 dark:bg-slate-800',
        icon: '?'
      }

    if (typeof val === 'string') {
      const length = val.length
      const isUrl = /^https?:\/\//.test(val)
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)
      const isPath = /^[\/\\]/.test(val) || /[\/\\]/.test(val)

      let subtype = ''
      let icon = '"'
      if (isUrl) {
        subtype = ' • URL'
        icon = '🔗'
      } else if (isEmail) {
        subtype = ' • EMAIL'
        icon = '@'
      } else if (isPath) {
        subtype = ' • PATH'
        icon = '📁'
      }

      return {
        type: 'string',
        info: `${length} chars${subtype}`,
        color: 'text-emerald-700 dark:text-emerald-300',
        bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
        icon
      }
    }

    if (typeof val === 'number') {
      const isFloat = val % 1 !== 0
      return {
        type: isFloat ? 'float' : 'integer',
        info: '',
        color: 'text-blue-700 dark:text-blue-300',
        bgColor: 'bg-blue-50 dark:bg-blue-950/30',
        icon: isFloat ? '.' : '#'
      }
    }

    if (typeof val === 'boolean') {
      return {
        type: 'boolean',
        info: '',
        color: 'text-purple-700 dark:text-purple-300',
        bgColor: 'bg-purple-50 dark:bg-purple-950/30',
        icon: val ? '✓' : '✗'
      }
    }

    if (Array.isArray(val)) {
      const length = val.length
      return {
        type: 'array',
        info: `${length} items`,
        color: 'text-orange-700 dark:text-orange-300',
        bgColor: 'bg-orange-50 dark:bg-orange-950/30',
        icon: '[]'
      }
    }

    if (typeof val === 'object') {
      const keys = Object.keys(val)
      const length = keys.length
      return {
        type: 'object',
        info: `${length} props`,
        color: 'text-indigo-700 dark:text-indigo-300',
        bgColor: 'bg-indigo-50 dark:bg-indigo-950/30',
        icon: '{}'
      }
    }

    return {
      type: 'unknown',
      info: '',
      color: 'text-slate-600 dark:text-slate-400',
      bgColor: 'bg-slate-100 dark:bg-slate-800',
      icon: '?'
    }
  }

  const renderValue = (val: any, key: string, level: number = 0): React.ReactNode => {
    const typeInfo = getTypeInfo(val)

    if (val === null) {
      return (
        <div className="flex items-center space-x-3">
          <div
            className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-mono font-semibold ${typeInfo.bgColor} ${typeInfo.color} border border-slate-200 dark:border-slate-700`}
          >
            <span className="mr-1">{typeInfo.icon}</span>
            NULL
          </div>
          <span className="text-slate-500 dark:text-slate-400 italic font-medium">null</span>
        </div>
      )
    }

    if (val === undefined) {
      return (
        <div className="flex items-center space-x-3">
          <div
            className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-mono font-semibold ${typeInfo.bgColor} ${typeInfo.color} border border-slate-200 dark:border-slate-700`}
          >
            <span className="mr-1">{typeInfo.icon}</span>
            UNDEFINED
          </div>
          <span className="text-slate-500 dark:text-slate-400 italic font-medium">undefined</span>
        </div>
      )
    }

    if (typeof val === 'string') {
      const isUrl = /^https?:\/\//.test(val)
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)
      const isPath = /^[\/\\]/.test(val) || /[\/\\]/.test(val)

      return (
        <div className="flex items-start space-x-3">
          <div
            className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-mono font-semibold ${typeInfo.bgColor} ${typeInfo.color} border border-emerald-200 dark:border-emerald-800 whitespace-nowrap`}
          >
            <span className="mr-1">{typeInfo.icon}</span>
            STRING
            {typeInfo.info && <span className="ml-1 opacity-75">({typeInfo.info})</span>}
          </div>
          <div className="flex-1 min-w-0">
            {isUrl ? (
              <span
                className="text-blue-600 dark:text-blue-400 underline cursor-pointer hover:text-blue-800 dark:hover:text-blue-300 break-all font-medium"
                onClick={() => window.open(val)}
              >
                "{val}"
              </span>
            ) : isEmail ? (
              <span className="text-purple-600 dark:text-purple-400 break-all font-medium">
                "{val}"
              </span>
            ) : isPath ? (
              <span className="text-orange-600 dark:text-orange-400 font-mono break-all">
                "{val}"
              </span>
            ) : (
              <span className="text-slate-700 dark:text-slate-300 break-all font-medium">
                "{val}"
              </span>
            )}
          </div>
        </div>
      )
    }

    if (typeof val === 'number') {
      return (
        <div className="flex items-center space-x-3">
          <div
            className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-mono font-semibold ${typeInfo.bgColor} ${typeInfo.color} border border-blue-200 dark:border-blue-800`}
          >
            <span className="mr-1">{typeInfo.icon}</span>
            {typeInfo.type.toUpperCase()}
          </div>
          <span className="text-slate-700 dark:text-slate-300 font-mono font-bold text-lg">
            {val}
          </span>
        </div>
      )
    }

    if (typeof val === 'boolean') {
      return (
        <div className="flex items-center space-x-3">
          <div
            className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-mono font-semibold ${typeInfo.bgColor} ${typeInfo.color} border border-purple-200 dark:border-purple-800`}
          >
            <span className="mr-1">{typeInfo.icon}</span>
            BOOLEAN
          </div>
          <span
            className={`font-mono font-bold text-lg ${val ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}
          >
            {val.toString()}
          </span>
        </div>
      )
    }

    if (Array.isArray(val)) {
      const isExpanded = expandedItems.has(key)

      if (val.length === 0) {
        return (
          <div className="flex items-center space-x-3">
            <div
              className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-mono font-semibold ${typeInfo.bgColor} ${typeInfo.color} border border-orange-200 dark:border-orange-800`}
            >
              <span className="mr-1">[]</span>
              ARRAY (empty)
            </div>
            <span className="text-slate-500 dark:text-slate-400 font-mono">[]</span>
          </div>
        )
      }

      return (
        <div>
          <div className="flex items-center space-x-3">
            <div
              className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-mono font-semibold ${typeInfo.bgColor} ${typeInfo.color} border border-orange-200 dark:border-orange-800`}
            >
              <span className="mr-1">{typeInfo.icon}</span>
              ARRAY ({typeInfo.info})
            </div>
            <button
              onClick={() => toggleItem(key)}
              className="inline-flex items-center px-2 py-1 rounded-md text-xs font-mono font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 transition-colors"
            >
              {isExpanded ? (
                <>
                  <svg
                    className="w-3 h-3 mr-1"
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
                  COLLAPSE
                </>
              ) : (
                <>
                  <svg
                    className="w-3 h-3 mr-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                  EXPAND
                </>
              )}
            </button>
          </div>
          {isExpanded && (
            <div className="mt-3 ml-6 border-l-2 border-orange-200 dark:border-orange-800 pl-6 space-y-3 bg-gradient-to-r from-orange-50/30 to-transparent dark:from-orange-950/10">
              {val.map((item, index) => (
                <div key={index} className="flex items-start gap-4">
                  <div className="inline-flex items-center px-2 py-1 rounded-md text-xs font-mono font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 min-w-[3rem] justify-center">
                    [{index}]
                  </div>
                  <div className="flex-1 min-w-0">
                    {renderValue(item, `${key}[${index}]`, level + 1)}
                  </div>
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
        return (
          <div className="flex items-center space-x-3">
            <div
              className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-mono font-semibold ${typeInfo.bgColor} ${typeInfo.color} border border-indigo-200 dark:border-indigo-800`}
            >
              <span className="mr-1">{typeInfo.icon}</span>
              OBJECT (empty)
            </div>
            <span className="text-slate-500 dark:text-slate-400 font-mono">{'{}'}</span>
          </div>
        )
      }

      return (
        <div>
          <div className="flex items-center space-x-3">
            <div
              className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-mono font-semibold ${typeInfo.bgColor} ${typeInfo.color} border border-indigo-200 dark:border-indigo-800`}
            >
              <span className="mr-1">{typeInfo.icon}</span>
              OBJECT ({typeInfo.info})
            </div>
            <button
              onClick={() => toggleItem(key)}
              className="inline-flex items-center px-2 py-1 rounded-md text-xs font-mono font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 transition-colors"
            >
              {isExpanded ? (
                <>
                  <svg
                    className="w-3 h-3 mr-1"
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
                  COLLAPSE
                </>
              ) : (
                <>
                  <svg
                    className="w-3 h-3 mr-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                  EXPAND
                </>
              )}
            </button>
          </div>
          {isExpanded && (
            <div className="mt-3 ml-6 border-l-2 border-indigo-200 dark:border-indigo-800 pl-6 space-y-3 bg-gradient-to-r from-indigo-50/30 to-transparent dark:from-indigo-950/10">
              {keys.map((objKey) => (
                <div key={objKey} className="flex items-start gap-4">
                  <div className="inline-flex items-center px-2 py-1 rounded-md text-xs font-mono font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
                    "{objKey}"
                  </div>
                  <div className="flex-1 min-w-0">
                    {renderValue(val[objKey], `${key}.${objKey}`, level + 1)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }

    return (
      <div className="flex items-center space-x-3">
        <div
          className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-mono font-semibold ${typeInfo.bgColor} ${typeInfo.color} border border-slate-200 dark:border-slate-700`}
        >
          <span className="mr-1">{typeInfo.icon}</span>
          {typeInfo.type.toUpperCase()}
        </div>
        <span className="text-slate-700 dark:text-slate-300 font-medium">{String(val)}</span>
      </div>
    )
  }

  // Pokud je dataToShow objekt, rozbal ho na první úrovni
  if (typeof dataToShow === 'object' && dataToShow !== null && !Array.isArray(dataToShow)) {
    const keys = Object.keys(dataToShow)

    return (
      <div className="space-y-4 font-mono text-sm">
        {keys.map((key, index) => (
          <div
            key={key}
            className="group hover:bg-gradient-to-r hover:from-slate-50 hover:to-transparent dark:hover:from-slate-800/30 dark:hover:to-transparent rounded-lg px-4 py-3 -mx-4 transition-all duration-200 border-l-2 border-transparent hover:border-l-blue-300 dark:hover:border-l-blue-600"
          >
            <div className="flex items-start gap-4">
              <div className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-mono font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 shadow-sm min-w-fit">
                "{key}"
              </div>
              <div className="flex-1 min-w-0 pt-0.5">{renderValue(dataToShow[key], key)}</div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Pro jednoduché hodnoty nebo pole
  return (
    <div className="font-mono text-sm p-4 bg-gradient-to-r from-slate-50 to-transparent dark:from-slate-800/30 dark:to-transparent rounded-lg">
      {renderValue(dataToShow, 'root')}
    </div>
  )
}
