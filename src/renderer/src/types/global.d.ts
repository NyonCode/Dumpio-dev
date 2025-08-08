export interface IElectronAPI {
  loadPreferences: () => Promise<void>
}

export interface APIInterface {
  // Settings
  getSettings: () => Promise<any>
  saveSettings: (settings: any) => Promise<void>
  saveSettingsAndSyncServers: (settings: any) => Promise<void> // PŘIDÁNO
  getTheme: () => Promise<string>
  setTheme: (theme: string) => Promise<void>

  // Server management
  startServer: (server: any) => Promise<void>
  stopServer: (serverId: string) => Promise<void>
  restartServer: (server: any) => Promise<void>

  // Dump management
  getDumps: () => Promise<any[]>
  clearDumps: () => Promise<void>
  exportDumps: () => Promise<boolean>
  forceSaveDumps: () => Promise<boolean>
  getDumpStats: () => Promise<any>

  // IDE integration
  openInIde: (params: any) => Promise<void>

  // Event listeners
  onDumpReceived: (callback: (dump: any) => void) => () => void
  onServerStarted: (callback: (server: any) => void) => () => void
  onServerStopped: (callback: (serverId: string) => void) => () => void
  onServerError: (callback: (error: any) => void) => () => void
  onDumpsCleared: (callback: () => void) => () => void
}

declare global {
  interface Window {
    electron: IElectronAPI
    api: APIInterface
  }
}

export {}
