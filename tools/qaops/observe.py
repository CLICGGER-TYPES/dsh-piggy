"""只读观察页面与窗口，并提供有界语义等待。"""
from __future__ import annotations

import time
from pathlib import Path
from typing import Any, Callable, Protocol, Sequence

from .model import (ControlObservation, ControlSpec, NativeWindow, PageRef,
                    PageSnapshot, Point, QAOperationError, ScreenshotRef)


class BrowserObservationAdapter(Protocol):
    def page_candidates(self, role: str, expected_url: str) -> Sequence[PageRef]: ...
    def snapshot(self, page: PageRef, controls: Sequence[ControlSpec]) -> PageSnapshot: ...
    def hit_test(self, page: PageRef, point: Point, control: ControlSpec) -> dict[str, Any]: ...
    def console(self, page: PageRef, since: Any = None) -> Sequence[dict[str, Any]]: ...
    def capture_viewport(self, page: PageRef, path: Path) -> ScreenshotRef: ...
    def focused(self, page: PageRef, control: ControlSpec) -> bool: ...


class NativeObservationAdapter(Protocol):
    def owned_window(self, page: PageRef) -> NativeWindow: ...
    def pointer(self) -> Point: ...
    def capture_native(self, path: Path) -> ScreenshotRef: ...


class Observer:
    def __init__(self, browser: BrowserObservationAdapter, native: NativeObservationAdapter):
        self.browser = browser
        self.native = native

    def unique_page(self, role: str, expected_url: str) -> PageRef:
        pages = list(self.browser.page_candidates(role, expected_url))
        if len(pages) != 1:
            raise QAOperationError("ACTION_NOCOVER", f"expected one page for role/url, got {len(pages)}")
        return pages[0]

    def snapshot(self, page: PageRef, controls: Sequence[ControlSpec] = ()) -> PageSnapshot:
        fresh_page = self.unique_page(page.role, page.url)
        if fresh_page.target_id != page.target_id or fresh_page.role != page.role or fresh_page.url != page.url:
            raise QAOperationError("ACTION_NOCOVER", "page target changed during observation")
        state = self.browser.snapshot(fresh_page, controls)
        if state.page.target_id != fresh_page.target_id:
            raise QAOperationError("ACTION_NOCOVER", "snapshot came from a different page target")
        return state

    def control(self, snapshot: PageSnapshot, spec: ControlSpec) -> ControlObservation:
        value = snapshot.controls.get(spec.key)
        if value is None:
            raise QAOperationError("ACTION_NOCOVER", f"control key was not observed: {spec.key}")
        if value.count != 1 or not value.visible or value.center is None:
            raise QAOperationError("ACTION_NOCOVER", f"control is not unique and visible: {spec.key}")
        if not value.center_hit:
            raise QAOperationError("ACTION_NOCOVER", f"control center is not hit-testable: {spec.key}")
        return value

    def wait(self, page: PageRef, controls: Sequence[ControlSpec],
             predicate: Callable[[PageSnapshot], bool], timeout: float, poll: float = 0.15) -> PageSnapshot:
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            snapshot = self.snapshot(page, controls)
            if predicate(snapshot):
                return snapshot
            time.sleep(poll)
        raise QAOperationError("WAIT_TIMEOUT", f"semantic wait timed out after {timeout:g}s")

    def hit_test(self, page: PageRef, point: Point, spec: ControlSpec) -> dict[str, Any]:
        fresh_page = self.unique_page(page.role, page.url)
        if fresh_page.target_id != page.target_id or fresh_page.role != page.role or fresh_page.url != page.url:
            raise QAOperationError("ACTION_NOCOVER", "page target changed before elementFromPoint")
        result = self.browser.hit_test(fresh_page, point, spec)
        if result.get("targetId", page.target_id) != page.target_id:
            raise QAOperationError("ACTION_NOCOVER", "elementFromPoint came from a different page target")
        return result

    def capture_viewport(self, page: PageRef, path: str | Path) -> ScreenshotRef:
        fresh_page = self.unique_page(page.role, page.url)
        if fresh_page.target_id != page.target_id or fresh_page.role != page.role or fresh_page.url != page.url:
            raise QAOperationError("ACTION_NOCOVER", "page target changed before viewport capture")
        shot = self.browser.capture_viewport(fresh_page, Path(path))
        if shot.space != "viewport":
            raise QAOperationError("ENVIRONMENT", "browser adapter mislabeled a viewport screenshot")
        return shot

    def capture_native(self, path: str | Path) -> ScreenshotRef:
        shot = self.native.capture_native(Path(path))
        if shot.space != "native-fullscreen":
            raise QAOperationError("ENVIRONMENT", "native adapter mislabeled a full-screen screenshot")
        return shot

    def focused(self, page: PageRef, control: ControlSpec) -> bool:
        fresh_page = self.unique_page(page.role, page.url)
        if fresh_page.target_id != page.target_id or fresh_page.role != page.role or fresh_page.url != page.url:
            raise QAOperationError("ACTION_NOCOVER", "page target changed before focus read")
        return bool(self.browser.focused(fresh_page, control))

    def console(self, page: PageRef, since: Any = None) -> Sequence[dict[str, Any]]:
        fresh_page = self.unique_page(page.role, page.url)
        if fresh_page.target_id != page.target_id or fresh_page.role != page.role or fresh_page.url != page.url:
            raise QAOperationError("ACTION_NOCOVER", "page target changed before console read")
        return self.browser.console(fresh_page, since)
