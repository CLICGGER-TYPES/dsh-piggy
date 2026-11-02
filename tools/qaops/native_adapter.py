"""Frozen XSession/ProcessLedger native-window ownership and screenshot observation."""
from __future__ import annotations

import re
from pathlib import Path

from .model import NativeBounds, NativeWindow, PageRef, Point, QAOperationError, ScreenshotRef


def parse_xwininfo_client_bounds(output: str) -> NativeBounds:
    """解析 xwininfo 的屏幕绝对 client 起点与 client 尺寸，不套用 WM frame extents。"""
    labels = {
        "x": "Absolute upper-left X",
        "y": "Absolute upper-left Y",
        "width": "Width",
        "height": "Height",
    }
    values = {}
    for field, label in labels.items():
        match = re.search(rf"(?m)^\s*{re.escape(label)}:\s*(-?\d+)\s*$", output)
        if match is None:
            raise ValueError("xwininfo client geometry is incomplete")
        values[field] = int(match.group(1))
    if values["width"] <= 0 or values["height"] <= 0:
        raise ValueError("xwininfo client geometry is empty")
    return NativeBounds(values["x"], values["y"], values["width"], values["height"])


class NativeWindowAdapter:
    def __init__(self, *, xsession, ledger, proc_stat, process_roles, native_wm_class, command_timeout: float = 8):
        self.xsession = xsession
        self.ledger = ledger
        self.proc_stat = proc_stat
        self.process_roles = tuple(process_roles)
        self.native_wm_class = native_wm_class
        self.command_timeout = command_timeout

    def _ledger_groups(self):
        groups = set()
        for entry in self.ledger.data.get("processes", []):
            if entry.get("role") not in self.process_roles:
                continue
            members = self.ledger.refresh(entry)
            leader = entry.get("leader", {})
            if members and entry.get("status") == "running" and leader.get("pgid") and leader.get("sid"):
                groups.add((int(leader["pgid"]), int(leader["sid"])))
        return groups

    def _visible_windows(self):
        try:
            result = self.xsession.action(["xdotool", "search", "--onlyvisible", "--class", self.native_wm_class],
                                          timeout=self.command_timeout)
        except Exception as error:
            raise QAOperationError("ENVIRONMENT", f"native window enumeration failed ({type(error).__name__})") from None
        if result.returncode not in (0, 1):
            raise QAOperationError("ENVIRONMENT", "native window enumeration returned an error")
        return [line.strip() for line in result.stdout.splitlines() if line.strip()]

    def _window(self, xid: str, groups) -> NativeWindow | None:
        try:
            info = self.xsession.window_info(xid)
            pid = info.get("pid")
            geometry = self.xsession.action(["xwininfo", "-id", str(xid)], timeout=self.command_timeout)
            if geometry.returncode != 0:
                return None
            bounds = parse_xwininfo_client_bounds(geometry.stdout)
            if not isinstance(pid, int) or bounds.width <= 0 or bounds.height <= 0:
                return None
            row = self.proc_stat(pid)
            pgid, sid = int(row["pgid"]), int(row["sid"])
            props = info.get("properties", "")
            if self.native_wm_class.lower() not in props.lower() or (pgid, sid) not in groups:
                return None
            return NativeWindow(str(xid), pid, pgid, sid, bounds, True, True, self.native_wm_class)
        except Exception:
            return None

    def owned_window(self, page: PageRef) -> NativeWindow:
        groups = self._ledger_groups()
        matches = [window for xid in self._visible_windows() if (window := self._window(xid, groups)) is not None]
        if len(matches) != 1:
            raise QAOperationError("ACTION_NOCOVER", f"expected one visible task-owned native window, got {len(matches)}")
        return matches[0]

    def active_window(self, page: PageRef) -> NativeWindow:
        owned = self.owned_window(page)
        try:
            result = self.xsession.action(["xdotool", "getactivewindow"], timeout=self.command_timeout)
            xid = result.stdout.strip()
        except Exception as error:
            raise QAOperationError("ENVIRONMENT", f"active native window read failed ({type(error).__name__})") from None
        if result.returncode != 0 or xid != owned.window_id:
            raise QAOperationError("ACTION_NOCOVER", "configured task-owned native window is not active")
        return owned

    def pointer(self) -> Point:
        try:
            result = self.xsession.action(["xdotool", "getmouselocation", "--shell"], timeout=self.command_timeout)
            x = re.search(r"(?:^|\n)X[=:](-?\d+)", result.stdout)
            y = re.search(r"(?:^|\n)Y[=:](-?\d+)", result.stdout)
            if result.returncode != 0 or not x or not y:
                raise ValueError("pointer fields absent")
            return Point(float(x.group(1)), float(y.group(1)))
        except Exception as error:
            raise QAOperationError("ENVIRONMENT", f"native pointer read failed ({type(error).__name__})") from None

    def capture_native(self, path: Path) -> ScreenshotRef:
        if path.exists() or path.is_symlink():
            raise QAOperationError("ENVIRONMENT", "native screenshot path already exists")
        self.xsession.screenshot(str(path))
        width, height = self._png_size(path)
        return ScreenshotRef(str(path), "native-fullscreen", width, height)

    @staticmethod
    def _png_size(path: Path):
        with path.open("rb") as stream:
            header = stream.read(24)
        if len(header) < 24 or header[:8] != b"\x89PNG\r\n\x1a\n":
            raise QAOperationError("ENVIRONMENT", "captured screenshot is not a PNG")
        return int.from_bytes(header[16:20], "big"), int.from_bytes(header[20:24], "big")
