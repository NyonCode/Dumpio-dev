// src/renderer/src/utils/editor.ts
//
// Build "open file at line" URLs for common editors. The chosen editor is a
// per-machine renderer preference (localStorage key `dumpio.editor`), surfaced
// in Settings → Appearance. The actual open is delegated to main via
// `window.api.openInEditor`, which allowlists these schemes.

export type EditorScheme =
  | 'none'
  | 'vscode'
  | 'vscode-insiders'
  | 'cursor'
  | 'phpstorm'
  | 'webstorm'
  | 'idea'
  | 'sublime'
  | 'textmate'
  | 'zed'

export const EDITOR_STORAGE_KEY = 'dumpio.editor'

export const EDITOR_OPTIONS: { value: EditorScheme; label: string }[] = [
  { value: 'none', label: 'Off' },
  { value: 'vscode', label: 'VS Code' },
  { value: 'vscode-insiders', label: 'VS Code Insiders' },
  { value: 'cursor', label: 'Cursor' },
  { value: 'phpstorm', label: 'PhpStorm' },
  { value: 'webstorm', label: 'WebStorm' },
  { value: 'idea', label: 'IntelliJ IDEA' },
  { value: 'sublime', label: 'Sublime Text' },
  { value: 'textmate', label: 'TextMate' },
  { value: 'zed', label: 'Zed' }
]

/**
 * Build an editor deep-link for `file` (absolute path) at `line`, or null when
 * no editor is configured or the file is unknown.
 */
export function editorHref(
  scheme: EditorScheme | undefined,
  file: string | undefined,
  line: number | undefined
): string | null {
  if (!scheme || scheme === 'none' || !file) return null
  const l = typeof line === 'number' && line > 0 ? line : 1
  const enc = encodeURIComponent(file)
  switch (scheme) {
    case 'vscode':
      return `vscode://file${file}:${l}`
    case 'vscode-insiders':
      return `vscode-insiders://file${file}:${l}`
    case 'cursor':
      return `cursor://file${file}:${l}`
    case 'phpstorm':
      return `phpstorm://open?file=${enc}&line=${l}`
    case 'webstorm':
      return `webstorm://open?file=${enc}&line=${l}`
    case 'idea':
      return `idea://open?file=${enc}&line=${l}`
    case 'sublime':
      return `subl://open?url=file://${enc}&line=${l}`
    case 'textmate':
      return `txmt://open?url=file://${enc}&line=${l}`
    case 'zed':
      return `zed://file${file}:${l}`
    default:
      return null
  }
}
