import { writeFile, readFile, mkdir } from 'fs/promises'
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
  private dumps: Dump[] = []  // OPRAVA: Použit Array místo Map pro zachování pořadí
  private maxDumps = 1000
  private dumpsFilePath: string
  private autoSaveInterval: NodeJS.Timeout | null = null
  private autoSaveEnabled = false
  private hasUnsavedChanges = false

  constructor() {
    this.dumpsFilePath = join(app.getPath('userData'), 'dumps.json')
  }

  // OPRAVA: Vždy načte dumps pokud existují, nezávisle na nastavení
  async loadDumps(): Promise<Dump[]> {
    try {
      const data = await readFile(this.dumpsFilePath, 'utf8')
      const savedData = JSON.parse(data)

      if (savedData.dumps && Array.isArray(savedData.dumps)) {
        // Load dumps but respect maxDumps limit, sort by timestamp descending
        const dumpsToLoad = savedData.dumps
          .sort((a: Dump, b: Dump) => b.timestamp - a.timestamp)
          .slice(0, this.maxDumps)

        this.dumps = dumpsToLoad
        console.log(`Loaded ${this.dumps.length} dumps from disk`)
        return this.dumps
      }
    } catch (error) {
      // File doesn't exist or is invalid, start fresh
      console.log('No saved dumps found, starting fresh')
    }
    return []
  }

  async saveDumps(): Promise<void> {
    try {
      // Ensure userData directory exists
      await mkdir(app.getPath('userData'), { recursive: true })

      const saveData = {
        savedAt: new Date().toISOString(),
        totalDumps: this.dumps.length,
        dumps: this.dumps
      }

      await writeFile(this.dumpsFilePath, JSON.stringify(saveData, null, 2), 'utf8')
      this.hasUnsavedChanges = false
      console.log(`Saved ${this.dumps.length} dumps to disk`)
    } catch (error) {
      console.error('Failed to save dumps:', error)
      throw error
    }
  }

  addDump(dump: Dump): void {
    // Add to beginning to maintain newest-first order
    this.dumps.unshift(dump)

    // If we've reached the max dumps, remove the oldest
    if (this.dumps.length > this.maxDumps) {
      this.dumps = this.dumps.slice(0, this.maxDumps)
    }

    this.hasUnsavedChanges = true
  }

  getDumps(): Dump[] {
    return [...this.dumps]  // Return copy to prevent external modification
  }

  getDump(id: string): Dump | undefined {
    return this.dumps.find(dump => dump.id === id)
  }

  clearDumps(): void {
    this.dumps = []
    this.hasUnsavedChanges = true
  }

  async clearDumpsFromDisk(): Promise<void> {
    try {
      // Ensure userData directory exists
      await mkdir(app.getPath('userData'), { recursive: true })

      await writeFile(this.dumpsFilePath, JSON.stringify({
        savedAt: new Date().toISOString(),
        totalDumps: 0,
        dumps: []
      }, null, 2), 'utf8')

      this.hasUnsavedChanges = false
      console.log('Dumps cleared from disk')
    } catch (error) {
      console.error('Failed to clear dumps from disk:', error)
      throw error
    }
  }

  getDumpsByServer(serverId: string): Dump[] {
    return this.dumps.filter(dump => dump.serverId === serverId)
  }

  getDumpsByFlag(flags: string[]): Dump[] {
    if (flags.length === 0) return this.getDumps()

    return this.dumps.filter(dump =>
      dump.flag && flags.includes(dump.flag)
    )
  }

  async exportDumps(filePath: string): Promise<boolean> {
    try {
      const exportData = {
        exportDate: new Date().toISOString(),
        totalDumps: this.dumps.length,
        dumps: this.dumps
      }

      await writeFile(filePath, JSON.stringify(exportData, null, 2), 'utf8')
      return true
    } catch (error) {
      console.error('Failed to export dumps:', error)
      return false
    }
  }

  getStats() {
    const stats = {
      total: this.dumps.length,
      byServer: {} as Record<string, number>,
      byFlag: {} as Record<string, number>,
      oldestTimestamp: 0,
      newestTimestamp: 0
    }

    if (this.dumps.length > 0) {
      stats.oldestTimestamp = Math.min(...this.dumps.map(d => d.timestamp))
      stats.newestTimestamp = Math.max(...this.dumps.map(d => d.timestamp))

      this.dumps.forEach(dump => {
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

    // If current dumps exceed new max, remove oldest (from end)
    if (this.dumps.length > max) {
      this.dumps = this.dumps.slice(0, max)
      this.hasUnsavedChanges = true
    }
  }

  getDumpsFilePath(): string {
    return this.dumpsFilePath
  }

  startAutoSave(): void {
    if (this.autoSaveInterval) {
      return // Already running
    }

    this.autoSaveEnabled = true
    this.autoSaveInterval = setInterval(async () => {
      if (this.hasUnsavedChanges && this.autoSaveEnabled) {
        try {
          await this.saveDumps()
          console.log('Auto-saved dumps')
        } catch (error) {
          console.error('Auto-save failed:', error)
        }
      }
    }, 5000) // Save every 5 seconds

    console.log('Auto-save started (every 5 seconds)')
  }

  stopAutoSave(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval)
      this.autoSaveInterval = null
    }
    this.autoSaveEnabled = false
    console.log('Auto-save stopped')
  }

  async forceSave(): Promise<void> {
    if (this.hasUnsavedChanges) {
      await this.saveDumps()
    }
  }

  hasChanges(): boolean {
    return this.hasUnsavedChanges
  }

  async cleanup(): Promise<void> {
    this.stopAutoSave()
    if (this.hasUnsavedChanges) {
      await this.saveDumps()
    }
  }
}
