// src/renderer/src/components/dump-viewer/EnhancedDumpViewer.tsx
//
// Master-detail container. A type-filter / control toolbar sits above a
// resizable split: virtualized DumpList on the left, DumpDetail on the right.
// All filtering lives in App.tsx; this component is presentational plus a lazy
// per-selection exception parse. Styled on the semantic token layer.

import { useCallback, useEffect, useRef, useState, type JSX } from 'react'
import { Dump, Server } from '../../App'
import { DumpList } from './DumpList'
import { DumpDetail } from './DumpDetail'
import { ExceptionParser } from '../../utils/exceptionParser'
import type { DumpKind } from './utils'

type TypeFilter = DumpKind | 'all'

interface EnhancedDumpViewerProps {
  dumps: Dump[]
  servers: Server[]
  selectedDumpId: string | null
  onSelect: (id: string) => void
  isPaused: boolean
  onTogglePause: () => void
  filterType: TypeFilter
  onFilterTypeChange: (t: TypeFilter) => void
  typeCounts: Record<TypeFilter, number>
  density: 'comfortable' | 'compact'
  onToggleDensity: () => void
  newDumpIds: Set<string>
}

const TYPE_FILTERS: Array<{ key: TypeFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'exception', label: 'Exceptions' },
  { key: 'var', label: 'Vars' },
  { key: 'sql', label: 'SQL' },
  { key: 'http', label: 'HTTP' },
  { key: 'log', label: 'Logs' },
  { key: 'performance', label: 'Perf' },
  { key: 'event', label: 'Events' },
  { key: 'model', label: 'Models' },
  { key: 'collection', label: 'Collections' },
  { key: 'table', label: 'Tables' },
  { key: 'measure', label: 'Measures' },
  { key: 'data', label: 'Data' }
]

const LIST_WIDTH_KEY = 'dumpio.listWidth'

export function EnhancedDumpViewer({
  dumps,
  servers,
  selectedDumpId,
  onSelect,
  isPaused,
  onTogglePause,
  filterType,
  onFilterTypeChange,
  typeCounts,
  density,
  onToggleDensity,
  newDumpIds
}: EnhancedDumpViewerProps): JSX.Element {
  const [listWidth, setListWidth] = useState<number>(() => {
    const saved = Number(localStorage.getItem(LIST_WIDTH_KEY))
    return saved >= 280 && saved <= 720 ? saved : 380
  })
  const draggingRef = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedDump = selectedDumpId ? (dumps.find((d) => d.id === selectedDumpId) ?? null) : null
  const selectedServer = selectedDump
    ? servers.find((s) => s.id === selectedDump.serverId)
    : undefined
  const parsedException = selectedDump
    ? ExceptionParser.parseCached(selectedDump.id, selectedDump.payload)
    : null

  // Resizable divider.
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    draggingRef.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [])
  useEffect(() => {
    const onMove = (e: PointerEvent): void => {
      if (!draggingRef.current || !containerRef.current) return
      const left = containerRef.current.getBoundingClientRect().left
      const w = Math.max(280, Math.min(720, e.clientX - left))
      setListWidth(w)
    }
    const onUp = (): void => {
      if (draggingRef.current) {
        draggingRef.current = false
        localStorage.setItem(LIST_WIDTH_KEY, String(listWidth))
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [listWidth])

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex h-10 flex-shrink-0 items-center justify-between gap-4 border-b border-line bg-panel px-3">
        <div className="flex items-center gap-1 overflow-x-auto">
          {TYPE_FILTERS.map((f) => {
            const count = typeCounts[f.key] ?? 0
            const isActive = filterType === f.key
            // Hide empty type chips (keep "All" always visible).
            if (count === 0 && f.key !== 'all' && !isActive) return null
            return (
              <button
                key={f.key}
                type="button"
                aria-pressed={isActive}
                onClick={() => onFilterTypeChange(f.key)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  isActive ? 'bg-accent text-white' : 'text-muted hover:bg-elevated hover:text-fg'
                }`}
              >
                {f.label}
                <span
                  className={`rounded px-1 text-[10px] tabular-nums ${
                    isActive ? 'bg-white/25' : 'bg-sunken text-subtle'
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex flex-shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleDensity}
            className="rounded-md border border-line px-2 py-1 text-xs font-medium text-muted transition-colors hover:bg-elevated hover:text-fg"
            title="Toggle row density"
          >
            {density === 'compact' ? 'Compact' : 'Comfortable'}
          </button>
          <button
            type="button"
            aria-pressed={isPaused}
            onClick={onTogglePause}
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              isPaused
                ? 'border-amber-400/50 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'border-emerald-400/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            }`}
            title="Pause / resume auto-scroll (p)"
          >
            <span className="text-[10px]">{isPaused ? '❚❚' : '▶'}</span>
            {isPaused ? 'Paused' : 'Following'}
          </button>
        </div>
      </div>

      {/* Split */}
      <div ref={containerRef} className="flex flex-1 overflow-hidden">
        <div style={{ width: listWidth }} className="flex-shrink-0 border-r border-line bg-panel">
          <DumpList
            dumps={dumps}
            servers={servers}
            selectedDumpId={selectedDumpId}
            onSelect={onSelect}
            isPaused={isPaused}
            density={density}
            newDumpIds={newDumpIds}
          />
        </div>

        {/* Divider */}
        <div
          onPointerDown={onPointerDown}
          className="w-1 flex-shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-accent/40"
          title="Drag to resize"
        />

        <div className="min-w-0 flex-1">
          <DumpDetail
            dump={selectedDump}
            server={selectedServer}
            parsedException={parsedException}
          />
        </div>
      </div>
    </div>
  )
}
