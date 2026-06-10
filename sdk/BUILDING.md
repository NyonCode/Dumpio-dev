# Building a Dumpio SDK

> **Authoritative client contract.** This document is derived directly from the
> Dumpio application's ingest pipeline (`src/main/ingest/**`, `src/main/security/guards.ts`)
> and the renderer that displays dumps (`src/renderer/src/components/dump-viewer/**`).
> If anything here disagrees with an older guide (e.g. the legacy
> `dumpio_sdk_docs.md`), **this document wins** — it is kept in lock-step with the
> code. Build every SDK to this spec.

An SDK's job is narrow and well-defined:

1. Serialize an arbitrary value into the language-agnostic **`var` tree**, or build
   one of the **structured message types** the viewer renders.
2. Ship it to a running Dumpio viewer over **HTTP** (`POST /dumps`).
3. **Never break the host application** — a debug helper that can throw, block, or
   leak is a bug. Transport is fire-and-forget, errors are swallowed, timeouts are short.

---

## 1. Transport

### HTTP (primary)

Every Dumpio server exposes the same HTTP surface:

```
POST /dumps     Content-Type: application/json     →  202 { "accepted": <n> }
GET  /health                                        →  200 { "ok": true, "version": "<x.y.z>" }
```

- **Default endpoint:** `http://localhost:21234/dumps`.
- **Body:** a single dump object **or a JSON array of dump objects** (batch). The
  server emits one dump per array element and replies `202 { accepted: <count> }`.
- **Unparseable JSON is not rejected** — the server stores it as a red-flagged
  `raw` dump. SDKs should still only send valid JSON.

### Request rules (enforced by `guards.ts` — get these wrong and you get a 403/401)

| Rule | What the SDK must do |
| --- | --- |
| **No browser headers** | Do **not** send an `Origin` header or `Sec-Fetch-Site: cross-site`. Native HTTP clients (curl, sockets, server-side runtimes) don't — only browsers do. A present `Origin` ⇒ **403**. |
| **Host header** | When the server is loopback-bound (the default), the `Host` header must resolve to a loopback name (`localhost`/`127.0.0.1`/`::1`). Native clients set `Host` automatically from the URL, so just point them at `localhost`/`127.0.0.1`. |
| **Token** | If the server has a shared token configured, send it as **`X-Dumpio-Token: <token>`** *or* **`Authorization: Bearer <token>`**. Comparison is constant-time. Missing/wrong ⇒ **401**. |
| **Rate limit** | Per-IP fixed-window limit (default off / generous). On **429**, drop the dump silently — do not retry-storm. |
| **Body size** | Hard per-request byte cap (server-side `maxPayloadBytes`). Keep payloads bounded via the serializer limits below; on **413**, drop silently. |

### Health check

`GET /health` is loopback-only and needs no token. Use it for an optional
"is the viewer running?" probe, or just rely on fire-and-forget POSTs failing silently.

### TCP (legacy fallback)

The viewer also runs an optional raw-TCP ingest. Send **raw JSON** (one object;
pretty-printed multi-line is fine — the server brace-counts). With a token, embed
it **as a top-level `token` field inside the JSON** (there are no headers on TCP).
The server greets new connections with `{"type":"welcome",...}\n` — ignore it.
**Prefer HTTP**; only implement TCP if a target environment can't do HTTP.

### Configuration (every SDK exposes the same knobs + env vars)

| Option | Env var | Default |
| --- | --- | --- |
| host | `DUMPIO_HOST` | `localhost` |
| port | `DUMPIO_PORT` | `21234` |
| token | `DUMPIO_TOKEN` | `""` (none) |
| enabled | `DUMPIO_DISABLE` (set ⇒ off) | `true` |
| timeout | — | ~1.5 s |
| maxDepth / maxItems / maxString | — | `6` / `100` / `2000` |

---

## 2. The dump envelope

A dump is a JSON object. The server (`normalize.ts`) reads these **top-level**
keys; everything else is preserved verbatim as the payload the renderer inspects.

