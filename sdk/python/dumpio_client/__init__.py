"""dumpio-client (Python) — send faithful, typed value dumps to the Dumpio app.

    from dumpio_client import dumpio, dd, configure

    dumpio(user, label="user", flag="blue")
    dd(a, b)   # dump and raise SystemExit

Transport is HTTP-first (POST /dumps), fire-and-forget, and never raises into
your application code — a debugging helper must not be able to break the app.
"""

from __future__ import annotations

import json
import os
import sys
import time
import traceback
import urllib.request
from typing import Any, Dict, List, Optional

from .serializer import serialize

__all__ = [
    "dumpio",
    "dd",
    "configure",
    "serialize",
    "config",
    "message",
    "dumpio_exception",
    "dumpio_query",
    "dumpio_http",
    "dumpio_log",
    "dumpio_model",
    "dumpio_collection",
    "dumpio_table",
    "dumpio_measure",
    "dumpio_performance",
    "dumpio_event",
]

config: Dict[str, Any] = {
    "host": os.environ.get("DUMPIO_HOST", "localhost"),
    "port": int(os.environ.get("DUMPIO_PORT", "21234")),
    "path": "/dumps",
    "token": os.environ.get("DUMPIO_TOKEN", ""),
    "timeout": 1.5,
    "enabled": os.environ.get("DUMPIO_DISABLE") is None,
    "max_depth": 6,
    "max_items": 100,
    "max_string": 2000,
}

_SDK_DIR = os.path.dirname(os.path.abspath(__file__))


def configure(**options: Any) -> Dict[str, Any]:
    config.update(options)
    return config


def _caller() -> Optional[Dict[str, Any]]:
    """First stack frame outside this SDK, as {file, line, function}."""
    for frame in reversed(traceback.extract_stack()[:-1]):
        if os.path.dirname(os.path.abspath(frame.filename)) == _SDK_DIR:
            continue
        return {"file": frame.filename, "line": frame.lineno, "function": frame.name}
    return None


def _send(message: Dict[str, Any]) -> None:
    if not config["enabled"]:
        return
    try:
        body = json.dumps(message, default=str).encode("utf-8")
    except Exception:
        return
    url = f"http://{config['host']}:{config['port']}{config['path']}"
    headers = {"Content-Type": "application/json"}
    if config["token"]:
        headers["X-Dumpio-Token"] = config["token"]
    try:
        req = urllib.request.Request(url, data=body, headers=headers, method="POST")
        urllib.request.urlopen(req, timeout=config["timeout"]).close()
    except Exception:
        # App not running / refused / timed out — stay silent.
        pass


def dumpio(value: Any, label: Optional[str] = None, flag: str = "blue", channel: str = "default") -> Any:
    """Send one value as a ``var`` dump. Returns the value (chainable)."""
    tree = serialize(
        value,
        max_depth=config["max_depth"],
        max_items=config["max_items"],
        max_string=config["max_string"],
    )
    _send(
        {
            "type": "var",
            "language": "python",
            "label": label,
            "message": label,
            "flag": flag,
            "channel": channel,
            "timestamp": int(time.time() * 1000),
            "caller": _caller(),
            "value": tree,
        }
    )
    return value


def dd(*values: Any) -> None:
    """Dump every argument, then stop the program ("dump & die")."""
    for value in values:
        dumpio(value)
    sys.exit(1)


# ---------------------------------------------------------------------------
# Typed message helpers
#
# Every helper below is fire-and-forget: it builds one of the structured
# message types described in ``sdk/BUILDING.md`` §3 and hands it to ``_send``
# via the internal ``_emit`` wrapper. None of them may ever raise into the
# host application — ``_emit`` and ``_send`` both swallow all exceptions.
# ---------------------------------------------------------------------------

_VALID_FLAGS = frozenset(
    {"red", "yellow", "blue", "gray", "purple", "pink", "green"}
)


