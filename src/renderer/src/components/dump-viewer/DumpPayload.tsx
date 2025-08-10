import React, { useState } from 'react'
import { DumpPayloadProps, FLAG_COLORS } from './types'
import { CopyMenuExpanded } from './CopyMenu'
import { ArrayViewer } from './ArrayViewer'
import { SimpleArrayViewer } from './SimpleArrayViewer'

interface ExtendedDumpPayloadProps extends DumpPayloadProps {
  viewerMode?: 'professional' | 'simple'
}

export function DumpPayload({ dump, onCopy, copySuccess, viewerMode = 'professional' }: ExtendedDumpPayloadProps) {
  const [showCopyMenu, setShowCopyMenu] = useState(false)
  const flagStyle = FLAG_COLORS[dump.flag || 'gray']

  return (
    <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
      <div className="p-6">
        {/* Quick Info Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <div className="space-y-1">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">ID</span>
            <p className="font-mono text-sm text-slate-700 dark:text-slate-300 truncate">{dump.id}</p>
          </div>
          <div className="space-y-1">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Timestamp</span>
            <p className="text-sm text-slate-700 dark:text-slate-300">{new Date(dump.timestamp).toLocaleString()}</p>
          </div>
          <div className="space-y-1">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Origin</span>
            <p className="text-sm text-slate-700 dark:text-slate-300 truncate">{dump.origin}</p>
          </div>
          <div className="space-y-1">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Flag</span>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${flagStyle.dot}`}></div>
              <span className="text-sm text-slate-700 dark:text-slate-300 capitalize">{dump.flag || 'gray'}</span>
            </div>
          </div>
        </div>

        {/* Payload */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Data</h4>
            <div className="flex items-center space-x-2">
              {copySuccess && (
                <span className={`text-xs px-2 py-1 rounded-full ${
                  copySuccess.success
                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                    : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                }`}>
                  {copySuccess.success ? `Copied as ${copySuccess.type.toUpperCase()}!` : 'Copy failed'}
                </span>
              )}

              <CopyMenuExpanded
                onCopy={onCopy}
                copySuccess={copySuccess}
                isOpen={showCopyMenu}
                onToggle={() => setShowCopyMenu(!showCopyMenu)}
              />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-6 overflow-x-auto">
            <div className="font-mono text-sm leading-relaxed">
              {viewerMode === 'professional' ? (
                <ArrayViewer value={dump.payload} expanded={true} />
              ) : (
                <SimpleArrayViewer value={dump.payload} expanded={true} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
