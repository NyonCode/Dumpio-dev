# dumpio-client (Node.js)

Send faithful, typed value dumps to the [Dumpio](../../README.md) viewer over HTTP.
Every helper is **fire-and-forget** and **never throws into your app** — if the
viewer isn't running, the dump is dropped silently.

See [`../BUILDING.md`](../BUILDING.md) for the authoritative wire contract.

## Install

```bash
npm install dumpio-client
```

## Quick start

```js
const { dumpio, dd, configure } = require('dumpio-client')

configure({ host: 'localhost', port: 21234 }) // optional; these are the defaults

dumpio(someValue, { label: 'user', flag: 'blue' }) // fire-and-forget var dump
dd(a, b) // dump every arg, flush, then exit the process
```

`dumpio()` serializes plain objects & class instances (by constructor name),
`Map`/`Set`/`Date`/`RegExp`/`Error`/typed arrays, `bigint`, and functions into
the language-agnostic `var` tree, breaking cycles via `ref` nodes and capturing
the calling `file:line` automatically.

### Configuration

`configure({...})` or env vars. Defaults shown:

| Option | Env var | Default |
| --- | --- | --- |
| `host` | `DUMPIO_HOST` | `localhost` |
| `port` | `DUMPIO_PORT` | `21234` |
| `token` | `DUMPIO_TOKEN` | `""` |
| `enabled` | `DUMPIO_DISABLE` (set ⇒ off) | `true` |
| `timeoutMs` | — | `1500` |
| `maxDepth` / `maxItems` / `maxString` | — | `6` / `100` / `2000` |

## Typed helpers

Each renders a dedicated view in the viewer. All accept a trailing
`opts` of `{ flag?, channel?, timestamp? }`, set `schemaVersion: 1`, and pick a
sensible default flag.

| Helper | Renders | Example |
| --- | --- | --- |
| `dumpio(v, { label })` | faithful `var` tree | `dumpio(user, { label: 'user' })` |
| `dumpioMessage(msg, extra?)` | generic titled data | `dumpioMessage('checkpoint', { step: 3 })` |
| `dumpioException(err, ctx?)` | error + stack/trace (red) | `dumpioException(err, { userId: 7 })` |
| `dumpioQuery(sql, bindings?, ms?)` | SQL query (purple) | `dumpioQuery('select * from users where id = ?', [7], 1.8)` |
| `dumpioHttp({ method, url, status, ... })` | HTTP request (flag from status) | `dumpioHttp({ method: 'POST', url: '/api/users', status: 201 })` |
| `dumpioLog(level, msg, details?)` | log line (flag from level) | `dumpioLog('warning', 'Auth failed', { ip })` |
| `dumpioModel(class, { attributes, ... })` | single domain object | `dumpioModel('User', { attributes: { id: 1 }, exists: true })` |
| `dumpioCollection(items)` | list / table | `dumpioCollection([{ id: 1 }, { id: 2 }])` |
| `dumpioTable(columns, rows)` | explicit table | `dumpioTable(['id', 'name'], [[1, 'Ada']])` |
| `dumpioMeasure(name, ms, { memory?, context? })` | single timing | `dumpioMeasure('render', 84.2, { memory: 2097152 })` |
| `dumpioPerformance({ metrics, breakdown?, context? })` | metric bundle | `dumpioPerformance({ metrics: { db_queries: 12 } })` |
| `dumpioEvent(event, { entity?, entityId?, actor?, data?, metadata? })` | domain event | `dumpioEvent('order.completed', { entityId: 'ord_1' })` |

`flush()` waits for all in-flight dumps to settle (always resolves) — handy
before exiting a short-lived script.

## Express middleware

`expressMiddleware()` times each request and emits an `http` dump on response
finish. It is defensive — it can never break the host app.

```js
const express = require('express')
const { expressMiddleware, installGlobalErrorHandlers } = require('dumpio-client/middleware')

const app = express()
app.use(expressMiddleware({ channel: 'http' }))

// Forward uncaught errors / unhandled rejections as `exception` dumps.
installGlobalErrorHandlers({ channel: 'errors' })
```

Options: `{ channel?, headers?, skip? }` — `headers` includes request headers
(off by default), `skip(req) => boolean` filters out requests (e.g. health checks).

Koa and Fastify integrations are also exported:

```js
const { koaMiddleware, fastifyPlugin } = require('dumpio-client/middleware')

app.use(koaMiddleware()) // Koa
fastify.register(fastifyPlugin) // Fastify
```

`installGlobalErrorHandlers()` returns an uninstall function and does **not**
swallow errors — your existing handlers and the default process behaviour still run.
