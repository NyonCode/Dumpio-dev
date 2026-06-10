"""Serialize any Python value into Dumpio's language-agnostic ``var`` tree.

(PLAN-VIEWER C1.) The same tree shape is produced by the PHP/Node/Go SDKs so
the receiver renders every language identically.

A node is a ``dict``::

    {"kind": ..., "class"?, "visibility"?, "key"?, "value"?,
     "children"?, "refId"?, "truncated"?}

``kind`` is one of: object array map set string int float bool null undefined
resource callable ref.
"""

from __future__ import annotations

import dataclasses
from typing import Any, Dict, List

_DEFAULTS = {"max_depth": 6, "max_items": 100, "max_string": 2000}


class Serializer:
    def __init__(self, max_depth: int = 6, max_items: int = 100, max_string: int = 2000) -> None:
        self.max_depth = max_depth
        self.max_items = max_items
        self.max_string = max_string
        self._seen: Dict[int, int] = {}
        self._counter = 0

    def serialize(self, value: Any) -> Dict[str, Any]:
        self._seen = {}
        self._counter = 0
        return self._walk(value, 0)

    # -- helpers ---------------------------------------------------------

    def _scalar_string(self, value: str) -> Dict[str, Any]:
        if len(value) > self.max_string:
            return {"kind": "string", "value": value[: self.max_string], "truncated": True}
        return {"kind": "string", "value": value}

    def _new_ref(self) -> int:
        self._counter += 1
        return self._counter

    # -- core ------------------------------------------------------------

    def _walk(self, value: Any, depth: int) -> Dict[str, Any]:
        if value is None:
            return {"kind": "null"}
        if isinstance(value, bool):  # before int — bool is a subclass of int
            return {"kind": "bool", "value": value}
        if isinstance(value, int):
            return {"kind": "int", "value": value}
        if isinstance(value, float):
            if value != value or value in (float("inf"), float("-inf")):
                special = "NAN" if value != value else ("INF" if value > 0 else "-INF")
                return {"kind": "float", "class": "special", "value": special}
            return {"kind": "float", "value": value}
        if isinstance(value, str):
            return self._scalar_string(value)
        if isinstance(value, (bytes, bytearray)):
            text = bytes(value).decode("utf-8", "replace")
            node = self._scalar_string(text)
            node["class"] = type(value).__name__
            return node
        if callable(value) and not isinstance(value, type):
            name = getattr(value, "__name__", repr(value))
            return {"kind": "callable", "class": name}

        # Containers / objects — cycle check first.
        ident = id(value)
        if ident in self._seen:
            return {"kind": "ref", "refId": self._seen[ident]}

        if isinstance(value, dict):
            return self._walk_dict(value, depth, ident)
        if isinstance(value, (set, frozenset)):
            return self._walk_iterable(value, depth, ident, kind="set")
        if isinstance(value, (list, tuple)):
            klass = "tuple" if isinstance(value, tuple) else None
            return self._walk_iterable(value, depth, ident, kind="array", klass=klass)

        return self._walk_object(value, depth, ident)

    def _container(self, kind: str, depth: int, ident: int, klass: str | None) -> Dict[str, Any]:
        ref_id = self._new_ref()
        self._seen[ident] = ref_id
        node: Dict[str, Any] = {"kind": kind, "refId": ref_id, "children": []}
        if klass:
            node["class"] = klass
        return node

    def _push(self, node: Dict[str, Any], child: Dict[str, Any]) -> bool:
        children: List[Dict[str, Any]] = node["children"]
        if len(children) >= self.max_items:
            node["truncated"] = True
            return False
        children.append(child)
        return True

    def _walk_dict(self, value: dict, depth: int, ident: int) -> Dict[str, Any]:
        if depth >= self.max_depth:
            return {"kind": "map", "truncated": True}
        node = self._container("map", depth, ident, None)
        for key, item in value.items():
            child = self._walk(item, depth + 1)
            child["key"] = key if isinstance(key, (str, int)) else repr(key)
            if not self._push(node, child):
                break
        return node

    def _walk_iterable(self, value, depth: int, ident: int, kind: str, klass=None) -> Dict[str, Any]:
        if depth >= self.max_depth:
            stub = {"kind": kind, "truncated": True}
            if klass:
                stub["class"] = klass
            return stub
        node = self._container(kind, depth, ident, klass)
        for item in value:
            if not self._push(node, self._walk(item, depth + 1)):
                break
        return node

    def _walk_object(self, value: Any, depth: int, ident: int) -> Dict[str, Any]:
        klass = type(value).__name__
        if depth >= self.max_depth:
            return {"kind": "object", "class": klass, "truncated": True}
        node = self._container("object", depth, ident, klass)

        if dataclasses.is_dataclass(value) and not isinstance(value, type):
            attrs = {f.name: getattr(value, f.name) for f in dataclasses.fields(value)}
        else:
            attrs = getattr(value, "__dict__", None)
            if not isinstance(attrs, dict):
                # Fall back to repr() for objects without a usable __dict__.
                if not self._push(node, self._scalar_string(repr(value))):
                    pass
                return node

        for key, item in attrs.items():
            child = self._walk(item, depth + 1)
            child["key"] = key
            # Python convention: _name = protected, __name = private.
            if key.startswith("__"):
                child["visibility"] = "private"
            elif key.startswith("_"):
                child["visibility"] = "protected"
            else:
                child["visibility"] = "public"
            if not self._push(node, child):
                break
        return node


def serialize(value: Any, **limits: int) -> Dict[str, Any]:
    opts = {**_DEFAULTS, **limits}
    return Serializer(opts["max_depth"], opts["max_items"], opts["max_string"]).serialize(value)
