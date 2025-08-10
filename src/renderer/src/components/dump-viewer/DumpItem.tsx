import { useState, useRef, useEffect } from 'react'
import { DumpItemProps, FLAG_COLORS, CopyFormat, CopyResult } from './types'
import { DumpHeader } from './DumpHeader'
import { DumpContent } from './DumpContent'
import { DumpPayload } from './DumpPayload'
import { extractFileAndLine } from './utils'
import { formatArrayForCopy } from './arrayConverter'

export function DumpItem({
                           dump,
                           server,
                           onOpenInIde,
                           isExpanded,
                           onToggleExpand,
                           isNew = false,
                           viewMode,
                           viewerMode = 'professional'
                         }: DumpItemProps & { viewerMode?: 'professional' | 'simple' }) {
  const [copySuccess, setCopySuccess] = useState<CopyResult | null>(null)
  const [isVisible, setIsVisible] = useState(false)
  const itemRef = useRef<HTMLDivElement>(null)

  // Animation for new items - bez opakování
  useEffect(() => {
    if (isNew) {
      setIsVisible(true)
      // Odebrat new flag po kratší době
      const timer = setTimeout(() => {
        // Můžeme přidat callback pro parent komponentu
      }, 1000) // Kratší doba
      return () => clearTimeout(timer)
    } else {
      setIsVisible(true)
    }
  }, [isNew])

  const handleCopy = async (format: CopyFormat) => {
    try {
      let textToCopy = ''

      switch (format) {
        case 'json':
          textToCopy = JSON.stringify(dump.payload, null, 2)
          break
        case 'array':
          // Použít nový převodník na skutečné pole
          const arrayData = formatArrayForCopy(dump.payload)
          textToCopy = JSON.stringify(arrayData, null, 2)
          break
        case 'raw':
          if (typeof dump.payload === 'string') {
            textToCopy = dump.payload
          } else {
            textToCopy = JSON.stringify(dump.payload)
          }
          break
      }

      await navigator.clipboard.writeText(textToCopy)
      setCopySuccess({ type: format, success: true })
      setTimeout(() => setCopySuccess(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
      setCopySuccess({ type: format, success: false })
      setTimeout(() => setCopySuccess(null), 2000)
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
