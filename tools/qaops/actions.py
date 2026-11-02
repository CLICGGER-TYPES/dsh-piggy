"""通过观察器与 native input adapter 执行可复用的真实输入动作。"""
from __future__ import annotations

import json
import os
import stat
import time
from datetime import datetime, timezone
from collections.abc import Callable, Mapping, Sequence
from pathlib import Path
from typing import Any

from .geometry import CoordinateMapper
from .input_adapter import NativeInputAdapter
from .target_positioner import TargetPositioner
from .model import (ActionRecord, ControlSpec, NativeWindow, PageRef,
                    PageSnapshot, Point, QAOperationError)
from .observe import Observer

class Actions:
    def __init__(self, observer: Observer, mapper: CoordinateMapper,
                 native: NativeInputAdapter, *, log: Callable[[Mapping[str, Any]], None] | None = None,
                 pointer_settle_seconds: float = 0.15):
        self.observer = observer
        self.mapper = mapper
        self.native = native
        self.log = log or (lambda _record: None)
        self.pointer_settle_seconds = pointer_settle_seconds
        self.positioner = TargetPositioner(observer, mapper, native,
                                           pointer_settle_seconds=pointer_settle_seconds)

    def _require_focus(self, page: PageRef, control: ControlSpec) -> NativeWindow:
        if not self.observer.focused(page, control):
            raise QAOperationError("ACTION_NOCOVER", "configured control is not the current DOM focus")
        owned = self.observer.native.owned_window(page)
        active = self.native.active_window(page)
        self.positioner.require_owned(owned)
        self.positioner.require_owned(active)
        if not CoordinateMapper.same_native_window(owned, active):
            raise QAOperationError("ACTION_NOCOVER", "active native window is not the configured owned window")
        return active

    def _click(self, page: PageRef, control: ControlSpec, button: int) -> ActionRecord:
        prepared = self.positioner.position(page, control, remap_budget=1)
        latest_window = self.observer.native.owned_window(page)
        self.positioner.require_owned(latest_window)
        if not CoordinateMapper.same_native_window(prepared["window"], latest_window):
            if prepared["remaps"] >= 1:
                raise QAOperationError("ACTION_NOCOVER", "native bounds changed twice before input")
            prepared = self.positioner.position(page, control, remap_budget=0)
            latest_window = self.observer.native.owned_window(page)
            if not CoordinateMapper.same_native_window(prepared["window"], latest_window):
                raise QAOperationError("ACTION_NOCOVER", "native bounds changed after one bounded remap")
        latest_window, pointer, pointer_viewport, pointer_hit, verified_snapshot, verified_mapping = \
            self.positioner.verify_position(page, control, prepared)
        result = self.native.click_button(button)
        if result != 0:
            raise QAOperationError("ACTION_NOCOVER", f"native click returned {result}")
        record = ActionRecord(
            "context-click" if button == 3 else "click", page.target_id, control.key,
            {"xTestReturnCode": result, "pointerScreenPx": pointer.as_dict(),
             "pointerViewportCss": pointer_viewport.as_dict(), "pointerHit": dict(pointer_hit)},
            {"mappedPoint": dict(verified_mapping), "nativeWindowBounds": latest_window.bounds.as_dict(),
             "devicePixelRatio": verified_snapshot.metrics.device_pixel_ratio,
             "boundsRemaps": prepared["remaps"]},
        )
        self.log(self.record_dict(record))
        return record

    def click(self, page: PageRef, control: ControlSpec) -> ActionRecord:
        return self._click(page, control, 1)

    def context_click(self, page: PageRef, control: ControlSpec) -> ActionRecord:
        return self._click(page, control, 3)

    def key(self, page: PageRef, focus_control: ControlSpec, keys: Sequence[str]) -> ActionRecord:
        window = self._require_focus(page, focus_control)
        result = self.native.key(tuple(keys))
        if result != 0:
            raise QAOperationError("ACTION_NOCOVER", f"native key input returned {result}")
        record = ActionRecord("key", page.target_id, focus_control.key,
                              {"keys": list(keys), "returnCode": result},
                              {"nativeWindowBounds": window.bounds.as_dict()})
        self.log(self.record_dict(record))
        return record

    def type_text(self, page: PageRef, focus_control: ControlSpec, text: str) -> ActionRecord:
        window = self._require_focus(page, focus_control)
        result = self.native.type_text_safe(text)
        record = ActionRecord("type", page.target_id, focus_control.key,
                              {"characterCount": len(text), "valueLogged": False, "returnCode": result},
                              {"nativeWindowBounds": window.bounds.as_dict()})
        self.log(self.record_dict(record))
        if result != 0:
            raise QAOperationError("ACTION_NOCOVER", f"native text input returned {result}")
        return record

    def type_private_file(self, page: PageRef, focus_control: ControlSpec, path: str | Path) -> ActionRecord:
        file = Path(path)
        try:
            before = file.lstat()
            fd = os.open(file, os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC)
        except OSError as error:
            raise QAOperationError("ENVIRONMENT", "private input could not be opened safely") from error
        info = os.fstat(fd)
        if (not stat.S_ISREG(info.st_mode) or info.st_uid != os.geteuid()
                or (info.st_dev, info.st_ino) != (before.st_dev, before.st_ino)):
            os.close(fd)
            raise QAOperationError("ENVIRONMENT", "private input is not an owned regular file")
        if stat.S_IMODE(info.st_mode) != 0o600 or info.st_size <= 0:
            os.close(fd)
            raise QAOperationError("ENVIRONMENT", "private input must be a nonempty mode-0600 file")
        count = 0
        result = -1
        input_error = None
        window = None
        file_removed = False
        try:
            window = self._require_focus(page, focus_control)
            result = self.native.type_private_fd(fd)
            if result != 0:
                raise QAOperationError("ACTION_NOCOVER", f"private text input returned {result}")
            count = info.st_size
        except Exception as error:
            input_error = error
        finally:
            os.close(fd)
            try:
                erase_fd = os.open(file, os.O_WRONLY | os.O_NOFOLLOW | os.O_CLOEXEC)
                try:
                    erase_info = os.fstat(erase_fd)
                    if (erase_info.st_dev, erase_info.st_ino) != (info.st_dev, info.st_ino):
                        raise OSError("private input identity changed")
                    remaining = info.st_size
                    block = b"\0" * min(65536, max(1, remaining))
                    while remaining:
                        written = os.write(erase_fd, block[:remaining])
                        if written <= 0:
                            raise OSError("private input erase made no progress")
                        remaining -= written
                    os.fsync(erase_fd)
                finally:
                    os.close(erase_fd)
                current = file.lstat()
                if (current.st_dev, current.st_ino) != (info.st_dev, info.st_ino):
                    raise OSError("private input identity changed before unlink")
                file.unlink()
                file_removed = True
            except OSError as error:
                if input_error is None:
                    input_error = QAOperationError("ENVIRONMENT", "private input could not be erased safely")
        if input_error is not None:
            record = ActionRecord("type-private-file", page.target_id, focus_control.key,
                                  {"inputBytes": info.st_size, "valueLogged": False,
                                   "fileRemoved": file_removed, "returnCode": result},
                                  {"nativeWindowBounds": window.bounds.as_dict() if window else {}})
            self.log(self.record_dict(record))
            category = getattr(input_error, "category", "ACTION_NOCOVER")
            raise QAOperationError(category, "private text action failed") from None
        record = ActionRecord("type-private-file", page.target_id, focus_control.key,
            {"inputBytes": count, "valueLogged": False, "fileRemoved": True,
                               "returnCode": result},
                              {"nativeWindowBounds": window.bounds.as_dict()})
        self.log(self.record_dict(record))
        return record

    def scroll(self, page: PageRef, control: ControlSpec, ticks: int) -> ActionRecord:
        if ticks == 0:
            raise QAOperationError("ACTION_NOCOVER", "wheel scroll requires nonzero ticks")
        prepared = self.positioner.position(page, control, remap_budget=1)
        _window, pointer, _viewport, _hit, _verified_snapshot, verified_mapping = \
            self.positioner.verify_position(page, control, prepared)
        direction = 1 if ticks > 0 else -1
        result = self.native.wheel(direction, abs(ticks))
        if result != 0:
            raise QAOperationError("ACTION_NOCOVER", f"native wheel input returned {result}")
        record = ActionRecord("wheel-scroll", page.target_id, control.key,
                              {"direction": direction, "ticks": abs(ticks), "returnCode": result,
                               "pointerScreenPx": pointer.as_dict()},
                              {"nativeWindowBounds": prepared["window"].bounds.as_dict(),
                               "mappedPoint": dict(verified_mapping)})
        self.log(self.record_dict(record))
        return record

    def drag(self, page: PageRef, start: ControlSpec, end: ControlSpec | None = None, *,
             end_viewport_offset: Point | None = None, steps: int = 8) -> ActionRecord:
        if steps < 2:
            raise QAOperationError("ACTION_NOCOVER", "drag requires at least two path steps")
        if (end is None) == (end_viewport_offset is None):
            raise QAOperationError("ACTION_NOCOVER", "drag requires exactly one end control or viewport offset")
        prepared = self.positioner.position(page, start, remap_budget=1)
        controls = (start, end) if end is not None else (start,)
        snapshot = self.observer.snapshot(page, controls)
        start_observed = self.positioner.require_control(snapshot, start)
        if end is not None:
            end_point = self.positioner.require_control(snapshot, end).center
        else:
            end_point = Point(start_observed.center.x + end_viewport_offset.x,
                              start_observed.center.y + end_viewport_offset.y)
            if not (0 <= end_point.x < snapshot.metrics.inner_width and
                    0 <= end_point.y < snapshot.metrics.inner_height):
                raise QAOperationError("ACTION_NOCOVER", "drag endpoint lies outside the current viewport")
        window = self.observer.native.owned_window(page)
        self.positioner.require_owned(window)
        if not CoordinateMapper.same_native_window(prepared["window"], window):
            raise QAOperationError("ACTION_NOCOVER", "native bounds changed before drag button-down")
        start_point = self.mapper.to_native(start_observed.center, snapshot.metrics, window.bounds)["screenPointPx"]
        end_screen = self.mapper.to_native(end_point, snapshot.metrics, window.bounds)["screenPointPx"]
        a = Point(float(start_point["x"]), float(start_point["y"]))
        b = Point(float(end_screen["x"]), float(end_screen["y"]))
        # 按最新快照重新定位，并在按下前验证当前指针仍命中同一 DOM 控件。
        self.native.move_to_screen(a)
        time.sleep(self.pointer_settle_seconds)
        start_pointer = self.native.pointer_screen()
        if abs(start_pointer.x - a.x) > 1 or abs(start_pointer.y - a.y) > 1:
            raise QAOperationError("ACTION_NOCOVER", "drag start pointer did not reach the current target")
        start_mapping = self.mapper.to_native(start_observed.center, snapshot.metrics, window.bounds)
        start_viewport = self.mapper.to_viewport(start_pointer, start_mapping)
        start_hit = self.observer.hit_test(page, start_viewport, start)
        if start_hit.get("hit") is not True:
            raise QAOperationError("ACTION_NOCOVER", "drag start pointer no longer hits the current control")
        latest = self.observer.native.owned_window(page)
        self.positioner.require_owned(latest)
        if not CoordinateMapper.same_native_window(window, latest):
            raise QAOperationError("ACTION_NOCOVER", "owned native window changed before drag button-down")
        down_attempted = False
        down_returned = False
        moved = 0
        path = []
        pointer = start_pointer
        release_result = None
        operation_error = None
        prior_pointer = start_pointer
        try:
            # Mark before the call: an adapter may issue the down event and then fail.
            down_attempted = True
            down_result = self.native.button_down(1)
            if down_result != 0:
                raise QAOperationError("ACTION_NOCOVER", f"drag button-down returned {down_result}")
            down_returned = True
            for index in range(1, steps + 1):
                fraction = index / steps
                point = Point(a.x + (b.x - a.x) * fraction, a.y + (b.y - a.y) * fraction)
                target_px = Point(round(point.x), round(point.y))
                dx, dy = round(target_px.x - prior_pointer.x), round(target_px.y - prior_pointer.y)
                motion_event = bool(dx or dy)
                if motion_event:
                    relative_result = self.native.move_relative(dx, dy)
                    if relative_result != 0:
                        raise QAOperationError("ACTION_NOCOVER", f"drag relative motion returned {relative_result}")
                    actual = self.positioner.wait_pointer(target_px)
                else:
                    time.sleep(0.02)
                    actual = self.native.pointer_screen()
                path.append({"commandScreenPx": target_px.as_dict(), "actualScreenPx": actual.as_dict(),
                             "motionEvent": motion_event, "monotonicNs": time.monotonic_ns()})
                moved += 1
                if abs(actual.x - target_px.x) > 1 or abs(actual.y - target_px.y) > 1:
                    raise QAOperationError("ACTION_NOCOVER", "drag pointer left the commanded path")
                prior_pointer = actual
            pointer = self.native.pointer_screen()
        except Exception as error:
            operation_error = error
        finally:
            if down_attempted:
                try:
                    release_result = self.native.button_up(1)
                except Exception as error:
                    release_result = {"errorType": type(error).__name__}
        try:
            pointer = self.native.pointer_screen()
        except Exception as error:
            if operation_error is None:
                operation_error = error
        record = ActionRecord("drag", page.target_id,
                              f"{start.key}->{end.key if end is not None else 'viewport-offset'}",
                              {"button": 1, "buttonDownAttempted": down_attempted, "pathSteps": moved,
                               "motionMethod": "xdotool relative native pointer motion",
                               "path": path, "pointerScreenPx": pointer.as_dict(),
                               "buttonDownReturnCode": down_result if down_attempted and down_returned else None,
                               "buttonDownReturned": down_returned,
                               "buttonReleaseResult": release_result,
                               "buttonReleased": release_result == 0},
                              {"startScreenPx": a.as_dict(), "endScreenPx": b.as_dict(),
                               "nativeWindowBounds": window.bounds.as_dict(),
                               "devicePixelRatio": snapshot.metrics.device_pixel_ratio,
                               "endTarget": end.key if end is not None else "viewport-offset"})
        self.log(self.record_dict(record))
        if operation_error is not None:
            raise QAOperationError("ACTION_NOCOVER", f"drag failed ({type(operation_error).__name__})") from None
        if release_result != 0:
            raise QAOperationError("ACTION_NOCOVER", "drag button release was not confirmed")
        return record

    @staticmethod
    def record_dict(record: ActionRecord) -> dict[str, Any]:
        return {"atUtc": datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
                "monotonicNs": time.monotonic_ns(),
                "actionKind": record.action_kind, "pageTargetId": record.page_target_id,
                "controlKey": record.control_key, "input": dict(record.input_result),
                "geometry": dict(record.geometry), "observations": list(record.observations)}
