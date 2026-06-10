"""Django integration for dumpio-client.

Add :class:`DumpioMiddleware` to ``MIDDLEWARE`` to emit one ``http`` dump per
request and an ``exception`` dump whenever a view raises::

    MIDDLEWARE = [
        # ...
        "dumpio_client.django.DumpioMiddleware",
    ]

Everything here is defensive: importing this module never requires Django, and
no emit can break the request — failures are swallowed so a missing viewer or a
serialization error stays invisible to the host app.
"""

from __future__ import annotations

import time
from typing import Any, Callable, Optional

from . import dumpio_exception, dumpio_http


class DumpioMiddleware:
    """New-style Django middleware that forwards requests and exceptions.

    Instantiate via Django's middleware chain (``__init__(get_response)``); each
    call emits an ``http`` dump for the response and, on a raised exception,
    an ``exception`` dump via :func:`dumpio_client.dumpio_exception`.
    """

    def __init__(self, get_response: Callable[[Any], Any]) -> None:
        self.get_response = get_response

    def __call__(self, request: Any) -> Any:
        start = time.time()
        response = self.get_response(request)
        try:
            elapsed_ms = (time.time() - start) * 1000.0
            dumpio_http(
                getattr(request, "method", "GET"),
                self._path(request),
                getattr(response, "status_code", None),
                headers=self._request_headers(request),
                response_time=round(elapsed_ms, 2),
                channel="http",
            )
        except Exception:
            pass
        return response

    def process_exception(self, request: Any, exception: BaseException) -> None:
        """Forward an unhandled view exception, then let Django handle it."""
        try:
            dumpio_exception(
                exception,
                context={
                    "request": {
                        "method": getattr(request, "method", None),
                        "url": self._path(request),
                        "headers": self._request_headers(request),
                    }
                },
                channel="http",
            )
        except Exception:
            pass
        # Return None so Django's normal exception handling proceeds.
        return None

    @staticmethod
    def _path(request: Any) -> str:
        try:
            return request.get_full_path()
        except Exception:
            return getattr(request, "path", "") or ""

    @staticmethod
    def _request_headers(request: Any) -> Optional[dict]:
        try:
            headers = getattr(request, "headers", None)
            if headers is not None:
                return dict(headers)
        except Exception:
            pass
        return None
