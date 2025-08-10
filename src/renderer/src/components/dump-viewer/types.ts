import { Dump, Server } from '../../App'

export interface DumpViewerProps {
  dumps: Dump[]
  servers: Server[]
  onOpenInIde: (file: string, line: number) => void
  viewMode?: 'detailed' | 'compact'
  viewerMode?: 'professional' | 'simple'
}

export interface DumpItemProps {
  dump: Dump
  server: Server | undefined
  onOpenInIde: (file: string, line: number) => void
  isExpanded: boolean
  onToggleExpand: () => void
  isNew?: boolean
  viewMode: 'detailed' | 'compact'
}

export interface DumpHeaderProps {
  dump: Dump
  server: Server | undefined
  onToggleExpand: () => void
  isExpanded: boolean
}

export interface DumpContentProps {
  dump: Dump
  onToggleExpand: () => void
  isExpanded: boolean
  fileLocation?: FileLocation
  onOpenInIde: (file: string, line: number) => void
  onCopy: (format: CopyFormat) => void
  copySuccess: CopyResult | null
}

export interface DumpPayloadProps {
  dump: Dump
  onCopy: (format: CopyFormat) => void
  copySuccess: CopyResult | null
  viewerMode?: 'professional' | 'simple'
}

export interface JsonViewerProps {
  value: any
  depth?: number
  expanded?: boolean
}

export interface CopyMenuProps {
  onCopy: (format: CopyFormat) => void
  copySuccess: CopyResult | null
  isOpen: boolean
  onToggle: () => void
}

export interface DumpToolbarProps {
  stats: DumpStats
  servers: Server[]
  autoScroll: boolean
  onToggleAutoScroll: () => void
  filteredCount: number
  totalCount: number
}

export interface EmptyStateProps {
  // No props needed for now
}

export interface FileLocation {
  file: string
  line: number
}

export interface DumpMetric {
  label: string
  value: string
  color: string
  icon: string
}

export interface DumpTypeInfo {
  icon: string
  type: string
  color: string
}

export interface DumpStats {
  total: number
  byServer: Record<string, number>
  byFlag: Record<string, number>
  byType: Record<string, number>
  recentActivity: number
}

export type CopyFormat = 'json' | 'array' | 'raw'

export interface CopyResult {
  type: CopyFormat
  success: boolean
}

export const FLAG_COLORS = {
  yellow: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800/50',
    dot: 'bg-amber-500',
    accent: 'border-l-amber-500'
  },
  red: {
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800/50',
    dot: 'bg-red-500',
    accent: 'border-l-red-500'
  },
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-800/50',
    dot: 'bg-blue-500',
    accent: 'border-l-blue-500'
  },
  gray: {
    bg: 'bg-gray-50 dark:bg-gray-950/30',
    border: 'border-gray-200 dark:border-gray-700/50',
    dot: 'bg-gray-500',
    accent: 'border-l-gray-500'
  },
  purple: {
    bg: 'bg-purple-50 dark:bg-purple-950/30',
    border: 'border-purple-200 dark:border-purple-800/50',
    dot: 'bg-purple-500',
    accent: 'border-l-purple-500'
  },
  pink: {
    bg: 'bg-pink-50 dark:bg-pink-950/30',
    border: 'border-pink-200 dark:border-pink-800/50',
    dot: 'bg-pink-500',
    accent: 'border-l-pink-500'
  },
  green: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-200 dark:border-emerald-800/50',
    dot: 'bg-emerald-500',
    accent: 'border-l-emerald-500'
  }
} as const

export const SERVER_COLORS = {
  blue: { bg: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-300', bgLight: 'bg-blue-100 dark:bg-blue-900/30' },
  red: { bg: 'bg-red-500', text: 'text-red-700 dark:text-red-300', bgLight: 'bg-red-100 dark:bg-red-900/30' },
  green: { bg: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300', bgLight: 'bg-emerald-100 dark:bg-emerald-900/30' },
  yellow: { bg: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300', bgLight: 'bg-amber-100 dark:bg-amber-900/30' },
  purple: { bg: 'bg-purple-500', text: 'text-purple-700 dark:text-purple-300', bgLight: 'bg-purple-100 dark:bg-purple-900/30' },
  pink: { bg: 'bg-pink-500', text: 'text-pink-700 dark:text-pink-300', bgLight: 'bg-pink-100 dark:bg-pink-900/30' },
  gray: { bg: 'bg-gray-500', text: 'text-gray-700 dark:text-gray-300', bgLight: 'bg-gray-100 dark:bg-gray-900/30' }
} as const
