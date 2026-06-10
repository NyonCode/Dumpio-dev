import { useState, useEffect, useRef, type JSX, type ReactNode } from 'react'
import {
  Server as ServerIcon,
  Palette,
  Database,
  ShieldCheck,
  Keyboard,
  X,
  Plus,
  Pencil,
  Trash2,
  Send,
  FolderOpen,
  Download,
  Upload,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Check,
  Sun,
  Moon,
  Monitor,
  type LucideIcon
} from 'lucide-react'
import { Settings, Server } from '../App'
import { serverDot, SERVER_COLOR_NAMES, ACCENT_OPTIONS } from '../lib/colors'
import type { ServerStatus } from '../types/global'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { usePersistentState } from '../hooks/usePersistentState'
import { EDITOR_OPTIONS, EDITOR_STORAGE_KEY, type EditorScheme } from '../utils/editor'

type SettingsTab = 'servers' | 'appearance' | 'data' | 'security' | 'shortcuts'

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

/** Mirror of the main-process guard: true when a host binds to loopback only. */
const isLoopbackHost = (host: string): boolean => LOOPBACK_HOSTS.has(host.trim().toLowerCase())

/** Generate a random shared token, prefixed `Dio-` so it's recognizable at a glance. */
const generateToken = (): string => {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  const body = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `Dio-${body}`
}

const TABS: { key: SettingsTab; label: string; icon: LucideIcon }[] = [
  { key: 'servers', label: 'Servers', icon: ServerIcon },
  { key: 'appearance', label: 'Appearance', icon: Palette },
  { key: 'data', label: 'Data', icon: Database },
  { key: 'security', label: 'Security', icon: ShieldCheck },
  { key: 'shortcuts', label: 'Shortcuts', icon: Keyboard }
]

const SHORTCUTS: { keys: string[]; desc: string }[] = [
  { keys: ['j', '↓'], desc: 'Next dump' },
  { keys: ['k', '↑'], desc: 'Previous dump' },
  { keys: ['g', 'g'], desc: 'Jump to first' },
  { keys: ['G'], desc: 'Jump to last' },
  { keys: ['Enter'], desc: 'Select first dump' },
  { keys: ['/'], desc: 'Focus search' },
  { keys: ['p'], desc: 'Pause / resume stream' },
  { keys: ['Esc'], desc: 'Clear selection / blur input' },
  { keys: ['⌘/Ctrl', 'K'], desc: 'Open command palette' }
]

// Shared control styles — kept in sync with the Header/Sidebar look.
const inputClass =
  'block w-full rounded-lg border border-line bg-sunken px-3 py-2 text-sm text-fg placeholder-subtle focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors'
const btnSecondary =
  'inline-flex items-center gap-2 rounded-lg border border-line bg-sunken px-3 py-2 text-sm font-medium text-fg transition-all hover:bg-elevated focus:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.98]'
const btnPrimary =
  'inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-all hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.98]'
const btnDanger =
  'inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 active:scale-[0.98]'
const iconBtn =
  'inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-elevated hover:text-fg focus:outline-none focus:ring-1 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-40 transition-colors'

// Lightweight CSS-only tooltip. `side="left"` keeps it inside scroll containers
// for right-aligned action buttons (no clipping at the viewport edge).
function Tooltip({
  label,
  side = 'top',
  children
}: {
  label: string
  side?: 'top' | 'left'
  children: ReactNode
}): JSX.Element {
  const pos =
    side === 'left'
      ? 'right-full top-1/2 mr-2 -translate-y-1/2'
      : 'bottom-full left-1/2 mb-2 -translate-x-1/2'
  return (
    <span className="group/tt relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-[80] whitespace-nowrap rounded-md bg-fg px-2 py-1 text-xs font-medium text-surface opacity-0 shadow-lg transition-opacity duration-150 group-hover/tt:opacity-100 ${pos}`}
      >
        {label}
      </span>
    </span>
  )
}

