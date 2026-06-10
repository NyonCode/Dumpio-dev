import { writeFile, readFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'
import { logger } from './logger'

export interface Dump {
  id: string
  serverId: string
  timestamp: number
  origin: string
  payload: unknown
  flag?: 'yellow' | 'red' | 'blue' | 'gray' | 'purple' | 'pink' | 'green'
  channel?: string
  schemaVersion?: number
}

export interface DumpStats {
  total: number
  byServer: Record<string, number>
  byFlag: Record<string, number>
  oldestTimestamp: number
  newestTimestamp: number
}

/**
 * In-memory dump store with newest-first ordering, size pruning, and JSON
 * persistence. Auto-save scheduling lives in the main orchestrator
 * (`index.ts`), so this class only exposes explicit load/save operations.
 */
export class DumpManager {
  private dumps: Dump[] = []
  private maxDumps = 1000
  private readonly dumpsFilePath: string

  constructor() {
    this.dumpsFilePath = join(app.getPath('userData'), 'dumps.json')
  }

  async loadDumps(): Promise<Dump[]> {
    try {
      const data = await readFile(this.dumpsFilePath, 'utf8')
      const savedData = JSON.parse(data)

      if (savedData.dumps && Array.isArray(savedData.dumps)) {
        this.dumps = savedData.dumps
          .sort((a: Dump, b: Dump) => b.timestamp - a.timestamp)
          .slice(0, this.maxDumps)
        logger.info(`Loaded ${this.dumps.length} dumps from disk`)
        return this.dumps
      }
    } catch {
      logger.info('No saved dumps found, starting fresh')
    }
    return []
  }

  async saveDumps(): Promise<void> {
    try {
      await mkdir(app.getPath('userData'), { recursive: true })
      const saveData = {
        savedAt: new Date().toISOString(),
        totalDumps: this.dumps.length,
        dumps: this.dumps
      }
      await writeFile(this.dumpsFilePath, JSON.stringify(saveData, null, 2), 'utf8')
    } catch (error) {
      logger.error('Failed to save dumps:', error)
      throw error
    }
  }

  addDump(dump: Dump): void {
    // newest-first
    this.dumps.unshift(dump)
    if (this.dumps.length > this.maxDumps) {
      this.dumps = this.dumps.slice(0, this.maxDumps)
    }
  }

  getDumps(): Dump[] {
    return [...this.dumps]
  }

  clearDumps(): void {
    this.dumps = []
  }

  async clearDumpsFromDisk(): Promise<void> {
    try {
      await mkdir(app.getPath('userData'), { recursive: true })
      await writeFile(
        this.dumpsFilePath,
        JSON.stringify({ savedAt: new Date().toISOString(), totalDumps: 0, dumps: [] }, null, 2),
        'utf8'
      )
    } catch (error) {
      logger.error('Failed to clear dumps from disk:', error)
      throw error
    }
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
      logger.error('Failed to export dumps:', error)
      return false
    }
  }

  getStats(): DumpStats {
    const stats: DumpStats = {
      total: this.dumps.length,
      byServer: {},
      byFlag: {},
      oldestTimestamp: 0,
      newestTimestamp: 0
    }

    if (this.dumps.length > 0) {
      stats.oldestTimestamp = Math.min(...this.dumps.map((d) => d.timestamp))
      stats.newestTimestamp = Math.max(...this.dumps.map((d) => d.timestamp))
      for (const dump of this.dumps) {
        stats.byServer[dump.serverId] = (stats.byServer[dump.serverId] || 0) + 1
        const flag = dump.flag || 'gray'
        stats.byFlag[flag] = (stats.byFlag[flag] || 0) + 1
      }
    }

    return stats
  }

  setMaxDumps(max: number): void {
    this.maxDumps = max
    if (this.dumps.length > max) {
      this.dumps = this.dumps.slice(0, max)
    }
  }
}
