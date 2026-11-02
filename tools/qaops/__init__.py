"""供 DSH 与桌面验收工具复用的 Linux native UI 操作库。"""
from .actions import Actions
from .geometry import CoordinateMapper
from .observe import Observer
from .wiring import create_operations
from .model import (ActionRecord, ControlObservation, ControlSpec, NativeBounds,
                    NativeWindow, PageRef, PageSnapshot, Point, QAOperationError,
                    ScreenshotRef, ViewportMetrics)

__all__ = [
    "Actions", "CoordinateMapper", "Observer", "create_operations", "ActionRecord",
    "ControlObservation", "ControlSpec", "NativeBounds", "NativeWindow",
    "PageRef", "PageSnapshot", "Point", "QAOperationError",
    "ScreenshotRef", "ViewportMetrics",
]
