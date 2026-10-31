"""私有 Xvfb 与 XTest 辅助函数，仅访问本次隔离显示和输入设备。"""
from __future__ import annotations

import json
import os
import pathlib
import re
import secrets
import shutil
import subprocess
import time
from ownership import utc


def _run(argv, env, timeout=8, check=True):
    result = subprocess.run(argv, env=env, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, text=True, timeout=timeout, check=False)
    if check and result.returncode:
        detail = (result.stderr or result.stdout).strip().splitlines()[-5:]
        raise RuntimeError(f"TOOL: {pathlib.Path(argv[0]).name} exited {result.returncode}: {' | '.join(detail)[:500]}")
    return result


class XSession:
    def __init__(self, cfg, run, layout):
        self.cfg, self.run, self.layout = cfg, run, layout
        self.display = None
        self.xenv = None
        self.native_auth = pathlib.Path(layout["nativeXauthority"])
        self.snap_auth = pathlib.Path(layout["chromiumXauthority"])
        self.action_log = pathlib.Path(run.out) / "logs" / "x11-actions.jsonl"

    @staticmethod
    def choose_ports(base, count, roles):
        import socket
        max_start = int(base) + int(count) - len(roles) + 1
        for first in range(int(base), max_start + 1):
            sockets = []
            try:
                for port in range(first, first + len(roles)):
                    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 0)
                    sock.bind(("127.0.0.1", port))
                    sockets.append(sock)
                return dict(zip(roles, range(first, first + len(roles))))
            except OSError:
                pass
            finally:
                for sock in sockets:
                    sock.close()
        raise RuntimeError("ENV: no free consecutive loopback CDP ports in configured range")

    @staticmethod
    def choose_display(base, count):
        for number in range(int(base), int(base) + int(count)):
            if pathlib.Path(f"/tmp/.X{number}-lock").exists() or pathlib.Path(f"/tmp/.X11-unix/X{number}").exists():
                continue
            return f":{number}"
        raise RuntimeError("ENV: no free X display in configured range")

    def prepare_layout_directories(self):
        """核对并准备本次布局的短路径目录，不启动 X 服务。"""
        roots = [self.layout[k] for k in ("nativeShortRoot", "nativeTmpDir", "nativeXdgRuntimeDir", "nativeCacheDir")]
        roots += [str(self.native_auth.parent), str(self.snap_auth.parent), self.layout["chromiumTmpDir"],
                  self.layout["chromiumXdgRuntimeDir"], self.layout["chromiumProfile"],
                  str(pathlib.Path(self.layout["chromiumFixture"]).parent),
                  str(pathlib.Path(self.layout["sampleInputSnap"]).parent)]
        for name in dict.fromkeys(roots):
            path = pathlib.Path(name)
            path.mkdir(parents=True, exist_ok=True, mode=0o700)
            os.chmod(path, 0o700)
        if self.layout["nativeTmpDir"] != str(pathlib.Path(self.layout["nativeTmpDir"]).resolve()):
            raise RuntimeError("CONFIG: native TMPDIR must be canonical")
        self.native_auth.parent.mkdir(parents=True, exist_ok=True, mode=0o700)

    def start(self, port_roles):
        g = self.cfg["guest"]
        self.display = self.choose_display(g["displayBase"], g["displayCount"])
        ports = self.choose_ports(g["portBase"], g["portCount"], port_roles)
        self.run.identity.update({"display": self.display, "screen": f"{g['screenWidth']}x{g['screenHeight']}x24",
                                  "ports": ports, "displaySelectedAtRunStart": True,
                                  "portsSelectedAtRunStart": True})
        self.run.ledger._write()
        self.prepare_layout_directories()
        cookie = secrets.token_hex(16)
        auth_env = {"PATH": "/usr/local/bin:/usr/bin:/bin", "HOME": str(self.run.out / "home"),
                    "XAUTHORITY": str(self.native_auth), "LANG": "C.UTF-8", "LC_ALL": "C.UTF-8", "TZ": "UTC"}
        self.native_auth.touch(mode=0o600)
        os.chmod(self.native_auth, 0o600)
        _run(["xauth", "-f", str(self.native_auth), "add", self.display,
              "MIT-MAGIC-COOKIE-1", cookie], auth_env)
        shutil.copyfile(self.native_auth, self.snap_auth)
        os.chmod(self.snap_auth, 0o600)
        self.xenv = {
            "PATH": "/usr/local/bin:/usr/bin:/bin", "HOME": str(self.run.out / "home"),
            "DISPLAY": self.display, "XAUTHORITY": str(self.native_auth),
            "XDG_RUNTIME_DIR": self.layout["nativeXdgRuntimeDir"], "TMPDIR": self.layout["nativeTmpDir"],
            "XDG_CONFIG_HOME": str(self.run.out / "config"), "XDG_CACHE_HOME": self.layout["nativeCacheDir"],
            "XDG_DATA_HOME": str(self.run.out / "data"), "LANG": "C.UTF-8", "LC_ALL": "C.UTF-8", "TZ": "UTC",
        }
        for d in ("home", "config", "cache", "data"):
            (self.run.out / d).mkdir(parents=True, exist_ok=True, mode=0o700)
        xvfb = ["Xvfb", self.display, "-screen", "0", f"{g['screenWidth']}x{g['screenHeight']}x24",
                "-nolisten", "tcp", "-auth", str(self.native_auth), "-noreset"]
        _, self.xvfb_entry = self.run.ledger.spawn("qaenv-xvfb", xvfb, cwd=self.run.out,
                                                  env=self.xenv, command_label="private Xvfb")
        self._wait_x()
        wm_env = dict(self.xenv)
        wm_env.update({"HOME": str(self.run.out / "wm-home"), "XDG_CONFIG_HOME": str(self.run.out / "wm-config"),
                       "XDG_CACHE_HOME": str(self.run.out / "wm-cache")})
        for d in ("wm-home", "wm-config", "wm-cache"):
            (self.run.out / d).mkdir(parents=True, exist_ok=True, mode=0o700)
        _, self.wm_entry = self.run.ledger.spawn("qaenv-xfwm", ["dbus-run-session", "--", "xfwm4",
                                      f"--display={self.display}", "--compositor=on"],
                                      cwd=self.run.out, env=wm_env, command_label="private xfwm4")
        self._wait_wm()
        return ports

    def _wait_x(self):
        deadline = time.monotonic() + 15
        last = None
        while time.monotonic() < deadline:
            result = _run(["xdpyinfo"], self.xenv, timeout=2, check=False)
            if result.returncode == 0:
                text = result.stdout
                dims = re.search(r"dimensions:\s+(\d+x\d+)", text)
                depth = re.search(r"depth of root window:\s+(\d+)", text)
                expected = f"{self.cfg['guest']['screenWidth']}x{self.cfg['guest']['screenHeight']}"
                if not dims or dims.group(1) != expected or not depth or depth.group(1) != "24":
                    raise RuntimeError("ASSERTION: private X display geometry/depth differs from the recorded layout")
                return
            last = result.stderr[-300:]
            time.sleep(0.2)
        raise RuntimeError(f"TOOL: private Xvfb did not become ready ({last})")

    def _wait_wm(self):
        deadline = time.monotonic() + 8
        while time.monotonic() < deadline:
            result = _run(["xprop", "-root", "_NET_SUPPORTING_WM_CHECK"], self.xenv, check=False)
            if result.returncode == 0 and "window id" in result.stdout:
                return
            time.sleep(0.2)
        raise RuntimeError("TOOL: private xfwm4 did not publish its root-window identity")

    def env(self, *, snap=False, user_data=None, temp=None):
        env = dict(self.xenv)
        if snap:
            env["XAUTHORITY"] = str(self.snap_auth)
            env["TMPDIR"] = self.layout["chromiumTmpDir"]
            env["XDG_RUNTIME_DIR"] = self.layout["chromiumXdgRuntimeDir"]
            env["HOME"] = str(pathlib.Path(self.layout["chromiumProfile"]).parent)
            env["XDG_CONFIG_HOME"] = str(pathlib.Path(self.layout["chromiumProfile"]) / "config")
            env["XDG_CACHE_HOME"] = str(pathlib.Path(self.layout["chromiumProfile"]) / "cache")
            env["XDG_DATA_HOME"] = str(pathlib.Path(self.layout["chromiumProfile"]) / "data")
        if user_data:
            env["PIGGY_USERDATA"] = str(user_data)
        if temp:
            env["TMPDIR"] = str(temp)
        return env

    def action(self, argv, *, timeout=8):
        with self.action_log.open("a", encoding="utf-8") as stream:
            stream.write(json.dumps({"atUtc": utc(), "argv": [str(value) for value in argv]}, ensure_ascii=False) + "\n")
        return _run(argv, self.xenv, timeout=timeout)

    def click(self, x, y, button=1):
        self.action(["xdotool", "mousemove", str(round(x)), str(round(y))])
        self.action(["xdotool", "click", str(button)])

    def type_text(self, value):
        self.action(["xdotool", "type", "--clearmodifiers", "--delay", "8", value], timeout=15)

    def key(self, *keys):
        self.action(["xdotool", "key", "--clearmodifiers", *keys])

    def window_info(self, window_id):
        geom = _run(["xdotool", "getwindowgeometry", "--shell", str(window_id)], self.xenv).stdout
        props = _run(["xprop", "-id", str(window_id), "_NET_WM_PID", "WM_TRANSIENT_FOR", "WM_CLASS", "_NET_WM_NAME"],
                     self.xenv, check=False).stdout
        fields = {}
        for line in geom.splitlines():
            if "=" in line:
                k, v = line.split("=", 1)
                if k in ("X", "Y", "WIDTH", "HEIGHT"):
                    fields[k.lower()] = int(v)
        pid_match = re.search(r"_NET_WM_PID\(CARDINAL\) = (\d+)", props)
        title = _run(["xdotool", "getwindowname", str(window_id)], self.xenv, check=False).stdout.strip()
        return {"xid": str(window_id), "title": title, "pid": int(pid_match.group(1)) if pid_match else None,
                "geometry": fields, "properties": props[-1200:]}

    def active_window(self):
        out = _run(["xdotool", "getactivewindow"], self.xenv).stdout.strip()
        return self.window_info(out)

    def screenshot(self, path):
        path = pathlib.Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        size = f"{self.cfg['guest']['screenWidth']}x{self.cfg['guest']['screenHeight']}"
        _run(["ffmpeg", "-nostdin", "-hide_banner", "-loglevel", "error", "-f", "x11grab",
              "-video_size", size, "-i", self.display, "-frames:v", "1", "-y", str(path)],
             self.xenv, timeout=12)
