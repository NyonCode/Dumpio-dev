import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

export type IpcRenderer = typeof ipcRenderer

// Custom APIs for renderer
const api = {
  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: any) => ipcRenderer.invoke('save-settings', settings),
  getTheme: () => ipcRenderer.invoke('get-theme'),
  setTheme: (theme: string) => ipcRenderer.invoke('set-theme', theme),

  // Server management
  startServer: (server: any) => ipcRenderer.invoke('start-server', server),
  stopServer: (serverId: string) => ipcRenderer.invoke('stop-server', serverId),
  restartServer: (server: any) => ipcRenderer.invoke('restart-server', server),

  // Dump management
  getDumps: () => ipcRenderer.invoke('get-dumps'),
  clearDumps: () => ipcRenderer.invoke('clear-dumps'),
  exportDumps: () => ipcRenderer.invoke('export-dumps'),

  // IDE integration
  openInIde: (params: any) => ipcRenderer.invoke('open-in-ide', params),

  // Event listeners
  onDumpReceived: (callback: (dump: any) => void) => {
    const handler = (_: any, dump: any) => callback(dump)
    ipcRenderer.on('dump-received', handler)
    return () => ipcRenderer.removeListener('dump-received', handler)
  },

  onServerStarted: (callback: (server: any) => void) => {
    const handler = (_: any, server: any) => callback(server)
    ipcRenderer.on('server-started', handler)
    return () => ipcRenderer.removeListener('server-started', handler)
  },

  onServerStopped: (callback: (serverId: string) => void) => {
    const handler = (_: any, serverId: string) => callback(serverId)
    ipcRenderer.on('server-stopped', handler)
    return () => ipcRenderer.removeListener('server-stopped', handler)
  },

  onServerError: (callback: (error: any) => void) => {
    const handler = (_: any, error: any) => callback(error)
    ipcRenderer.on('server-error', handler)
    return () => ipcRenderer.removeListener('server-error', handler)
  },

  onDumpsCleared: (callback: () => void) => {
    const handler = () => callback()
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
