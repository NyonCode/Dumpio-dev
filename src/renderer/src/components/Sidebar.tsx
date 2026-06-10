import { type JSX } from 'react'
import { Radio, Settings, Check } from 'lucide-react'
import { Server } from '../App'
import { serverDot } from '../lib/colors'

interface SidebarProps {
  servers: Server[]
  selectedServerId: string
  onServerSelect: (serverId: string) => void
  selectedFlags: string[]
  onFlagsChange: (flags: string[]) => void
  onSettingsClick: () => void
  serverCounts: Record<string, number>
  flagCounts: Record<string, number>
  channels: string[]
  channelCounts: Record<string, number>
  selectedChannel: string
  onChannelSelect: (channel: string) => void
  totalCount: number
}

const FLAG_DOT: Record<string, string> = {
  red: 'bg-dump-red',
  yellow: 'bg-dump-yellow',
  blue: 'bg-dump-blue',
  green: 'bg-dump-green',
  purple: 'bg-dump-purple',
  pink: 'bg-dump-pink',
  gray: 'bg-dump-gray'
}

// Shared row chrome: selected rows get a faint accent wash + accent text,
// everything else is muted text that lifts to an elevated surface on hover.
function rowClass(active: boolean): string {
  return active ? 'bg-accent/10 text-accent' : 'text-muted hover:bg-elevated hover:text-fg'
}

function SectionLabel({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <h3 className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-subtle">
      {children}
    </h3>
  )
}

export function Sidebar({
  servers,
  selectedServerId,
  onServerSelect,
  selectedFlags,
  onFlagsChange,
  onSettingsClick,
  serverCounts,
  flagCounts,
  channels,
  channelCounts,
  selectedChannel,
  onChannelSelect,
  totalCount
}: SidebarProps): JSX.Element {
  const toggleFlag = (flag: string): void => {
    onFlagsChange(
      selectedFlags.includes(flag)
        ? selectedFlags.filter((f) => f !== flag)
        : [...selectedFlags, flag]
    )
  }

  return (
    <div className="flex w-60 flex-col border-r border-line bg-panel">
      {/* Brand */}
      <div className="flex h-12 flex-shrink-0 items-center gap-2.5 border-b border-line px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-white">
          <Radio className="h-4 w-4" />
        </div>
        <div className="leading-none">
          <h1 className="text-sm font-semibold text-fg">Dumpio</h1>
          <span className="text-[10px] text-subtle">v{__APP_VERSION__}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-3">
        {/* Servers */}
        <div className="px-2">
          <SectionLabel>Servers</SectionLabel>

          <button
            onClick={() => onServerSelect('all')}
            className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${rowClass(
              selectedServerId === 'all'
            )}`}
          >
            <span className="h-2 w-2 flex-shrink-0 rounded-full bg-subtle" />
            <span className="flex-1 truncate">All Servers</span>
            <span className="text-xs tabular-nums text-subtle">{totalCount}</span>
          </button>

          {servers.map((server) => (
            <button
              key={server.id}
              onClick={() => onServerSelect(server.id)}
              className={`mt-0.5 flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors ${rowClass(
                selectedServerId === server.id
              )}`}
            >
              <span
                className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${serverDot(server.color)}`}
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium">{server.name}</span>
                  <span
                    className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                      server.active ? 'animate-pulse bg-emerald-500' : 'bg-subtle/50'
                    }`}
                    title={server.active ? 'Active' : 'Inactive'}
                  />
                </span>
                <span className="block truncate text-[11px] text-subtle">
                  <span className="uppercase">{server.protocol}</span> · {server.host}:{server.port}
                </span>
              </span>
              <span className="text-xs tabular-nums text-subtle">
                {serverCounts[server.id] ?? 0}
              </span>
            </button>
          ))}

          {servers.length === 0 && (
            <div className="px-2 py-3 text-sm text-subtle">No servers configured</div>
          )}
        </div>

        {/* Flag filters */}
        <div className="mt-4 px-2">
          <SectionLabel>Filter by flag</SectionLabel>

          {Object.entries(FLAG_DOT).map(([flag, dot]) => {
            const active = selectedFlags.includes(flag)
            return (
              <button
                key={flag}
                aria-pressed={active}
                onClick={() => toggleFlag(flag)}
                className={`mt-0.5 flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm capitalize transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${
                  active ? 'bg-elevated text-fg' : 'text-muted hover:bg-elevated hover:text-fg'
                }`}
              >
                <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${dot}`} />
                <span className="flex-1">{flag}</span>
                <span className="text-xs tabular-nums text-subtle">{flagCounts[flag] ?? 0}</span>
                {active && <Check className="h-3.5 w-3.5 text-accent" />}
              </button>
            )
          })}

          {selectedFlags.length > 0 && (
            <button
              onClick={() => onFlagsChange([])}
              className="mt-2 w-full rounded-md border border-line px-2 py-1.5 text-xs text-muted transition-colors hover:bg-elevated hover:text-fg"
            >
              Clear flag filters
            </button>
          )}
        </div>

        {/* Channels */}
        {channels.length > 0 && (
          <div className="mt-4 px-2">
            <SectionLabel>Channels</SectionLabel>

            <button
              onClick={() => onChannelSelect('all')}
              className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${rowClass(
                selectedChannel === 'all'
              )}`}
            >
              <span className="flex-1 truncate">All Channels</span>
              <span className="text-xs tabular-nums text-subtle">{totalCount}</span>
            </button>

            {channels.map((channel) => (
              <button
                key={channel}
                onClick={() => onChannelSelect(channel)}
                className={`mt-0.5 flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${rowClass(
                  selectedChannel === channel
                )}`}
              >
                <span className="flex-1 truncate font-mono text-[13px]">#{channel}</span>
                <span className="text-xs tabular-nums text-subtle">
                  {channelCounts[channel] ?? 0}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Settings */}
      <div className="flex-shrink-0 border-t border-line p-2">
        <button
          onClick={onSettingsClick}
          className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-muted transition-colors hover:bg-elevated hover:text-fg"
        >
          <Settings className="h-4 w-4" />
          <span>Settings</span>
        </button>
      </div>
    </div>
  )
}
