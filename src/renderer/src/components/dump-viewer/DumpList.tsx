// src/renderer/src/components/dump-viewer/DumpList.tsx
//
// Virtualized master list. Compact, scannable rows on the semantic token
// surface; smooth at thousands of dumps via @tanstack/react-virtual. Selection
// drives the detail panel; new dumps pulse and auto-scroll to top only when
// following (not paused) and the user is already near the top.

import { useEffect, useRef, type JSX } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Dump, Server } from '../../App'
import { FLAG_COLORS, SERVER_COLORS } from './types'
import { getDumpTypeInfo, getDumpTitle, formatTimestamp } from './utils'
import { getIconComponent } from './icons'

interface DumpListProps {
  dumps: Dump[]
  servers: Server[]
  selectedDumpId: string | null
  onSelect: (id: string) => void
  isPaused: boolean
  density: 'comfortable' | 'compact'
  newDumpIds: Set<string>
}

export function DumpList({
  dumps,
  servers,
  selectedDumpId,
  onSelect,
  isPaused,
  density,
  newDumpIds
}: DumpListProps): JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null)
  const rowHeight = density === 'compact' ? 38 : 60

  const virtualizer = useVirtualizer({
    count: dumps.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 12,
    getItemKey: (index) => dumps[index]?.id ?? index
  })

  const serverById = (id: string): Server | undefined => servers.find((s) => s.id === id)

  // Auto-scroll to the newest dump when following and the user is near the top.
  const topId = dumps[0]?.id
  useEffect(() => {
    if (isPaused || !topId) return
    const el = scrollRef.current
    if (el && el.scrollTop < rowHeight * 2) {
      virtualizer.scrollToIndex(0, { align: 'start' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topId, isPaused])

  // Keep the keyboard-selected row in view.
  useEffect(() => {
    if (!selectedDumpId) return
    const index = dumps.findIndex((d) => d.id === selectedDumpId)
    if (index >= 0) virtualizer.scrollToIndex(index, { align: 'auto' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDumpId])

  if (dumps.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-subtle">
        No dumps match the current filters.
      </div>
    )
  }

  return (
    <div
      ref={scrollRef}
      className="h-full overflow-y-auto focus:outline-none"
      role="listbox"
      aria-label="Received dumps"
      tabIndex={0}
      aria-activedescendant={selectedDumpId ? `dump-${selectedDumpId}` : undefined}
    >
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
        {virtualizer.getVirtualItems().map((item) => {
          const dump = dumps[item.index]
          const server = serverById(dump.serverId)
          const serverStyle = server
            ? (SERVER_COLORS[server.color as keyof typeof SERVER_COLORS] ?? SERVER_COLORS.gray)
            : SERVER_COLORS.gray
          const flagStyle = FLAG_COLORS[dump.flag || 'gray']
          const typeInfo = getDumpTypeInfo(dump.payload)
          const isSelected = dump.id === selectedDumpId
          const isNew = newDumpIds.has(dump.id)

          return (
            <button
              key={item.key}
              id={`dump-${dump.id}`}
              type="button"
              role="option"
              tabIndex={-1}
              aria-selected={isSelected}
              onClick={() => onSelect(dump.id)}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: item.size,
                transform: `translateY(${item.start}px)`
              }}
              className={`flex w-full items-center gap-2.5 border-l-2 border-b border-b-line/60 px-3 text-left transition-[background-color,border-color] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${
                isSelected
                  ? 'border-l-accent bg-accent/10'
                  : 'border-l-transparent hover:bg-elevated'
              }`}
            >
              {/* flag dot */}
              <span
                className={`h-2 w-2 flex-shrink-0 rounded-full ${flagStyle.dot}`}
                title={dump.flag || 'gray'}
              />

              {/* type icon */}
              <span className="flex-shrink-0 text-muted">
                {getIconComponent(typeInfo.icon, 'w-4 h-4')}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[13px] font-medium text-fg">
                    {getDumpTitle(dump.payload)}
                  </span>
                  {isNew && (
                    <span className="flex-shrink-0 animate-fade-in rounded-full bg-emerald-500 px-1.5 text-[9px] font-bold leading-4 text-white">
                      NEW
                    </span>
                  )}
                </div>
                {density === 'comfortable' && (
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-subtle">
                    {server && (
                      <span className={`inline-flex items-center gap-1 ${serverStyle.text}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${serverStyle.bg}`} />
                        {server.name}
                      </span>
                    )}
                    {dump.channel && dump.channel !== 'default' && (
                      <span className="rounded bg-sunken px-1 font-mono">#{dump.channel}</span>
                    )}
                    <span className="uppercase tracking-wide">{typeInfo.type}</span>
                  </div>
                )}
              </div>

              {/* timestamp */}
              <span
                className="flex-shrink-0 font-mono text-[11px] tabular-nums text-subtle"
                title={new Date(dump.timestamp).toLocaleString()}
              >
                {formatTimestamp(dump.timestamp)}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
