"""Viewport/native bridge over the shared reviewed mapper; injection is for offline checks."""
from __future__ import annotations

from collections.abc import Callable, Mapping
from typing import Any

from .model import NativeBounds, Point, QAOperationError, ViewportMetrics
from .viewport_mapper import viewport_to_native_point

ForwardMapper = Callable[[Mapping[str, float], Mapping[str, float], Mapping[str, int]], Mapping[str, Any]]


class CoordinateMapper:
    def __init__(self, forward: ForwardMapper | None = None):
        self._forward = forward or viewport_to_native_point

    def to_native(self, point: Point, metrics: ViewportMetrics, bounds: NativeBounds) -> Mapping[str, Any]:
        try:
            result = self._forward(point.as_dict(), metrics.as_dict(), bounds.as_dict())
            screen = result["screenPointPx"]
            origin = result["contentOriginPx"]
            dpr = float(result["devicePixelRatio"])
            mapped_bounds = result["nativeWindowBoundsPx"]
        except (KeyError, TypeError, ValueError) as error:
            raise QAOperationError("ACTION_NOCOVER", "coordinate mapper returned incomplete geometry") from error
        if dpr <= 0 or not (bounds.x <= int(screen["x"]) < bounds.x + bounds.width
                            and bounds.y <= int(screen["y"]) < bounds.y + bounds.height):
            raise QAOperationError("ACTION_NOCOVER", "mapped point lies outside current owned native bounds")
        if any(int(mapped_bounds[key]) != value for key, value in bounds.as_dict().items()):
            raise QAOperationError("ACTION_NOCOVER", "mapper used stale native bounds")
        return result

    @staticmethod
    def to_viewport(screen_point: Point, mapping: Mapping[str, Any]) -> Point:
        try:
            origin = mapping["contentOriginPx"]
            dpr = float(mapping["devicePixelRatio"])
            viewport = mapping["viewportSizeCss"]
            point = Point((screen_point.x - float(origin["x"])) / dpr,
                          (screen_point.y - float(origin["y"])) / dpr)
        except (KeyError, TypeError, ValueError, ZeroDivisionError) as error:
            raise QAOperationError("ACTION_NOCOVER", "cannot invert native point with current mapping") from error
        if not (0 <= point.x < float(viewport["width"]) and 0 <= point.y < float(viewport["height"])):
            raise QAOperationError("ACTION_NOCOVER", "native pointer maps outside the current DOM viewport")
        return point

    @staticmethod
    def same_native_window(first, second) -> bool:
        return first.identity() == second.identity() and first.geometry() == second.geometry()

    # Kept as a descriptive alias for callers that talk about geometry only.
    same_window_geometry = same_native_window
