# Dumpio SDKs

Reference client packages that send **typed, structured dumps** to the Dumpio
viewer. They serialize arbitrary values into one language-agnostic tree (the `var`
type) and build the viewer's structured types (`exception`, `query`, `http`,
`model`, `collection`, `table`, `measure`, `performance`, `event`, `log`) — so the
receiver renders every language and framework identically.

| Language | Package         | Folder              | Bare helper                         | Integrations |
| -------- | --------------- | ------------------- | ----------------------------------- | --- |
| Node.js  | `dumpio-client` | [`node/`](node)     | `dumpio(value, opts)` / `dd(...)`   | Express / Koa / Fastify |
| PHP      | `dumpio/client` | [`php/`](php)       | `dumpio($v, $label)` / `ddio(...)`  | Laravel, Symfony |
| Python   | `dumpio-client` | [`python/`](python) | `dumpio(value, label=…)` / `dd(...)`| Django, Flask, FastAPI |

## How to build / extend an SDK

**[`BUILDING.md`](BUILDING.md) is the authoritative client contract** — transport
rules, the dump envelope, every message type, the `var` tree, and the expected API
surface, all derived from the application code. Build to that spec; if an older doc
(e.g. the legacy `dumpio_sdk_docs.md`) disagrees, `BUILDING.md` wins.

## Transport in one paragraph

HTTP-first. `POST http://localhost:21234/dumps` with `Content-Type: application/json`
and a single dump object or an array (batch); the server replies `202 { accepted }`.
A configured token goes in `X-Dumpio-Token` (or `Authorization: Bearer`). All
helpers are **fire-and-forget** and never throw into your app — if the viewer isn't
running, the dump is silently dropped. Configure via `DUMPIO_HOST`, `DUMPIO_PORT`,
`DUMPIO_TOKEN`, `DUMPIO_DISABLE`. (A legacy raw-TCP ingest also exists; see `BUILDING.md`.)

## The `var` value tree

A `VarNode` is `{ kind, class?, visibility?, key?, value?, children?, refId?, truncated? }`
where `kind ∈ object|array|map|set|string|int|float|bool|null|undefined|resource|callable|ref`.
Containers carry `children` + a sequential `refId`; the second time the same
instance is seen the serializer emits `{ kind:'ref', refId:N }` to break cycles.
Depth/item/string limits keep payloads small (defaults 6 / 100 / 2000). Full rules
and the rest of the wire format live in [`BUILDING.md`](BUILDING.md).
