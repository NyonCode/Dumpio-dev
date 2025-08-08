import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
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
    app.whenReady().then(async () => {
      electronApp.setAppUserModelId('com.tcpdumpviewer')

      app.on('browser-window-created', (_, window) => {
        optimizer.watchWindowShortcuts(window)
      })

      this.createWindow()
      await this.initializeApplication()

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) this.createWindow()
      })
    })

    app.on('window-all-closed', async () => {
      await this.cleanup()
      if (process.platform !== 'darwin') app.quit()
    })

    app.on('before-quit', async () => {
      await this.handleBeforeQuit()
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
      icon: is.dev ? icon : join(__dirname, '../../build/icon.png'),
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        contextIsolation: true,
        enableRemoteModule: false
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
      this.mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
      this.mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }
  }

  private async initializeApplication() {
    console.log('🚀 Initializing TCP Dump Viewer application...')

    // Load settings first
    const settings = await this.settingsManager.getSettings()
    console.log('📋 Settings loaded:', {
      serverCount: settings.servers.length,
      maxDumpsInMemory: settings.maxDumpsInMemory
    })

    // Load dumps if setting is enabled
    if (settings.saveDumpsOnExit) {
      try {
        await this.dumpManager.loadDumps()
        console.log('Dumps loaded from previous session')
      } catch (error) {
        console.error('Failed to load dumps:', error)
      }
    }

    // Set max dumps from settings
    this.dumpManager.setMaxDumps(settings.maxDumpsInMemory)

    // Initialize servers
    console.log('🌐 Initializing TCP servers...')
    await this.initializeServers()

    console.log('✅ Application initialization complete')
  }

  private async initializeServers() {
    const settings = await this.settingsManager.getSettings()

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
      console.log('Created default server: localhost:21234')
    }

    console.log(`Found ${settings.servers.length} configured servers`)

    // Start all active servers
    for (const server of settings.servers) {
      if (server.active) {
        console.log(`Attempting to start server: ${server.name} (${server.host}:${server.port})`)
        try {
          await this.startServer(server)
        } catch (error) {
          console.error(`Failed to start server ${server.name} during initialization:`, error)
          // Continue with other servers even if one fails
        }
      } else {
        console.log(`Skipping inactive server: ${server.name}`)
      }
    }

    // Log final status
    console.log(`Active TCP servers: ${this.tcpServers.size}`)
    for (const [serverId, tcpServer] of this.tcpServers) {
      const status = tcpServer.getStatus()
      console.log(`  - ${serverId}: ${status.host}:${status.port} (running: ${status.isRunning})`)
    }
  }

  private async startServer(server: Server) {
    try {
      // Check if server with same ID is already running
      if (this.tcpServers.has(server.id)) {
        console.log(`Server ${server.name} is already running, stopping first...`)
        await this.stopServer(server.id)
      }

      // Check if port is already in use by another server
      const portInUse = Array.from(this.tcpServers.values()).find(tcpServer => {
        const status = tcpServer.getStatus()
        return status.host === server.host && status.port === server.port && status.isRunning
      })

      if (portInUse) {
        throw new Error(`Port ${server.port} is already in use by another server on ${server.host}`)
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
        // Remove failed server from map
        this.tcpServers.delete(server.id)
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
      // Make sure server is not in the map if it failed to start
      this.tcpServers.delete(server.id)
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
      try {
        await tcpServer.stop()
        this.tcpServers.delete(serverId)
        console.log(`Server ${serverId} stopped successfully`)
        this.mainWindow?.webContents.send('server-stopped', serverId)
      } catch (error) {
        console.error(`Error stopping server ${serverId}:`, error)
        // Still remove from map even if stop failed
        this.tcpServers.delete(serverId)
        this.mainWindow?.webContents.send('server-error', {
          serverId,
          error: `Failed to stop server: ${error.message}`
        })
      }
    }
  }

  private setupIPCHandlers() {
    // Settings handlers
    ipcMain.handle('get-settings', () => this.settingsManager.getSettings())
    ipcMain.handle('save-settings', (_, settings) => this.settingsManager.saveSettings(settings))

    // Server management
    ipcMain.handle('start-server', async (_, server: Server) => {
      console.log(`IPC: Starting server ${server.name}`)
      await this.startServer(server)
    })

    ipcMain.handle('stop-server', async (_, serverId: string) => {
      console.log(`IPC: Stopping server ${serverId}`)
      await this.stopServer(serverId)
    })

    ipcMain.handle('restart-server', async (_, server: Server) => {
      console.log(`IPC: Restarting server ${server.name}`)
      await this.stopServer(server.id)
      await this.startServer(server)
    })

    ipcMain.handle('get-server-status', () => {
      const serverStatus = new Map()
      for (const [serverId, tcpServer] of this.tcpServers) {
        serverStatus.set(serverId, tcpServer.getStatus())
      }
      return Object.fromEntries(serverStatus)
    })

    // Enhanced settings handler that manages server lifecycle
    ipcMain.handle('save-settings-and-sync-servers', async (_, settings) => {
      const currentSettings = await this.settingsManager.getSettings()
      await this.settingsManager.saveSettings(settings)

      // Update max dumps if changed
      if (currentSettings.maxDumpsInMemory !== settings.maxDumpsInMemory) {
        this.dumpManager.setMaxDumps(settings.maxDumpsInMemory)
      }

      // Sync server states based on new settings
      await this.syncServersWithSettings(currentSettings.servers, settings.servers)
    })

    // Dump management
    ipcMain.handle('get-dumps', () => this.dumpManager.getDumps())
    ipcMain.handle('clear-dumps', async () => {
      this.dumpManager.clearDumps()

      // Also clear from disk if dumps are being saved
      try {
        const settings = await this.settingsManager.getSettings()
        if (settings.saveDumpsOnExit) {
          await this.dumpManager.clearDumpsFromDisk()
        }
      } catch (error) {
        console.error('Failed to clear dumps from disk:', error)
        // Continue anyway - we cleared memory dumps successfully
      }

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
  }

  private async handleBeforeQuit() {
    try {
      const settings = await this.settingsManager.getSettings()

      if (settings.saveDumpsOnExit) {
        console.log('Saving dumps before quit...')
        await this.dumpManager.saveDumps()
      }
    } catch (error) {
      console.error('Failed to save dumps on quit:', error)
    }
  }

  private async cleanup() {
    console.log('Cleaning up TCP servers...')

    // Stop all TCP servers gracefully
    const stopPromises = Array.from(this.tcpServers.entries()).map(async ([serverId, tcpServer]) => {
      try {
        console.log(`Stopping server ${serverId}...`)
        await tcpServer.stop()
      } catch (error) {
        console.error(`Error stopping server ${serverId}:`, error)
      }
    })

    // Wait for all servers to stop, but don't wait forever
    try {
      await Promise.race([
        Promise.all(stopPromises),
        new Promise(resolve => setTimeout(resolve, 5000)) // 5 second timeout
      ])
    } catch (error) {
      console.error('Error during cleanup:', error)
    }

    this.tcpServers.clear()
    console.log('Cleanup completed')
  }

  private async syncServersWithSettings(oldServers: Server[], newServers: Server[]) {
    // Create maps for easier comparison
    const oldServersMap = new Map(oldServers.map(s => [s.id, s]))
    const newServersMap = new Map(newServers.map(s => [s.id, s]))

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
          // Add a small delay to ensure port is released
          await new Promise(resolve => setTimeout(resolve, 100))
          try {
            await this.startServer(newServer)
          } catch (error) {
            console.error(`Failed to restart server ${newServer.name}:`, error)
          }
        }
      }
    }

    // Start new servers or servers that became active
    for (const [serverId, newServer] of newServersMap) {
      if (newServer.active && !this.tcpServers.has(serverId)) {
        console.log(`Starting new/activated server: ${newServer.name}`)
        try {
          await this.startServer(newServer)
        } catch (error) {
          console.error(`Failed to start server ${newServer.name}:`, error)
        }
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
