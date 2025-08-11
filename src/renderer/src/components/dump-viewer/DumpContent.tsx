import { DumpContentProps } from './types'
import { CopyButton } from './CopyButton'
import { getDumpTypeInfo, getDumpTitle, getDumpMetrics } from './utils'
import { getIconComponent } from './icons'

export function DumpContent({
  dump,
  onToggleExpand,
  isExpanded,
  fileLocation,
  onOpenInIde,
  onCopy,
  copySuccess
}: DumpContentProps): JSX.Element {
  const typeInfo = getDumpTypeInfo(dump.payload)
  const metrics = getDumpMetrics(dump.payload)

  return (
    <div
      className="px-6 py-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
      onClick={onToggleExpand}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-4 flex-1 min-w-0">
          {/* Type Icon */}
          <div className="flex-shrink-0 mt-1">{getIconComponent(typeInfo.icon)}</div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-3 mb-2">
              <span className={`text-sm font-medium ${typeInfo.color}`}>{typeInfo.type}</span>

              {/* Metrics */}
              {metrics.length > 0 && (
                <div className="flex items-center space-x-4">
                  {metrics.map((metric, index) => (
                    <div key={index} className="flex items-center space-x-1 text-xs">
                      <span className={metric.color}>
                        {getIconComponent(metric.icon, 'w-3 h-3')}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">{metric.label}:</span>
                      <span className={`font-medium ${metric.color}`}>{metric.value}</span>
                    </div>
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
          {/* Copy button */}
          <CopyButton onCopy={onCopy} copySuccess={copySuccess} />

          {/*
          fileLocation && (
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
          )*/}

          <svg
            className={`w-4 h-4 text-slate-400 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  )
}
