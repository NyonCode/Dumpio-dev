import type { ElectronAPI } from '@electron-toolkit/preload'
import type { Settings, Dump } from '../App'

export interface ServerError {
  serverId: string
  error: string
}

export interface ServerStatus {
  isRunning: boolean
  host: string
  port: number
  protocol: 'http' | 'tcp'
  activeConnections: number
}

export interface DumpioApi {
  // Settings
  getSettings: () => Promise<Settings>
  saveSettings: (settings: Settings) => Promise<void>
  saveSettingsAndSyncServers: (settings: Settings) => Promise<void>
  getTheme: () => Promise<string>
  setTheme: (theme: string) => Promise<void>
  setAlwaysOnTop: (flag: boolean) => Promise<boolean>
  getAlwaysOnTop: () => Promise<boolean>
  openPath: () => Promise<boolean>
  exportSettings: () => Promise<boolean>
  importSettings: () => Promise<Settings | null>

  // Server management
  startServer: (server: unknown) => Promise<void>
  stopServer: (serverId: string) => Promise<void>
  restartServer: (server: unknown) => Promise<void>
  getServerStatus: () => Promise<Record<string, ServerStatus>>
  sendTestDump: (serverId: string) => Promise<boolean>

  // Dump management
  getDumps: () => Promise<Dump[]>
  clearDumps: () => Promise<void>
  exportDumps: () => Promise<boolean>
  forceSaveDumps: () => Promise<boolean>
  getDumpStats: () => Promise<unknown>

  // External links (validated in main: http/https only)
  openExternal: (url: string) => Promise<boolean>

  // Open a file:line in the user's editor (validated in main: editor schemes only)
  openInEditor: (url: string) => Promise<boolean>

  // Event listeners
  onDumpReceived: (callback: (dump: Dump) => void) => () => void
  onServerStarted: (callback: (serverId: string) => void) => () => void
  onServerStopped: (callback: (serverId: string) => void) => () => void
  onServerError: (callback: (error: ServerError) => void) => () => void
  onDumpsCleared: (callback: () => void) => () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: DumpioApi
  }
}
