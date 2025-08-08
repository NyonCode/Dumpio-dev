import { useState, useEffect } from 'react'
import { Settings, Server } from '../App'

interface SettingsModalProps {
  settings: Settings
  onClose: () => void
  onSave: (settings: Settings) => void
}

const SERVER_COLORS = ['blue', 'red', 'green', 'yellow', 'purple', 'pink', 'gray']

export function SettingsModal({ settings, onClose, onSave }: SettingsModalProps) {
  const [localSettings, setLocalSettings] = useState<Settings>(settings)
  const [activeTab, setActiveTab] = useState<'servers' | 'general' | 'ide'>('servers')
  const [editingServer, setEditingServer] = useState<Server | null>(null)
  const [isAddingServer, setIsAddingServer] = useState(false)

  useEffect(() => {
    setLocalSettings(settings)
  }, [settings])

  const handleSave = () => {
    onSave(localSettings)
    onClose()
  }

  const handleAddServer = () => {
    const newServer: Server = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      name: 'New Server',
      host: 'localhost',
      port: 21234,
      color: 'blue',
      active: true
    }
    setEditingServer(newServer)
    setIsAddingServer(true)
  }

  const handleSaveServer = (server: Server) => {
    if (isAddingServer) {
      setLocalSettings((prev) => ({
        ...prev,
        servers: [...prev.servers, server]
      }))
      setIsAddingServer(false)
    } else {
      setLocalSettings((prev) => ({
        ...prev,
        servers: prev.servers.map((s) => (s.id === server.id ? server : s))
      }))
    }
    setEditingServer(null)
  }

  const handleDeleteServer = (serverId: string) => {
    setLocalSettings((prev) => ({
      ...prev,
      servers: prev.servers.filter((s) => s.id !== serverId)
    }))
  }

  const handleToggleServer = (serverId: string) => {
    setLocalSettings((prev) => ({
      ...prev,
      servers: prev.servers.map((s) => (s.id === serverId ? { ...s, active: !s.active } : s))
    }))
  }

  return (
    <div className="fixed inset-0 bg-gray-600 dark:bg-gray-900 bg-opacity-50 dark:bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white dark:bg-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Settings</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 mt-4 mb-6">
          {[
            { key: 'servers' as const, label: 'Servers' },
            { key: 'general' as const, label: 'General' },
            { key: 'ide' as const, label: 'IDE Integration' }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === tab.key
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="min-h-96">
          {activeTab === 'servers' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="text-md font-medium text-gray-900 dark:text-white">TCP Servers</h4>
                <button
                  onClick={handleAddServer}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Add Server
                </button>
              </div>

              <div className="space-y-3">
                {localSettings.servers.map((server) => (
                  <div
                    key={server.id}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`w-4 h-4 rounded-full bg-${server.color}-500`}></div>
                      <div>
                        <div className="font-medium text-gray-900 dark:text-white">
                          {server.name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {server.host}:{server.port}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={server.active}
                          onChange={() => handleToggleServer(server.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                          Active
                        </span>
                      </label>

                      <button
                        onClick={() => setEditingServer(server)}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        Edit
                      </button>

                      <button
                        onClick={() => handleDeleteServer(server.id)}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}

                {localSettings.servers.length === 0 && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No servers configured. Add one to get started.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'general' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Theme
                </label>
                <select
                  value={localSettings.theme}
                  onChange={(e) =>
                    setLocalSettings((prev) => ({ ...prev, theme: e.target.value as any }))
                  }
                  className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="system">System</option>
                </select>
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={localSettings.saveDumpsOnExit}
                    onChange={(e) =>
                      setLocalSettings((prev) => ({ ...prev, saveDumpsOnExit: e.target.checked }))
                    }
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    Save dumps when application exits
                  </span>
                </label>
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={localSettings.autoStartServers}
                    onChange={(e) =>
                      setLocalSettings((prev) => ({ ...prev, autoStartServers: e.target.checked }))
                    }
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    Auto-start servers on application launch
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Maximum dumps in memory
                </label>
                <input
                  type="number"
                  min="100"
                  max="10000"
                  value={localSettings.maxDumpsInMemory}
                  onChange={(e) =>
                    setLocalSettings((prev) => ({
                      ...prev,
                      maxDumpsInMemory: parseInt(e.target.value)
                    }))
                  }
                  className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {activeTab === 'ide' && (
            <div className="space-y-6">
              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={localSettings.ideIntegration.enabled}
                    onChange={(e) =>
                      setLocalSettings((prev) => ({
                        ...prev,
                        ideIntegration: { ...prev.ideIntegration, enabled: e.target.checked }
                      }))
                    }
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    Enable IDE integration
                  </span>
                </label>
              </div>

              {localSettings.ideIntegration.enabled && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Default IDE
                    </label>
                    <select
                      value={localSettings.ideIntegration.defaultIde}
                      onChange={(e) =>
                        setLocalSettings((prev) => ({
                          ...prev,
                          ideIntegration: {
                            ...prev.ideIntegration,
                            defaultIde: e.target.value as any
                          }
                        }))
                      }
                      className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="vscode">Visual Studio Code</option>
                      <option value="jetbrains">JetBrains IDEs</option>
                      <option value="custom">Custom Command</option>
                    </select>
                  </div>

                  {localSettings.ideIntegration.defaultIde === 'custom' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Custom Command
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., code --goto {file}:{line}"
                        value={localSettings.ideIntegration.customCommand || ''}
                        onChange={(e) =>
                          setLocalSettings((prev) => ({
                            ...prev,
                            ideIntegration: {
                              ...prev.ideIntegration,
                              customCommand: e.target.value
                            }
                          }))
                        }
                        className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Use {'{file}'} and {'{line}'} as placeholders
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 pt-4 mt-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
          >
            Save Changes
          </button>
        </div>
      </div>

      {/* Server Edit Modal */}
      {editingServer && (
        <ServerEditModal
          server={editingServer}
          onSave={handleSaveServer}
          onCancel={() => {
            setEditingServer(null)
            setIsAddingServer(false)
          }}
        />
      )}
    </div>
  )
}

interface ServerEditModalProps {
  server: Server
  onSave: (server: Server) => void
  onCancel: () => void
}

function ServerEditModal({ server, onSave, onCancel }: ServerEditModalProps) {
  const [editedServer, setEditedServer] = useState(server)

  const handleSave = () => {
    onSave(editedServer)
  }

  return (
    <div className="fixed inset-0 bg-gray-600 dark:bg-gray-900 bg-opacity-50 dark:bg-opacity-50 overflow-y-auto h-full w-full z-60">
      <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-md shadow-lg rounded-md bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            {server.id ? 'Edit Server' : 'Add Server'}
          </h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="space-y-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Name
            </label>
            <input
              type="text"
              value={editedServer.name}
              onChange={(e) => setEditedServer((prev) => ({ ...prev, name: e.target.value }))}
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Host
            </label>
            <input
              type="text"
              value={editedServer.host}
              onChange={(e) => setEditedServer((prev) => ({ ...prev, host: e.target.value }))}
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Port
            </label>
            <input
              type="number"
              min="1"
              max="65535"
              value={editedServer.port}
              onChange={(e) =>
                setEditedServer((prev) => ({ ...prev, port: parseInt(e.target.value) }))
              }
              className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Color
            </label>
            <div className="flex space-x-2">
              {SERVER_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setEditedServer((prev) => ({ ...prev, color }))}
                  className={`w-8 h-8 rounded-full bg-${color}-500 ${
                    editedServer.color === color
                      ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-gray-600'
                      : ''
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4 mt-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
