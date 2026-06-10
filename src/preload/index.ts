import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

export type IpcRenderer = typeof ipcRenderer

type Unsubscribe = () => void

// Custom APIs for renderer
const api = {
  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: unknown) => ipcRenderer.invoke('save-settings', settings),
  saveSettingsAndSyncServers: (settings: unknown) =>
    ipcRenderer.invoke('save-settings-and-sync-servers', settings),
  getTheme: () => ipcRenderer.invoke('get-theme'),
  setTheme: (theme: string) => ipcRenderer.invoke('set-theme', theme),
  setAlwaysOnTop: (flag: boolean) => ipcRenderer.invoke('set-always-on-top', flag),
  getAlwaysOnTop: () => ipcRenderer.invoke('get-always-on-top'),
  openPath: () => ipcRenderer.invoke('open-path'),
  exportSettings: () => ipcRenderer.invoke('export-settings'),
  importSettings: () => ipcRenderer.invoke('import-settings'),

  // Server management
  startServer: (server: unknown) => ipcRenderer.invoke('start-server', server),
  stopServer: (serverId: string) => ipcRenderer.invoke('stop-server', serverId),
  restartServer: (server: unknown) => ipcRenderer.invoke('restart-server', server),
  getServerStatus: () => ipcRenderer.invoke('get-server-status'),
  sendTestDump: (serverId: string) => ipcRenderer.invoke('send-test-dump', serverId),

  // Dump management
  getDumps: () => ipcRenderer.invoke('get-dumps'),
  clearDumps: () => ipcRenderer.invoke('clear-dumps'),
  exportDumps: () => ipcRenderer.invoke('export-dumps'),

  forceSaveDumps: () => ipcRenderer.invoke('force-save-dumps'),
  getDumpStats: () => ipcRenderer.invoke('get-dump-stats'),

  // External links (validated in main: http/https only)
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),

  // Open a file:line in the user's editor (validated in main: editor schemes only)
  openInEditor: (url: string) => ipcRenderer.invoke('open-in-editor', url),

  // Event listeners
  onDumpReceived: (callback: (dump: unknown) => void): Unsubscribe => {
    const handler = (_: IpcRendererEvent, dump: unknown): void => callback(dump)
    ipcRenderer.on('dump-received', handler)
    return () => ipcRenderer.removeListener('dump-received', handler)
  },

  onServerStarted: (callback: (serverId: string) => void): Unsubscribe => {
    const handler = (_: IpcRendererEvent, serverId: string): void => callback(serverId)
    ipcRenderer.on('server-started', handler)
    return () => ipcRenderer.removeListener('server-started', handler)
  },

  onServerStopped: (callback: (serverId: string) => void): Unsubscribe => {
    const handler = (_: IpcRendererEvent, serverId: string): void => callback(serverId)
    ipcRenderer.on('server-stopped', handler)
    return () => ipcRenderer.removeListener('server-stopped', handler)
  },

  onServerError: (callback: (error: unknown) => void): Unsubscribe => {
    const handler = (_: IpcRendererEvent, error: unknown): void => callback(error)
    ipcRenderer.on('server-error', handler)
    return () => ipcRenderer.removeListener('server-error', handler)
  },

  onDumpsCleared: (callback: () => void): Unsubscribe => {
    const handler = (): void => callback()
    ipcRenderer.on('dumps-cleared', handler)
    return () => ipcRenderer.removeListener('dumps-cleared', handler)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
