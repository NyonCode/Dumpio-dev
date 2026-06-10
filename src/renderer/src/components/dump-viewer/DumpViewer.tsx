import React, { useState, useMemo, useRef, useEffect } from 'react'
import { DumpViewerProps } from './types'
import { DumpItem } from './DumpItem'
import { DumpToolbar } from './DumpToolbar'
import { EmptyState } from './EmptyState'

interface DumpViewerProps {
  dumps: Dump[]
  servers: Server[]
  onOpenInIde: (file: string, line: number) => void
  viewMode?: 'detailed' | 'compact'
  viewerMode?: 'professional' | 'simple'
}

export function DumpViewer({
  dumps,
  servers,
  onOpenInIde,
  viewMode = 'detailed',
  viewerMode = 'professional'
}: DumpViewerProps) {
  const [expandedDump, setExpandedDump] = useState<string | null>(null)
  const [newDumpIds, setNewDumpIds] = useState<Set<string>>(new Set())
  const [autoScroll, setAutoScroll] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)

  const getServerById = (serverId: string) => {
    return servers.find((s) => s.id === serverId)
  }

  const toggleExpand = (dumpId: string) => {
    setExpandedDump(expandedDump === dumpId ? null : dumpId)
  }

  // Track new dumps for animation - bez intervalu
  useEffect(() => {
    if (dumps.length > 0) {
      const latestDump = dumps[0]
      const latestDumpTime = latestDump.timestamp

      // Kontrola jestli je dump skutečně nový (ne starší než 1 sekunda)
      const now = Date.now()
      const isRecentDump = now - latestDumpTime < 1000

      if (isRecentDump && !newDumpIds.has(latestDump.id)) {
        setNewDumpIds((prev) => new Set([...prev, latestDump.id]))

        // Auto scroll pouze pro nové dumpy
        if (autoScroll && containerRef.current) {
          containerRef.current.scrollTo({ top: 0, behavior: 'smooth' })
        }

        // Odebrat highlight po 2 sekundách (ne 3)
        setTimeout(() => {
          setNewDumpIds((prev) => {
            const newSet = new Set(prev)
            newSet.delete(latestDump.id)
            return newSet
          })
        }, 2000)
      }
    }
  }, [dumps.length, autoScroll]) // Pouze při změně počtu dumps

  const dumpStats = useMemo(() => {
    const stats = {
      total: dumps.length,
      byServer: {} as Record<string, number>,
      byFlag: {} as Record<string, number>,
      byType: {} as Record<string, number>,
      recentActivity: 0
    }

    const now = Date.now()
    const oneMinuteAgo = now - 60000

    dumps.forEach((dump) => {
      // By server
      const server = getServerById(dump.serverId)
      const serverName = server?.name || 'Unknown Server'
      stats.byServer[serverName] = (stats.byServer[serverName] || 0) + 1

      // By flag
      const flag = dump.flag || 'gray'
      stats.byFlag[flag] = (stats.byFlag[flag] || 0) + 1

      // By type
      let type = 'Data'
      if (dump.payload?.type === 'query' || dump.payload?.sql) type = 'SQL'
      else if (dump.payload?.type === 'exception' || dump.payload?.error) type = 'Error'
      else if (dump.payload?.type === 'log' || dump.payload?.level) type = 'Log'
      else if (dump.payload?.method || dump.payload?.url) type = 'HTTP'

      stats.byType[type] = (stats.byType[type] || 0) + 1

      // Recent activity
      if (dump.timestamp > oneMinuteAgo) {
        stats.recentActivity++
      }
    })

    return stats
  }, [dumps, servers])

  const filteredDumps = useMemo(() => {
    // Bez filtrování podle typu - zobrazit všechny dumps
    return dumps
  }, [dumps])

  const toggleDumpType = (type: string) => {
    setSelectedDumpTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    )
  }

  if (dumps.length === 0) {
    return <EmptyState />
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <DumpToolbar
        stats={dumpStats}
        servers={servers}
        autoScroll={autoScroll}
        onToggleAutoScroll={() => setAutoScroll(!autoScroll)}
        filteredCount={filteredDumps.length}
        totalCount={dumps.length}
      />

      {/* Content */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900 scroll-smooth"
      >
        <div className="max-w-7xl mx-auto py-6 px-6">
          <div
            className={`transition-all duration-300 ease-in-out ${viewMode === 'compact' ? 'space-y-2' : 'space-y-6'}`}
          >
            {filteredDumps.map((dump) => {
              const server = getServerById(dump.serverId)
              const isExpanded = expandedDump === dump.id
              const isNew = newDumpIds.has(dump.id)

              return (
                <DumpItem
                  key={dump.id}
                  dump={dump}
                  server={server}
                  onOpenInIde={onOpenInIde}
                  isExpanded={isExpanded}
                  onToggleExpand={() => toggleExpand(dump.id)}
                  isNew={isNew}
                  viewMode={viewMode}
                  viewerMode={viewerMode}
                />
              )
            })}

            {/* Load more indicator for performance */}
            {filteredDumps.length > 100 && (
              <div className="text-center py-8">
                <div className="inline-flex items-center px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm">
                  <svg
                    className="w-5 h-5 text-slate-400 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    Showing first {filteredDumps.length} dumps for performance
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
