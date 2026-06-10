// src/renderer/src/hooks/usePersistentState.ts
//
// useState that mirrors its value into localStorage, so UI state (filters,
// selection) survives an app restart. Reads lazily on init; writes on change.
// Failures (private mode, quota, bad JSON) degrade silently to in-memory state.

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'

export function usePersistentState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw != null ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state))
    } catch {
      /* ignore persistence failures */
    }
  }, [key, state])

  return [state, setState]
}
