# dumpio-client (Python)

Send faithful, typed value dumps and structured messages to the
[Dumpio](../../README.md) viewer over HTTP. Fire-and-forget, no required
dependencies, and it **never raises into your app** — if the viewer isn't
running the dump is silently dropped.

See [`../BUILDING.md`](../BUILDING.md) for the full wire contract.

## Install

```bash
pip install dumpio-client            # or: pip install -e sdk/python

# framework extras (only what you need):
pip install "dumpio-client[django]"
pip install "dumpio-client[flask]"
pip install "dumpio-client[fastapi]"
```

## Configuration

Via `configure(...)` or environment variables:

```python
from dumpio_client import configure
configure(host="localhost", port=21234, token="", enabled=True)
```

| Option | Env var | Default |
| --- | --- | --- |
| host | `DUMPIO_HOST` | `localhost` |
| port | `DUMPIO_PORT` | `21234` |
| token | `DUMPIO_TOKEN` | `""` |
| enabled | `DUMPIO_DISABLE` (set ⇒ off) | `true` |

## Bare value dump

```python
from dumpio_client import dumpio, dd

dumpio(user, label="user", flag="blue")  # serialize any value; returns it (chainable)
dd(a, b)                                  # dump every arg, then sys.exit(1)
```

The serializer handles dict/list/tuple/set, **dataclasses**, arbitrary objects
via `__dict__`/`repr`, `bytes`, and special floats. Member visibility is
inferred from Python's `_`/`__` naming convention; cycles become `ref` nodes.
The calling `file:line` is captured automatically.

## Typed helpers

All helpers are fire-and-forget and accept `flag=`, `channel=`, `timestamp=`
plus extra keyword payload fields.

| Helper | Example |
| --- | --- |
| `message(text, **opts)` | `message("User logged in", flag="green", user_id=1)` |
| `dumpio_exception(exc, context=None)` | `dumpio_exception(e, context={"user": {"id": 1}})` |
| `dumpio_query(sql, bindings=None, time_ms=None)` | `dumpio_query("select * from users where id = ?", [1], 1.8)` |
| `dumpio_http(method, url, status=None, ...)` | `dumpio_http("POST", "/api/users", 201, response_time=120)` |
| `dumpio_log(level, message, details=None)` | `dumpio_log("warning", "Auth failed", {"ip": "1.2.3.4"})` |
| `dumpio_model(cls_name, attributes, ...)` | `dumpio_model("User", {"id": 1, "name": "Ada"}, exists=True)` |
| `dumpio_collection(items, count=None)` | `dumpio_collection([{"id": 1}, {"id": 2}])` |
| `dumpio_table(columns, rows)` | `dumpio_table(["id", "name"], [[1, "Ada"], [2, "Linus"]])` |
| `dumpio_measure(name, time_ms, ...)` | `dumpio_measure("render dashboard", 84.2, memory=2097152)` |
| `dumpio_performance(metrics, breakdown=None, ...)` | `dumpio_performance({"db_queries": 12}, breakdown={"database": 120})` |
| `dumpio_event(event, entity=None, ...)` | `dumpio_event("order.completed", entity="order", entity_id="ord_1")` |

Flag defaults are picked for you: exceptions red, queries purple, HTTP by
status code, logs by level — override any with `flag=`.

## Framework integrations

Each integration imports its framework lazily and is defensive: importing the
module without the framework, or the viewer being down, never breaks anything.

### Django

```python
# settings.py
MIDDLEWARE = [
    # ...
    "dumpio_client.django.DumpioMiddleware",
]
```

Emits an `http` dump per request and a `dumpio_exception` on view errors.

### Flask

```python
from flask import Flask
from dumpio_client.flask import DumpioFlask

app = Flask(__name__)
DumpioFlask(app)                 # or: DumpioFlask().init_app(app)
```

Uses `before_request` / `after_request` / `teardown_request` to emit `http`
dumps and exceptions.

### FastAPI / Starlette

```python
from fastapi import FastAPI
from dumpio_client.fastapi import DumpioMiddleware

app = FastAPI()
app.add_middleware(DumpioMiddleware)
```

ASGI `BaseHTTPMiddleware` emitting one `http` dump per request. Degrades to a
transparent pass-through if Starlette isn't installed.

### Standard logging (optional)

```python
import logging
from dumpio_client.logging import DumpioHandler

logging.getLogger().addHandler(DumpioHandler())
```

Forwards log records as `log` dumps (and `exception` dumps when a record
carries `exc_info`).
