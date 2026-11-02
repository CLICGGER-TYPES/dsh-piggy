"""qaops 的标准库离线契约测试；不启动 X、Chromium 或应用。"""
from __future__ import annotations

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from types import MethodType

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from qaops import (Actions, ControlObservation, ControlSpec, CoordinateMapper,
                   NativeBounds, NativeWindow, Observer, PageRef, PageSnapshot,
                   Point, QAOperationError, ViewportMetrics, create_operations)
from qaops.cdp_adapter import CdpBrowserAdapter
from qaops.input_adapter import XTestInputAdapter
from qaops.native_adapter import NativeWindowAdapter, parse_xwininfo_client_bounds
from qaops.viewport_mapper import viewport_to_native_point


def simple_mapper(point, metrics, bounds):
    dpr = metrics["devicePixelRatio"]
    origin_x, origin_y = bounds["x"], bounds["y"]
    return {
        "screenPointPx": {"x": round(origin_x + point["x"] * dpr),
                          "y": round(origin_y + point["y"] * dpr)},
        "contentOriginPx": {"x": origin_x, "y": origin_y},
        "devicePixelRatio": dpr,
        "viewportSizeCss": {"width": metrics["innerWidth"], "height": metrics["innerHeight"]},
        "nativeWindowBoundsPx": dict(bounds),
    }


class FakeBrowser:
    def __init__(self):
        self.page = PageRef("target-1", "pet", "piggy://app/index.html")
        self.metrics = ViewportMetrics(1000, 700, 1000, 700, 1)

    def page_candidates(self, role, expected_url):
        return [self.page] if (role, expected_url) == (self.page.role, self.page.url) else []

    def snapshot(self, page, controls):
        rows = {
            spec.key: ControlObservation(1, True, True, Point(400, 300),
                                         {"x": 380, "y": 280, "width": 40, "height": 40})
            for spec in controls
        }
        return PageSnapshot(page, self.metrics, rows, {"readyState": "complete"})

    def hit_test(self, page, point, control):
        hit = 380 <= point.x <= 420 and 280 <= point.y <= 320
        return {"hit": hit, "targetId": page.target_id, "pageTargetId": page.target_id}

    def focused(self, page, control):
        return True

    def console(self, page, since=None):
        return []

    def capture_viewport(self, page, path):
        raise AssertionError("offline contract does not capture UI screenshots")


class FakeNative:
    def __init__(self, *, down_raises=False):
        self.window = NativeWindow("0x10", 10, 10, 10, NativeBounds(100, 200, 1000, 700),
                                   True, True, "test-window")
        self.pointer = Point(100, 200)
        self.clicks = []
        self.down_raises = down_raises
        self.is_down = False
        self.ups = 0

    def owned_window(self, page):
        return self.window

    def active_window(self, page):
        return self.window

    def pointer_screen(self):
        return self.pointer

    def move_to_screen(self, point):
        self.pointer = Point(round(point.x), round(point.y))

    def move_relative(self, dx, dy):
        self.pointer = Point(self.pointer.x + int(dx), self.pointer.y + int(dy))
        return 0

    def click_button(self, button):
        self.clicks.append(button)
        return 0

    def wheel(self, direction, ticks):
        return 0

    def button_down(self, button):
        self.is_down = True
        if self.down_raises:
            raise RuntimeError("injected offline failure")
        return 0

    def button_up(self, button):
        self.ups += 1
        self.is_down = False
        return 0

    def key(self, keys):
        return 0

    def type_text_safe(self, text):
        raise NotImplementedError

    def type_private_fd(self, fd):
        raise NotImplementedError


class FakeXSession:
    xenv = {}

    def action(self, argv, *, timeout=8):
        raise AssertionError("the offline tests must not issue native input")


class RecordingXSession:
    def __init__(self):
        self.argv = None

    def action(self, argv, *, timeout=8):
        self.argv = list(argv)
        return type("Result", (), {"returncode": 0})()


class EmptyLedger:
    data = {"processes": []}

    def refresh(self, entry):
        return []