def _emit(
    payload: Dict[str, Any],
    *,
    flag: Optional[str] = None,
    channel: str = "default",
    timestamp: Optional[int] = None,
) -> None:
    """Add envelope metadata to ``payload`` and ship it.

    Stamps ``timestamp`` (epoch ms), ``flag``, ``channel`` and
    ``schemaVersion: 1`` onto the payload, then forwards it to :func:`_send`.
    Anything passed through ``**opts`` on a helper (e.g. an explicit ``flag``,
    ``channel`` or ``timestamp``, or extra payload keys merged before calling)
    is respected. Never raises.

    Args:
        payload: The message body. May already carry envelope keys, in which
            case the explicit ``flag``/``channel``/``timestamp`` arguments win.
        flag: Color category; coerced to ``gray`` when not a known flag.
        channel: Logical grouping / tab. Defaults to ``"default"``.
        timestamp: Epoch milliseconds. Defaults to "now".
    """
    try:
        envelope: Dict[str, Any] = dict(payload)
        envelope["schemaVersion"] = 1
        envelope["channel"] = channel or envelope.get("channel") or "default"
        envelope["timestamp"] = (
            timestamp
            if timestamp is not None
            else envelope.get("timestamp", int(time.time() * 1000))
        )
        chosen = flag if flag is not None else envelope.get("flag")
        envelope["flag"] = chosen if chosen in _VALID_FLAGS else "gray"
        if "caller" not in envelope:
            caller = _caller()
            if caller is not None:
                envelope["caller"] = caller
        _send(envelope)
    except Exception:
        # A debug helper must never break the host app.
        pass


def _pop_envelope_opts(opts: Dict[str, Any]) -> Dict[str, Any]:
    """Split envelope kwargs (flag/channel/timestamp) out of ``**opts``.

    Returns a dict suitable for ``**_emit`` keyword expansion; leftover keys in
    ``opts`` are extra payload fields and are merged by the caller.
    """
    envelope: Dict[str, Any] = {}
    for key in ("flag", "channel", "timestamp"):
        if key in opts:
            envelope[key] = opts.pop(key)
    return envelope


def _truncate(text: str, limit: Optional[int] = None) -> str:
    """Clip a string to ``max_string`` (or ``limit``) characters."""
    cap = limit if limit is not None else config["max_string"]
    if len(text) > cap:
        return text[:cap] + "…"
    return text


def message(text: str, **opts: Any) -> None:
    """Send a plain-data dump with ``text`` as the title.

    The generic, "just show me this" helper: emits ``message`` plus any extra
    keyword payload (e.g. ``user_id=1``). Extra keys appear in the generic
    value tree. ``flag``/``channel``/``timestamp`` are treated as envelope opts.

    Example:
        >>> message("User logged in", flag="green", channel="auth", user_id=1)
    """
    env = _pop_envelope_opts(opts)
    payload: Dict[str, Any] = {"message": text}
    payload.update(opts)
    _emit(payload, **env)


def dumpio_exception(
    exc: BaseException,
    context: Optional[Dict[str, Any]] = None,
    **opts: Any,
) -> None:
    """Send an ``exception`` dump with a structured stack trace.

    Args:
        exc: The caught exception instance.
        context: Optional ``ExceptionContext`` (request/user/database/...).
        **opts: Extra payload keys, or ``flag``/``channel``/``timestamp``.

    The dump carries ``exception`` (class name), ``message`` (``str(exc)``), a
    raw ``traceback`` string and a structured ``trace`` list, plus the
    ``file``/``line`` of the deepest frame. Flag defaults to ``red``.
    """
    env = _pop_envelope_opts(opts)
    env.setdefault("flag", "red")

    tb = exc.__traceback__
    try:
        frames = traceback.extract_tb(tb)
    except Exception:
        frames = []

    trace: List[Dict[str, Any]] = []
    for frame in frames:
        entry: Dict[str, Any] = {
            "file": frame.filename,
            "line": frame.lineno,
            "function": frame.name,
        }
        if getattr(frame, "line", None):
            entry["code"] = frame.line
        trace.append(entry)

    try:
        tb_text = "".join(
            traceback.format_exception(type(exc), exc, tb)
        )
    except Exception:
        tb_text = traceback.format_exc()

    payload: Dict[str, Any] = {
        "type": "exception",
        "framework": "python",
        "exception": type(exc).__name__,
        "message": str(exc) or type(exc).__name__,
        "traceback": tb_text,
        "trace": trace,
    }
    if frames:
        last = frames[-1]
        payload["file"] = last.filename
        payload["line"] = last.lineno
    if context:
        payload["context"] = context
    payload.update(opts)
    _emit(payload, **env)


