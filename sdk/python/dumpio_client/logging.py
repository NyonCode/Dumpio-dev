"""Stdlib ``logging`` integration for dumpio-client.

Attach :class:`DumpioHandler` to any logger to forward records as ``log`` dumps
(and ``exception`` dumps when a record carries ``exc_info``)::

    import logging
    from dumpio_client.logging import DumpioHandler

    logging.getLogger().addHandler(DumpioHandler())

The handler never raises into the logging framework — all forwarding is wrapped
and swallowed, so a missing viewer leaves logging untouched.
"""

from __future__ import annotations

import logging
from typing import Any

from . import dumpio_exception, dumpio_log


class DumpioHandler(logging.Handler):
    """A ``logging.Handler`` that forwards records to the Dumpio viewer.

    Records map to ``log`` dumps; their level name becomes the ``log`` level
    (driving the flag color). When a record includes exception info, an
    ``exception`` dump is emitted instead of (in addition to) the log line.
    """

    def __init__(self, level: int = logging.NOTSET, channel: str = "log") -> None:
        super().__init__(level)
        self.channel = channel

    def emit(self, record: logging.LogRecord) -> None:
        try:
            details: dict[str, Any] = {
                "logger": record.name,
                "module": record.module,
                "line": record.lineno,
            }
            dumpio_log(
                record.levelname.lower(),
                record.getMessage(),
                details=details,
                channel=self.channel,
            )
            if record.exc_info:
                exc = record.exc_info[1]
                if isinstance(exc, BaseException):
                    dumpio_exception(exc, channel=self.channel)
        except Exception:
            # Logging handlers must never raise; honor handleError contract.
            try:
                self.handleError(record)
            except Exception:
                pass
