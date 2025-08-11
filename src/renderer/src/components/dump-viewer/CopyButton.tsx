import { JSX } from 'react'

interface CopyButtonProps {
  onCopy: () => void
  copySuccess: boolean
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function CopyButton({
  onCopy,
  copySuccess,
  className = '',
  size = 'md'
}: CopyButtonProps): JSX.Element {
  const sizeClasses = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-3'
  }

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onCopy()
      }}
      className={`${sizeClasses[size]} rounded-lg transition-colors ${
        copySuccess
          ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20'
          : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
      } ${className}`}
      title="Copy JSON"
    >
      {copySuccess ? (
        <svg className={iconSizes[size]} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className={iconSizes[size]} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      )}
    </button>
  )
}

export function CopyButtonExpanded({
  onCopy,
  copySuccess
}: {
  onCopy: () => void
  copySuccess: boolean
}): JSX.Element {
  return (
    <button
      onClick={onCopy}
      className={`inline-flex items-center px-4 py-2 border text-sm font-medium rounded-lg transition-all ${
        copySuccess
          ? 'border-emerald-300 dark:border-emerald-600 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20'
          : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600'
      }`}
    >
      {copySuccess ? (
        <>
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          Copy JSON
        </>
      )}
    </button>
  )
}
