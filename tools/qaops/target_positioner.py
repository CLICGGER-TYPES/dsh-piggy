"""统一控件点定位、owned-window边界和真实指针反算验证。"""
from __future__ import annotations

import time

from .geometry import CoordinateMapper
from .model import ControlSpec, NativeWindow, PageRef, PageSnapshot, Point, QAOperationError
from .observe import Observer
from .input_adapter import NativeInputAdapter


class TargetPositioner:
    def __init__(self, observer: Observer, mapper: CoordinateMapper, native: NativeInputAdapter, *,
                 pointer_settle_seconds: float = 0.15):
        self.observer = observer
        self.mapper = mapper
        self.native = native
        self.pointer_settle_seconds = pointer_settle_seconds

    @staticmethod
    def require_control(snapshot: PageSnapshot, control: ControlSpec):
        value = snapshot.controls.get(control.key)
        if value is None or value.count != 1 or not value.visible or value.center is None:
            raise QAOperationError("ACTION_NOCOVER", f"control is not a unique visible target: {control.key}")
        if not value.center_hit:
            raise QAOperationError("ACTION_NOCOVER", f"control center failed elementFromPoint: {control.key}")
        return value

    @staticmethod
    def require_owned(window: NativeWindow):
        if not window.owned or not window.viewable:
            raise QAOperationError("ACTION_NOCOVER", "native target is not a unique owned viewable window")

    def verify_position(self, page: PageRef, control: ControlSpec, prepared):
        snapshot = self.observer.snapshot(page, (control,))
        self.require_control(snapshot, control)
        window = self.observer.native.owned_window(page)
        self.require_owned(window)
        if not CoordinateMapper.same_native_window(prepared["window"], window):
            raise QAOperationError("ACTION_NOCOVER", "owned native bounds changed immediately before input")
        pointer = self.native.pointer_screen()
        expected = prepared["pointer"]
        if abs(pointer.x - expected.x) > 1 or abs(pointer.y - expected.y) > 1:
            raise QAOperationError("ACTION_NOCOVER", "native pointer changed immediately before input")
        origin_mapping = self.mapper.to_native(Point(0, 0), snapshot.metrics, window.bounds)
        point = self.mapper.to_viewport(pointer, origin_mapping)
        mapping = self.mapper.to_native(point, snapshot.metrics, window.bounds)
        mapped_screen = mapping["screenPointPx"]
        if abs(float(mapped_screen["x"]) - pointer.x) > 1 or abs(float(mapped_screen["y"]) - pointer.y) > 1:
            raise QAOperationError("ACTION_NOCOVER", "fresh viewport remap disagrees with actual pointer")
        hit = self.observer.hit_test(page, point, control)
        if hit.get("hit") is not True:
            raise QAOperationError("ACTION_NOCOVER", "actual pointer no longer hits the configured control")
        return window, pointer, point, hit, snapshot, mapping

    def position(self, page: PageRef, control: ControlSpec, *, remap_budget: int = 1):
        last_geometry = None
        for remaps in range(remap_budget + 1):
            snapshot = self.observer.snapshot(page, (control,))
            target = self.require_control(snapshot, control)
            window = self.observer.native.owned_window(page)
            self.require_owned(window)
            mapped = self.mapper.to_native(target.center, snapshot.metrics, window.bounds)
            screen_value = mapped["screenPointPx"]
            screen_point = Point(float(screen_value["x"]), float(screen_value["y"]))
            self.native.move_to_screen(screen_point)
            time.sleep(self.pointer_settle_seconds)
            pointer = self.native.pointer_screen()
            if abs(pointer.x - screen_point.x) > 1 or abs(pointer.y - screen_point.y) > 1:
                raise QAOperationError("ACTION_NOCOVER", "native pointer did not reach the mapped point")
            viewport_point = self.mapper.to_viewport(pointer, mapped)
            hit = self.observer.hit_test(page, viewport_point, control)
            if hit.get("hit") is not True or hit.get("pageTargetId", page.target_id) != page.target_id:
                raise QAOperationError("ACTION_NOCOVER", "actual pointer failed fresh DOM elementFromPoint")

            fresh = self.observer.snapshot(page, (control,))
            self.require_control(fresh, control)
            fresh_window = self.observer.native.owned_window(page)
            self.require_owned(fresh_window)
            if fresh.page.target_id != page.target_id:
                raise QAOperationError("ACTION_NOCOVER", "page target changed during pointer placement")
            if not CoordinateMapper.same_native_window(window, fresh_window):
                last_geometry = fresh_window
                if remaps == remap_budget:
                    break
                continue
            return {
                "snapshot": fresh, "control": self.require_control(fresh, control),
                "window": fresh_window, "mapped": mapped, "pointer": pointer,
                "pointerViewport": viewport_point, "pointerHit": hit, "remaps": remaps,
            }
        raise QAOperationError("ACTION_NOCOVER", f"native bounds changed during placement: {last_geometry!r}")

    def wait_pointer(self, target: Point, timeout: float = 0.25) -> Point:
        deadline = time.monotonic() + timeout
        while True:
            pointer = self.native.pointer_screen()
            if abs(pointer.x - target.x) <= 1 and abs(pointer.y - target.y) <= 1:
                return pointer
            if time.monotonic() >= deadline:
                return pointer
            time.sleep(0.01)
