import { useState, useRef, useEffect } from 'react'
import { DumpItemProps, FLAG_COLORS } from './types'
import { DumpHeader } from './DumpHeader'
import { DumpContent } from './DumpContent'
import { DumpPayload } from './DumpPayload'
import { extractFileAndLine } from './utils'

export function DumpItem({
  dump,
  server,
  onOpenInIde,
  isExpanded,
  onToggleExpand,
  isNew = false,
  viewMode,
  viewerMode = 'professional'
}: DumpItemProps & { viewerMode?: 'professional' | 'simple' }): JSX.Element {
  const [copySuccess, setCopySuccess] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const itemRef = useRef<HTMLDivElement>(null)

  // Animation for new items
  useEffect(() => {
    if (isNew) {
      setIsVisible(true)
      // Remove new flag after animation
      const timer = setTimeout(() => {
        // Animation complete callback if needed
      }, 1000)
      return () => clearTimeout(timer)
    } else {
      setIsVisible(true)
    }
  }, [isNew])

  const handleCopy = async (): Promise<void> => {
    try {
      const jsonString = JSON.stringify(dump.payload, null, 2)
      await navigator.clipboard.writeText(jsonString)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
      setCopySuccess(false)
    }
  }

  const flagStyle = FLAG_COLORS[dump.flag || 'gray']
  const fileLocation = extractFileAndLine(dump.payload)

  return (
    <div
      ref={itemRef}
      className={`group border-l-4 ${flagStyle.accent} bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-r-lg shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden ${
        isNew ? 'ring-2 ring-blue-300 dark:ring-blue-600' : ''
      }`}
    >
      {/* Header with Server Info */}
      <DumpHeader
        dump={dump}
        server={server}
        onToggleExpand={onToggleExpand}
        isExpanded={isExpanded}
      />

      {/* Main Content */}
      <DumpContent
        dump={dump}
        onToggleExpand={onToggleExpand}
        isExpanded={isExpanded}
        fileLocation={fileLocation}
        onOpenInIde={onOpenInIde}
        onCopy={handleCopy}
        copySuccess={copySuccess}
      />

      {/* Expanded Content */}
      {isExpanded && (
        <DumpPayload
          dump={dump}
          onCopy={handleCopy}
          copySuccess={copySuccess}
          viewerMode={viewerMode}
        />
      )}
    </div>
  )
}
