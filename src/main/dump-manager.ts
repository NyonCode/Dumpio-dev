import { writeFile } from 'fs/promises'

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

  addDump(dump: Dump): void {
    // If we've reached the max dumps, remove the oldest
    if (this.dumps.size >= this.maxDumps) {
      const oldestId = Array.from(this.dumps.keys())[0]
      this.dumps.delete(oldestId)
    }

    this.dumps.set(dump.id, dump)
  }

  getDumps(): Dump[] {
    return Array.from(this.dumps.values()).sort((a, b) => b.timestamp - a.timestamp)
  }

  getDump(id: string): Dump | undefined {
    return this.dumps.get(id)
  }

  clearDumps(): void {
    this.dumps.clear()
  }

  getDumpsByServer(serverId: string): Dump[] {
    return this.getDumps().filter((dump) => dump.serverId === serverId)
  }

  getDumpsByFlag(flags: string[]): Dump[] {
    if (flags.length === 0) return this.getDumps()

    return this.getDumps().filter((dump) => dump.flag && flags.includes(dump.flag))
  }

  async exportDumps(filePath: string): Promise<boolean> {
    try {
      const dumps = this.getDumps()
      const exportData = {
        exportDate: new Date().toISOString(),
        totalDumps: dumps.length,
        dumps: dumps
      }

      await writeFile(filePath, JSON.stringify(exportData, null, 2), 'utf8')
      return true
    } catch (error) {
      console.error('Failed to export dumps:', error)
      return false
    }
  }

  getStats() {
    const dumps = this.getDumps()
    const stats = {
      total: dumps.length,
      byServer: {} as Record<string, number>,
      byFlag: {} as Record<string, number>,
      oldestTimestamp: 0,
      newestTimestamp: 0
    }

    if (dumps.length > 0) {
      stats.oldestTimestamp = Math.min(...dumps.map((d) => d.timestamp))
      stats.newestTimestamp = Math.max(...dumps.map((d) => d.timestamp))

      dumps.forEach((dump) => {
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
      toRemove.forEach((dump) => this.dumps.delete(dump.id))
    }
  }
}
