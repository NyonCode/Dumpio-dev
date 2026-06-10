import { type JSX } from 'react'
import { Inbox } from 'lucide-react'

const STEPS = [
  'Configure a server in Settings (HTTP on localhost:21234 by default).',
  'Send JSON to it — POST /dumps over HTTP, or raw JSON over TCP.',
  'Add a "flag" to categorize a dump.'
]

export function EmptyState(): JSX.Element {
  return (
    <div className="flex flex-1 items-center justify-center bg-surface px-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-elevated text-subtle">
          <Inbox className="h-7 w-7" />
        </div>

        <h3 className="mb-1.5 text-lg font-semibold text-fg">No dumps yet</h3>
        <p className="mb-6 text-sm leading-relaxed text-muted">
          Send data to a configured server and it will appear here in real time.
        </p>

        <div className="rounded-lg border border-line bg-panel p-4 text-left">
          <ol className="space-y-2.5">
            {STEPS.map((step, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-muted">
                <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-accent/10 text-[11px] font-semibold text-accent">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>

          <code className="mt-3 block rounded-md bg-sunken px-2.5 py-1.5 font-mono text-[11px] text-muted">
            {`{ "message": "Hello", "flag": "red" }`}
          </code>
        </div>
      </div>
    </div>
  )
}
