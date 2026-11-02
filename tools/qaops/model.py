"""内部 native UI 操作共享的轻量数据类型。"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Mapping, Sequence


class QAOperationError(RuntimeError):
    def __init__(self, category: str, message: str):
        super().__init__(message)
        self.category = category


@dataclass(frozen=True)
class Point:
    x: float
    y: float

    def as_dict(self) -> dict[str, float]:
        return {"x": self.x, "y": self.y}


@dataclass(frozen=True)
class ViewportMetrics:
    inner_width: float
    inner_height: float
    outer_width: float
    outer_height: float
    device_pixel_ratio: float

    def as_dict(self) -> dict[str, float]:
        return {"innerWidth": self.inner_width, "innerHeight": self.inner_height,
                "outerWidth": self.outer_width, "outerHeight": self.outer_height,
                "devicePixelRatio": self.device_pixel_ratio}


@dataclass(frozen=True)
class NativeBounds:
    """xwininfo 的屏幕绝对 client 起点及 client 尺寸，不含额外 frame extents 修正。"""
    x: int
    y: int
    width: int
    height: int

    def as_dict(self) -> dict[str, int]:
        return {"x": self.x, "y": self.y, "width": self.width, "height": self.height}


@dataclass(frozen=True)
class PageRef:
    target_id: str
    role: str
    url: str


@dataclass(frozen=True)
class ControlSpec:
    """Task-provided locator; generic operations never store selectors."""
    key: str
    selector: str
    accessible_name: str | None = None


@dataclass(frozen=True)
class ControlObservation:
    count: int
    visible: bool
    center_hit: bool
    center: Point | None
    rect: Mapping[str, float] = field(default_factory=dict)
    label: str | None = None


@dataclass(frozen=True)
class PageSnapshot:
    page: PageRef
    metrics: ViewportMetrics
    controls: Mapping[str, ControlObservation]
    state: Mapping[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class NativeWindow:
    window_id: str
    pid: int
    pgid: int
    sid: int
    bounds: NativeBounds
    owned: bool
    viewable: bool
    wm_class: str = ""

    def identity(self) -> tuple[str, int, int, int]:
        return self.window_id, self.pid, self.pgid, self.sid

    def geometry(self) -> tuple[int, int, int, int]:
        return self.bounds.x, self.bounds.y, self.bounds.width, self.bounds.height


@dataclass(frozen=True)
class ScreenshotRef:
    path: str
    space: str  # "viewport" or "native-fullscreen"
    width: int | None = None
    height: int | None = None


@dataclass(frozen=True)
class ActionRecord:
    action_kind: str
    page_target_id: str | None
    control_key: str | None
    input_result: Mapping[str, Any]
    geometry: Mapping[str, Any] = field(default_factory=dict)
    observations: Sequence[Mapping[str, Any]] = ()