class QaopsContractTests(unittest.TestCase):
    def setUp(self):
        self.browser = FakeBrowser()
        self.native = FakeNative()
        self.observer = Observer(self.browser, self.native)
        self.page = self.browser.page
        self.control = ControlSpec("target", "[data-task-target]")
        self.logs = []
        self.actions = Actions(self.observer, CoordinateMapper(simple_mapper), self.native,
                               log=self.logs.append, pointer_settle_seconds=0)

    def test_shared_mapper_handles_111_pixel_content_origin(self):
        result = viewport_to_native_point(
            {"x": 1012, "y": 630.5},
            {"innerWidth": 1600, "innerHeight": 889, "outerWidth": 1600,
             "outerHeight": 976, "devicePixelRatio": 1},
            {"x": 0, "y": 24, "width": 1600, "height": 976},
        )
        self.assertEqual(result["contentOriginPx"], {"x": 0.0, "y": 111.0})
        self.assertEqual(result["screenPointPx"], {"x": 1012, "y": 742})
        inverse = CoordinateMapper.to_viewport(Point(1012, 742), result)
        self.assertAlmostEqual(inverse.y, 630.5, delta=1)

    def test_xwininfo_client_y_does_not_reapply_frame_extent(self):
        xwininfo = """Window id: 0x600003
  Absolute upper-left X: 0
  Absolute upper-left Y: 24
  Relative upper-left X: 0
  Relative upper-left Y: 0
  Width: 1600
  Height: 976
"""
        bounds = parse_xwininfo_client_bounds(xwininfo)
        self.assertEqual(bounds.as_dict(), {"x": 0, "y": 24, "width": 1600, "height": 976})
        mapping = CoordinateMapper().to_native(
            Point(1012, 630.5), ViewportMetrics(1600, 889, 1600, 976, 1), bounds)
        self.assertEqual(mapping["contentOriginPx"]["y"], 111)
        self.assertEqual(mapping["screenPointPx"], {"x": 1012, "y": 742})

    def test_complete_click_uses_shared_native_window_interface(self):
        record = self.actions.click(self.page, self.control)
        self.assertEqual(self.native.clicks, [1])
        self.assertEqual(record.input_result["xTestReturnCode"], 0)
        self.assertEqual(self.logs[0]["actionKind"], "click")
        self.assertGreater(self.logs[0]["monotonicNs"], 0)

    def test_factory_wires_both_entrypoints_to_concrete_split_adapters(self):
        observer, actions = create_operations(
            Cdp=object, xsession=FakeXSession(), ledger=EmptyLedger(),
            proc_stat=lambda _pid: {},
            config={
                "cdpPort": 54100,
                "pageRoleUrls": {"pet": "piggy://app/index.html"},
                "pageRoleProbes": {"pet": ("window.__dshPiggyShell?.role||null", "pet")},
                "processRoles": ["browser-supervisor-configured"],
                "nativeWmClass": "Chromium", "privateInputDir": ".",
            },
        )
        self.assertIsInstance(observer.browser, CdpBrowserAdapter)
        self.assertIsInstance(observer.native, NativeWindowAdapter)
        self.assertIsInstance(actions.native, XTestInputAdapter)

    def test_drag_attempt_always_releases_button(self):
        native = FakeNative(down_raises=True)
        observer = Observer(self.browser, native)
        logs = []
        actions = Actions(observer, CoordinateMapper(simple_mapper), native,
                          log=logs.append, pointer_settle_seconds=0)
        with self.assertRaises(QAOperationError):
            actions.drag(self.page, self.control, end_viewport_offset=Point(20, 10), steps=3)
        self.assertEqual(native.ups, 1)
        self.assertFalse(native.is_down)
        self.assertTrue(logs[-1]["input"]["buttonDownAttempted"])
        self.assertEqual(logs[-1]["input"]["buttonReleaseResult"], 0)

    def test_drag_records_relative_native_path(self):
        record = self.actions.drag(self.page, self.control,
                                   end_viewport_offset=Point(-30, -20), steps=3)
        self.assertEqual(record.input_result["pathSteps"], 3)
        self.assertTrue(all(row["actualScreenPx"] == row["commandScreenPx"]
                            for row in record.input_result["path"]))
        self.assertTrue(record.input_result["buttonReleased"])

    def test_relative_motion_terminates_options_before_negative_delta(self):
        session = RecordingXSession()
        adapter = XTestInputAdapter(xsession=session, windows=self.native,
                                    private_input_dir=".")
        self.assertEqual(adapter.move_relative(-5, -7), 0)
        self.assertEqual(session.argv, ["xdotool", "mousemove_relative", "--", "-5", "-7"])

    def test_private_text_is_not_logged_and_temp_file_is_removed(self):
        with tempfile.TemporaryDirectory(prefix="qaops-text-") as directory:
            adapter = XTestInputAdapter(xsession=FakeXSession(), windows=self.native,
                                        private_input_dir=directory)
            captured = {}

            def read_fd(_self, fd):
                os.lseek(fd, 0, os.SEEK_SET)
                captured["text"] = os.read(fd, 4096).decode("utf-8")
                return 0

            adapter.type_private_fd = MethodType(read_fd, adapter)
            actions = Actions(self.observer, CoordinateMapper(simple_mapper), adapter,
                              log=self.logs.append, pointer_settle_seconds=0)
            secret = "qaops-sensitive-canary-7c1e"
            actions.type_text(self.page, self.control, secret)
            self.assertEqual(captured["text"], secret)
            self.assertNotIn(secret, json.dumps(self.logs))
            self.assertEqual(list(Path(directory).iterdir()), [])

    def test_private_text_cleanup_failure_is_not_success(self):
        with tempfile.TemporaryDirectory(prefix="qaops-cleanup-failure-") as directory:
            adapter = XTestInputAdapter(xsession=FakeXSession(), windows=self.native,
                                        private_input_dir=directory)
            adapter.type_private_fd = MethodType(lambda _self, _fd: 0, adapter)
            adapter._erase_path = lambda _path: False
            with self.assertRaises(QAOperationError) as raised:
                adapter.type_text_safe("cleanup-failure-canary")
            self.assertEqual(raised.exception.category, "ENVIRONMENT")
            self.assertNotIn("cleanup-failure-canary", str(raised.exception))


if __name__ == "__main__":
    unittest.main()
