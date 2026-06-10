// src/renderer/src/hooks/useKeyboardNav.ts
//
// Power-user keyboard navigation (Phase A6):
//   j / ↓      next dump          k / ↑      previous dump
//   g g        first              G          last
//   Enter      select first if none selected
//   /          focus search       p          pause / resume stream
//   Esc        clear selection / blur        Cmd/Ctrl+K  command palette
//
// Typing in an input is respected: only Escape and Cmd/Ctrl+K are handled there.

import { useEffect, useRef } from 'react'

interface KeyboardNavOptions {
  ids: string[]
  selectedId: string | null
  onSelect: (id: string) => void
  onFocusSearch: () => void
  onTogglePause: () => void
  onOpenPalette: () => void
  onEscape: () => void
  disabled?: boolean
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable
}

export function useKeyboardNav({
  ids,
  selectedId,
  onSelect,
  onFocusSearch,
  onTogglePause,
  onOpenPalette,
  onEscape,
  disabled
}: KeyboardNavOptions): void {
  // Keep latest values without re-binding the listener every render.
  const ref = useRef({
    ids,
    selectedId,
    onSelect,
    onFocusSearch,
    onTogglePause,
    onOpenPalette,
    onEscape,
    disabled
  })
  ref.current = {
    ids,
    selectedId,
    onSelect,
    onFocusSearch,
    onTogglePause,
    onOpenPalette,
    onEscape,
    disabled
  }

  const lastG = useRef(0)

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      const s = ref.current

      // Command palette always available.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        s.onOpenPalette()
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (s.disabled) return

      const typing = isTypingTarget(e.target)

      if (e.key === 'Escape') {
        if (typing && e.target instanceof HTMLElement) e.target.blur()
        else s.onEscape()
        return
      }

      if (typing) return

      const { ids, selectedId } = s
      const index = selectedId ? ids.indexOf(selectedId) : -1
      const move = (next: number): void => {
        if (ids.length === 0) return
        const clamped = Math.max(0, Math.min(ids.length - 1, next))
        s.onSelect(ids[clamped])
      }

      switch (e.key) {
        case 'j':
        case 'ArrowDown':
          e.preventDefault()
          move(index < 0 ? 0 : index + 1)
          break
        case 'k':
        case 'ArrowUp':
          e.preventDefault()
          move(index < 0 ? 0 : index - 1)
          break
        case 'Enter':
          if (index < 0 && ids.length > 0) {
            e.preventDefault()
            s.onSelect(ids[0])
          }
          break
        case 'G':
          e.preventDefault()
          move(ids.length - 1)
          break
        case 'g': {
          const now = Date.now()
          if (now - lastG.current < 400) {
            e.preventDefault()
            move(0)
            lastG.current = 0
          } else {
            lastG.current = now
          }
          break
        }
        case '/':
          e.preventDefault()
          s.onFocusSearch()
          break
        case 'p':
          e.preventDefault()
          s.onTogglePause()
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
}
