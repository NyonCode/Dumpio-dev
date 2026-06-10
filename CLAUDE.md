# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Dumpio is an Electron desktop app (React 19 + TypeScript + Tailwind) that runs one or more
local TCP servers, receives JSON "dumps" from instrumented applications (Laravel, Node, Python,
Go, etc.), and displays them in real time with exception parsing, flag/color categorization, and
filtering. Think of it as a network-based `dd()`/debug-dump receiver.

## Commands

```bash
npm run dev            # Run app in development (electron-vite, hot reload)
npm run build          # Typecheck both projects + electron-vite build
npm run typecheck      # typecheck:node (main/preload) + typecheck:web (renderer)
npm run lint           # ESLint with cache
npm run verify         # typecheck + lint
npm run verify:main    # typecheck:node + lint:main
npm run verify:renderer# typecheck:web + lint:renderer
npm run format         # Prettier write
npm run build:mac      # Package .dmg (also :win .exe, :linux AppImage)
npm run dist           # build + electron-builder for current platform
```

There is **no test runner**. `tests/*.js` are standalone manual TCP client scripts you run with
`node tests/<file>.js` against a running app to send sample dumps (exceptions, multi-framework
context). Use them to exercise the receive/parse/render path; they are not unit tests.

Quick manual smoke test (with the app running): `echo '{"message":"hi","flag":"green"}' | nc localhost 21234`

## Claude working style

Prefer **small, isolated tasks**. Do not mix renderer redesign, main-process ingest changes, and SDK work in one pass.

Recommended work units:

- renderer shell only: `App.tsx`, `Header.tsx`, `Sidebar.tsx`, `index.css`
- viewer layout only: `EnhancedDumpViewer.tsx`, `DumpList.tsx`, `DumpDetail.tsx`
- heavy detail only: `exceptionParser.ts`, `ExceptionDumpItem.tsx`
- main/preload/settings only: `src/main/*`, `src/preload/*`
- one SDK language per task

Verification discipline:

- renderer-only task → run `npm run verify:renderer`
- main/preload/settings task → run `npm run verify:main`
- cross-layer task → run `npm run verify`
- only run `npm run build` when a task changes packaging, app bootstrap, or multiple layers

Token hygiene:

- do not reopen `PLAN*.md` or `README.md` unless the task needs product context
- do not read `dist-electron/` or `release/`
- do not open `exceptionParser.ts` unless the task directly touches exception parsing
- start from `rg` on exact symbols/files instead of broad repository reads
- keep edits scoped to the files needed for the current contract path

Task template:

```md
Goal: one concrete outcome
Files: exact files only
Constraints: keep IPC/settings contracts coherent on the touched path
Verify: one of verify:main / verify:renderer / verify
Done when: 3-5 explicit conditions
```

## Architecture

Three Electron layers, each in its own TypeScript project (separate tsconfigs, no shared compile):

- **Main** (`src/main/`, tsconfig.node.json) — Node process. Owns all ingest transports (HTTP + TCP), persistence, settings, security policy.
- **Preload** (`src/preload/index.ts`) — exposes a hand-written `window.api` bridge over `ipcRenderer.invoke`/`on`. The renderer never touches Node/IPC directly.
- **Renderer** (`src/renderer/src/`, tsconfig.web.json) — React UI. Alias `@renderer` → `src/renderer/src`.

### Data flow (the core loop)

1. `MainApplication` (`src/main/index.ts`) is the orchestrator: instantiated once at the bottom of the file. It holds the `IngestManager`, the `SettingsManager`, and the `DumpManager`, plus a cached `SecurityOptions` snapshot refreshed on settings save.
2. `IngestManager` (`ingest/ingest-manager.ts`) owns a `Map<serverId, Transport>` and is the single place where policy (loopback enforcement, normalization, limits, port-collision checks) lives. Each active server gets an `HttpTransport` or `TcpTransport` (`ingest/transports/`) depending on `server.protocol`. Both are `EventEmitter`s that emit a `dump` (`RawDump`) event. The TCP transport buffers incoming bytes **per connection** and extracts complete JSON objects by brace-counting (string/escape aware), so pretty-printed multi-line JSON works; unparseable input becomes a `raw` dump with a red flag rather than being dropped. Non-loopback binds are refused unless `security.allowRemote` is set.
3. On a transport `dump` event, `IngestManager` runs `normalizeDump` (`ingest/normalize.ts`) into a `Dump` (id/serverId/timestamp/flag/channel, with limits applied), then calls back into `index.ts`, which stores it via `DumpManager.addDump` and pushes it to the renderer with `webContents.send('dump-received', dump)`.
4. The renderer's `App.tsx` subscribes via `window.api.onDumpReceived` and prepends to React state, capped at `maxDumpsInMemory`. Filtering (server/flag/search) happens client-side in `App.tsx`.

### Persistence

- `SettingsManager` → `settings.json` in Electron `userData`. Reads merge over `defaultSettings`, so adding a new setting field requires updating that default.
- `DumpManager` → `dumps.json` in `userData`. Keeps dumps newest-first, trims to `maxDumps`. Auto-save (every 5s, `index.ts`'s `setupAutoSave`) and save-on-exit are gated by settings.
- Server lifecycle is reconciled in `IngestManager.sync(oldActive, newActive)`: on settings save `index.ts` diffs the old vs new active server lists and the manager starts/stops/restarts transports accordingly (a host/port/protocol change triggers a restart with a short delay to release the port).

### Type definitions are intentionally NOT shared

The `Dump`, `Server`, and `Settings` shapes are **redefined independently** in `src/main/index.ts`,
`src/main/dump-manager.ts`, `src/main/settings-manager.ts`, and `src/renderer/src/App.tsx` because
the three TS projects don't share a compile. `src/main/types.ts` defines a richer, more "designed"
set of interfaces (`DumpEntry`, `AppSettings`, `ElectronAPI`) that is **largely aspirational and not
the runtime contract** — the live wire/IPC shapes are the ad-hoc interfaces in the files above. When
changing a dump or settings field, update every copy that participates in the path you touch
(main wrap → preload passthrough → renderer consume), not just `types.ts`.

### Exception parsing

`src/renderer/src/utils/exceptionParser.ts` (~900 lines) is the heavy renderer-side logic: it
normalizes stack traces across frameworks (PHP/Laravel, Node, Python/Django, Go) into `StackFrame[]`,
extracts request/user/db/environment `ExceptionContext`, and produces solution suggestions with
probabilities. The dump-viewer components under `src/renderer/src/components/dump-viewer/` render the
result. `App.tsx` only does a crude `exception` vs `dataPacket` count for header stats; the real
classification lives in this parser and the viewer.

## Conventions

- IPC contract is manual and string-keyed: an `ipcMain.handle('x', …)` in `index.ts` must have a matching `ipcRenderer.invoke('x', …)` wrapper in `preload/index.ts`. Add both sides.
- Default server is HTTP-first on `localhost:21234` (`protocol: 'http'`), created on first run if none configured. HTTP ingest accepts `POST /dumps`; TCP ingest accepts raw JSON.
- Color flags are a fixed set: `red | yellow | blue | gray | purple | pink | green` (default `gray`).
- Some comments and a few field notes are in Czech (e.g. `// OPRAVA:` = "FIX:"); keep or translate as you prefer but don't treat them as TODO markers.
- `dist-electron/` and `release/` are build output — never edit by hand.
