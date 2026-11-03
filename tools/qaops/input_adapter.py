"""Native XTest pointer, button, wheel, keyboard, and private text input."""
from __future__ import annotations

import os
import re
import stat
import subprocess
import tempfile
from collections.abc import Sequence
from pathlib import Path
from typing import Protocol

from .model import NativeWindow, PageRef, Point, QAOperationError
from .native_adapter import NativeWindowAdapter


class NativeInputAdapter(Protocol):
    def active_window(self, page: PageRef) -> NativeWindow: ...
    def move_to_screen(self, point: Point) -> None: ...
    def move_relative(self, dx: int, dy: int) -> int: ...
    def pointer_screen(self) -> Point: ...
    def click_button(self, button: int) -> int: ...
    def wheel(self, direction: int, ticks: int) -> int: ...
    def button_down(self, button: int) -> int: ...
    def button_up(self, button: int) -> int: ...
    def key(self, keys: Sequence[str]) -> int: ...
    def type_text_safe(self, text: str) -> int: ...
    def type_private_fd(self, fd: int) -> int: ...


class XTestInputAdapter:
    def __init__(self, *, xsession, windows: NativeWindowAdapter, private_input_dir: str | Path, command_timeout: float = 8):
        self.xsession = xsession
        self.windows = windows
        self.private_input_dir = Path(private_input_dir)
        self.command_timeout = command_timeout

    def active_window(self, page: PageRef) -> NativeWindow:
        return self.windows.active_window(page)

    def move_to_screen(self, point: Point) -> None:
        result = self.xsession.action(["xdotool", "mousemove", str(round(point.x)), str(round(point.y))],
                                      timeout=self.command_timeout)
        if result.returncode != 0:
            raise QAOperationError("ACTION_NOCOVER", "native pointer movement failed")

    def move_relative(self, dx: int, dy: int) -> int:
        result = self.xsession.action(["xdotool", "mousemove_relative", "--",
                                      str(int(dx)), str(int(dy))],
                                      timeout=self.command_timeout)
        return int(result.returncode)

    def pointer_screen(self) -> Point:
        return self.windows.pointer()

    def click_button(self, button: int) -> int:
        result = self.xsession.action(["xdotool", "click", "--clearmodifiers", str(int(button))],
                                      timeout=self.command_timeout)
        return int(result.returncode)

    def wheel(self, direction: int, ticks: int) -> int:
        button = 4 if direction < 0 else 5
        result = self.xsession.action(["xdotool", "click", "--repeat", str(int(ticks)), "--delay", "60", str(button)],
                                      timeout=max(self.command_timeout, ticks * 0.1 + 2))
        return int(result.returncode)

    def button_down(self, button: int) -> int:
        result = self.xsession.action(["xdotool", "mousedown", str(int(button))], timeout=self.command_timeout)
        return int(result.returncode)

    def button_up(self, button: int) -> int:
        result = self.xsession.action(["xdotool", "mouseup", str(int(button))], timeout=self.command_timeout)
        return int(result.returncode)

    def key(self, keys: Sequence[str]) -> int:
        if not keys or any(not re.fullmatch(r"[A-Za-z0-9_+.-]+", key) for key in keys):
            raise QAOperationError("ACTION_NOCOVER", "key chord contains an invalid key name")
        result = self.xsession.action(["xdotool", "key", "--clearmodifiers", *keys], timeout=self.command_timeout)
        return int(result.returncode)

    def type_text_safe(self, text: str) -> int:
        fd = None
        name = None
        try:
            self.private_input_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
            info = self.private_input_dir.lstat()
            if (not stat.S_ISDIR(info.st_mode) or stat.S_ISLNK(info.st_mode)
                    or info.st_uid != os.geteuid() or stat.S_IMODE(info.st_mode) & 0o077):
                raise QAOperationError("ENVIRONMENT", "private input directory is not owned and private")
            fd, name = tempfile.mkstemp(prefix="qaops-type-", dir=self.private_input_dir)
            os.fchmod(fd, 0o600)
            view = memoryview(text.encode("utf-8"))
            while view:
                written = os.write(fd, view)
                if written <= 0:
                    raise OSError("private text write made no progress")
                view = view[written:]
            os.fsync(fd)
            os.close(fd)
            fd = None
            with open(name, "rb") as stream:
                result = self.type_private_fd(stream.fileno())
            return result
        except QAOperationError:
            raise
        except Exception as error:
            raise QAOperationError("ENVIRONMENT", f"private text transport failed ({type(error).__name__})") from None
        finally:
            if fd is not None:
                os.close(fd)
            if name is not None:
                if self._erase_path(Path(name)) is not True:
                    raise QAOperationError("ENVIRONMENT", "private input cleanup could not be confirmed")

    def type_private_fd(self, fd: int) -> int:
        try:
            result = subprocess.run(["xdotool", "type", "--clearmodifiers", "--delay", "8", "--file",
                                     f"/proc/self/fd/{fd}"], env=dict(self.xsession.xenv),
                                    stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                                    stderr=subprocess.DEVNULL, timeout=60, check=False, pass_fds=(fd,))
            return int(result.returncode)
        except Exception as error:
            raise QAOperationError("ACTION_NOCOVER", f"private text input failed ({type(error).__name__})") from None

    @staticmethod
    def _erase_path(path: Path):
        try:
            before = path.lstat()
            if not stat.S_ISREG(before.st_mode):
                raise OSError("private input is no longer a regular file")
            fd = os.open(path, os.O_WRONLY | os.O_NOFOLLOW | os.O_CLOEXEC)
            try:
                opened = os.fstat(fd)
                if (opened.st_dev, opened.st_ino) != (before.st_dev, before.st_ino):
                    raise OSError("private input identity changed")
                remaining = opened.st_size
                block = b"\0" * min(65536, max(1, remaining))
                while remaining:
                    count = os.write(fd, block[:remaining])
                    if count <= 0:
                        raise OSError("private input erase made no progress")
                    remaining -= count
                os.fsync(fd)
            finally:
                os.close(fd)
            current = path.lstat()
            if (current.st_dev, current.st_ino) != (before.st_dev, before.st_ino):
                raise OSError("private input identity changed before unlink")
            path.unlink(missing_ok=True)
            return True
        except FileNotFoundError:
            return not path.exists() and not path.is_symlink()
        except OSError:
            raise QAOperationError("ENVIRONMENT", "private input cleanup could not be confirmed") from None
