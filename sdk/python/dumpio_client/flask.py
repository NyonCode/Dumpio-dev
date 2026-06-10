"""Flask integration for dumpio-client.

Register the extension to emit an ``http`` dump per request and an
``exception`` dump whenever a request teardown carries an error::

    from flask import Flask
    from dumpio_client.flask import DumpioFlask

    app = Flask(__name__)
    DumpioFlask(app)            # or: DumpioFlask().init_app(app)

Importing this module never requires Flask, and every hook is wrapped so a
missing viewer or a serialization error can't break the request lifecycle.
"""

from __future__ import annotations

import time
from typing import Any, Optional

from . import dumpio_exception, dumpio_http


class DumpioFlask:
    """Flask extension forwarding requests and exceptions to Dumpio.

    Use the app-factory pattern with :meth:`init_app`, or pass the app to the
    constructor for immediate registration.
    """

    def __init__(self, app: Optional[Any] = None) -> None:
        if app is not None:
            self.init_app(app)

    def init_app(self, app: Any) -> None:
        """Wire ``before_request`` / ``after_request`` / ``teardown_request``."""
        try:
            app.before_request(self._before_request)
            app.after_request(self._after_request)
            app.teardown_request(self._teardown_request)
        except Exception:
            pass

    # -- hooks ----------------------------------------------------------------

    def _before_request(self) -> None:
        try:
            from flask import g

            g._dumpio_start = time.time()
        except Exception:
            pass

    def _after_request(self, response: Any) -> Any:
        try:
            from flask import g, request

            start = getattr(g, "_dumpio_start", None)
            response_time = None
            if start is not None:
                response_time = round((time.time() - start) * 1000.0, 2)
            dumpio_http(
                request.method,
                request.full_path.rstrip("?") or request.path,
                getattr(response, "status_code", None),
                headers=dict(request.headers),
                response_time=response_time,
                channel="http",
            )
        except Exception:
            pass
        return response

    def _teardown_request(self, exc: Optional[BaseException]) -> None:
        if exc is None:
            return
        try:
            from flask import request

            dumpio_exception(
                exc,
                context={
                    "request": {
                        "method": request.method,
                        "url": request.full_path.rstrip("?") or request.path,
                        "headers": dict(request.headers),
                    }
                },
                channel="http",
            )
        except Exception:
            pass


def init_app(app: Any) -> DumpioFlask:
    """Functional shortcut: ``init_app(app)`` returns the extension instance."""
    ext = DumpioFlask()
    ext.init_app(app)
    return ext
