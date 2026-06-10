// src/renderer/src/hooks/useFocusTrap.ts
//
// Keeps keyboard focus inside an open overlay (dialog / command palette): moves
// initial focus into the container, cycles Tab / Shift+Tab within it, and
// restores focus to the previously-focused element when the overlay closes.

import { useEffect, type RefObject } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function useFocusTrap(ref: RefObject<HTMLElement | null>, active = true): void {
  useEffect(() => {
    if (!active) return
    const container = ref.current
    if (!container) return

    const previouslyFocused = document.activeElement as HTMLElement | null
    const visible = (): HTMLElement[] =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement
      )

    // Move focus in unless it is already inside the overlay.
    if (!container.contains(document.activeElement)) visible()[0]?.focus()

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== 'Tab') return
      const els = visible()
      if (els.length === 0) {
        e.preventDefault()
        return
      }
      const first = els[0]
      const last = els[els.length - 1]
      const activeEl = document.activeElement
      if (e.shiftKey && (activeEl === first || !container.contains(activeEl))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && activeEl === last) {
        e.preventDefault()
        first.focus()
      }
    }

    container.addEventListener('keydown', onKeyDown)
    return () => {
      container.removeEventListener('keydown', onKeyDown)
      // Restore focus to the trigger, if it is still in the document.
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus()
    }
  }, [ref, active])
}
