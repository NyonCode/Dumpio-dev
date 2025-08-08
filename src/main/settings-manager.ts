import { app } from 'electron'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

export interface Server {
  id: string
  name: string
  host: string
  port: number
  color: string
  active: boolean
}

export interface Settings {
  servers: Server[]
  theme: 'light' | 'dark' | 'system'
  saveDumpsOnExit: boolean
  autoSaveDumps: boolean  // OPRAVA: Přidáno chybějící pole
  maxDumpsInMemory: number
  autoStartServers: boolean
  ideIntegration: {
    enabled: boolean
    defaultIde: 'vscode' | 'jetbrains' | 'custom'
    customCommand?: string
  }
  filters: {
    showServerColors: boolean
    defaultFlagFilter: string[]
  }
}

export class SettingsManager {
  private settingsPath: string
  private defaultSettings: Settings

  constructor() {
    this.settingsPath = join(app.getPath('userData'), 'settings.json')
    this.defaultSettings = {
      servers: [],
      theme: 'system',
      saveDumpsOnExit: false,
      autoSaveDumps: false,  // OPRAVA: Přidáno výchozí hodnota
      maxDumpsInMemory: 1000,
      autoStartServers: true,
      ideIntegration: {
        enabled: false,
        defaultIde: 'vscode'
      },
      filters: {
        showServerColors: true,
        defaultFlagFilter: []
      }
    }
  }

  async getSettings(): Promise<Settings> {
    try {
      const data = await readFile(this.settingsPath, 'utf8')
      const settings = JSON.parse(data)

      // Merge with default settings to ensure all properties exist
      return { ...this.defaultSettings, ...settings }
    } catch (error) {
      // If file doesn't exist or is invalid, return default settings
      return { ...this.defaultSettings }
    }
  }

  async saveSettings(settings: Settings): Promise<void> {
    try {
      // Ensure userData directory exists
      await mkdir(app.getPath('userData'), { recursive: true })

      await writeFile(this.settingsPath, JSON.stringify(settings, null, 2), 'utf8')
    } catch (error) {
      console.error('Failed to save settings:', error)
      throw error
    }
  }

  async getTheme(): Promise<string> {
    const settings = await this.getSettings()
    return settings.theme
  }

  async setTheme(theme: 'light' | 'dark' | 'system'): Promise<void> {
    const settings = await this.getSettings()
    settings.theme = theme
    await this.saveSettings(settings)
  }

  async addServer(server: Omit<Server, 'id'>): Promise<Server> {
    const settings = await this.getSettings()
    const newServer: Server = {
      ...server,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
    }

    settings.servers.push(newServer)
    await this.saveSettings(settings)

    return newServer
  }

  async updateServer(serverId: string, updates: Partial<Server>): Promise<void> {
    const settings = await this.getSettings()
    const serverIndex = settings.servers.findIndex(s => s.id === serverId)

    if (serverIndex >= 0) {
      settings.servers[serverIndex] = { ...settings.servers[serverIndex], ...updates }
      await this.saveSettings(settings)
    }
  }

  async removeServer(serverId: string): Promise<void> {
    const settings = await this.getSettings()
    settings.servers = settings.servers.filter(s => s.id !== serverId)
    await this.saveSettings(settings)
  }
}