// The switch control on its own — shows an explicit ON / OFF state plus a
// check/cross glyph in the knob. `label` is used only for the accessible name.
function Switch({
  checked,
  onChange,
  label
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-[3.25rem] shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface ${
        checked ? 'bg-accent' : 'bg-line-strong'
      }`}
    >
      <span
        className={`pointer-events-none absolute left-2 text-[9px] font-bold uppercase tracking-wide text-white transition-opacity ${
          checked ? 'opacity-100' : 'opacity-0'
        }`}
      >
        On
      </span>
      <span
        className={`pointer-events-none absolute right-2 text-[9px] font-bold uppercase tracking-wide text-subtle transition-opacity ${
          checked ? 'opacity-0' : 'opacity-100'
        }`}
      >
        Off
      </span>
      <span
        className={`flex h-6 w-6 transform items-center justify-center rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-[1.625rem]' : 'translate-x-0.5'
        }`}
      >
        {checked ? (
          <Check className="h-3.5 w-3.5 text-blue-600" />
        ) : (
          <X className="h-3.5 w-3.5 text-subtle" />
        )}
      </span>
    </button>
  )
}

function Toggle({
  checked,
  onChange,
  label,
  description
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description?: string
}): JSX.Element {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="text-sm font-medium text-fg">{label}</div>
        {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      </div>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  )
}

function SectionTitle({ children }: { children: ReactNode }): JSX.Element {
  return (
    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-subtle">{children}</h4>
  )
}

// A labeled control row used across the Appearance tab.
function Field({
  label,
  description,
  children
}: {
  label: string
  description?: string
  children: ReactNode
}): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="text-sm font-medium text-fg">{label}</div>
        {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

// Segmented (radio-group) control — icon-optional pills sharing one track.
function Segmented<T extends string>({
  value,
  onChange,
  options,
  label
}: {
  value: T
  onChange: (v: T) => void
  label: string
  options: { value: T; label: string; icon?: LucideIcon }[]
}): JSX.Element {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const onKeyDown = (e: React.KeyboardEvent): void => {
    const idx = options.findIndex((o) => o.value === value)
    let next = idx
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % options.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')
      next = (idx - 1 + options.length) % options.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = options.length - 1
    else return
    e.preventDefault()
    onChange(options[next].value)
    refs.current[next]?.focus()
  }
  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="inline-flex rounded-lg border border-line bg-sunken p-0.5"
    >
      {options.map((o, i) => {
        const active = value === o.value
        const Icon = o.icon
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              active ? 'bg-panel text-fg shadow-sm' : 'text-muted hover:text-fg'
            }`}
          >
            {Icon && <Icon className="h-4 w-4" />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

interface SettingsModalProps {
  settings: Settings
  onClose: () => void
  onSave: (settings: Settings) => void
  onClearDumps: () => void | Promise<void>
  onApplyImported: (settings: Settings) => void
}

export function SettingsModal({
  settings,
  onClose,
  onSave,
  onClearDumps,
  onApplyImported
}: SettingsModalProps): JSX.Element {
  const [localSettings, setLocalSettings] = useState<Settings>(settings)
  const [activeTab, setActiveTab] = useState<SettingsTab>('servers')
  // Editor for clickable file:line links — a per-machine preference, applied
  // immediately rather than going through the Save flow.
  const [editorScheme, setEditorScheme] = usePersistentState<EditorScheme>(
    EDITOR_STORAGE_KEY,
    'none'
  )
  const panelRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Roving tab navigation: Up/Down (or Left/Right) + Home/End move between tabs.
  const onTabListKeyDown = (e: React.KeyboardEvent): void => {
    const keys = TABS.map((t) => t.key)
    const idx = keys.indexOf(activeTab)
    let next = idx
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = (idx + 1) % keys.length
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft')
      next = (idx - 1 + keys.length) % keys.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = keys.length - 1
    else return
    e.preventDefault()
    setActiveTab(keys[next])
    tabRefs.current[next]?.focus()
  }
  const [editingServer, setEditingServer] = useState<Server | null>(null)
  const [isAddingServer, setIsAddingServer] = useState(false)
  const [statuses, setStatuses] = useState<Record<string, ServerStatus>>({})
  const [notification, setNotification] = useState<{
    type: 'error' | 'success'
    message: string
  } | null>(null)

  // Trap focus in the settings dialog, but yield to the server editor when it is open.
  useFocusTrap(panelRef, !editingServer)

  useEffect(() => {
    setLocalSettings(settings)
  }, [settings])

  // Poll live server status while the modal is open.
  useEffect(() => {
    let cancelled = false
    const poll = async (): Promise<void> => {
      try {
        const next = await window.api.getServerStatus()
        if (!cancelled) setStatuses(next)
      } catch {
        /* ignore transient polling errors */
      }
    }
    poll()
    const interval = setInterval(poll, 2000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  // Close on Escape (unless the server editor is open — it handles its own Esc).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !editingServer) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editingServer, onClose])

  // Auto-hide notification
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [notification])

  const showNotification = (type: 'error' | 'success', message: string): void => {
    setNotification({ type, message })
  }

  const handleSave = (): void => {
    onSave(localSettings)
    onClose()
  }

  const handleAddServer = (): void => {
    const newServer: Server = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      name: 'New Server',
      host: 'localhost',
      port: 21234,
      color: 'blue',
      active: true,
      protocol: 'http'
    }
    setEditingServer(newServer)
    setIsAddingServer(true)
  }

  const handleSaveServer = async (server: Server): Promise<void> => {
    // Check for duplicates (same host:port combination)
    const isDuplicate = localSettings.servers.some(
      (existingServer) =>
        existingServer.id !== server.id &&
        existingServer.host === server.host &&
        existingServer.port === server.port
    )

    if (isDuplicate) {
      showNotification(
        'error',
        `Server with ${server.host}:${server.port} already exists. Please use a different host or port.`
      )
      return
    }

    try {
      let updatedSettings: Settings

      if (isAddingServer) {
        updatedSettings = {
          ...localSettings,
          servers: [...localSettings.servers, server]
        }
        setLocalSettings(updatedSettings)
        setIsAddingServer(false)

        // If the new server is active, start it immediately
        if (server.active) {
          await window.api.saveSettingsAndSyncServers(updatedSettings)
          showNotification('success', `Server "${server.name}" added and started successfully`)
        } else {
          showNotification('success', `Server "${server.name}" added successfully`)
        }
      } else {
        updatedSettings = {
          ...localSettings,
          servers: localSettings.servers.map((s) => (s.id === server.id ? server : s))
        }
        setLocalSettings(updatedSettings)

        // If server configuration changed, sync immediately
        await window.api.saveSettingsAndSyncServers(updatedSettings)
        showNotification('success', `Server "${server.name}" updated successfully`)
      }

      setEditingServer(null)
    } catch (error) {
      console.error('Failed to save server:', error)
      showNotification('error', `Failed to save server: ${(error as Error).message}`)
    }
  }

  const handleDeleteServer = (serverId: string): void => {
    const updatedSettings = {
      ...localSettings,
      servers: localSettings.servers.filter((s) => s.id !== serverId)
    }
    setLocalSettings(updatedSettings)
  }

  // Immediate save for server toggle - no need to wait for "Save Changes"
  const handleToggleServer = async (serverId: string): Promise<void> => {
    const server = localSettings.servers.find((s) => s.id === serverId)
    if (!server) return

    const updatedSettings = {
      ...localSettings,
      servers: localSettings.servers.map((s) =>
        s.id === serverId ? { ...s, active: !s.active } : s
      )
    }
    setLocalSettings(updatedSettings)

    // Immediately save and sync servers
    try {
      await window.api.saveSettingsAndSyncServers(updatedSettings)
      const action = server.active ? 'stopped' : 'started'
      showNotification('success', `Server "${server.name}" ${action} successfully`)
    } catch (error) {
      console.error('Failed to toggle server:', error)
      showNotification('error', `Failed to toggle server: ${(error as Error).message}`)
      // Revert the change on error
      setLocalSettings(localSettings)
    }
  }

  const handleSendTestDump = async (server: Server): Promise<void> => {
    try {
      await window.api.sendTestDump(server.id)
      showNotification('success', `Test dump sent to "${server.name}"`)
    } catch (error) {
      showNotification('error', `Failed to send test dump: ${(error as Error).message}`)
    }
  }

  const handleOpenDataFolder = async (): Promise<void> => {
    const ok = await window.api.openPath()
    if (!ok) showNotification('error', 'Could not open the data folder')
  }

  const handleExportSettings = async (): Promise<void> => {
    try {
      const ok = await window.api.exportSettings()
      if (ok) showNotification('success', 'Settings exported')
    } catch (error) {
      showNotification('error', `Export failed: ${(error as Error).message}`)
    }
  }

  const handleImportSettings = async (): Promise<void> => {
    try {
      const imported = await window.api.importSettings()
      if (imported) {
        setLocalSettings(imported)
        onApplyImported(imported)
        showNotification('success', 'Settings imported')
      }
    } catch (error) {
      showNotification('error', `Import failed: ${(error as Error).message}`)
    }
  }

  const handleClearAllDumps = async (): Promise<void> => {
    await onClearDumps()
    showNotification('success', 'All dumps cleared')
  }

  const handleResetToDefaults = (): void => {
    setLocalSettings((prev) => ({
      ...prev,
      theme: 'system',
      saveDumpsOnExit: false,
      autoSaveDumps: false,
      maxDumpsInMemory: 1000,
      autoStartServers: true,
      viewMode: 'detailed',
      density: 'comfortable',
      fontSize: 'medium',
      accentColor: 'blue',
      filters: { showServerColors: true, defaultFlagFilter: [] }
    }))
    showNotification('success', 'Defaults restored — click Save Changes to apply')
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-4xl animate-scale-in flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-line px-6 py-4">
          <div>
            <h3 className="text-base font-semibold text-fg">Settings</h3>
            <p className="text-xs text-muted">Configure servers, appearance, data and security</p>
          </div>
          <button onClick={onClose} className={iconBtn} aria-label="Close settings">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body: vertical tabs + content */}
        <div className="flex min-h-0 flex-1">
          {/* Tabs */}
          <nav
            className="w-48 shrink-0 space-y-1 overflow-y-auto border-r border-line p-3"
            role="tablist"
            aria-orientation="vertical"
            aria-label="Settings sections"
            onKeyDown={onTabListKeyDown}
          >
            {TABS.map((tab, i) => {
              const Icon = tab.icon
              const active = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  ref={(el) => {
                    tabRefs.current[i] = el
                  }}
                  role="tab"
                  aria-selected={active}
                  tabIndex={active ? 0 : -1}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${
                    active
                      ? 'bg-accent/10 text-accent'
                      : 'text-muted hover:bg-elevated hover:text-fg'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {tab.label}
                </button>
              )
            })}
          </nav>

          {/* Content */}
          <div className="min-w-0 flex-1 overflow-y-auto p-6" role="tabpanel">
            {activeTab === 'servers' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <SectionTitle>Ingest servers</SectionTitle>
                  <button onClick={handleAddServer} className={btnPrimary}>
                    <Plus className="h-4 w-4" />
                    Add Server
                  </button>
                </div>

                <div className="space-y-2.5">
                  {localSettings.servers.map((server) => {
                    const status = statuses[server.id]
                    return (
                      <div
                        key={server.id}
                        className="flex items-center justify-between gap-4 rounded-xl border border-line bg-sunken p-4"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className={`h-3 w-3 shrink-0 rounded-full ${serverDot(server.color)}`}
                          />
                          <div className="min-w-0">
                            <div className="truncate font-medium text-fg">{server.name}</div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                                  server.protocol === 'http'
                                    ? 'bg-accent/15 text-accent'
                                    : 'bg-elevated text-muted'
                                }`}
                              >
                                {server.protocol}
                              </span>
                              <span className="font-mono text-xs">
                                {server.host}:{server.port}
                              </span>
                              {status && (
                                <span className="inline-flex items-center gap-1.5">
                                  <span
                                    className={`h-2 w-2 rounded-full ${
                                      status.isRunning
                                        ? 'animate-pulse bg-emerald-500'
                                        : 'bg-subtle'
                                    }`}
                                  />
                                  <span className="text-xs">
                                    {status.isRunning
                                      ? `running · ${status.activeConnections} conn`
                                      : 'stopped'}
                                  </span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          <Tooltip
                            side="left"
                            label={server.active ? 'Disable server' : 'Enable server'}
                          >
                            <Switch
                              checked={server.active}
                              onChange={() => handleToggleServer(server.id)}
                              label={`${server.active ? 'Disable' : 'Enable'} ${server.name}`}
                            />
                          </Tooltip>
                          <div className="mx-1 h-6 w-px bg-line" />
                          <Tooltip
                            side="left"
                            label={
                              status?.isRunning
                                ? 'Send test dump'
                                : 'Start the server to send a test dump'
                            }
                          >
                            <button
                              onClick={() => status?.isRunning && handleSendTestDump(server)}
                              aria-disabled={!status?.isRunning}
                              aria-label={`Send test dump to ${server.name}`}
                              className={`${iconBtn} ${
                                !status?.isRunning ? 'cursor-not-allowed opacity-40' : ''
                              }`}
                            >
                              <Send className="h-4 w-4" />
                            </button>
                          </Tooltip>
                          <Tooltip side="left" label="Edit server">
                            <button
                              onClick={() => setEditingServer(server)}
                              className={iconBtn}
                              aria-label={`Edit ${server.name}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          </Tooltip>
                          <Tooltip side="left" label="Delete server">
                            <button
                              onClick={() => handleDeleteServer(server.id)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-red-100 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 dark:hover:bg-red-950/50 dark:hover:text-red-400"
                              aria-label={`Delete ${server.name}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </Tooltip>
                        </div>
                      </div>
                    )
                  })}

                  {localSettings.servers.length === 0 && (
                    <div className="rounded-xl border border-dashed border-line py-10 text-center text-sm text-muted">
                      No servers configured. Add one to get started.
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'appearance' && (
              <div className="space-y-8">
                <section className="space-y-4">
                  <SectionTitle>Theme</SectionTitle>
                  <Field label="Color scheme" description="Light, dark, or follow the system">
                    <Segmented
                      label="Color scheme"
                      value={localSettings.theme}
                      onChange={(v) => setLocalSettings((prev) => ({ ...prev, theme: v }))}
                      options={[
                        { value: 'light', label: 'Light', icon: Sun },
                        { value: 'dark', label: 'Dark', icon: Moon },
                        { value: 'system', label: 'System', icon: Monitor }
                      ]}
                    />
                  </Field>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-fg">Accent color</label>
                    <div className="flex flex-wrap gap-2.5">
                      {ACCENT_OPTIONS.map((accent) => {
                        const selected = localSettings.accentColor === accent.value
                        return (
                          <button
                            key={accent.value}
                            type="button"
                            title={accent.label}
                            aria-label={accent.label}
                            aria-pressed={selected}
                            onClick={() =>
                              setLocalSettings((prev) => ({ ...prev, accentColor: accent.value }))
                            }
                            className={`flex h-8 w-8 items-center justify-center rounded-full text-white transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-panel ${accent.swatch} ${
                              selected ? 'ring-2 ring-fg ring-offset-2 ring-offset-panel' : ''
                            }`}
                          >
                            {selected && <Check className="h-4 w-4" />}
                          </button>
                        )
                      })}
                    </div>
                    <p className="mt-2 text-xs text-muted">
                      Recolors buttons, links and active states across the app
                    </p>
                  </div>
                </section>

                <section className="space-y-4 border-t border-line pt-6">
                  <SectionTitle>Layout &amp; text</SectionTitle>
                  <Field label="View mode" description="How much detail each dump shows">
                    <Segmented
                      label="View mode"
                      value={localSettings.viewMode}
                      onChange={(v) => setLocalSettings((prev) => ({ ...prev, viewMode: v }))}
                      options={[
                        { value: 'detailed', label: 'Detailed' },
                        { value: 'compact', label: 'Compact' }
                      ]}
                    />
                  </Field>
                  <Field label="List density" description="Row height in the dump list">
                    <Segmented
                      label="List density"
                      value={localSettings.density}
                      onChange={(v) => setLocalSettings((prev) => ({ ...prev, density: v }))}
                      options={[
                        { value: 'comfortable', label: 'Comfortable' },
                        { value: 'compact', label: 'Compact' }
                      ]}
                    />
                  </Field>
                  <Field label="Font size" description="Base text size across the app">
                    <Segmented
                      label="Font size"
                      value={localSettings.fontSize}
                      onChange={(v) => setLocalSettings((prev) => ({ ...prev, fontSize: v }))}
                      options={[
                        { value: 'small', label: 'S' },
                        { value: 'medium', label: 'M' },
                        { value: 'large', label: 'L' }
                      ]}
                    />
                  </Field>
                </section>

                <section className="space-y-4 border-t border-line pt-6">
                  <SectionTitle>Editor</SectionTitle>
                  <Field
                    label="Open file:line in"
                    description="Makes caller and stack-trace locations clickable, opening your editor at that line"
                  >
                    <select
                      value={editorScheme}
                      onChange={(e) => setEditorScheme(e.target.value as EditorScheme)}
                      className={inputClass}
                      aria-label="Editor for file:line links"
                    >
                      {EDITOR_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </section>
              </div>
            )}

            {activeTab === 'data' && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <SectionTitle>Dump management</SectionTitle>

                  <Toggle
                    checked={localSettings.autoSaveDumps}
                    onChange={(v) => setLocalSettings((prev) => ({ ...prev, autoSaveDumps: v }))}
                    label="Automatically save dumps to disk"
                    description="Dumps will be saved every 5 seconds to dumps.json file"
                  />

                  <Toggle
                    checked={localSettings.saveDumpsOnExit}
                    onChange={(v) => setLocalSettings((prev) => ({ ...prev, saveDumpsOnExit: v }))}
                    label="Force save dumps when application exits"
                    description="Ensures all dumps are saved before closing"
                  />

                  <Toggle
                    checked={localSettings.autoStartServers}
                    onChange={(v) => setLocalSettings((prev) => ({ ...prev, autoStartServers: v }))}
                    label="Auto-start servers on application launch"
                  />

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-fg">
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
                      className={inputClass}
                    />
                    <p className="mt-1.5 text-xs text-muted">
                      Older dumps will be removed from memory when limit is reached
                    </p>
                  </div>
                </div>

                <div className="space-y-3 border-t border-line pt-4">
                  <SectionTitle>Storage &amp; backups</SectionTitle>
                  <div className="flex flex-wrap gap-2.5">
                    <button onClick={handleOpenDataFolder} className={btnSecondary}>
                      <FolderOpen className="h-4 w-4" />
                      Open data folder
                    </button>
                    <button onClick={handleExportSettings} className={btnSecondary}>
                      <Download className="h-4 w-4" />
                      Export settings
                    </button>
                    <button onClick={handleImportSettings} className={btnSecondary}>
                      <Upload className="h-4 w-4" />
                      Import settings
                    </button>
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border border-red-200 bg-red-50/50 p-4 dark:border-red-900/50 dark:bg-red-950/20">
                  <h5 className="text-xs font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">
                    Danger zone
                  </h5>
                  <div className="flex flex-wrap gap-2.5">
                    <button onClick={handleResetToDefaults} className={btnSecondary}>
                      <RotateCcw className="h-4 w-4" />
                      Reset to defaults
                    </button>
                    <button onClick={handleClearAllDumps} className={btnDanger}>
                      <Trash2 className="h-4 w-4" />
                      Clear all dumps
                    </button>
                  </div>
                  <p className="text-xs text-muted">
                    Reset restores appearance &amp; data defaults (servers untouched) and applies on
                    Save. Clearing dumps is immediate and cannot be undone.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-6">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-fg">
                    Access token (optional)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={localSettings.security.token}
                      placeholder="Disabled"
                      onChange={(e) =>
                        setLocalSettings((prev) => ({
                          ...prev,
                          security: { ...prev.security, token: e.target.value }
                        }))
                      }
                      className={`${inputClass} font-mono`}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setLocalSettings((prev) => ({
                          ...prev,
                          security: { ...prev.security, token: generateToken() }
                        }))
                      }
                      className={`${btnSecondary} shrink-0`}
                    >
                      <RotateCcw className="h-4 w-4" />
                      Generate
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs text-muted">
                    When set, every dump must carry this token — HTTP:{' '}
                    <code>Authorization: Bearer &lt;token&gt;</code> or <code>X-Dumpio-Token</code>;
                    TCP: a <code>token</code> field in the payload. Leave empty to disable.
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-fg">
                    Max payload size (KB)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={localSettings.security.maxPayloadKb}
                    onChange={(e) =>
                      setLocalSettings((prev) => ({
                        ...prev,
                        security: { ...prev.security, maxPayloadKb: parseInt(e.target.value) || 1 }
                      }))
                    }
                    className={inputClass}
                  />
                  <p className="mt-1.5 text-xs text-muted">
                    Requests/messages larger than this are rejected (protects against memory abuse)
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-fg">
                    Rate limit (messages / second)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={localSettings.security.rateLimitPerSec}
                    onChange={(e) =>
                      setLocalSettings((prev) => ({
                        ...prev,
                        security: {
                          ...prev.security,
                          rateLimitPerSec: parseInt(e.target.value) || 0
                        }
                      }))
                    }
                    className={inputClass}
                  />
                  <p className="mt-1.5 text-xs text-muted">
                    Per client/connection. Set to 0 to disable rate limiting.
                  </p>
                </div>

                <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700/60 dark:bg-amber-900/20">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                        Network exposure is per server
                      </p>
                      <ul className="space-y-1.5 text-xs leading-relaxed text-amber-800 dark:text-amber-200/90">
                        <li className="flex gap-2">
                          <span aria-hidden>•</span>
                          <span>
                            Each server listens only on{' '}
                            <span className="font-mono font-medium">127.0.0.1</span> (this computer)
                            until you switch it to <span className="font-medium">Network</span> in
                            its settings.
                          </span>
                        </li>
                        <li className="flex gap-2">
                          <span aria-hidden>•</span>
                          <span>
                            A network-exposed server <span className="font-medium">requires</span>{' '}
                            this token — it won&apos;t start without one, and you&apos;ll be
                            prompted to set it when you switch.
                          </span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'shortcuts' && (
              <div className="space-y-4">
                <SectionTitle>Keyboard shortcuts</SectionTitle>
                <p className="text-xs text-muted">
                  Shortcuts are fixed and cannot be customized. They are ignored while typing in an
                  input (except Esc and the command palette).
                </p>
                <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
                  {SHORTCUTS.map((sc) => (
                    <div
                      key={sc.desc}
                      className="flex items-center justify-between px-4 py-2.5 odd:bg-sunken"
                    >
                      <span className="text-sm text-fg">{sc.desc}</span>
                      <span className="flex items-center gap-1">
                        {sc.keys.map((k, i) => (
                          <kbd
                            key={i}
                            className="rounded border border-line bg-sunken px-2 py-0.5 font-mono text-xs font-semibold text-fg shadow-sm"
                          >
                            {k}
                          </kbd>
                        ))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 justify-end gap-3 border-t border-line px-6 py-4">
          <button onClick={onClose} className={btnSecondary}>
            Cancel
          </button>
          <button onClick={handleSave} className={btnPrimary}>
            Save Changes
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={`fixed right-4 top-4 z-[70] w-full max-w-sm rounded-xl shadow-lg animate-slide-down ${
            notification.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
          }`}
          role="alert"
        >
          <div className="flex items-center gap-3 p-4">
            <div className="shrink-0">
              {notification.type === 'error' ? (
                <AlertCircle className="h-5 w-5" />
              ) : (
                <CheckCircle2 className="h-5 w-5" />
              )}
            </div>
            <p className="flex-1 text-sm font-medium">{notification.message}</p>
            <button
              onClick={() => setNotification(null)}
              className="shrink-0 rounded p-1 text-white/80 hover:bg-white/20 hover:text-white focus:outline-none"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Server Edit Modal */}
      {editingServer && (
        <ServerEditModal
          server={editingServer}
          token={localSettings.security.token}
          onSetToken={(token) =>
            setLocalSettings((prev) => ({ ...prev, security: { ...prev.security, token } }))
          }
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
  token: string
  onSetToken: (token: string) => void
  onSave: (server: Server) => void
  onCancel: () => void
}

function ServerEditModal({
  server,
  token,
  onSetToken,
  onSave,
  onCancel
}: ServerEditModalProps): JSX.Element {
  const [editedServer, setEditedServer] = useState(server)
  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  // Confirmation gate shown before flipping a server to network exposure.
  const [networkConfirm, setNetworkConfirm] = useState(false)
  const [tokenDraft, setTokenDraft] = useState(token)
  const editPanelRef = useRef<HTMLDivElement>(null)
  useFocusTrap(editPanelRef)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  const validateServer = (): boolean => {
    const newErrors: { [key: string]: string } = {}

    // Validate name
    if (!editedServer.name.trim()) {
      newErrors.name = 'Server name is required'
    }

    // Validate host
    if (!editedServer.host.trim()) {
      newErrors.host = 'Host is required'
    }

    // A network-exposed server must be token-protected (mirrors the main-process gate).
    if (!isLoopbackHost(editedServer.host) && !token.trim()) {
      newErrors.host = 'A shared token is required for network-exposed servers.'
    }

    // Validate port
    if (!editedServer.port || editedServer.port < 1 || editedServer.port > 65535) {
      newErrors.port = 'Port must be between 1 and 65535'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = (): void => {
    if (validateServer()) {
      onSave(editedServer)
    }
  }

  const handleInputChange = <K extends keyof Server>(field: K, value: Server[K]): void => {
    setEditedServer((prev) => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }))
    }
  }

  const fieldClass = (hasError: boolean): string =>
    `block w-full rounded-lg border px-3 py-2 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-accent transition-colors ${
      hasError
        ? 'border-red-400 bg-red-50 dark:border-red-600 dark:bg-red-900/20'
        : 'border-line bg-sunken focus:border-accent'
    }`

  const confirmNetwork = (): void => {
    onSetToken(tokenDraft.trim())
    handleInputChange('host', '0.0.0.0')
    setNetworkConfirm(false)
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in"
        onClick={onCancel}
        role="dialog"
        aria-modal="true"
        aria-label={server.id ? 'Edit server' : 'Add server'}
      >
        <div
          ref={editPanelRef}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md animate-scale-in overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-line px-6 py-4">
            <h3 className="text-base font-semibold text-fg">
              {server.id ? 'Edit Server' : 'Add Server'}
            </h3>
            <button onClick={onCancel} className={iconBtn} aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4 p-6">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-fg">Name</label>
              <input
                type="text"
                value={editedServer.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className={fieldClass(!!errors.name)}
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name}</p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-fg">Availability</label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { value: 'localhost', label: 'This computer', hint: '127.0.0.1 only' },
                    { value: '0.0.0.0', label: 'Network', hint: 'exposed to LAN' }
                  ] as const
                ).map((opt) => {
                  const selected = isLoopbackHost(editedServer.host)
                    ? opt.value === 'localhost'
                    : opt.value === '0.0.0.0'
                  const onClick = (): void => {
                    if (opt.value === '0.0.0.0' && isLoopbackHost(editedServer.host)) {
                      // Going public is a deliberate, confirmed action.
                      setTokenDraft(token)
                      setNetworkConfirm(true)
                    } else {
                      handleInputChange('host', opt.value)
                    }
                  }
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={onClick}
                      className={`flex flex-col items-start rounded-lg border px-3 py-2 text-left transition-colors ${
                        selected
                          ? 'border-accent bg-accent/10'
                          : 'border-line bg-sunken hover:border-accent/50'
                      }`}
                    >
                      <span className="text-sm font-medium text-fg">{opt.label}</span>
                      <span className="text-xs text-muted">{opt.hint}</span>
                    </button>
                  )
                })}
              </div>
              {!isLoopbackHost(editedServer.host) && (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                  Warning: this server accepts dumps from any machine on your network. Access is
                  controlled only by the shared token.
                </p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-fg">Port</label>
              <input
                type="number"
                min="1"
                max="65535"
                value={editedServer.port}
                onChange={(e) => handleInputChange('port', parseInt(e.target.value) || 0)}
                className={fieldClass(!!errors.port)}
              />
              {errors.port && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.port}</p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-fg">Protocol</label>
              <select
                value={editedServer.protocol}
                onChange={(e) => handleInputChange('protocol', e.target.value as 'http' | 'tcp')}
                className={inputClass}
              >
                <option value="http">HTTP (recommended)</option>
                <option value="tcp">TCP (legacy)</option>
              </select>
              <p className="mt-1.5 break-all text-xs text-muted">
                {(() => {
                  const displayHost = isLoopbackHost(editedServer.host)
                    ? 'localhost'
                    : '<this-machine-ip>'
                  return editedServer.protocol === 'http'
                    ? `POST http://${displayHost}:${editedServer.port}/dumps`
                    : `Send JSON over a raw TCP socket to ${displayHost}:${editedServer.port}`
                })()}
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-fg">Color</label>
              <div className="flex flex-wrap gap-2.5">
                {SERVER_COLOR_NAMES.map((color) => {
                  const selected = editedServer.color === color
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => handleInputChange('color', color)}
                      title={color}
                      aria-label={color}
                      aria-pressed={selected}
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-white transition-transform hover:scale-110 ${serverDot(
                        color
                      )} ${selected ? 'ring-2 ring-fg ring-offset-2 ring-offset-panel' : ''}`}
                    >
                      {selected && <Check className="h-4 w-4" />}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-line px-6 py-4">
            <button onClick={onCancel} className={btnSecondary}>
              Cancel
            </button>
            <button onClick={handleSave} className={btnPrimary}>
              Save
            </button>
          </div>
        </div>
      </div>

      {networkConfirm && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in"
          onClick={() => setNetworkConfirm(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Expose server to the network"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md animate-scale-in overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl"
          >
            <div className="flex items-center gap-2 border-b border-line px-6 py-4">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <h3 className="text-base font-semibold text-fg">
                Expose this server to the network?
              </h3>
            </div>

            <div className="space-y-4 p-6">
              <p className="text-sm text-fg">
                The server will bind to <span className="font-mono">0.0.0.0</span> and accept dumps
                from any machine that can reach this computer. A shared token is required and acts
                as the only access control.
              </p>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-fg">Shared token</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tokenDraft}
                    autoFocus
                    onChange={(e) => setTokenDraft(e.target.value)}
                    placeholder="Required for network access"
                    className={`${fieldClass(false)} font-mono`}
                  />
                  <button
                    type="button"
                    onClick={() => setTokenDraft(generateToken())}
                    className={`${btnSecondary} shrink-0`}
                  >
                    <RotateCcw className="h-4 w-4" />
                    Generate
                  </button>
                </div>
                <p className="mt-1.5 text-xs text-muted">
                  Applies to all servers. Clients send it as a Bearer token (HTTP) or a{' '}
                  <span className="font-mono">token</span> field (TCP).
                </p>
              </div>

              <div className="rounded-lg border border-line bg-sunken p-3">
                <p className="text-xs text-muted">
                  Dumps travel in cleartext over the LAN — the token is sniffable. For a properly
                  secured channel, keep this server on{' '}
                  <span className="font-medium text-fg">This computer</span> and forward it instead:
                </p>
                <pre className="mt-2 overflow-x-auto rounded bg-panel px-2 py-1.5 text-xs text-fg">
                  ssh -L {editedServer.port}:localhost:{editedServer.port} user@this-machine
                </pre>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-line px-6 py-4">
              <button onClick={() => setNetworkConfirm(false)} className={btnSecondary}>
                Cancel
              </button>
              <button
                onClick={confirmNetwork}
                disabled={!tokenDraft.trim()}
                className={`${btnPrimary} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                Expose to network
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