| Key | Type | Meaning | Default if absent |
| --- | --- | --- | --- |
| `timestamp` | number | Epoch **milliseconds** | server receive time |
| `flag` | enum | Color category (see below) | `gray` |
| `channel` | string | Logical grouping / tab | `default` |
| `origin` | string | Free-form source id | socket `ip:port` |
| `schemaVersion` | number | Wire schema version | `1` |
| `type` | string | Selects the renderer view (§3) | — (generic data) |
| `message` | string | List/detail title (see title rules) | — |

**Flags** are a fixed set — anything else falls back to `gray`:

```
red  yellow  blue  gray  purple  pink  green
```

**Title resolution** (`getDumpTitle`) picks the first present of:
`message` → `label` → `title` → `name` → `event` → `sql` → `exception` → `error`
→ `method`+`url` → capitalized `type`. **Always set a `message`** (or `label` for
`var`) so the dump reads well in the list.

A minimal valid dump:

```json
{ "message": "User logged in", "flag": "green", "channel": "auth", "userId": 123 }
```

---

## 3. Message types

The renderer (`getDumpType` + `DumpDetail`/`TypeViews`) chooses a view from the
payload's `type` field (and a few heuristics). Build these shapes exactly — extra
keys are fine and shown in the generic tree. **Send a `message`/`label` on every type.**

### 3.1 `var` — language-agnostic value tree (the flagship)

The faithful, typed dump of an arbitrary variable. Renders class names, member
visibility, special types and cycles identically across languages. **This is §4.**

```jsonc
{
  "type": "var",
  "language": "php",            // node | php | python  (informational)
  "label": "$user",             // also the title
  "message": "$user",           // mirror of label
  "flag": "blue",
  "channel": "default",
  "timestamp": 1700000000000,
  "caller": { "file": "/app/Http/Controller.php", "line": 42, "function": "show" },
  "value": { /* root VarNode — see §4 */ }
}
```

Detection requires `type === "var"` **and** `value` being an object.

### 3.2 `exception` — error with stack + context

Detected by `type === "exception"` **or** the presence of any of `exception`,
`error`, `stack`, `stackTrace`, `trace`. The parser (`exceptionParser.ts`) is very
tolerant; produce as much of this as the language affords:

```jsonc
{
  "type": "exception",
  "framework": "laravel",       // laravel|symfony|node|js|react|vue|django|flask|fastapi|go…
  "exception": "RuntimeException",   // class name
  "message": "Something failed",
  "file": "/app/Service.php",
  "line": 88,
  "code": "E_USER",             // string|number, optional
  "severity": "error",          // optional
  "stack": "…raw string…",      // optional; OR `trace` (preferred, structured)
  "trace": [
    { "file": "/app/Service.php", "line": 88, "function": "run",
      "class": "App\\Service", "type": "->",
      "code": ["  line above", "> the line", "  line below"] }
  ],
  "context": {
    "request":     { "url": "…", "method": "GET", "headers": {}, "body": {}, "query": {}, "ip": "…", "userAgent": "…" },
    "user":        { "id": 1, "email": "…", "name": "…", "roles": [] },
    "session":     { },
    "environment": { "php_version": "8.3", "node_version": "20", "python_version": "3.12",
                     "framework_version": "11.0", "environment": "local", "debug": true },
    "database":    { "connection": "mysql", "query": "select …", "bindings": [], "time": 1.2 }
  },
  "flag": "red"
}
```

Frame keys are read flexibly: `file|filename`, `line|lineno`, `column|colno`,
`function|method|name`, `class`, `type` (`->`/`::`), `code` (array of source lines)
or `code_snippet`/`context`. A `trace` **array** is preferred over a `stack`
**string**. Python may send `traceback`; Go may send a `goroutine` stack string.

### 3.3 `query` (a.k.a. SQL) — a database query

Detected by `type === "query"` **or** a `sql` field.

```jsonc
{
  "type": "query",
  "message": "User lookup",
  "sql": "select * from users where email = ? and active = ?",
  "bindings": ["a@b.cz", true],   // interpolated into the formatted SQL in the UI
  "time": 1.8,                    // milliseconds (>100 amber, >1000 red)
  "connection": "mysql",
  "flag": "purple"
}
```

### 3.4 `http` — an HTTP request/response

Detected by `type === "http"` **or** a `method`/`url` field. The UI offers
**Copy as cURL**, builds it from `method`, `url`, `headers`, `body`.