def dumpio_query(
    sql: str,
    bindings: Optional[List[Any]] = None,
    time_ms: Optional[float] = None,
    **opts: Any,
) -> None:
    """Send a ``query`` (SQL) dump.

    Args:
        sql: The raw SQL string (also used, truncated, as the title).
        bindings: Bound parameter values, interpolated by the viewer.
        time_ms: Execution time in milliseconds.
        **opts: ``connection=...`` and other extras, or envelope opts.

    Flag defaults to ``purple``.
    """
    env = _pop_envelope_opts(opts)
    env.setdefault("flag", "purple")
    payload: Dict[str, Any] = {
        "type": "query",
        "message": _truncate(sql, 120),
        "sql": sql,
    }
    if bindings is not None:
        payload["bindings"] = bindings
    if time_ms is not None:
        payload["time"] = time_ms
    payload.update(opts)
    _emit(payload, **env)


def dumpio_http(
    method: str,
    url: str,
    status: Optional[int] = None,
    *,
    headers: Optional[Dict[str, Any]] = None,
    body: Any = None,
    response_time: Optional[float] = None,
    **opts: Any,
) -> None:
    """Send an ``http`` request/response dump.

    Args:
        method: HTTP verb (``GET``, ``POST``, ...).
        url: Request URL or path.
        status: Response status code; drives the flag color.
        headers: Request/response headers.
        body: Request/response body (string or JSON-able object).
        response_time: Round-trip time in milliseconds.
        **opts: Extra payload or envelope opts.

    Flag by status: ``>=500`` red, ``>=400`` yellow, ``>=300`` blue, else green.
    """
    env = _pop_envelope_opts(opts)
    if "flag" not in env:
        if status is None:
            env["flag"] = "blue"
        elif status >= 500:
            env["flag"] = "red"
        elif status >= 400:
            env["flag"] = "yellow"
        elif status >= 300:
            env["flag"] = "blue"
        else:
            env["flag"] = "green"
    payload: Dict[str, Any] = {
        "type": "http",
        "message": f"{method} {url}",
        "method": method,
        "url": url,
    }
    if status is not None:
        payload["status"] = status
    if headers is not None:
        payload["headers"] = headers
    if body is not None:
        payload["body"] = body
    if response_time is not None:
        payload["response_time"] = response_time
    payload.update(opts)
    _emit(payload, **env)


def dumpio_log(
    level: str,
    message: str,  # noqa: A002 - matches the documented signature
    details: Any = None,
    **opts: Any,
) -> None:
    """Send a ``log`` dump.

    Args:
        level: ``error``/``warning``/``warn``/``info``/``debug`` (drives flag).
        message: The log line (also the title).
        details: Optional structured context for the log entry.
        **opts: Extra payload or envelope opts.

    Flag by level: error red, warning yellow, info blue, debug gray.
    """
    env = _pop_envelope_opts(opts)
    if "flag" not in env:
        lvl = (level or "").lower()
        env["flag"] = {
            "error": "red",
            "critical": "red",
            "fatal": "red",
            "warning": "yellow",
            "warn": "yellow",
            "info": "blue",
            "debug": "gray",
        }.get(lvl, "gray")
    payload: Dict[str, Any] = {
        "type": "log",
        "level": level,
        "message": message,
    }
    if details is not None:
        payload["details"] = details
    payload.update(opts)
    _emit(payload, **env)


def dumpio_model(
    cls_name: str,
    attributes: Dict[str, Any],
    *,
    relations: Optional[Dict[str, Any]] = None,
    exists: Optional[bool] = None,
    connection: Optional[str] = None,
    **opts: Any,
) -> None:
    """Send a ``model`` dump (a single domain object / ORM record).

    Args:
        cls_name: Fully-qualified model class name (also the title).
        attributes: The model's column/attribute map.
        relations: Eager-loaded relations.
        exists: Whether the record is persisted (``True``) or new (``False``).
        connection: Database connection name.
        **opts: Extra payload or envelope opts.
    """
    env = _pop_envelope_opts(opts)
    payload: Dict[str, Any] = {
        "type": "model",
        "class": cls_name,
        "message": cls_name,
        "attributes": attributes,
    }
    if relations is not None:
        payload["relations"] = relations
    if exists is not None:
        payload["exists"] = exists
    if connection is not None:
        payload["connection"] = connection
    payload.update(opts)
    _emit(payload, **env)


