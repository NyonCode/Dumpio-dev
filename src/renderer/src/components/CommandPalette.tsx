// src/renderer/src/components/CommandPalette.tsx
//
// Lightweight command palette (Phase A6), opened with Cmd/Ctrl+K. Custom
// subsequence fuzzy match — no heavy dependency. The host (App) supplies the
// command list, including dynamic per-server / per-flag / per-channel filters.

import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import { useFocusTrap } from '../hooks/useFocusTrap'

export interface Command {
  id: string
  label: string
  group?: string
  hint?: string
  run: () => void
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  commands: Command[]
}

/** Subsequence fuzzy score; higher is better, -1 = no match. */
function fuzzyScore(query: string, text: string): number {
  if (!query) return 0
  const q = query.toLowerCase()
  const t = text.toLowerCase()
  let score = 0
  let ti = 0
  let streak = 0
  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi]
    const found = t.indexOf(ch, ti)
    if (found === -1) return -1
    streak = found === ti ? streak + 1 : 0
    score += found === ti ? 3 + streak : 1
    ti = found + 1
  }
  return score
}

export function CommandPalette({
  open,
  onClose,
  commands
}: CommandPaletteProps): JSX.Element | null {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  useFocusTrap(panelRef, open)

  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      // focus after mount
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  const results = useMemo(() => {
    if (!query) return commands
    return commands
      .map((c) => ({ c, score: fuzzyScore(query, c.label + ' ' + (c.group ?? '')) }))
      .filter((r) => r.score >= 0)
      .sort((a, b) => b.score - a.score)
      .map((r) => r.c)
  }, [query, commands])

  useEffect(() => {
    setActive(0)
  }, [query])

  if (!open) return null

  const run = (cmd: Command | undefined): void => {
    if (!cmd) return
    onClose()
    cmd.run()
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(results.length - 1, a + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(0, a - 1))
    } else if (e.key === 'Home') {
      e.preventDefault()
      setActive(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setActive(results.length - 1)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      run(results[active])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  const activeId = results[active] ? `cmd-${results[active].id}` : undefined

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[15vh]"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className="w-full max-w-lg animate-scale-in overflow-hidden rounded-xl border border-line bg-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type a command…"
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls="command-palette-list"
          aria-activedescendant={activeId}
          aria-autocomplete="list"
          className="w-full border-b border-line bg-transparent px-4 py-3 text-sm text-fg placeholder-subtle focus:outline-none"
        />
        <div
          ref={listRef}
          id="command-palette-list"
          role="listbox"
          aria-label="Commands"
          className="max-h-80 overflow-y-auto py-1"
        >
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-subtle">No commands found</div>
          ) : (
            results.map((cmd, i) => (
              <button
                key={cmd.id}
                id={`cmd-${cmd.id}`}
                type="button"
                role="option"
                tabIndex={-1}
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => run(cmd)}
                ref={(el) => {
                  if (i === active) el?.scrollIntoView({ block: 'nearest' })
                }}
                className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors ${
                  i === active ? 'bg-accent/10 text-accent' : 'text-fg'
                }`}
              >
                {cmd.group && (
                  <span className="rounded bg-sunken px-1.5 py-px text-[10px] font-medium uppercase text-subtle">
                    {cmd.group}
                  </span>
                )}
                <span className="flex-1 truncate">{cmd.label}</span>
                {cmd.hint && <span className="text-xs text-subtle">{cmd.hint}</span>}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