```jsonc
{
  "type": "http",
  "message": "POST /api/users",
  "method": "POST",
  "url": "/api/users",
  "status": 201,                  // ≥500 red, ≥400 amber, else green
  "headers": { "Content-Type": "application/json" },
  "body": { "name": "Ada" },      // string or object
  "response_time": 120,           // ms
  "flag": "blue"
}
```

### 3.5 `log` — a log line

Detected by `type === "log"` **or** a `level` field. Rendered with a level badge
(`error` red, `warning` amber, `info` blue, `debug` gray) and a value tree.

```jsonc
{ "type": "log", "level": "warning", "message": "Auth failed", "details": { "ip": "…" }, "flag": "yellow" }
```

### 3.6 `model` — a single domain object (Eloquent / Django / Prisma / struct)

```jsonc
{
  "type": "model",
  "class": "App\\Models\\User",   // or `model`
  "exists": true,                 // → "persisted"/"new" badge
  "connection": "mysql",
  "attributes": { "id": 1, "name": "Ada", "email": "ada@x.cz" },
  "relations":  { "posts": [ { "id": 10, "title": "Hi" } ] },
  "message": "App\\Models\\User"
}
```

### 3.7 `collection` — a list of items

```jsonc
{ "type": "collection", "count": 2, "items": [ {"id":1}, {"id":2} ], "message": "users" }
```

Renders as a table when **every** item is a record, else as a value tree.
`items` or `data` are both accepted.

### 3.8 `table` — explicit columns + rows

```jsonc
{ "type": "table",
  "columns": ["id", "name", "role"],
  "rows": [ [1, "Ada", "admin"], [2, "Linus", "user"] ],   // arrays aligned to columns…
  "message": "users" }
// …or rows as records: "rows": [ {"id":1,"name":"Ada","role":"admin"} ]
```

### 3.9 `measure` — a single timing

```jsonc
{ "type": "measure", "name": "render dashboard", "time": 84.2, "memory": 2097152,
  "context": { "route": "/dashboard" } }
```

`time` (or `duration`) in ms (>100 amber, >1000 red); `memory` in bytes.

### 3.10 `performance` — metric bundle with breakdown

```jsonc
{ "type": "performance", "message": "request profile",
  "metrics":   { "memory_usage": 45678901, "response_time": 250, "db_queries": 12 },
  "breakdown": { "database": 120, "template": 80, "network": 35 },   // ms slices → stacked bar
  "context":   { "route": "/dashboard" } }
```

Metric values matching `memory|bytes|size` are byte-formatted; `time|duration|latency|ms`
get a ` ms` suffix; `cpu|usage|percent` get `%`.

### 3.11 `event` — a business/domain event

```jsonc
{ "type": "event", "event": "order.completed", "entity": "order", "entity_id": "ord_1",
  "actor": { "type": "user", "id": 1 }, "data": { "total": 299.9 }, "metadata": { "source": "web" } }
```

---

## 4. The `var` value tree

The whole point of the flagship `var` type: serialize any value into one
**language-agnostic tree** so the viewer renders PHP, Node and Python identically.

### VarNode

```ts
interface VarNode {
  kind: 'object' | 'array' | 'map' | 'set'
      | 'string' | 'int' | 'float' | 'bool'
      | 'null' | 'undefined' | 'resource' | 'callable' | 'ref'
  class?: string                                   // class / type name
  visibility?: 'public' | 'protected' | 'private'  // where the language has it
  key?: string | number                            // this node's key in its parent
  value?: string | number | boolean | null         // scalar payload
  children?: VarNode[]                              // for containers
  refId?: number                                    // container identity, or ref target
  truncated?: boolean                              // clipped by a limit
}
```

### Rules every serializer follows

- **Scalars.** `string`/`int`/`float`/`bool` carry `value`. `null`/`undefined`
  carry neither. Split `number` into `int` (integral) vs `float`. Non-finite
  floats are sent as `{ kind:'float', class:'special', value:'NAN'|'INF'|'-INF' }`.
- **Containers.** `object`/`array`/`map`/`set` carry `children` and a sequential
  `refId` (start at 1, increment per container). `map` and `object` children carry
  a `key`; object members carry `visibility` where the language exposes it.
  Map = keyed/dict, array = ordered list, set = unique unordered, object = class instance.
