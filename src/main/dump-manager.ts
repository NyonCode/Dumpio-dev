import { writeFile, readFile, mkdir, unlink } from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'

export interface Dump {
  id: string
  serverId: string
  timestamp: number
  origin: string
  payload: any
  flag?: 'yellow' | 'red' | 'blue' | 'gray' | 'purple' | 'pink' | 'green'
  channel?: string
}

export class DumpManager {
  private dumps: Map<string, Dump> = new Map()
  private maxDumps = 1000
  private autoSave = true
  private saveDirectory: string
  private dumpFilePath: string
  private pendingSaves: Dump[] = []
  private saveInterval: NodeJS.Timeout | null = null

  constructor() {
    this.saveDirectory = join(app.getPath('userData'))
    this.dumpFilePath = join(this.saveDirectory, 'dumps.json')
    this.initializeAutoSave()
  }

  private async initializeAutoSave() {
    // Ensure directory exists
    try {
      await mkdir(this.saveDirectory, { recursive: true })
    } catch (error) {
      console.error('Failed to create directory:', error)
    }

    // Load existing dumps
    await this.loadDumps()

    // Start auto-save interval (every 5 seconds)
    this.startAutoSaveInterval()
  }

  private startAutoSaveInterval() {
    if (this.saveInterval) {
      clearInterval(this.saveInterval)
    }

    this.saveInterval = setInterval(async () => {
      if (this.autoSave && this.pendingSaves.length > 0) {
        await this.savePendingDumps()
      }
    }, 5000) // Save every 5 seconds
  }

  private async loadDumps() {
    try {
      const data = await readFile(this.dumpFilePath, 'utf8')
      const savedData = JSON.parse(data)

      if (savedData.dumps && Array.isArray(savedData.dumps)) {
        for (const dump of savedData.dumps) {
          this.dumps.set(dump.id, dump)
        }
        console.log(`Loaded ${savedData.dumps.length} dumps from ${this.dumpFilePath}`)
      }
    } catch (error) {
      // File doesn't exist or is invalid, that's okay
      console.log(`No existing dump file found: ${this.dumpFilePath}`)
    }
  }

  private async savePendingDumps() {
    if (this.pendingSaves.length === 0) return

    try {
      // Get all current dumps (including pending ones)
      const allDumps = this.getDumps()

      const saveData = {
        lastUpdated: new Date().toISOString(),
        totalDumps: allDumps.length,
        version: '1.0',
        dumps: allDumps
      }

      // Save to file
      await writeFile(this.dumpFilePath, JSON.stringify(saveData, null, 2), 'utf8')

      console.log(`Saved ${this.pendingSaves.length} new dumps (${allDumps.length} total)`)
      this.pendingSaves = []

    } catch (error) {
      console.error('Failed to save dumps:', error)
    }
  }

  addDump(dump: Dump): void {
    // If we've reached the max dumps, remove the oldest
    if (this.dumps.size >= this.maxDumps) {
      const oldestId = Array.from(this.dumps.keys())[0]
      this.dumps.delete(oldestId)
    }

    this.dumps.set(dump.id, dump)

    // Add to pending saves if auto-save is enabled
    if (this.autoSave) {
      this.pendingSaves.push(dump)
    }
  }

  getDumps(): Dump[] {
    return Array.from(this.dumps.values()).sort((a, b) => b.timestamp - a.timestamp)
  }

  getDump(id: string): Dump | undefined {
    return this.dumps.get(id)
  }

  async clearDumps(): Promise<void> {
    // Clear from memory
    this.dumps.clear()
    this.pendingSaves = []

    // Delete the dump file
    try {
      await unlink(this.dumpFilePath)
      console.log('Dump file deleted')
    } catch (error) {
      // File might not exist, that's okay
      console.log('No dump file to delete')
    }
  }

  getDumpsByServer(serverId: string): Dump[] {
    return this.getDumps().filter(dump => dump.serverId === serverId)
  }

  getDumpsByFlag(flags: string[]): Dump[] {
    if (flags.length === 0) return this.getDumps()

    return this.getDumps().filter(dump =>
      dump.flag && flags.includes(dump.flag)
    )
  }

  async exportDumps(filePath: string): Promise<boolean> {
    try {
      const dumps = this.getDumps()
      const exportData = {
        exportDate: new Date().toISOString(),
        totalDumps: dumps.length,
        metadata: {
          version: '1.0',
          source: 'TCP Dump Viewer Manual Export'
        },
        dumps: dumps
      }

      await writeFile(filePath, JSON.stringify(exportData, null, 2), 'utf8')
      return true
    } catch (error) {
      console.error('Failed to export dumps:', error)
      return false
    }
  }

  // Auto-save configuration
  setAutoSave(enabled: boolean): void {
    this.autoSave = enabled
    if (enabled) {
      this.startAutoSaveInterval()
    } else if (this.saveInterval) {
      clearInterval(this.saveInterval)
      this.saveInterval = null
    }
  }

  isAutoSaveEnabled(): boolean {
    return this.autoSave
  }

  async forceSave(): Promise<boolean> {
    try {
      await this.savePendingDumps()
      return true
    } catch (error) {
      console.error('Failed to force save dumps:', error)
      return false
    }
  }

  getStats() {
    const dumps = this.getDumps()
    const stats = {
      total: dumps.length,
      pendingSaves: this.pendingSaves.length,
      autoSaveEnabled: this.autoSave,
      dumpFilePath: this.dumpFilePath,
      byServer: {} as Record<string, number>,
      byFlag: {} as Record<string, number>,
      oldestTimestamp: 0,
      newestTimestamp: 0
    }

    if (dumps.length > 0) {
      stats.oldestTimestamp = Math.min(...dumps.map(d => d.timestamp))
      stats.newestTimestamp = Math.max(...dumps.map(d => d.timestamp))

      dumps.forEach(dump => {
        // Count by server
        stats.byServer[dump.serverId] = (stats.byServer[dump.serverId] || 0) + 1

        // Count by flag
        const flag = dump.flag || 'gray'
        stats.byFlag[flag] = (stats.byFlag[flag] || 0) + 1
      })
    }

    return stats
  }

  setMaxDumps(max: number): void {
    this.maxDumps = max

    // If current dumps exceed new max, remove oldest
    const dumps = this.getDumps()
    if (dumps.length > max) {
      const toRemove = dumps.slice(max)
      toRemove.forEach(dump => this.dumps.delete(dump.id))
    }
  }

  // Cleanup on app exit
  async cleanup(): Promise<void> {
    if (this.saveInterval) {
      clearInterval(this.saveInterval)
    }

    // Save any pending dumps before exit
    if (this.pendingSaves.length > 0) {
      await this.savePendingDumps()
    }
  }
}
