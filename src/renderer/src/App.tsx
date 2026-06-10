// src/renderer/src/App.tsx

import { useState, useEffect, useMemo, useRef, type JSX } from 'react'
import { Sidebar } from './components/Sidebar'
import { Header } from './components/Header'
import { EnhancedDumpViewer } from './components/dump-viewer/EnhancedDumpViewer'
import { EmptyState } from './components/dump-viewer/EmptyState'
import { SettingsModal } from './components/SettingsModal'
import { CommandPalette, type Command } from './components/CommandPalette'
import { useKeyboardNav } from './hooks/useKeyboardNav'
import { usePersistentState } from './hooks/usePersistentState'
import { useTheme } from './contexts/ThemeContext'
import {
  getDumpType,
  createSearchMatcher,
  payloadMatches,
  type DumpKind,
  type SearchScope
} from './components/dump-viewer/utils'
import './assets/index.css'

export interface Server {
  id: string
  name: string
  host: string
  port: number
  color: string
  active: boolean
  protocol: 'http' | 'tcp'
}

export interface Dump {
  id: string
  serverId: string
  timestamp: number
  origin: string
  payload: unknown
  flag?: 'yellow' | 'red' | 'blue' | 'gray' | 'purple' | 'pink' | 'green'
  channel?: string
  schemaVersion?: number
}

export interface SecuritySettings {
  token: string
  maxPayloadKb: number
  rateLimitPerSec: number
}

export interface Settings {
  servers: Server[]
  theme: 'light' | 'dark' | 'system'
  saveDumpsOnExit: boolean
  maxDumpsInMemory: number
  autoStartServers: boolean
  autoSaveDumps: boolean
  viewMode: 'detailed' | 'compact'
  density: 'comfortable' | 'compact'
  fontSize: 'small' | 'medium' | 'large'
  accentColor: string
  security: SecuritySettings
  filters: {
    showServerColors: boolean
    defaultFlagFilter: string[]
  }
}

const FLAG_NAMES = ['red', 'yellow', 'blue', 'green', 'purple', 'pink', 'gray']
type TypeFilter = DumpKind | 'all'

/** The SDK's dedupe key for count()/once()/limit() collapsing, if present. */
function dedupeKeyOf(dump: Dump): string | undefined {
  const p = dump.payload
  if (p && typeof p === 'object' && !Array.isArray(p)) {
    const k = (p as Record<string, unknown>).dedupeKey
    if (typeof k === 'string' && k) return k
  }
  return undefined
}

