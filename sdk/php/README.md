# dumpio/client (PHP)

Send faithful, typed value dumps **and** structured debug messages (exceptions,
SQL queries, HTTP calls, logs, models, …) to the [Dumpio](../../README.md)
viewer. HTTP-first, fire-and-forget, **never breaks the host app** — every call
swallows its own errors and silently drops if the viewer isn't running.

Built to the authoritative client contract in [`../BUILDING.md`](../BUILDING.md).

## Install

```bash
composer require dumpio/client
```

Configuration is read from the environment, or override it at runtime:

| Option  | Env var          | Default     |
| ------- | ---------------- | ----------- |
| host    | `DUMPIO_HOST`    | `localhost` |
| port    | `DUMPIO_PORT`    | `21234`     |
| token   | `DUMPIO_TOKEN`   | `""`        |
| enabled | `DUMPIO_DISABLE` (set ⇒ off) | `true` |

```php
use Dumpio\Dumpio;

Dumpio::configure(['host' => 'localhost', 'port' => 21234, 'token' => 'secret']);
```

## The basics — `var` dumps

```php
dumpio($user, 'user', 'blue'); // global helper, returns $user (chainable, like tap())
ddio($a, $b);                  // dump every arg, then die
// or: Dumpio::dump($user, 'user'); Dumpio::dd($a, $b);
```

The `var` serializer uses Reflection, so **member visibility**
(public/protected/private), class names, typed/uninitialized properties and
**enums** are preserved. It breaks cycles via `ref` nodes and bounds
depth/items/string length. The calling `file:line` is captured automatically.

It also recognises a few common shapes and renders their **logical** value
instead of raw internals: `DateTimeInterface` becomes a formatted date, an
**Eloquent model** becomes its casted/visible attributes (via
`attributesToArray()`), and a **Laravel `Collection`** becomes its items. These
checks are by class name, so the core stays framework-agnostic and they are
inert when Laravel is absent.

### Fluent builder & flood control

`Dumpio::make()` returns a chainable builder. The dump ships on `->send()` or
automatically when the builder goes out of scope, so `->send()` is optional:

```php
Dumpio::make($user)->red()->label('user')->channel('auth')->send();
Dumpio::make($payload)->purple();   // auto-sends at end of statement
```

Colors: `red() yellow() blue() gray() purple() pink() green()` (or `flag('…')`),
plus `label()` and `channel()`.

Three helpers keep loops from flooding the viewer (keyed by call-site `file:line`,
per process):

```php
foreach ($rows as $row) {
    Dumpio::make($row)->once();      // only the first iteration is sent
    Dumpio::make($row)->limit(5);    // at most 5 are sent
    Dumpio::make($row)->count();     // one live-updating entry, "×N" in the viewer
}
```

### Chainable macros (Laravel)

On Laravel, `->dio()` and `->ddio()` are registered as macros on query builders
and collections, so you can drop a dump **mid-chain** without breaking it — it
ships the current state and returns `$this`:

```php
User::query()
    ->where('name', 'John')
    ->dio()                              // → query dump (SQL + bindings so far)
    ->whereDate('email_verified_at', '2024-02-15')
    ->dio()                              // → query dump (with the extra clause)
    ->first();

collect($users)->dio('after filter');    // → var dump, returns the collection
```

`->ddio()` is the dump-and-die variant. Works on `Eloquent\Builder`,
`Query\Builder` (`DB::table(...)`) and `Support\Collection`. Disable with
`DUMPIO_REGISTER_MACROS=false`.

## Typed helpers

Every helper is a static method on `Dumpio` (fire-and-forget). `$opts` always
accepts envelope overrides: `flag`, `channel`, `origin`.

| Helper | One-liner |
| --- | --- |
| `Dumpio::exception(\Throwable $e, array $context = [], array $opts = [])` | `Dumpio::exception($e, ['user' => ['id' => 1]]);` |
| `Dumpio::query(string $sql, array $bindings = [], ?float $timeMs = null, array $opts = [])` | `Dumpio::query('select * from users where id = ?', [1], 1.8);` |
| `Dumpio::http(string $method, string $url, ?int $status = null, array $opts = [])` | `Dumpio::http('POST', '/api/users', 201, ['body' => $payload, 'responseTime' => 120]);` |
| `Dumpio::log(string $level, string $message, array $details = [], array $opts = [])` | `Dumpio::log('warning', 'Auth failed', ['ip' => $ip]);` |
| `Dumpio::model(string $class, array $attributes, array $opts = [])` | `Dumpio::model(User::class, $user->getAttributes(), ['exists' => true]);` |
| `Dumpio::collection(array $items, array $opts = [])` | `Dumpio::collection($users, ['message' => 'users']);` |
| `Dumpio::table(array $columns, array $rows, array $opts = [])` | `Dumpio::table(['id', 'name'], [[1, 'Ada'], [2, 'Linus']]);` |
| `Dumpio::measure(string $name, float $timeMs, array $opts = [])` | `Dumpio::measure('render dashboard', 84.2, ['memory' => 2097152]);` |
| `Dumpio::performance(array $metrics, array $opts = [])` | `Dumpio::performance(['db_queries' => 12], ['breakdown' => ['database' => 120]]);` |
| `Dumpio::event(string $event, array $opts = [])` | `Dumpio::event('order.completed', ['entity' => 'order', 'data' => ['total' => 299.9]]);` |

