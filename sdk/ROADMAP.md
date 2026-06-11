# Dumpio SDK / viewer — feature roadmap

Tracks the Ray-parity work beyond what's already shipped. Done items are listed
for context; the rest is prioritized by value/cost.

> Sequenced, task-sized execution lives in
> [`../PLAN-IMPLEMENTATION.md`](../PLAN-IMPLEMENTATION.md) (milestones M1–M7); this
> file is the feature-level catalogue. Detailed SDK rationale is in
> [`../PLAN-PHP-SDK-RAY-PARITY.md`](../PLAN-PHP-SDK-RAY-PARITY.md).

## Shipped

- **Serializer**: Eloquent model / Laravel Collection / `DateTimeInterface`-aware
  nodes (framework-agnostic, by class name).
- **Laravel auto-instrumentation** (opt-in env flags): queries, exceptions,
  `dd()`/`dump()` interception, model events, cache events, queue jobs, app events.
- **Symfony auto-instrumentation**: exceptions, Doctrine (DBAL 4) queries,
  Messenger lifecycle, `dump()`/`dd()` interception.
- **Fluent builder**: `dio($x)->red()->label()->channel()` (and `Dumpio::make()`);
  `dio()` returns the builder, `dumpio()` is the tap-style passthrough.
- **Conditional send**: `when($bool)` / `unless($bool)` (a failed gate drops the
  dump and doesn't count toward flood control).
- **Flood control**: `once()` / `limit(n)` / `count($name?)` (call-site keyed, or a
  named counter shared across call-sites; collapses to one live-updating `×N` entry
  via `dedupeKey`).
- **Stopwatch**: `Dumpio::stopwatch($name)` → `->lap()` / `->stop()` ship a
  `measure` dump with elapsed ms + memory delta.
- **Editor-clickable `file:line`**: caller + stack frames open VS Code / PhpStorm /
  WebStorm / IntelliJ / Cursor / Sublime / TextMate / Zed (Settings → Appearance).
  Main allowlists the editor URL schemes; renderer builds the deep-link.

## Planned

Each item is cross-referenced to its milestone in `PLAN-IMPLEMENTATION.md`.

### P0 — SDK ergonomics finish (low cost) → M1

- **Runtime `show*` toggles**: `Dumpio::showQueries()/stopShowingQueries()` (+
  events/cache/jobs/httpClient) flip the existing auto-instrumentation listeners at
  runtime, not just via boot-time config flags. Extract the listener registration
  behind a guard flag the listeners read.
- **Snapshots**: `Dumpio::trace()` (full backtrace as its own entry) and
  `Dumpio::memory()` (current/peak).

### P1 — Outbound HTTP client logging (medium cost, high value) → M2

"What did this request call out to?" Currently only inbound query/exception are
captured.

- **Laravel**: register a Guzzle middleware on the `Http` facade
  (`Http::globalMiddleware(...)` in L11+) → `Dumpio::http(...)` per request, with
  status/timing. Gate behind `listen_http_client`.
- **Symfony**: decorate `HttpClientInterface` (a `TraceableHttpClient`-style
  wrapper, or a DI decorator) → `Dumpio::http(...)`.
- Reuse the existing `http` dump type + status→flag mapping.

### P1b — Monolog handler (low cost, high value) → M2

A `DumpioHandler` (opt-in `dumpio` log channel) streams all app logs into the
viewer as `log` dumps. Doubles as the in-process source for the log-viewer mode
(P6). Level → flag mapping; never throws into the logging pipeline.

### P2 — Screens / clear (low–medium cost) → M3

Organize dumps into sessions (Ray's `newScreen()` / `clearScreen()`).

- Add **control messages** to the ingest pipeline: a payload `{ "__control":
  "newScreen" | "clear", "label"?: string }` handled in `ingest-manager` /
  `index.ts` rather than stored as a dump.
- SDK: `Dumpio::newScreen($label)`, `Dumpio::clearScreen()`.
- Renderer: a screen separator row in the list; "clear" empties the current
  screen. Natural fit per HTTP request or per PHPUnit/Pest test.

### P3 — Laravel views + mail + HTML previews → M2 (events) / M4 (preview)

Round out the Laravel listeners (Ray parity) and add live HTML preview:

- `view()->composer('*', …)` or the `composing:` events → `event` dumps (channel
  `views`) with view name + bound data keys.
- `MessageSending` / `MessageSent` mail events → `event` dumps (channel `mail`),
  flag `listen_mail` — the cheap part, ships in **M2**.
- **HTML / email / page previews** (the flagship — **M4**): new `html` / `mail`
  dump types + `Dumpio::html()` / `Dumpio::mailable()` + optional mail
  auto-intercept, rendered in a **sandboxed `<iframe>`** (no scripts/same-origin,
  remote resources blocked by default). Build SDK + renderer as one vertical slice.
  Full spec in `PLAN-PHP-SDK-RAY-PARITY.md` §5a.

### P3b — Request correlation & grouping (high value) → M5

Stamp every dump in a request with a shared `origin` (request id / url / user) via
a Laravel middleware / Symfony subscriber, so the viewer collapses them into one
request unit instead of a flat stream. Unlocks **N+1 detection** and **request
waterfall**. Biggest usefulness jump short of the back-channel; no two-way needed.

### P3c — Light profiler + log-viewer modes → M6

Builds on P1b (Monolog) and P3b (correlation). Span/signal-level profiler (NOT
function-level — that needs Xdebug/SPX): a per-request `profile` aggregate dump +
a viewer timeline/waterfall mode. Log-viewer mode (Monolog stream + a CLI file-tail
agent for non-Monolog logs). Bulk of the work is in the viewer.

### P4 — pause() + update-in-place (high cost — needs a back-channel) → M7

Ray's signature features. Both require the viewer to talk **back** to the app,
which today's one-way fire-and-forget transport can't do.

- Add a control socket / long-poll endpoint the SDK can block on. `pause()` sends
  a dump, then waits for a "continue" from the viewer (Continue button).
- `update()` / `remove()`: dumps return a server-assigned id; subsequent control
  messages mutate that entry. (The `dedupeKey` collapse already prototypes the
  viewer-side of in-place updates — generalize it to explicit ids.)
- Biggest architectural lift; schedule last.

### P5 — Richer payload types (incremental) → M4 onward

`image`, `markdown`, `json`/`xml` pretty, `notify`, `phpinfo`, plus the display
modifiers `->size()` / `->hide()` / `->expand()`. Each is a new dump `type` (or
envelope hint) + a small renderer view. Add on demand. (`html` / `mailable` are
promoted to P3 / M4.)

---

## Livewire 3 & 4 support → parallel track (after M2)

Independent of the milestone chain; can slot in any time after M2.

Livewire AJAX round-trips already flow through the HTTP kernel, so query /
exception / `dd()` instrumentation **partially** covers them. The Livewire-specific
value is **component lifecycle, property diffs, and actions** — which need a
Livewire hook, not HTTP interception.

### Livewire 3

Livewire 3's supported extension point is a **`ComponentHook`** registered with
`Livewire::componentHook(...)`. A single hook covers the whole lifecycle:

```php
// src/Laravel/Livewire/DumpioLivewireHook.php
use Livewire\ComponentHook;

final class DumpioLivewireHook extends ComponentHook
{
    public function mount($params)      { Dumpio::event('livewire.mount',  ['data' => ['component' => $this->component->getName(), 'params' => array_keys($params)], 'channel' => 'livewire', 'flag' => 'blue']); }
    public function call($method, $params, $returnEarly) { Dumpio::event('livewire.action', ['data' => ['component' => $this->component->getName(), 'method' => $method, 'params' => $params], 'channel' => 'livewire']); }
    public function update($property, $fullPath, $newValue) { Dumpio::event('livewire.update', ['data' => ['property' => $fullPath, 'value' => $newValue], 'channel' => 'livewire', 'flag' => 'yellow']); }
    public function dehydrate($context) { /* optional: snapshot $this->component->all() as a model/var dump */ }
    public function exception($e, $stopPropagation) { Dumpio::exception($e, [], ['framework' => 'laravel']); }
    public function render($view, $data) { Dumpio::event('livewire.render', ['data' => ['component' => $this->component->getName(), 'view' => $view->name()], 'channel' => 'livewire']); }
}
```

Register in `DumpioServiceProvider::boot()`, guarded:

```php
if (!empty($config['listen_livewire']) && class_exists(\Livewire\Livewire::class)) {
    \Livewire\Livewire::componentHook(DumpioLivewireHook::class);
}
```

Add `listen_livewire` (`DUMPIO_LISTEN_LIVEWIRE`) to `config/dumpio.php`. Channel
`livewire`, flags: mount/action blue, update yellow, exception red.

### Livewire 4

Livewire 4 keeps the component-hook concept but ships a **new compiler and
single-file / island components**, and some namespaces/registration entry points
move. Plan:

1. **Detect version** rather than assume: branch on
   `class_exists(\Livewire\Livewire::class)` + a v4 marker (e.g. the new compiler
   class) and pick the matching registration call.
2. Keep the hook's *body* identical (it only calls `Dumpio::*`); isolate the
   v3-vs-v4 differences to the **registration** and the hook base class import.
3. New in v4 to consider forwarding: **island** render boundaries and the new
   action/`@js` paths — emit `livewire.island` events so partial re-renders are
   visible.
4. Verify the hook method signatures against the v4 `ComponentHook` (Livewire 4 is
   still stabilizing — pin the supported version range in `composer.json` once
   confirmed, like the DBAL 4 gate we use for Doctrine).

Because the hook only depends on `Dumpio::*` (never throws into the host),
supporting both is mostly a thin compatibility shim around registration — the
forwarding logic is shared.