function App(): JSX.Element {
  const { isDark, setTheme } = useTheme()

  const [dumps, setDumps] = useState<Dump[]>([])
  const [servers, setServers] = useState<Server[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)

  // Filters — persisted across launches so the workspace reopens as you left it.
  const [selectedServerId, setSelectedServerId] = usePersistentState<string>(
    'dumpio.filter.server',
    'all'
  )
  const [selectedFlags, setSelectedFlags] = usePersistentState<string[]>('dumpio.filter.flags', [])
  const [selectedChannel, setSelectedChannel] = usePersistentState<string>(
    'dumpio.filter.channel',
    'all'
  )
  const [filterType, setFilterType] = usePersistentState<TypeFilter>('dumpio.filter.type', 'all')
  const [searchQuery, setSearchQuery] = usePersistentState<string>('dumpio.filter.search', '')
  const [searchScope, setSearchScope] = usePersistentState<SearchScope>(
    'dumpio.filter.scope',
    'all'
  )
  const [searchRegex, setSearchRegex] = usePersistentState<boolean>('dumpio.filter.regex', false)

  // Selection / stream
  const [selectedDumpId, setSelectedDumpId] = usePersistentState<string | null>(
    'dumpio.selectedDump',
    null
  )
  const [isPaused, setIsPaused] = useState(false)
  const [alwaysOnTop, setAlwaysOnTop] = usePersistentState<boolean>('dumpio.alwaysOnTop', false)
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable')
  const [newDumpIds, setNewDumpIds] = useState<Set<string>>(new Set())

  // UI
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isPaletteOpen, setIsPaletteOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // The dump listener is wired once on mount, so it can't close over the latest
  // `settings`. Keep the in-memory cap in a ref the listener can read live.
  const maxDumpsRef = useRef(1000)
  useEffect(() => {
    if (settings?.maxDumpsInMemory) maxDumpsRef.current = settings.maxDumpsInMemory
  }, [settings?.maxDumpsInMemory])

  useEffect(() => {
    loadInitialData()
    return setupEventListeners()
    // Mount-only: load persisted data once and wire IPC listeners for the session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep the OS window's always-on-top flag in sync with the persisted toggle.
  useEffect(() => {
    window.api.setAlwaysOnTop(alwaysOnTop)
  }, [alwaysOnTop])

  // Apply Appearance settings (font size + accent color) to the document root.
  useEffect(() => {
    const root = window.document.documentElement
    const sizes: Record<string, string> = { small: '14px', medium: '16px', large: '18px' }
    root.style.fontSize = sizes[settings?.fontSize ?? 'medium'] ?? sizes.medium
    root.dataset.accent = settings?.accentColor ?? 'blue'
  }, [settings?.fontSize, settings?.accentColor])

  const loadInitialData = async (): Promise<void> => {
    try {
      const [settingsData, dumpsData] = await Promise.all([
        window.api.getSettings(),
        window.api.getDumps()
      ])
      setSettings(settingsData)
      setServers(settingsData.servers)
      setDumps(dumpsData)
      setDensity(settingsData.density ?? 'comfortable')
    } catch (error) {
      console.error('Failed to load initial data:', error)
    }
  }

  const setupEventListeners = (): (() => void) => {
    const unsubscribeDump = window.api.onDumpReceived((dump: Dump) => {
      // Dumps carrying a `dedupeKey` (from the SDK's count()/once()/limit()
      // helpers) collapse onto the previous dump with the same key: we update it
      // in place and float it to the top instead of flooding the list.
      const key = dedupeKeyOf(dump)
      setDumps((prev) => {
        if (key) {
          const idx = prev.findIndex((d) => dedupeKeyOf(d) === key)
          if (idx !== -1) {
            const merged = { ...dump, id: prev[idx].id }
            const next = [merged, ...prev.slice(0, idx), ...prev.slice(idx + 1)]
            return next.slice(0, maxDumpsRef.current)
          }
        }
        return [dump, ...prev].slice(0, maxDumpsRef.current)
      })
      setNewDumpIds((prev) => new Set(prev).add(dump.id))
      setTimeout(() => {
        setNewDumpIds((prev) => {
          const next = new Set(prev)
          next.delete(dump.id)
          return next
        })
      }, 2000)
    })

    const unsubscribeCleared = window.api.onDumpsCleared(() => {
      setDumps([])
      setSelectedDumpId(null)
    })

    const unsubscribeServerStarted = window.api.onServerStarted((serverId: string) => {
      setServers((prev) => prev.map((s) => (s.id === serverId ? { ...s, active: true } : s)))
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

  const handleClearDumps = async (): Promise<void> => {
    try {
      await window.api.clearDumps()
      setDumps([])
      setSelectedDumpId(null)
    } catch (error) {
      console.error('Failed to clear dumps:', error)
    }
  }

  const handleExportDumps = async (): Promise<void> => {
    try {
      await window.api.exportDumps()
    } catch (error) {
      console.error('Failed to export dumps:', error)
    }
  }

  const handleSaveSettings = async (newSettings: Settings): Promise<void> => {
    try {
      await window.api.saveSettingsAndSyncServers(newSettings)
      setSettings(newSettings)
      setServers(newSettings.servers)
      setDensity(newSettings.density ?? 'comfortable')
      setTheme(newSettings.theme)
    } catch (error) {
      console.error('Failed to save settings:', error)
    }
  }

  // Import already persisted + synced servers in main; just adopt the result.
  const handleApplyImported = (imported: Settings): void => {
    setSettings(imported)
    setServers(imported.servers)
    setDensity(imported.density ?? 'comfortable')
    setTheme(imported.theme)
  }

  // --- Filtering ---------------------------------------------------------

  const matcher = useMemo(
    () => (searchQuery ? createSearchMatcher(searchQuery, searchRegex) : null),
    [searchQuery, searchRegex]
  )

  const preTypeFiltered = useMemo(() => {
    return dumps.filter((dump) => {
      if (selectedServerId !== 'all' && dump.serverId !== selectedServerId) return false
      if (selectedFlags.length > 0 && (!dump.flag || !selectedFlags.includes(dump.flag)))
        return false
      if (selectedChannel !== 'all' && (dump.channel ?? 'default') !== selectedChannel) return false
      if (matcher) {
        const metaHit =
          searchScope !== 'keys' && matcher(`${dump.origin ?? ''} ${dump.channel ?? ''}`)
        if (!metaHit && !payloadMatches(dump.payload, matcher, searchScope)) return false
      }
      return true
    })
  }, [dumps, selectedServerId, selectedFlags, selectedChannel, matcher, searchScope])

  const filteredDumps = useMemo(() => {
    if (filterType === 'all') return preTypeFiltered
    return preTypeFiltered.filter((d) => getDumpType(d.payload) === filterType)
  }, [preTypeFiltered, filterType])

  const typeCounts = useMemo(() => {
    const counts: Record<TypeFilter, number> = {
      all: preTypeFiltered.length,
      exception: 0,
      var: 0,
      sql: 0,
      http: 0,
      log: 0,
      performance: 0,
      event: 0,
      model: 0,
      collection: 0,
      table: 0,
      measure: 0,
      data: 0
    }
    for (const d of preTypeFiltered) counts[getDumpType(d.payload)]++
    return counts
  }, [preTypeFiltered])

  // --- Sidebar counts (over all dumps) -----------------------------------

  const { serverCounts, flagCounts, channelCounts, channels } = useMemo(() => {
    const sc: Record<string, number> = {}
    const fc: Record<string, number> = {}
    const cc: Record<string, number> = {}
    for (const d of dumps) {
      sc[d.serverId] = (sc[d.serverId] ?? 0) + 1
      fc[d.flag ?? 'gray'] = (fc[d.flag ?? 'gray'] ?? 0) + 1
      const ch = d.channel ?? 'default'
      cc[ch] = (cc[ch] ?? 0) + 1
    }
    return {
      serverCounts: sc,
      flagCounts: fc,
      channelCounts: cc,
      channels: Object.keys(cc).sort()
    }
  }, [dumps])

  // --- Header stats ------------------------------------------------------

  const headerStats = useMemo(() => {
    const oneMinuteAgo = Date.now() - 60000
    let exceptions = 0
    let recent = 0
    for (const d of filteredDumps) {
      if (getDumpType(d.payload) === 'exception') exceptions++
      if (d.timestamp > oneMinuteAgo) recent++
    }
    return {
      total: dumps.length,
      filtered: filteredDumps.length,
      exceptions,
      dataPackets: filteredDumps.length - exceptions,
      recent
    }
  }, [filteredDumps, dumps.length])

  // --- Keyboard navigation -----------------------------------------------

  const filteredIds = useMemo(() => filteredDumps.map((d) => d.id), [filteredDumps])

  useKeyboardNav({
    ids: filteredIds,
    selectedId: selectedDumpId,
    onSelect: setSelectedDumpId,
    onFocusSearch: () => searchInputRef.current?.focus(),
    onTogglePause: () => setIsPaused((p) => !p),
    onOpenPalette: () => setIsPaletteOpen(true),
    onEscape: () => setSelectedDumpId(null),
    disabled: !settings || isPaletteOpen || isSettingsOpen
  })

  const toggleDensity = (): void => setDensity((d) => (d === 'compact' ? 'comfortable' : 'compact'))

  // --- Command palette ---------------------------------------------------

  const commands = useMemo<Command[]>(() => {
    const list: Command[] = [
      { id: 'clear', group: 'Action', label: 'Clear all dumps', run: handleClearDumps },
      { id: 'export', group: 'Action', label: 'Export dumps', run: handleExportDumps },
      {
        id: 'pause',
        group: 'Action',
        label: isPaused ? 'Resume stream' : 'Pause stream',
        run: () => setIsPaused((p) => !p)
      },
      {
        id: 'copy-selected',
        group: 'Action',
        label: 'Copy selected dump as JSON',
        run: () => {
          const sel = dumps.find((d) => d.id === selectedDumpId)
          if (sel) navigator.clipboard.writeText(JSON.stringify(sel.payload, null, 2))
        }
      },
      {
        id: 'theme',
        group: 'View',
        label: `Switch to ${isDark ? 'light' : 'dark'} theme`,
        run: () => setTheme(isDark ? 'light' : 'dark')
      },
      {
        id: 'density',
        group: 'View',
        label: `Use ${density === 'compact' ? 'comfortable' : 'compact'} density`,
        run: toggleDensity
      },
      { id: 'settings', group: 'Go', label: 'Open settings', run: () => setIsSettingsOpen(true) }
    ]

    const types: TypeFilter[] = [
      'all',
      'exception',
      'var',
      'sql',
      'http',
      'log',
      'performance',
      'event',
      'model',
      'collection',
      'table',
      'measure',
      'data'
    ]
    types.forEach((t) =>
      list.push({
        id: `type-${t}`,
        group: 'Filter type',
        label: t === 'all' ? 'All types' : t.charAt(0).toUpperCase() + t.slice(1),
        run: () => setFilterType(t)
      })
    )

    servers.forEach((s) =>
      list.push({
        id: `srv-${s.id}`,
        group: 'Filter server',
        label: s.name,
        run: () => setSelectedServerId(s.id)
      })
    )
    list.push({
      id: 'srv-all',
      group: 'Filter server',
      label: 'All servers',
      run: () => setSelectedServerId('all')
    })

    FLAG_NAMES.forEach((f) =>
      list.push({
        id: `flag-${f}`,
        group: 'Filter flag',
        label: f.charAt(0).toUpperCase() + f.slice(1),
        run: () => setSelectedFlags([f])
      })
    )

    channels.forEach((c) =>
      list.push({
        id: `ch-${c}`,
        group: 'Filter channel',
        label: `#${c}`,
        run: () => setSelectedChannel(c)
      })
    )

    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dumps, selectedDumpId, isPaused, isDark, density, servers, channels])

  if (!settings) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-line border-t-accent"></div>
          <p className="text-sm text-muted">Loading Dumpio…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-surface text-fg">
      <Sidebar
        servers={servers}
        selectedServerId={selectedServerId}
        onServerSelect={setSelectedServerId}
        selectedFlags={selectedFlags}
        onFlagsChange={setSelectedFlags}
        onSettingsClick={() => setIsSettingsOpen(true)}
        serverCounts={serverCounts}
        flagCounts={flagCounts}
        channels={channels}
        channelCounts={channelCounts}
        selectedChannel={selectedChannel}
        onChannelSelect={setSelectedChannel}
        totalCount={dumps.length}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onClearDumps={handleClearDumps}
          onExportDumps={handleExportDumps}
          alwaysOnTop={alwaysOnTop}
          onToggleAlwaysOnTop={() => setAlwaysOnTop((prev) => !prev)}
          totalDumps={headerStats.total}
          filteredDumps={headerStats.filtered}
          recentActivity={headerStats.recent}
          exceptions={headerStats.exceptions}
          dataPackets={headerStats.dataPackets}
          searchScope={searchScope}
          onSearchScopeChange={setSearchScope}
          searchRegex={searchRegex}
          onSearchRegexChange={setSearchRegex}
          searchInputRef={searchInputRef}
        />

        {dumps.length === 0 ? (
          <EmptyState />
        ) : (
          <EnhancedDumpViewer
            dumps={filteredDumps}
            servers={servers}
            selectedDumpId={selectedDumpId}
            onSelect={setSelectedDumpId}
            isPaused={isPaused}
            onTogglePause={() => setIsPaused((p) => !p)}
            filterType={filterType}
            onFilterTypeChange={setFilterType}
            typeCounts={typeCounts}
            density={density}
            onToggleDensity={toggleDensity}
            newDumpIds={newDumpIds}
          />
        )}
      </div>

      {isSettingsOpen && (
        <SettingsModal
          settings={settings}
          onClose={() => setIsSettingsOpen(false)}
          onSave={handleSaveSettings}
          onClearDumps={handleClearDumps}
          onApplyImported={handleApplyImported}
        />
      )}

      <CommandPalette
        open={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        commands={commands}
      />
    </div>
  )
}

export default App