Flags are picked automatically where it helps: exceptions are `red`, queries
`purple`, HTTP by status (`≥500` red, `≥400` yellow, `≥300` blue, else green),
logs by level (error red, warning yellow, info blue).

Two thin global wrappers are also autoloaded for the most common cases:

```php
dumpio_exception($e, ['user' => ['id' => 1]]);
dumpio_query('select * from users', [], 1.2);
```

## Laravel

The service provider is **auto-discovered** — no manual registration. It reads
`config('dumpio.*')`, configures the static client, and (opt-in) forwards
queries and exceptions.

Publish the config:

```bash
php artisan vendor:publish --tag=dumpio-config
```

`config/dumpio.php`:

```php
return [
    'host' => env('DUMPIO_HOST', 'localhost'),
    'port' => (int) env('DUMPIO_PORT', 21234),
    'token' => env('DUMPIO_TOKEN', ''),
    'enabled' => env('DUMPIO_ENABLED', env('APP_DEBUG', false)), // off in prod
    'listen_queries' => env('DUMPIO_LISTEN_QUERIES', false),     // DB::listen → query dumps
    'listen_exceptions' => env('DUMPIO_LISTEN_EXCEPTIONS', false), // reported exceptions → exception dumps
    'intercept_dumps' => env('DUMPIO_INTERCEPT_DUMPS', false),   // dump()/dd() → the viewer
    'listen_models' => env('DUMPIO_LISTEN_MODELS', false),       // Eloquent created/updated/deleted/restored → model dumps
    'listen_cache' => env('DUMPIO_LISTEN_CACHE', false),         // cache hit/miss/written/forgotten → event dumps
    'listen_jobs' => env('DUMPIO_LISTEN_JOBS', false),           // queue job processing/processed/failed → event dumps
    'listen_events' => env('DUMPIO_LISTEN_EVENTS', false),       // application (non-framework) events → event dumps
];
```

When `enabled` is false (the default in production) the provider configures the
client as disabled and registers **no** listeners — a complete no-op.

### Auto-instrumentation (opt-in)

Each switch below is off by default; flip the env var to forward that signal:

| Env var | What it forwards |
| --- | --- |
| `DUMPIO_LISTEN_QUERIES` | every executed SQL query (`DB::listen`) |
| `DUMPIO_LISTEN_EXCEPTIONS` | reported exceptions |
| `DUMPIO_INTERCEPT_DUMPS` | `dump()` / `dd()` routed to the viewer (via `VarDumper::setHandler`) — replaces inline rendering, and `dd()` still dies |
| `DUMPIO_LISTEN_MODELS` | Eloquent `created` / `updated` / `deleted` / `restored` as `model` dumps (channel `models`) |
| `DUMPIO_LISTEN_CACHE` | cache `hit` / `missed` / `written` / `forgotten` as `event` dumps (channel `cache`) |
| `DUMPIO_LISTEN_JOBS` | queue job `processing` / `processed` / `failed` as `event` dumps (channel `jobs`) |
| `DUMPIO_LISTEN_EVENTS` | your application (non-framework) events as `event` dumps (channel `events`) |

Use the helpers anywhere, or the optional facade (also auto-discovered as the
`Dumpio` alias):

```php
use Dumpio\Laravel\Facades\Dumpio;

Dumpio::query($sql, $bindings, $timeMs);
// equivalently: \Dumpio\Dumpio::query(...) or dumpio_query(...)
```

Set `DUMPIO_LISTEN_QUERIES=true` to mirror every executed query into the viewer
via `DB::listen`, and `DUMPIO_LISTEN_EXCEPTIONS=true` to forward reported
exceptions through the framework's exception handler.

## Symfony

Add the bundle (dev only is recommended):

```php
// config/bundles.php
return [
    // …
    Dumpio\Symfony\DumpioBundle::class => ['dev' => true],
];
```

The bundle registers `Dumpio\Symfony\EventSubscriber\ExceptionSubscriber`, which
forwards every `kernel.exception` to the viewer as an `exception` dump with the
current request context. It reads `DUMPIO_HOST` / `DUMPIO_PORT` / `DUMPIO_TOKEN`
/ `DUMPIO_DISABLE` from the environment.

The bundle adds more auto-instrumentation when the relevant component is present:

| Condition | What it forwards |
| --- | --- |
| always | `kernel.exception` → `exception` dumps with request context |
| Doctrine **DBAL 4** | every executed SQL → `query` dumps (channel `database`); SQL + timing only, bindings are not captured |
| **symfony/messenger** | Messenger `sent` / `received` / `handled` / `failed` → `event` dumps (channel `messenger`) — the Symfony equivalent of Laravel's queued-job listeners |
| `DUMPIO_INTERCEPT_DUMPS` set | `dump()` / `dd()` routed to the viewer (via `VarDumper::setHandler`); `dd()` still dies |

> Symfony cache pools have no built-in event system (unlike Laravel), so there is
> no automatic cache forwarding — call `Dumpio::event('cache.…', …)` yourself if
> you need it.

You can also call the static client or helpers from anywhere in your code:

```php
\Dumpio\Dumpio::query($sql, $bindings, $timeMs);
dumpio($entity, 'entity');
```

---

See [`../BUILDING.md`](../BUILDING.md) for the full wire contract and the shared
`var` tree format.
