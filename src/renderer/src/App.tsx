// src/renderer/src/App.tsx

import { useState, useEffect } from 'react'
import { ThemeProvider } from './contexts/ThemeContext'
import { Sidebar } from './components/Sidebar'
import { Header } from './components/Header'
import { EnhancedDumpViewer } from './components/dump-viewer/EnhancedDumpViewer'
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
  autoSaveDumps: boolean
  viewMode: 'detailed' | 'compact'
  viewerMode: 'professional' | 'simple'
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
  const [stats, setStats] = useState({
    totalDumps: 0,
    filteredDumps: 0,
    recentActivity: 0,
    exceptions: 0,
    dataPackets: 0
  })

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
      updateStats(dumpsData)
    } catch (error) {
      console.error('Failed to load initial data:', error)
    }
  }

  const setupEventListeners = () => {
    const unsubscribeDump = window.api.onDumpReceived((dump: Dump) => {
      setDumps((prev) => {
        const newDumps = [dump, ...prev].slice(0, settings?.maxDumpsInMemory || 1000)
        updateStats(newDumps)
        return newDumps
      })
    })

    const unsubscribeCleared = window.api.onDumpsCleared(() => {
      setDumps([])
      updateStats([])
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

  const updateStats = (dumpList: Dump[]) => {
    const now = Date.now()
    const oneMinuteAgo = now - 60000

    // Count exceptions vs data dumps
    let exceptions = 0
    let dataPackets = 0

    dumpList.forEach((dump) => {
      // Simple check for exceptions - can be enhanced with ExceptionParser
      if (
        dump.payload?.exception ||
        dump.payload?.error ||
        dump.payload?.type === 'exception' ||
        dump.payload?.stack ||
        dump.payload?.trace
      ) {
        exceptions++
      } else {
        dataPackets++
      }
    })

    setStats({
      totalDumps: dumpList.length,
      filteredDumps: dumpList.length, // Will be updated by filter
      recentActivity: dumpList.filter((d) => d.timestamp > oneMinuteAgo).length,
      exceptions,
      dataPackets
    })
  }

  const handleClearDumps = async () => {
    try {
      await window.api.clearDumps()
      setDumps([])
      updateStats([])
    } catch (error) {
      console.error('Failed to clear dumps:', error)
    }
  }

  const handleExportDumps = async () => {
    try {
      const success = await window.api.exportDumps()
      if (success) {
        console.log('Dumps exported successfully')
      }
    } catch (error) {
      console.error('Failed to export dumps:', error)
    }
  }

  const handleSaveSettings = async (newSettings: Settings) => {
    try {
      await window.api.saveSettingsAndSyncServers(newSettings)
      setSettings(newSettings)
      setServers(newSettings.servers)
    } catch (error) {
      console.error('Failed to save settings:', error)
    }
  }

  const handleOpenInIde = async (file: string, line: number) => {
    if (!settings?.ideIntegration.enabled) {
      console.log(`Would open ${file}:${line} in IDE (IDE integration disabled)`)
      return
    }

    try {
      await window.api.openInIde({
        file,
        line,
        ide: settings.ideIntegration.defaultIde,
        customCommand: settings.ideIntegration.customCommand
      })
    } catch (error) {
      console.error('Failed to open in IDE:', error)
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

  useEffect(() => {
    setStats((prev) => ({ ...prev, filteredDumps: filteredDumps.length }))
  }, [filteredDumps.length])

  if (!settings) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading DumpeX...</p>
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
            totalDumps={stats.totalDumps}
            filteredDumps={stats.filteredDumps}
            recentActivity={stats.recentActivity}
            exceptions={stats.exceptions}
            dataPackets={stats.dataPackets}
          />

          <EnhancedDumpViewer
            dumps={filteredDumps}
            servers={servers}
            viewMode={settings.viewMode}
            viewerMode={settings.viewerMode}
            onOpenInIde={handleOpenInIde}
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
