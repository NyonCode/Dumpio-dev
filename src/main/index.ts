import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { connect } from 'net'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { SettingsManager, type Server, type Settings } from './settings-manager'
import { DumpManager } from './dump-manager'
import { IngestManager } from './ingest/ingest-manager'
import { DEFAULT_LIMITS } from './ingest/normalize'
import type { IngestServerConfig, NormalizeLimits, SecurityOptions } from './ingest/types'
import { logger } from './logger'

class MainApplication {
  private mainWindow: BrowserWindow | null = null
  private readonly settingsManager: SettingsManager
  private readonly dumpManager: DumpManager
  private readonly ingestManager: IngestManager
  private autoSaveInterval: NodeJS.Timeout | null = null

  constructor() {
    this.settingsManager = new SettingsManager()
    this.dumpManager = new DumpManager()
    this.ingestManager = new IngestManager(
      {
        onDump: (dump) => {
          this.dumpManager.addDump(dump)
          this.mainWindow?.webContents.send('dump-received', dump)
        },
        onError: (serverId, error) => {
          this.mainWindow?.webContents.send('server-error', { serverId, error })
        },
        onStarted: (serverId) => {
          this.mainWindow?.webContents.send('server-started', serverId)
        },
        onStopped: (serverId) => {
          this.mainWindow?.webContents.send('server-stopped', serverId)
        }
      },
      () => this.getSecurityOptions(),
      (): NormalizeLimits => DEFAULT_LIMITS,
      app.getVersion()
    )
    this.setupEventHandlers()
  }

  /** Build the live security policy from persisted settings. */
  private async getSecurityOptionsAsync(): Promise<SecurityOptions> {
    const { security } = await this.settingsManager.getSettings()
    return {
      token: security.token,
      maxPayloadBytes: Math.max(1, security.maxPayloadKb) * 1024,
      rateLimitPerSec: security.rateLimitPerSec
    }
  }

  /** Synchronous snapshot of the security policy (refreshed on settings save). */
  private securityCache: SecurityOptions = {
    token: '',
    maxPayloadBytes: 1024 * 1024,
    rateLimitPerSec: 1000
  }

  private getSecurityOptions(): SecurityOptions {
    return this.securityCache
  }

  private async refreshSecurityCache(): Promise<void> {
    this.securityCache = await this.getSecurityOptionsAsync()
  }

  private toIngestConfig(server: Server): IngestServerConfig {
    return {
      id: server.id,
      name: server.name,
      host: server.host,
      port: server.port,
      protocol: server.protocol
    }
  }

  private activeConfigs(servers: Server[]): IngestServerConfig[] {
    return servers.filter((s) => s.active).map((s) => this.toIngestConfig(s))
  }

  private setupEventHandlers(): void {
    app.whenReady().then(async () => {
      electronApp.setAppUserModelId('cz.nyoncode.dumpio')

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
        contextIsolation: true
      }
    })

    this.mainWindow.on('ready-to-show', () => {
      this.mainWindow?.show()
    })

