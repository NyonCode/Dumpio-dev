import type { ReactElement } from 'react'

interface IconProps {
  className?: string
}

export const SqlIcon = ({ className = 'w-5 h-5' }: IconProps): ReactElement => (
  <svg className={`${className} text-blue-500`} fill="currentColor" viewBox="0 0 20 20">
    <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
  </svg>
)

export const ErrorIcon = ({ className = 'w-5 h-5' }: IconProps): ReactElement => (
  <svg className={`${className} text-red-500`} fill="currentColor" viewBox="0 0 20 20">
    <path
      fillRule="evenodd"
      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
      clipRule="evenodd"
    />
  </svg>
)

export const LogIcon = ({ className = 'w-5 h-5' }: IconProps): ReactElement => (
  <svg className={`${className} text-amber-500`} fill="currentColor" viewBox="0 0 20 20">
    <path
      fillRule="evenodd"
      d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
      clipRule="evenodd"
    />
  </svg>
)

export const HttpIcon = ({ className = 'w-5 h-5' }: IconProps): ReactElement => (
  <svg className={`${className} text-purple-500`} fill="currentColor" viewBox="0 0 20 20">
    <path
      fillRule="evenodd"
      d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
      clipRule="evenodd"
    />
  </svg>
)

export const DataIcon = ({ className = 'w-5 h-5' }: IconProps): ReactElement => (
  <svg className={`${className} text-slate-500`} fill="currentColor" viewBox="0 0 20 20">
    <path
      fillRule="evenodd"
      d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
      clipRule="evenodd"
    />
  </svg>
)

export const VarIcon = ({ className = 'w-5 h-5' }: IconProps): ReactElement => (
  <svg className={`${className} text-teal-500`} fill="currentColor" viewBox="0 0 20 20">
    <path
      fillRule="evenodd"
      d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm2.293 4.293a1 1 0 011.414 0l2 2a1 1 0 010 1.414l-2 2a1 1 0 01-1.414-1.414L7.586 10 6.293 8.707a1 1 0 010-1.414zM11 12a1 1 0 100 2h3a1 1 0 100-2h-3z"
      clipRule="evenodd"
    />
  </svg>
)

export const EventIcon = ({ className = 'w-5 h-5' }: IconProps): ReactElement => (
  <svg className={`${className} text-emerald-500`} fill="currentColor" viewBox="0 0 20 20">
    <path
      fillRule="evenodd"
      d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
      clipRule="evenodd"
    />
  </svg>
)

export const ModelIcon = ({ className = 'w-5 h-5' }: IconProps): ReactElement => (
  <svg className={`${className} text-indigo-500`} fill="currentColor" viewBox="0 0 20 20">
    <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" />
    <path
      fillRule="evenodd"
      d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm3 3a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1z"
      clipRule="evenodd"
    />
  </svg>
)

export const CollectionIcon = ({ className = 'w-5 h-5' }: IconProps): ReactElement => (
  <svg className={`${className} text-violet-500`} fill="currentColor" viewBox="0 0 20 20">
    <path d="M2 6a2 2 0 012-2h12a2 2 0 012 2v1H2V6z" />
    <path
      fillRule="evenodd"
      d="M2 9h16v5a2 2 0 01-2 2H4a2 2 0 01-2-2V9zm3 2a1 1 0 100 2h10a1 1 0 100-2H5z"
      clipRule="evenodd"
    />
  </svg>
)

export const TableIcon = ({ className = 'w-5 h-5' }: IconProps): ReactElement => (
  <svg className={`${className} text-sky-500`} fill="currentColor" viewBox="0 0 20 20">
    <path
      fillRule="evenodd"
      d="M3 3a1 1 0 00-1 1v12a1 1 0 001 1h14a1 1 0 001-1V4a1 1 0 00-1-1H3zm1 4V5h5v2H4zm7 0V5h5v2h-5zm-7 2h5v2H4V9zm7 0h5v2h-5V9zm-7 4h5v2H4v-2zm7 0h5v2h-5v-2z"
      clipRule="evenodd"
    />
  </svg>
)

export const ClockIcon = ({ className = 'w-3 h-3' }: IconProps): ReactElement => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path
      fillRule="evenodd"
      d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
      clipRule="evenodd"
    />
  </svg>
)

export const HashIcon = ({ className = 'w-3 h-3' }: IconProps): ReactElement => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path
      fillRule="evenodd"
      d="M9.243 3.03a1 1 0 01.727 1.213L9.53 6h2.94l.56-2.243a1 1 0 111.94.486L14.47 6H17a1 1 0 110 2h-3.53l-.5 2H16a1 1 0 110 2h-3.53l-.56 2.242a1 1 0 11-1.94-.485L10.47 12H7.53l-.56 2.242a1 1 0 11-1.94-.485L5.53 12H3a1 1 0 110-2h3.53l.5-2H4a1 1 0 110-2h3.53l.56-2.243a1 1 0 011.213-.727zM9.03 8l-.5 2h2.94l.5-2H9.03z"
      clipRule="evenodd"
    />
  </svg>
)

export const CheckIcon = ({ className = 'w-3 h-3' }: IconProps): ReactElement => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path
      fillRule="evenodd"
      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
      clipRule="evenodd"
    />
  </svg>
)

export const CpuIcon = ({ className = 'w-3 h-3' }: IconProps): ReactElement => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path d="M13 7H7v6h6V7z" />
    <path
      fillRule="evenodd"
      d="M7 2a1 1 0 012 0v1h2V2a1 1 0 112 0v1h2a2 2 0 012 2v2h1a1 1 0 110 2h-1v2h1a1 1 0 110 2h-1v2a2 2 0 01-2 2h-2v1a1 1 0 11-2 0v-1H9v1a1 1 0 11-2 0v-1H5a2 2 0 01-2-2v-2H2a1 1 0 110-2h1V9H2a1 1 0 010-2h1V5a2 2 0 012-2h2V2zM5 5h10v10H5V5z"
      clipRule="evenodd"
    />
  </svg>
)

export const DatabaseIcon = ({ className = 'w-3 h-3' }: IconProps): ReactElement => (
  <svg className={className} fill="currentColor" viewBox="0 0 20 20">
    <path d="M3 12v3c0 1.657 3.134 3 7 3s7-1.343 7-3v-3c0 1.657-3.134 3-7 3s-7-1.343-7-3z" />
    <path d="M3 7v3c0 1.657 3.134 3 7 3s7-1.343 7-3V7c0 1.657-3.134 3-7 3S3 8.657 3 7z" />
    <path d="M17 5c0 1.657-3.134 3-7 3S3 6.657 3 5s3.134-3 7-3 7 1.343 7 3z" />
  </svg>
)

// Helper function to get icon component by name
// eslint-disable-next-line react-refresh/only-export-components
export function getIconComponent(iconName: string, className?: string): ReactElement {
  const icons = {
    sql: SqlIcon,
    error: ErrorIcon,
    log: LogIcon,
    http: HttpIcon,
    data: DataIcon,
    var: VarIcon,
    event: EventIcon,
    model: ModelIcon,
    collection: CollectionIcon,
    table: TableIcon,
    clock: ClockIcon,
    hash: HashIcon,
    check: CheckIcon,
    cpu: CpuIcon,
    database: DatabaseIcon
  }

  const IconComponent = icons[iconName as keyof typeof icons] || DataIcon
  return <IconComponent className={className} />
}
