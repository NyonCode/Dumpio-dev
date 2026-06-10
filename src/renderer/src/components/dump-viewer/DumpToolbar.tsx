import { DumpToolbarProps, SERVER_COLORS } from './types'

export function DumpToolbar({
  stats,
  servers,
  autoScroll,
  onToggleAutoScroll,
  totalCount
}: DumpToolbarProps) {
  return (
    <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-6">
          {/* Stats Overview */}
          <div className="flex items-center space-x-4">
            <div className="text-sm">
              <span className="font-semibold text-slate-900 dark:text-slate-100">{totalCount}</span>
              <span className="text-slate-500 dark:text-slate-400 ml-1">
                {totalCount === 1 ? 'dump' : 'dumps'}
              </span>
            </div>

            {/* Recent activity indicator */}
            {stats.recentActivity > 0 && (
              <div className="flex items-center space-x-1 text-xs px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <span>{stats.recentActivity} new</span>
              </div>
            )}
          </div>

          {/* Server breakdown */}
          <div className="flex items-center space-x-3">
            {Object.entries(stats.byServer).map(([serverName, count]) => {
              const server = servers.find((s) => s.name === serverName)
              const serverStyle = server
                ? SERVER_COLORS[server.color as keyof typeof SERVER_COLORS]
                : SERVER_COLORS.gray

              return (
                <div key={serverName} className="flex items-center space-x-2 text-sm">
                  <div className={`w-3 h-3 rounded-full ${serverStyle.bg}`}></div>
                  <span className="text-slate-700 dark:text-slate-300 font-medium">
                    {serverName}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">({count})</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {/* Auto-scroll toggle */}
          <button
            onClick={onToggleAutoScroll}
            className={`flex items-center space-x-2 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              autoScroll
                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
            title={autoScroll ? 'Auto-scroll enabled' : 'Auto-scroll disabled'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 13l-7 7-7-7m14-8l-7 7-7-7"
              />
            </svg>
            <span>Auto-scroll</span>
          </button>
        </div>
      </div>
    </div>
  )
}