def dumpio_collection(
    items: List[Any],
    *,
    count: Optional[int] = None,
    **opts: Any,
) -> None:
    """Send a ``collection`` dump (a list of items).

    Args:
        items: The collection's elements.
        count: Item count; defaults to ``len(items)``.
        **opts: ``message=...`` (a label) and extras, or envelope opts.
    """
    env = _pop_envelope_opts(opts)
    payload: Dict[str, Any] = {
        "type": "collection",
        "items": items,
        "count": count if count is not None else len(items),
    }
    payload.setdefault("message", "collection")
    payload.update(opts)
    _emit(payload, **env)


def dumpio_table(
    columns: List[str],
    rows: List[Any],
    **opts: Any,
) -> None:
    """Send a ``table`` dump (explicit columns + rows).

    Args:
        columns: Column headers.
        rows: Either arrays aligned to ``columns`` or record dicts.
        **opts: ``message=...`` (a label) and extras, or envelope opts.
    """
    env = _pop_envelope_opts(opts)
    payload: Dict[str, Any] = {
        "type": "table",
        "columns": columns,
        "rows": rows,
    }
    payload.setdefault("message", "table")
    payload.update(opts)
    _emit(payload, **env)


def dumpio_measure(
    name: str,
    time_ms: float,
    *,
    memory: Optional[int] = None,
    context: Optional[Dict[str, Any]] = None,
    **opts: Any,
) -> None:
    """Send a ``measure`` dump (a single timing).

    Args:
        name: Label for what was measured (also the title).
        time_ms: Elapsed time in milliseconds (>100 amber, >1000 red).
        memory: Memory in bytes.
        context: Extra context (e.g. ``{"route": "/dashboard"}``).
        **opts: Extra payload or envelope opts.
    """
    env = _pop_envelope_opts(opts)
    payload: Dict[str, Any] = {
        "type": "measure",
        "name": name,
        "message": name,
        "time": time_ms,
    }
    if memory is not None:
        payload["memory"] = memory
    if context is not None:
        payload["context"] = context
    payload.update(opts)
    _emit(payload, **env)


def dumpio_performance(
    metrics: Dict[str, Any],
    *,
    breakdown: Optional[Dict[str, Any]] = None,
    context: Optional[Dict[str, Any]] = None,
    **opts: Any,
) -> None:
    """Send a ``performance`` dump (a metric bundle with breakdown).

    Args:
        metrics: Named metric values (memory/bytes byte-formatted, time/ms
            suffixed, cpu/usage/percent as ``%``).
        breakdown: Millisecond slices rendered as a stacked bar.
        context: Extra context.
        **opts: ``message=...`` (a label) and extras, or envelope opts.
    """
    env = _pop_envelope_opts(opts)
    payload: Dict[str, Any] = {
        "type": "performance",
        "metrics": metrics,
    }
    if breakdown is not None:
        payload["breakdown"] = breakdown
    if context is not None:
        payload["context"] = context
    payload.setdefault("message", "performance")
    payload.update(opts)
    _emit(payload, **env)


def dumpio_event(
    event: str,
    *,
    entity: Optional[str] = None,
    entity_id: Optional[Any] = None,
    actor: Optional[Dict[str, Any]] = None,
    data: Optional[Dict[str, Any]] = None,
    metadata: Optional[Dict[str, Any]] = None,
    **opts: Any,
) -> None:
    """Send an ``event`` dump (a business/domain event).

    Args:
        event: Event name, e.g. ``"order.completed"`` (also the title).
        entity: Entity type, e.g. ``"order"``.
        entity_id: Entity identifier.
        actor: Who triggered it, e.g. ``{"type": "user", "id": 1}``.
        data: Event payload.
        metadata: Extra metadata, e.g. ``{"source": "web"}``.
        **opts: Extra payload or envelope opts.
    """
    env = _pop_envelope_opts(opts)
    payload: Dict[str, Any] = {
        "type": "event",
        "event": event,
        "message": event,
    }
    if entity is not None:
        payload["entity"] = entity
    if entity_id is not None:
        payload["entity_id"] = entity_id
    if actor is not None:
        payload["actor"] = actor
    if data is not None:
        payload["data"] = data
    if metadata is not None:
        payload["metadata"] = metadata
    payload.update(opts)
    _emit(payload, **env)