    // Only ever hand http(s) links to the OS browser; deny everything else.
    this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (this.isSafeExternalUrl(url)) shell.openExternal(url)
      return { action: 'deny' }
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      this.mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
      this.mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }
  }

  private isSafeExternalUrl(url: string): boolean {
    try {
      const { protocol } = new URL(url)
      return protocol === 'http:' || protocol === 'https:'
    } catch {
      return false
    }
  }

  /** Known editor "open file" URL schemes, used to gate `open-in-editor`. */
  private isEditorUrl(url: string): boolean {
    const allowed = new Set([
      'vscode:',
      'vscode-insiders:',
      'cursor:',
      'phpstorm:',
      'webstorm:',
      'idea:',
      'subl:',
      'txmt:',
      'zed:'
    ])
    try {
      return allowed.has(new URL(url).protocol)
    } catch {
      return false
    }
  }

  private async initializeApplication(): Promise<void> {
    logger.info('🚀 Initializing Dumpio...')

    const settings = await this.settingsManager.getSettings()
    await this.refreshSecurityCache()

    if (settings.saveDumpsOnExit || settings.autoSaveDumps) {
      try {
        await this.dumpManager.loadDumps()
      } catch (error) {
        logger.error('Failed to load dumps:', error)
      }
    }

    this.dumpManager.setMaxDumps(settings.maxDumpsInMemory)
    this.setupAutoSave(settings.autoSaveDumps)
    await this.initializeServers()

    logger.info('✅ Application initialization complete')
  }

  private setupAutoSave(enabled: boolean): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval)
      this.autoSaveInterval = null
    }
    if (enabled) {
      this.autoSaveInterval = setInterval(async () => {
        try {
          await this.dumpManager.saveDumps()
        } catch (error) {
          logger.error('Auto-save failed:', error)
        }
      }, 5000)
    }
  }

  private async initializeServers(): Promise<void> {
    const settings = await this.settingsManager.getSettings()

    // First run: create a default HTTP server (HTTP-first).
    if (settings.servers.length === 0) {
      const defaultServer: Server = {
        id: 'default',
        name: 'Default Server',
        host: 'localhost',
        port: 21234,
        color: 'blue',
        active: true,
        protocol: 'http'
      }
      settings.servers.push(defaultServer)
      await this.settingsManager.saveSettings(settings)
      logger.info('Created default HTTP server: http://localhost:21234')
    }

    for (const cfg of this.activeConfigs(settings.servers)) {
      try {
        await this.ingestManager.startServer(cfg)
      } catch (error) {
        logger.error(`Failed to start "${cfg.name}" during init:`, error)
      }
    }
  }

  private setupIPCHandlers(): void {
    // Settings
    ipcMain.handle('get-settings', () => this.settingsManager.getSettings())
    ipcMain.handle('save-settings', (_, settings: Settings) =>
      this.settingsManager.saveSettings(settings)
    )

    // Server management
    ipcMain.handle('start-server', async (_, server: Server) => {
      await this.ingestManager.startServer(this.toIngestConfig(server))
    })
    ipcMain.handle('stop-server', async (_, serverId: string) => {
      await this.ingestManager.stopServer(serverId)
    })
    ipcMain.handle('restart-server', async (_, server: Server) => {
      await this.ingestManager.stopServer(server.id)
      await this.ingestManager.startServer(this.toIngestConfig(server))
    })
    ipcMain.handle('get-server-status', () => this.ingestManager.getStatuses())

    // Save settings + reconcile transports
    ipcMain.handle('save-settings-and-sync-servers', async (_, settings: Settings) => {
      const current = await this.settingsManager.getSettings()
      await this.settingsManager.saveSettings(settings)
      await this.refreshSecurityCache()

      if (current.maxDumpsInMemory !== settings.maxDumpsInMemory) {
        this.dumpManager.setMaxDumps(settings.maxDumpsInMemory)
      }
      if (current.autoSaveDumps !== settings.autoSaveDumps) {
        this.setupAutoSave(settings.autoSaveDumps)
      }
      await this.ingestManager.sync(
        this.activeConfigs(current.servers),
        this.activeConfigs(settings.servers)
      )
    })

    // Dumps
    ipcMain.handle('get-dumps', () => this.dumpManager.getDumps())
    ipcMain.handle('clear-dumps', async () => {
      this.dumpManager.clearDumps()
      try {
        const settings = await this.settingsManager.getSettings()
        if (settings.saveDumpsOnExit || settings.autoSaveDumps) {
          await this.dumpManager.clearDumpsFromDisk()
        }
      } catch (error) {
        logger.error('Failed to clear dumps from disk:', error)
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
    ipcMain.handle('force-save-dumps', async () => {
      try {
        await this.dumpManager.saveDumps()
        return true
      } catch (error) {
        logger.error('Force save failed:', error)
        return false
      }
    })
    ipcMain.handle('get-dump-stats', () => this.dumpManager.getStats())

    // Open external links safely (http/https only).
    ipcMain.handle('open-external', async (_, url: string) => {
      if (this.isSafeExternalUrl(url)) {
        await shell.openExternal(url)
        return true
      }
      logger.warn(`Blocked attempt to open non-http(s) URL: ${url}`)
      return false
    })

    // Open a file:line in the user's editor via its custom URL scheme. Restricted
    // to a known allowlist of editor protocols so the renderer can't smuggle
    // arbitrary scheme handlers through this channel.
    ipcMain.handle('open-in-editor', async (_, url: string) => {
      if (this.isEditorUrl(url)) {
        await shell.openExternal(url)
        return true
      }
      logger.warn(`Blocked attempt to open non-editor URL: ${url}`)
      return false
    })

    // Always-on-top (pin window above other windows)
    ipcMain.handle('set-always-on-top', (_, flag: boolean) => {
      this.mainWindow?.setAlwaysOnTop(!!flag)
      return this.mainWindow?.isAlwaysOnTop() ?? false
    })
    ipcMain.handle('get-always-on-top', () => this.mainWindow?.isAlwaysOnTop() ?? false)

    // Theme
    ipcMain.handle('get-theme', () => this.settingsManager.getTheme())
    ipcMain.handle('set-theme', (_, theme: 'light' | 'dark' | 'system') =>
      this.settingsManager.setTheme(theme)
    )

    // Data folder
    ipcMain.handle('open-path', async () => {
      const err = await shell.openPath(app.getPath('userData'))
      if (err) logger.warn(`Failed to open data folder: ${err}`)
      return err === ''
    })

    // Settings export / import
    ipcMain.handle('export-settings', async () => {
      const result = await dialog.showSaveDialog(this.mainWindow!, {
        defaultPath: `dumpio-settings-${new Date().toISOString().split('T')[0]}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }]
      })
      if (result.canceled || !result.filePath) return false
      const settings = await this.settingsManager.getSettings()
      await writeFile(result.filePath, JSON.stringify(settings, null, 2), 'utf8')
      return true
    })
    ipcMain.handle('import-settings', async () => {
      const result = await dialog.showOpenDialog(this.mainWindow!, {
        properties: ['openFile'],
        filters: [{ name: 'JSON', extensions: ['json'] }]
      })
      if (result.canceled || result.filePaths.length === 0) return null
      let imported: Partial<Settings>
      try {
        imported = JSON.parse(await readFile(result.filePaths[0], 'utf8'))
      } catch {
        throw new Error('Selected file is not valid JSON')
      }
      if (typeof imported !== 'object' || imported === null || !Array.isArray(imported.servers)) {
        throw new Error('File does not look like a Dumpio settings export')
      }
      const current = await this.settingsManager.getSettings()
      await this.settingsManager.saveSettings(imported as Settings)
      const merged = await this.settingsManager.getSettings()
      await this.refreshSecurityCache()
      this.dumpManager.setMaxDumps(merged.maxDumpsInMemory)
      this.setupAutoSave(merged.autoSaveDumps)
      await this.ingestManager.sync(
        this.activeConfigs(current.servers),
        this.activeConfigs(merged.servers)
      )
      return merged
    })

    // Send a sample dump to a configured server (Settings → "Send test dump")
    ipcMain.handle('send-test-dump', async (_, serverId: string) => {
      const settings = await this.settingsManager.getSettings()
      const server = settings.servers.find((s) => s.id === serverId)
      if (!server) throw new Error('Server not found')
      return this.sendTestDump(server, settings.security.token)
    })
  }

  /** Connect to a configured server as a client and deliver one sample dump. */
  private async sendTestDump(server: Server, token: string): Promise<boolean> {
    const payload: Record<string, unknown> = {
      type: 'log',
      level: 'info',
      message: 'Dumpio test dump',
      flag: 'green',
      channel: 'test',
      context: { source: 'Settings → Send test dump', at: new Date().toISOString() }
    }

    // The dump targets our own server; 0.0.0.0 isn't a connectable address, so
    // reach a network-exposed server over loopback for the self-test.
    const targetHost = server.host === '0.0.0.0' ? '127.0.0.1' : server.host

    if (server.protocol === 'http') {
      const res = await fetch(`http://${targetHost}:${server.port}/dumps`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      })
      if (!res.ok) throw new Error(`Server responded with ${res.status}`)
      return true
    }

    if (token) payload.token = token
    await new Promise<void>((resolve, reject) => {
      const socket = connect(server.port, targetHost, () => {
        socket.write(JSON.stringify(payload))
        socket.end()
      })
      socket.setTimeout(3000)
      socket.on('timeout', () => socket.destroy(new Error('Connection timed out')))
      socket.on('error', reject)
      socket.on('close', () => resolve())
    })
    return true
  }

  private async handleBeforeQuit(): Promise<void> {
    try {
      const settings = await this.settingsManager.getSettings()
      if (settings.saveDumpsOnExit) {
        await this.dumpManager.saveDumps()
      }
    } catch (error) {
      logger.error('Failed to save dumps on quit:', error)
    }
  }

  private async cleanup(): Promise<void> {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval)
      this.autoSaveInterval = null
    }
    await Promise.race([
      this.ingestManager.stopAll(),
      new Promise((resolve) => setTimeout(resolve, 5000))
    ])
  }
}

// Initialize the application
new MainApplication()
