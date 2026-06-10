import { type JSX, type RefObject } from 'react'
import { Search, X, Download, Trash2, Pin } from 'lucide-react'
import type { SearchScope } from './dump-viewer/utils'

interface HeaderProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  onClearDumps: () => void
  onExportDumps: () => void
  alwaysOnTop: boolean
  onToggleAlwaysOnTop: () => void
  totalDumps?: number
  filteredDumps?: number
  recentActivity?: number
  exceptions?: number
  dataPackets?: number
  searchScope: SearchScope
  onSearchScopeChange: (scope: SearchScope) => void
  searchRegex: boolean
  onSearchRegexChange: (regex: boolean) => void
  searchInputRef: RefObject<HTMLInputElement | null>
}

export function Header({
  searchQuery,
  onSearchChange,
  onClearDumps,
  onExportDumps,
  alwaysOnTop,
  onToggleAlwaysOnTop,
  totalDumps = 0,
  filteredDumps = 0,
  recentActivity = 0,
  exceptions = 0,
  dataPackets = 0,
  searchScope,
  onSearchScopeChange,
  searchRegex,
  onSearchRegexChange,
  searchInputRef
}: HeaderProps): JSX.Element {
  return (
    <header className="flex h-12 flex-shrink-0 items-center gap-4 border-b border-line bg-panel px-4">
      {/* Search */}
      <div className="relative max-w-md flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search dumps…  /"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="block w-full rounded-md border border-line bg-sunken py-1.5 pl-9 pr-8 text-sm text-fg placeholder-subtle focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-subtle hover:text-fg"
            title="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Scope + regex */}
      <div className="flex items-center gap-1">
        <select
          value={searchScope}
          onChange={(e) => onSearchScopeChange(e.target.value as SearchScope)}
          className="rounded-md border border-line bg-sunken px-1.5 py-1.5 text-xs text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          title="Search scope"
        >
          <option value="all">All</option>
          <option value="keys">Keys</option>
          <option value="values">Values</option>
        </select>
        <button
          onClick={() => onSearchRegexChange(!searchRegex)}
          className={`rounded-md border px-2 py-1.5 font-mono text-xs transition-colors ${
            searchRegex
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-line text-subtle hover:bg-elevated hover:text-fg'
          }`}
          title="Toggle regular-expression search"
        >
          .*
        </button>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3 text-xs">
        <span className="text-muted">
          <span className="font-semibold tabular-nums text-fg">
            {filteredDumps === totalDumps ? totalDumps : `${filteredDumps}/${totalDumps}`}
          </span>{' '}
          {filteredDumps === 1 ? 'dump' : 'dumps'}
        </span>

        {exceptions > 0 && (
          <span className="inline-flex items-center gap-1 font-medium text-dump-red">
            <span className="h-1.5 w-1.5 rounded-full bg-dump-red" />
            {exceptions} {exceptions === 1 ? 'error' : 'errors'}
          </span>
        )}

        {dataPackets > 0 && <span className="tabular-nums text-muted">{dataPackets} data</span>}

        {recentActivity > 0 && (
          <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            {recentActivity} new
          </span>
        )}
      </div>

      {/* Spacer pushes the actions to the right edge */}
      <div className="flex-1" />

      {/* Actions */}
      <div className="flex flex-shrink-0 items-center gap-1">
        <button
          onClick={onToggleAlwaysOnTop}
          aria-pressed={alwaysOnTop}
          className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
            alwaysOnTop
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-line bg-sunken text-muted hover:bg-elevated hover:text-fg'
          }`}
          title={alwaysOnTop ? 'Window pinned on top — click to unpin' : 'Pin window on top'}
        >
          <Pin className={`h-3.5 w-3.5 ${alwaysOnTop ? 'fill-current' : ''}`} />
          Pin
        </button>

        <button
          onClick={onExportDumps}
          disabled={totalDumps === 0}
          className="inline-flex items-center gap-1.5 rounded-md border border-line bg-sunken px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-elevated hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-40"
          title="Export dumps"
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </button>

        <button
          onClick={onClearDumps}
          disabled={totalDumps === 0}
          className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:border-dump-red/40 hover:bg-dump-red/10 hover:text-dump-red focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-40"
          title="Clear all dumps"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear
        </button>
      </div>
    </header>
  )
}
