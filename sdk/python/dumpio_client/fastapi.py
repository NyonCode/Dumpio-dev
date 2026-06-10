"""FastAPI / Starlette integration for dumpio-client.

Add the middleware to emit one ``http`` dump per request::

    from fastapi import FastAPI
    from dumpio_client.fastapi import DumpioMiddleware

    app = FastAPI()
    app.add_middleware(DumpioMiddleware)

If Starlette/FastAPI is not installed, importing this module still succeeds and
:class:`DumpioMiddleware` degrades to a transparent pass-through ASGI wrapper,
so nothing breaks. Every emit is wrapped and swallowed.
"""

from __future__ import annotations

import time
from typing import Any

try:  # pragma: no cover - exercised only when starlette is present
    from starlette.middleware.base import BaseHTTPMiddleware

    _HAS_STARLETTE = True
except Exception:  # pragma: no cover
    BaseHTTPMiddleware = object  # type: ignore[assignment,misc]
    _HAS_STARLETTE = False

from . import dumpio_http


class DumpioMiddleware(BaseHTTPMiddleware):  # type: ignore[misc,valid-type]
    """Starlette ``BaseHTTPMiddleware`` emitting an ``http`` dump per request.

    When Starlette isn't importable this still constructs as a minimal ASGI
    pass-through (``app(scope, receive, send)``) so adding it never raises.
    """

    def __init__(self, app: Any, *args: Any, **kwargs: Any) -> None:
        self.app = app
        if _HAS_STARLETTE:
            super().__init__(app)

    async def dispatch(self, request: Any, call_next: Any) -> Any:
        """Starlette hook: time the request and emit an ``http`` dump."""
        start = time.time()
        response = await call_next(request)
        try:
            elapsed_ms = (time.time() - start) * 1000.0
            url = str(getattr(request, "url", ""))
            path = getattr(getattr(request, "url", None), "path", url)
            dumpio_http(
                getattr(request, "method", "GET"),
                path or url,
                getattr(response, "status_code", None),
                headers=self._headers(request),
                response_time=round(elapsed_ms, 2),
                channel="http",
            )
        except Exception:
            pass
        return response

    async def __call__(self, scope: Any, receive: Any, send: Any) -> Any:
        """Fallback ASGI entry point used when Starlette is unavailable."""
        if _HAS_STARLETTE:
            return await super().__call__(scope, receive, send)
        # No Starlette: behave as a transparent pass-through.
        return await self.app(scope, receive, send)

    @staticmethod
    def _headers(request: Any) -> Any:
        try:
            return dict(request.headers)
        except Exception:
            return None
