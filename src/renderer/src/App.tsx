import { useState, useEffect } from 'react'
import { ThemeProvider } from './contexts/ThemeContext'
import { Sidebar } from './components/Sidebar'
import { Header } from './components/Header'
import { DumpViewer } from './components/DumpViewer'
import { SettingsModal } from './components/SettingsModal'
import './assets/index.css'

export interface Server {
  id: string
  name: string
  host: string
  port: number
  color: string
  active: boolean
}

export interface Dump {
  id: string
  serverId: string
  timestamp: number
  origin: string
  payload: any
  flag?: 'yellow' | 'red' | 'blue' | 'gray' | 'purple' | 'pink' | 'green'
  channel?: string
}

export interface Settings {
  servers: Server[]
  theme: 'light' | 'dark' | 'system'
  saveDumpsOnExit: boolean
  maxDumpsInMemory: number
  autoStartServers: boolean
  ideIntegration: {
    enabled: boolean
    defaultIde: 'vscode' | 'jetbrains' | 'custom'
    customCommand?: string
  }
  filters: {
    showServerColors: boolean
    defaultFlagFilter: string[]
  }
}

function App() {
  const [dumps, setDumps] = useState<Dump[]>([])
  const [servers, setServers] = useState<Server[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [selectedServerId, setSelectedServerId] = useState<string>('all')
  const [selectedFlags, setSelectedFlags] = useState<string[]>([])
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadInitialData()
    setupEventListeners()
  }, [])

  const loadInitialData = async () => {
    try {
      const [settingsData, dumpsData] = await Promise.all([
        window.api.getSettings(),
        window.api.getDumps()
      ])

      setSettings(settingsData)
      setServers(settingsData.servers)
      setDumps(dumpsData)
    } catch (error) {
      console.error('Failed to load initial data:', error)
    }
  }

  const setupEventListeners = () => {
    const unsubscribeDump = window.api.onDumpReceived((dump: Dump) => {
      setDumps((prev) => [dump, ...prev].slice(0, 1000))
    })

    const unsubscribeCleared = window.api.onDumpsCleared(() => {
      setDumps([])
    })

    const unsubscribeServerStarted = window.api.onServerStarted((server: Server) => {
      setServers((prev) => prev.map((s) => (s.id === server.id ? { ...s, active: true } : s)))
    })

    const unsubscribeServerStopped = window.api.onServerStopped((serverId: string) => {
      setServers((prev) => prev.map((s) => (s.id === serverId ? { ...s, active: false } : s)))
    })

    return () => {
      unsubscribeDump()
      unsubscribeCleared()
      unsubscribeServerStarted()
      unsubscribeServerStopped()
    }
  }

  const handleClearDumps = async () => {
    try {
      await window.api.clearDumps()
      setDumps([])
    } catch (error) {
      console.error('Failed to clear dumps:', error)
    }
  }

  const handleExportDumps = async () => {
    try {
      const success = await window.api.exportDumps()
      if (success) {
        // Could show success notification
        console.log('Dumps exported successfully')
      }
    } catch (error) {
      console.error('Failed to export dumps:', error)
    }
  }

  const handleSaveSettings = async (newSettings: Settings) => {
    try {
      await window.api.saveSettings(newSettings)
      setSettings(newSettings)
      setServers(newSettings.servers)
    } catch (error) {
      console.error('Failed to save settings:', error)
    }
  }

  const filteredDumps = dumps.filter((dump) => {
    // Server filter
    if (selectedServerId !== 'all' && dump.serverId !== selectedServerId) {
      return false
    }

    // Flag filter
    if (selectedFlags.length > 0 && (!dump.flag || !selectedFlags.includes(dump.flag))) {
      return false
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const searchableText = [dump.origin, dump.channel, JSON.stringify(dump.payload)]
        .join(' ')
        .toLowerCase()

      if (!searchableText.includes(query)) {
        return false
      }
    }

    return true
  })

  if (!settings) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading TCP Dump Viewer...</p>
        </div>
      </div>
    )
  }

  return (
    <ThemeProvider>
      <div className="h-screen flex bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        <Sidebar
          servers={servers}
          selectedServerId={selectedServerId}
          onServerSelect={setSelectedServerId}
          selectedFlags={selectedFlags}
          onFlagsChange={setSelectedFlags}
          onSettingsClick={() => setIsSettingsOpen(true)}
        />

        <div className="flex-1 flex flex-col min-w-0">
          <Header
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onClearDumps={handleClearDumps}
            onExportDumps={handleExportDumps}
            totalDumps={dumps.length}
            filteredDumps={filteredDumps.length}
          />

          <DumpViewer
            dumps={filteredDumps}
            servers={servers}
            onOpenInIde={(file, line) => {
              window.api.openInIde({ file, line, ide: settings.ideIntegration.defaultIde })
            }}
          />
        </div>

        {isSettingsOpen && (
          <SettingsModal
            settings={settings}
            onClose={() => setIsSettingsOpen(false)}
            onSave={handleSaveSettings}
          />
        )}
      </div>
    </ThemeProvider>
  )
}

export default App
