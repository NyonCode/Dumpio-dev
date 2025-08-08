import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { TCPServer } from './tcp-server'
import { SettingsManager } from './settings-manager'
import { DumpManager } from './dump-manager'

interface Server {
  id: string
  name: string
  host: string
  port: number
  color: string
  active: boolean
}

interface Dump {
  id: string
  serverId: string
  timestamp: number
  origin: string
  payload: any
  flag?: 'yellow' | 'red' | 'blue' | 'gray' | 'purple' | 'pink' | 'green'
  channel?: string
}

class MainApplication {
  private mainWindow: BrowserWindow | null = null
  private tcpServers: Map<string, TCPServer> = new Map()
  private settingsManager: SettingsManager
  private dumpManager: DumpManager

  constructor() {
    this.settingsManager = new SettingsManager()
    this.dumpManager = new DumpManager()
    this.setupEventHandlers()
  }

  private setupEventHandlers() {
    app.whenReady().then(() => {
      electronApp.setAppUserModelId('com.tcpdumpviewer')

      app.on('browser-window-created', (_, window) => {
        optimizer.watchWindowShortcuts(window)
      })

      this.createWindow()
      this.initializeServers()

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) this.createWindow()
      })
    })

    app.on('window-all-closed', () => {
      this.cleanup()
      if (process.platform !== 'darwin') app.quit()
    })

    this.setupIPCHandlers()
  }

  private createWindow(): void {
    this.mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1000,
      minHeight: 600,
      show: false,
      autoHideMenuBar: true,
      ...(process.platform === 'linux'
        ? { icon: join(__dirname, '../../resources/icon.png') }
        : {}),
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        contextIsolation: true
      }
    })

    this.mainWindow.on('ready-to-show', () => {
      this.mainWindow?.show()
    })

    this.mainWindow.webContents.setWindowOpenHandler((details) => {
      shell.openExternal(details.url)
      return { action: 'deny' }
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      // DEV mód — načte z Vite serveru
      this.mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
      // BUILD mód — načte z dist-electron/renderer
      this.mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }
  }

  private async initializeServers() {
    const settings = await this.settingsManager.getSettings()

    this.dumpManager.setAutoSave(settings.autoSaveDumps)
    this.dumpManager.setMaxDumps(settings.maxDumpsInMemory)

    // Add default server if none exist
    if (settings.servers.length === 0) {
      const defaultServer: Server = {
        id: 'default',
        name: 'Default Server',
        host: 'localhost',
        port: 21234,
        color: 'blue',
        active: true
      }
      settings.servers.push(defaultServer)
      await this.settingsManager.saveSettings(settings)
    }

    // Start all active servers
    for (const server of settings.servers) {
      if (server.active) {
        await this.startServer(server)
      }
    }
  }

  private async startServer(server: Server) {
    try {
      const existingServer = Array.from(this.tcpServers.values()).find((tcpServer) => {
        const status = tcpServer.getStatus()
        return status.host === server.host && status.port === server.port
      })

      if (existingServer) {
        throw new Error(`Server already running on ${server.host}:${server.port}`)
      }

      const tcpServer = new TCPServer(server.host, server.port)

      tcpServer.on('dump', (data) => {
        const dump: Dump = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          serverId: server.id,
          timestamp: Date.now(),
          origin: data.origin || 'unknown',
          payload: data,
          flag: data.flag || 'gray',
          channel: data.channel || 'default'
        }

        this.dumpManager.addDump(dump)
        this.mainWindow?.webContents.send('dump-received', dump)
      })

      tcpServer.on('error', (error) => {
        console.error(`Server ${server.name} error:`, error)
        this.mainWindow?.webContents.send('server-error', {
          serverId: server.id,
          error: error.message
        })
      })

      await tcpServer.start()
      this.tcpServers.set(server.id, tcpServer)

      console.log(`TCP Server "${server.name}" started on ${server.host}:${server.port}`)
      this.mainWindow?.webContents.send('server-started', server)
    } catch (error) {
      console.error(`Failed to start server ${server.name}:`, error)
      this.mainWindow?.webContents.send('server-error', {
        serverId: server.id,
        error: (error as Error).message
      })
      throw error
    }
  }

  private async stopServer(serverId: string) {
    const tcpServer = this.tcpServers.get(serverId)
    if (tcpServer) {
      await tcpServer.stop()
      this.tcpServers.delete(serverId)
      this.mainWindow?.webContents.send('server-stopped', serverId)
    }
  }

  private setupIPCHandlers() {
    // Settings handlers
    ipcMain.handle('get-settings', () => this.settingsManager.getSettings())
    ipcMain.handle('save-settings', (_, settings) => this.settingsManager.saveSettings(settings))

    // Server management
    ipcMain.handle('start-server', async (_, server: Server) => {
      await this.startServer(server)
    })

    ipcMain.handle('stop-server', async (_, serverId: string) => {
      await this.stopServer(serverId)
    })

    ipcMain.handle('restart-server', async (_, server: Server) => {
      await this.stopServer(server.id)
      await this.startServer(server)
    })

    // Enhanced settings handler that manages server lifecycle
    ipcMain.handle('save-settings-and-sync-servers', async (_, settings) => {
      const currentSettings = await this.settingsManager.getSettings()
      await this.settingsManager.saveSettings(settings)

      this.dumpManager.setAutoSave(settings.autoSaveDumps)
      this.dumpManager.setMaxDumps(settings.maxDumpsInMemory)

      // Sync server states based on new settings
      await this.syncServersWithSettings(currentSettings.servers, settings.servers)
    })

    // Dump management
    ipcMain.handle('get-dumps', () => this.dumpManager.getDumps())
    ipcMain.handle('clear-dumps', async () => {
      await this.dumpManager.clearDumps()
      this.mainWindow?.webContents.send('dumps-cleared')
    })

    ipcMain.handle('export-dumps', async () => {
      const result = await dialog.showSaveDialog(this.mainWindow!, {
        defaultPath: `dumps-${new Date().toISOString().split('T')[0]}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }]
      })

      if (!result.canceled && result.filePath) {
        return this.dumpManager.exportDumps(result.filePath)
      }
      return false
    })

    // IDE integration (planned)
    ipcMain.handle('open-in-ide', async (_, { file, line, ide }) => {
      // TODO: Implement IDE integration
      console.log(`Opening ${file}:${line} in ${ide}`)
    })

    // Theme management
    ipcMain.handle('get-theme', () => this.settingsManager.getTheme())
    ipcMain.handle('set-theme', (_, theme) => this.settingsManager.setTheme(theme))
    ipcMain.handle('get-dump-stats', () => this.dumpManager.getStats())
  }

  private cleanup() {
    // Stop all TCP servers
    for (const tcpServer of this.tcpServers.values()) {
      tcpServer.stop().catch(console.error)
    }
    this.tcpServers.clear()

    //Clean dump manager
    this.dumpManager.cleanup().catch(console.error)
  }

  private async syncServersWithSettings(oldServers: Server[], newServers: Server[]) {
    // Create maps for easier comparison
    const oldServersMap = new Map(oldServers.map((s) => [s.id, s]))
    const newServersMap = new Map(newServers.map((s) => [s.id, s]))

    // Stop servers that are no longer active or have been removed
    for (const [serverId, oldServer] of oldServersMap) {
      const newServer = newServersMap.get(serverId)

      if (!newServer || !newServer.active) {
        // Server was removed or deactivated
        if (this.tcpServers.has(serverId)) {
          console.log(`Stopping server: ${oldServer.name}`)
          await this.stopServer(serverId)
        }
      } else if (this.serverConfigChanged(oldServer, newServer)) {
        // Server configuration changed (host, port, etc.)
        if (this.tcpServers.has(serverId)) {
          console.log(`Restarting server due to config change: ${newServer.name}`)
          await this.stopServer(serverId)
          await this.startServer(newServer)
        }
      }
    }

    // Start new servers or servers that became active
    for (const [serverId, newServer] of newServersMap) {
      if (newServer.active && !this.tcpServers.has(serverId)) {
        console.log(`Starting new/activated server: ${newServer.name}`)
        await this.startServer(newServer)
      }
    }
  }

  private serverConfigChanged(oldServer: Server, newServer: Server): boolean {
    return (
      oldServer.host !== newServer.host ||
      oldServer.port !== newServer.port ||
      oldServer.name !== newServer.name
    )
  }
}

// Initialize the application
new MainApplication()
