import React, { useState } from 'react'
import { Dump, Server } from '../App'

interface DumpViewerProps {
  dumps: Dump[]
  servers: Server[]
  onOpenInIde: (file: string, line: number) => void
}

const FLAG_COLORS = {
  yellow: 'bg-dump-yellow',
  red: 'bg-dump-red',
  blue: 'bg-dump-blue',
  gray: 'bg-dump-gray',
  purple: 'bg-dump-purple',
  pink: 'bg-dump-pink',
  green: 'bg-dump-green'
}

export function DumpViewer({ dumps, servers, onOpenInIde }: DumpViewerProps) {
  const [expandedDump, setExpandedDump] = useState<string | null>(null)

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const getServerById = (serverId: string) => {
    return servers.find((s) => s.id === serverId)
  }

  const formatJson = (obj: any) => {
    if (typeof obj === 'string') {
      try {
        // If it's already a string, try to parse it to check if it's valid JSON
        const parsed = JSON.parse(obj)
        return JSON.stringify(parsed, null, 2)
      } catch {
        // If parsing fails, it's just a plain string
        return obj
      }
    } else if (obj !== null && typeof obj === 'object') {
      // If it's already an object, just stringify it
      try {
        return JSON.stringify(obj, null, 2)
      } catch {
        return String(obj)
      }
    } else {
      // For primitives, convert to string
      return String(obj)
    }
  }

  const toggleExpand = (dumpId: string) => {
    setExpandedDump(expandedDump === dumpId ? null : dumpId)
  }

  const extractFileAndLine = (payload: any) => {
    // Try to extract file and line information from common dump formats
    if (payload.file && payload.line) {
      return { file: payload.file, line: payload.line }
    }
    if (payload.origin && typeof payload.origin === 'string') {
      const match = payload.origin.match(/(.+):(\d+)$/)
      if (match) {
        return { file: match[1], line: parseInt(match[2]) }
      }
    }
    return null
  }

  if (dumps.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No dumps</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Start your TCP servers and send some data to see dumps here.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-hidden">
      <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <div className="space-y-4">
            {dumps.map((dump) => {
              const server = getServerById(dump.serverId)
              const isExpanded = expandedDump === dump.id
              const fileLocation = extractFileAndLine(dump.payload)

              return (
                <div
                  key={dump.id}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  {/* Header */}
                  <div
                    className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    onClick={() => toggleExpand(dump.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {/* Flag indicator */}
                        <div
                          className={`w-3 h-3 rounded-full ${FLAG_COLORS[dump.flag || 'gray']}`}
                        ></div>

                        {/* Server indicator */}
                        {server && (
                          <div className="flex items-center space-x-2">
                            <div className={`w-2 h-2 rounded-full bg-${server.color}-500`}></div>
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {server.name}
                            </span>
                          </div>
                        )}

                        {/* Channel */}
                        {dump.channel && dump.channel !== 'default' && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                            {dump.channel}
                          </span>
                        )}

                        {/* Timestamp */}
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {formatTimestamp(dump.timestamp)}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
                        {/* IDE button */}
                        {fileLocation && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              onOpenInIde(fileLocation.file, fileLocation.line)
                            }}
                            className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                            title="Open in IDE"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                              />
                            </svg>
                          </button>
                        )}

                        {/* Expand indicator */}
                        <svg
                          className={`w-4 h-4 text-gray-400 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </div>
                    </div>

                    {/* Origin */}
                    <div className="mt-2 flex items-center space-x-4">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        Origin: {dump.origin}
                      </span>
                      {fileLocation && (
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {fileLocation.file}:{fileLocation.line}
                        </span>
                      )}
                    </div>

                    {/* Preview (when collapsed) */}
                    {!isExpanded && (
                      <div className="mt-2 text-sm text-gray-600 dark:text-gray-400 truncate">
                        {(() => {
                          if (typeof dump.payload === 'string') {
                            return dump.payload.substring(0, 100)
                          } else if (dump.payload !== null && typeof dump.payload === 'object') {
                            try {
                              return JSON.stringify(dump.payload).substring(0, 100)
                            } catch {
                              return String(dump.payload).substring(0, 100)
                            }
                          } else {
                            return String(dump.payload).substring(0, 100)
                          }
                        })()}
                        ...
                      </div>
                    )}
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="px-4 py-4">
                      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                        <pre className="text-sm text-gray-800 dark:text-gray-200 overflow-x-auto whitespace-pre-wrap">
                          {formatJson(dump.payload)}
                        </pre>
                      </div>

                      {/* Actions */}
                      <div className="mt-3 flex space-x-2">
                        <button
                          onClick={() => navigator.clipboard.writeText(formatJson(dump.payload))}
                          className="inline-flex items-center px-3 py-1 border border-gray-300 dark:border-gray-600 text-xs font-medium rounded text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                        >
                          <svg
                            className="w-3 h-3 mr-1"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                          </svg>
                          Copy
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
