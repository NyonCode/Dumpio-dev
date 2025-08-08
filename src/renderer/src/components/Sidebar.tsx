import { Server } from '../App'

interface SidebarProps {
  servers: Server[]
  selectedServerId: string
  onServerSelect: (serverId: string) => void
  selectedFlags: string[]
  onFlagsChange: (flags: string[]) => void
  onSettingsClick: () => void
}

const FLAG_COLORS = {
  yellow: 'bg-dump-yellow',
  red: 'bg-dump-red',
  blue: 'bg-dump-blue',
  gray: 'bg-dump-gray',
  purple: 'bg-dump-purple',
  pink: 'bg-dump-pink',
  green: 'bg-dump-green'
}

const SERVER_COLORS = {
  blue: 'bg-blue-500',
  red: 'bg-red-500',
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  purple: 'bg-purple-500',
  pink: 'bg-pink-500',
  gray: 'bg-gray-500'
}

export function Sidebar({
  servers,
  selectedServerId,
  onServerSelect,
  selectedFlags,
  onFlagsChange,
  onSettingsClick
}: SidebarProps) {
  const toggleFlag = (flag: string) => {
    if (selectedFlags.includes(flag)) {
      onFlagsChange(selectedFlags.filter((f) => f !== flag))
    } else {
      onFlagsChange([...selectedFlags, flag])
    }
  }

  const getServerStatusIcon = (server: Server) => {
    return server.active ? (
      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
    ) : (
      <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
    )
  }

  return (
    <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
      {/* Header */}
      {/*      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
          Dumpex
        </h1>
      </div>*/}

      {/* Server List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-3">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Servers</h3>

          {/* All Servers Option */}
          <button
            onClick={() => onServerSelect('all')}
            className={`w-full text-left px-3 py-2 rounded-lg mb-1 flex items-center space-x-3 transition-colors ${
              selectedServerId === 'all'
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
            <span className="text-sm">All Servers</span>
            <span className="ml-auto text-xs text-gray-500">{servers.length}</span>
          </button>

          {/* Individual Servers */}
          {servers.map((server) => (
            <button
              key={server.id}
              onClick={() => onServerSelect(server.id)}
              className={`w-full text-left px-3 py-2 rounded-lg mb-1 flex items-center space-x-3 transition-colors ${
                selectedServerId === server.id
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              <div
                className={`w-3 h-3 rounded-full ${SERVER_COLORS[server.color as keyof typeof SERVER_COLORS] || 'bg-gray-400'}`}
              ></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium truncate">{server.name}</span>
                  {getServerStatusIcon(server)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {server.host}:{server.port}
                </div>
              </div>
            </button>
          ))}

          {servers.length === 0 && (
            <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
              No servers configured
            </div>
          )}
        </div>

        {/* Flag Filters */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Filter by Flag
          </h3>

          <div className="space-y-2">
            {Object.entries(FLAG_COLORS).map(([flag, colorClass]) => (
              <button
                key={flag}
                onClick={() => toggleFlag(flag)}
                className={`w-full text-left px-3 py-2 rounded-lg flex items-center space-x-3 transition-colors ${
                  selectedFlags.includes(flag)
                    ? 'bg-gray-100 dark:bg-gray-700 ring-2 ring-blue-500'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <div className={`w-3 h-3 rounded-full ${colorClass}`}></div>
                <span className="text-sm capitalize text-gray-700 dark:text-gray-300">{flag}</span>
                {selectedFlags.includes(flag) && (
                  <div className="ml-auto">
                    <svg
                      className="w-4 h-4 text-blue-500"
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
                  </div>
                )}
              </button>
            ))}
          </div>

          {selectedFlags.length > 0 && (
            <button
              onClick={() => onFlagsChange([])}
              className="w-full mt-3 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Settings Button */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={onSettingsClick}
          className="w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex items-center space-x-3 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <span>Settings</span>
        </button>
      </div>

      {/* Version */}
      <div className="p-1 border-t dark:border-gray-700">
        <span className={'text-gray-400 text-sm'}>Version: 1.0.0</span>
      </div>
    </div>
  )
}
