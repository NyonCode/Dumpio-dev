# Dumpio SDK / viewer — feature roadmap

Tracks the Ray-parity work beyond what's already shipped. Done items are listed
for context; the rest is prioritized by value/cost.

## Shipped

- **Serializer**: Eloquent model / Laravel Collection / `DateTimeInterface`-aware
  nodes (framework-agnostic, by class name).
- **Laravel auto-instrumentation** (opt-in env flags): queries, exceptions,
  `dd()`/`dump()` interception, model events, cache events, queue jobs, app events.
- **Symfony auto-instrumentation**: exceptions, Doctrine (DBAL 4) queries,
  Messenger lifecycle, `dump()`/`dd()` interception.
- **Fluent builder**: `Dumpio::make($x)->red()->label()->channel()->send()`.
- **Flood control**: `once()` / `limit(n)` / `count()` (call-site keyed; `count()`
  collapses to one live-updating, `×N` entry in the viewer via `dedupeKey`).
- **Editor-clickable `file:line`**: caller + stack frames open VS Code / PhpStorm /
  WebStorm / IntelliJ / Cursor / Sublime / TextMate / Zed (Settings → Appearance).
  Main allowlists the editor URL schemes; renderer builds the deep-link.

## Planned

### P1 — Outbound HTTP client logging (medium cost, high value)

"What did this request call out to?" Currently only inbound query/exception are
captured.

- **Laravel**: register a Guzzle middleware on the `Http` facade
  (`Http::globalMiddleware(...)` in L11+) → `Dumpio::http(...)` per request, with
  status/timing. Gate behind `listen_http_client`.
- **Symfony**: decorate `HttpClientInterface` (a `TraceableHttpClient`-style
  wrapper, or a DI decorator) → `Dumpio::http(...)`.
- Reuse the existing `http` dump type + status→flag mapping.

### P2 — Screens / clear (low–medium cost)

Organize dumps into sessions (Ray's `newScreen()` / `clearScreen()`).

- Add **control messages** to the ingest pipeline: a payload `{ "__control":
  "newScreen" | "clear", "label"?: string }` handled in `ingest-manager` /
  `index.ts` rather than stored as a dump.
- SDK: `Dumpio::newScreen($label)`, `Dumpio::clearScreen()`.
- Renderer: a screen separator row in the list; "clear" empties the current
  screen. Natural fit per HTTP request or per PHPUnit/Pest test.

### P3 — Laravel views + mail (low cost)

Round out the Laravel listeners (Ray parity):

- `view()->composer('*', …)` or the `composing:` events → `event` dumps (channel
  `views`) with view name + bound data keys.
- `MessageSending` / `MessageSent` mail events → `event`/`model` dumps (channel
  `mail`), optionally rendering the mailable.

### P4 — pause() + update-in-place (high cost — needs a back-channel)

Ray's signature features. Both require the viewer to talk **back** to the app,
which today's one-way fire-and-forget transport can't do.

- Add a control socket / long-poll endpoint the SDK can block on. `pause()` sends
  a dump, then waits for a "continue" from the viewer (Continue button).
- `update()` / `remove()`: dumps return a server-assigned id; subsequent control
  messages mutate that entry. (The `dedupeKey` collapse already prototypes the
  viewer-side of in-place updates — generalize it to explicit ids.)
- Biggest architectural lift; schedule last.

### P5 — Richer payload types (incremental)

`image`, `html`, `markdown`, `json`/`xml` pretty, `mailable`, `phpinfo`. Each is
a new dump `type` + a small renderer view. Add on demand.

---

## Livewire 3 & 4 support

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
