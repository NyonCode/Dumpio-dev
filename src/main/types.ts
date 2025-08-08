export interface ServerConfig {
  id: string
  name: string
  host: string
  port: number
  color: string
  enabled: boolean
  description?: string
}

export interface DumpEntry {
  id: string
  timestamp: string
  serverId: string
  serverName: string
  serverColor: string
  clientId: string
  type: string
  channel: string
  origin: string
  colorFlag: ColorFlag | null
  payload: unknown
  raw: string
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system'
  persistDumps: boolean
  autoStartServers: boolean
  maxDumps: number
  notifications: boolean
  compactMode: boolean
  sidebarWidth: number
  preferredIDE: string
}

export interface DumpFilter {
  serverIds?: string[]
  colorFlags?: (ColorFlag | null)[]
  types?: string[]
  dateFrom?: string
  dateTo?: string
  search?: string
}

export interface IDEInfo {
  name: string
  command?: string
  path?: string
  type: 'vscode' | 'jetbrains' | 'sublime' | 'vim' | 'other'
  available: boolean
}

export type ColorFlag = 'red' | 'yellow' | 'blue' | 'gray' | 'purple' | 'pink' | 'green'

export type ServerStatus = 'running' | 'stopped' | 'error' | 'starting'

export interface ElectronAPI {
  // Settings
  getSettings: () => Promise<AppSettings>
  updateSettings: (settings: Partial<AppSettings>) => Promise<AppSettings>

  // Servers
  getServers: () => Promise<ServerConfig[]>
  addServer: (server: Omit<ServerConfig, 'id'>) => Promise<ServerConfig>
  updateServer: (serverId: string, updates: Partial<ServerConfig>) => Promise<ServerConfig | null>
  deleteServer: (serverId: string) => Promise<boolean>

  // Dumps
  getDumps: () => Promise<DumpEntry[]>
  clearDumps: () => Promise<boolean>
  filterDumps: (filter: DumpFilter) => Promise<DumpEntry[]>

  // Theme
  getTheme: () => Promise<'light' | 'dark'>
  setTheme: (theme: 'light' | 'dark' | 'system') => Promise<'light' | 'dark'>

  // IDE Integration
  openInIDE: (filePath: string, lineNumber?: number) => Promise<boolean>
  detectIDEs: () => Promise<IDEInfo[]>

  // Events
  onDumpReceived: (callback: (dump: DumpEntry) => void) => () => void
  onDumpsCleared: (callback: () => void) => () => void
  onDumpsLoaded: (callback: (dumps: DumpEntry[]) => void) => () => void
  onServerStatusChanged: (callback: (serverId: string, status: ServerStatus) => void) => () => void
  onThemeChanged: (callback: (theme: 'light' | 'dark') => void) => () => void
}
