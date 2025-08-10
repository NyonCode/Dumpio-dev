import { DumpHeaderProps, SERVER_COLORS } from './types'
import { formatTimestamp } from './utils'

export function DumpHeader({ dump, server, onToggleExpand, isExpanded }: DumpHeaderProps) {
  const serverStyle = server
    ? SERVER_COLORS[server.color as keyof typeof SERVER_COLORS]
    : SERVER_COLORS.gray

  return (
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
            className={`w-3 h-3 rounded-full bg-${dump.flag || 'gray'}-500 opacity-80`}
            title={`Flag: ${dump.flag || 'gray'}`}
          ></div>

          {/* Origin info */}
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">{dump.origin}</div>
        </div>
      </div>
    </div>
  )
}
