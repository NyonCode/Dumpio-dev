import { EmptyStateProps } from './types'

export function EmptyState({}: EmptyStateProps) {
  return (
    <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-900">
      <div className="text-center max-w-lg">
        {/* Empty State Icon */}
        <div className="mx-auto h-32 w-32 text-slate-300 dark:text-slate-600 mb-8">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={0.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>

        <h3 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-3">
          No dumps yet
        </h3>
        <p className="text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
          Start your TCP servers and begin sending data to see dumps appear here.
          <br />
          Configure your servers in Settings to get started.
        </p>

        {/* Getting Started Card */}
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-xl p-6 text-left">
          <div className="flex items-center mb-4">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center mr-3">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h4 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
              Getting Started
            </h4>
          </div>

          <div className="space-y-3 text-sm text-blue-800 dark:text-blue-200">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-blue-700 dark:text-blue-300 text-xs font-bold">1</span>
              </div>
              <p>Configure your TCP servers in the Settings panel</p>
            </div>

            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-blue-700 dark:text-blue-300 text-xs font-bold">2</span>
              </div>
              <p>Send JSON data to the configured host:port</p>
            </div>

            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-blue-700 dark:text-blue-300 text-xs font-bold">3</span>
              </div>
              <div>
                <p>Use flags to categorize your dumps:</p>
                <code className="bg-blue-100 dark:bg-blue-900/50 px-2 py-1 rounded text-xs mt-1 inline-block">
                  {`{ "message": "Hello", "flag": "red" }`}
                </code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