- **Cycles.** The first time a container is seen it gets a `refId`; the **second**
  time the *same* instance appears, emit `{ kind:'ref', refId:N }` pointing at it.
- **Limits.** Bound `maxDepth` (default 6), `maxItems` per container (100), and
  `maxString` length (2000). When a limit clips a node, set `truncated: true`
  (and still emit the `kind`/`class` you know).
- **Class names.** Set `class` to the real type for instances and typed containers
  (`Date`, `RegExp`, `bytes`, `tuple`, an enum, an Eloquent model, …). Plain
  dict/array/object leave `class` unset.

### Caller capture

The ergonomic helper records the **call site** (so the dump points at user code,
not the SDK). Skip frames inside the SDK directory, return the first user frame as
`{ file, line, function }`.

| Language | Mechanism |
| --- | --- |
| PHP | `debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS)` |
| Node | `Error.prepareStackTrace` → `CallSite[]` |
| Python | `traceback.extract_stack()` |

The reference serializers in [`node/`](node), [`php/`](php) and [`python/`](python)
already implement all of the above — **reuse them** and build the typed helpers
(§3) and framework integrations (§5) on top.

---

## 5. Ergonomic API surface

Keep the public API consistent across languages so docs and muscle memory transfer.

| Capability | Node | PHP | Python |
| --- | --- | --- | --- |
| Var dump | `dumpio(v, { label, flag })` | `dumpio($v, $label, $flag)` / `Dumpio::dump()` | `dumpio(v, label=…, flag=…)` |
| Dump & die | `dd(...vals)` | `ddio(...$v)` / `Dumpio::dd()` | `dd(*vals)` |
| Exception | `dumpioException(err, ctx)` | `Dumpio::exception($e, $ctx)` | `dumpio_exception(exc, ctx)` |
| SQL / query | `dumpioQuery(sql, bindings, ms)` | `Dumpio::query(...)` | `dumpio_query(...)` |
| HTTP | `dumpioHttp({...})` | `Dumpio::http(...)` | `dumpio_http(...)` |
| Log | `dumpioLog(level, msg, details)` | `Dumpio::log(...)` | `dumpio_log(...)` |
| Model / collection / table | `dumpioModel/Collection/Table(...)` | `Dumpio::model/collection/table(...)` | `dumpio_model/collection/table(...)` |
| Measure / performance / event | `dumpioMeasure/Performance/Event(...)` | matching static methods | matching functions |
| Configure | `configure({...})` | `Dumpio::configure([...])` | `configure(**opts)` |

All helpers are **fire-and-forget** and must never throw into user code. `dd`-style
helpers flush in-flight sends, then stop execution.

### Framework integrations (ship these)

- **JS/Node:** Express/Koa/Fastify request-logging middleware (emits `http`), an
  uncaught-exception / unhandled-rejection hook (emits `exception`).
- **PHP/Laravel:** a `ServiceProvider` that registers a `Dumpio` facade, a
  `DB::listen` → `query` forwarder, and an exception-reporter hook; respects
  `config('dumpio.*')` and `app.debug`.
- **PHP/Symfony:** a small bundle / event subscriber that forwards `kernel.exception`
  and (optionally) Doctrine queries; reads `%env(DUMPIO_*)%`.
- **Python:** Django middleware (`http` + exception), a Flask extension
  (`before/after_request`), and FastAPI/Starlette middleware. Optionally hook the
  `logging` module to forward records as `log` dumps.

Integrations must degrade to no-ops when the viewer is down and respect
`DUMPIO_DISABLE` / production guards.

---

## 6. Quality bar

- **Safety first.** No exception, no blocking, no unbounded memory may ever reach
  the host app from the SDK. Wrap transport and serialization in catch-all guards.
- **No required dependencies.** Use the language's stdlib HTTP client. Framework
  integrations live behind optional extras and only load when the framework is present.
- **Faithful types.** The `var` serializer must preserve class, visibility, special
  types and cycles per §4. Test round-trips for nested objects, cycles and limits.
- **Documented.** Each package ships a README with install + a copy-paste example
  for the bare helper and each framework integration, and links back here.
- **Versioned envelope.** Emit `schemaVersion: 1`. Bump only when the wire shape
  changes incompatibly.
```
