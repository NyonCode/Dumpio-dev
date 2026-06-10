// src/renderer/src/components/dump-viewer/EditorLink.tsx
//
// Renders a `file:line` reference. When an editor is configured (Settings →
// Appearance), it becomes a clickable link that opens the file at that line in
// the editor; otherwise it degrades to plain monospace text.

import type { JSX } from 'react'
import { usePersistentState } from '../../hooks/usePersistentState'
import { editorHref, EDITOR_STORAGE_KEY, type EditorScheme } from '../../utils/editor'

interface EditorLinkProps {
  file?: string
  line?: number
  /** Show only the basename instead of the full path. */
  basename?: boolean
  className?: string
}

export function EditorLink({
  file,
  line,
  basename,
  className
}: EditorLinkProps): JSX.Element | null {
  const [scheme] = usePersistentState<EditorScheme>(EDITOR_STORAGE_KEY, 'none')

  if (!file) return null

  const shown = basename ? (file.split('/').pop() ?? file) : file
  const label = line !== undefined ? `${shown}:${line}` : shown
  const href = editorHref(scheme, file, line)

  if (!href) {
    return <span className={className}>{label}</span>
  }

  return (
    <button
      type="button"
      title={`Open ${file}:${line ?? ''} in editor`}
      onClick={(e) => {
        e.stopPropagation()
        void window.api.openInEditor(href)
      }}
      className={`${className ?? ''} cursor-pointer underline decoration-dotted underline-offset-2 hover:decoration-solid`}
    >
      {label}
    </button>
  )
}
