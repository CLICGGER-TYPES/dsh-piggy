"""QAENV 客体运行的单写者进程所有权账本。"""
from __future__ import annotations

import hashlib
import json
import os
import pathlib
import signal
import subprocess
import time
from datetime import datetime, timezone


_HASH_CACHE: dict[tuple[int, int, int, int], str] = {}


def utc():
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def proc_stat(pid):
    raw = pathlib.Path(f"/proc/{pid}/stat").read_text()
    fields = raw.rsplit(")", 1)[1].split()
    return {
        "state": fields[0], "ppid": int(fields[1]), "pgid": int(fields[2]),
        "sid": int(fields[3]), "startTicks": int(fields[19]),
    }


def _exe_hash(exe_path):
    st = os.stat(exe_path)
    key = (st.st_dev, st.st_ino, st.st_size, st.st_mtime_ns)
    if key not in _HASH_CACHE:
        digest = hashlib.sha256()
        with open(exe_path, "rb") as stream:
            for block in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(block)
        _HASH_CACHE[key] = digest.hexdigest()
    return _HASH_CACHE[key]


def proc_record(pid, role, *, include_hash=False):
    proc = pathlib.Path(f"/proc/{pid}")
    stat = proc_stat(pid)
    row = {"pid": int(pid), "role": role, **stat}
    try:
        exe = os.readlink(proc / "exe")
        row["exe"] = exe
        if include_hash:
            row["exeSha256"] = _exe_hash(proc / "exe")
    except (OSError, PermissionError):
        row["exe"] = None
        if include_hash:
            row["exeSha256"] = None
    return row


def read_group(pgid, sid, role):
    """只读取进程元数据，不在扫描循环中重复计算大型 Electron/Chromium 文件哈希。"""
    rows = []
    for entry in pathlib.Path("/proc").iterdir():
        if not entry.name.isdigit():
            continue
        try:
            row = proc_record(entry.name, role)
            if row["pgid"] == pgid and row["sid"] == sid and row["state"] not in ("Z", "X"):
                rows.append(row)
        except (OSError, ValueError, IndexError, PermissionError):
            pass
    return rows


class ProcessLedger:
    def __init__(self, out_root, run_id):
        self.root = pathlib.Path(out_root)
        self.logs = self.root / "logs"
        self.reports = self.root / "reports"
        self.logs.mkdir(parents=True, exist_ok=True)
        self.reports.mkdir(parents=True, exist_ok=True)
        self.path = self.reports / "identity.json"
        if self.path.exists():
            raise RuntimeError("TOOL: identity ledger already exists; refusing reuse")
        self._handles = {}
        self.data = {"runId": run_id, "writer": "qa-env/lib/ownership.py", "createdAtUtc": utc(), "processes": []}
        self._write()

    def _write(self):
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(self.data, indent=2) + "\n", encoding="utf-8")
        os.chmod(tmp, 0o600)
        tmp.replace(self.path)

    def stage(self, progress_path, stage, status, **safe_fields):
        row = {"atUtc": utc(), "stage": stage, "status": status, **safe_fields}
        with pathlib.Path(progress_path).open("a", encoding="utf-8") as stream:
            stream.write(json.dumps(row, sort_keys=True) + "\n")
        return row

    def _entry(self, process, role, stdout, stderr, command_label):
        pid = process.pid
        try:
            row = proc_record(pid, role, include_hash=True)
            alive = row["state"] not in ("Z", "X")
        except (OSError, ValueError, IndexError, PermissionError):
            row = {"pid": pid, "role": role, "pgid": pid, "sid": pid, "startTicks": None,
                   "state": "unknown", "exe": None, "exeSha256": None}
            alive = process.poll() is None
        entry = {
            "role": role, "commandLabel": command_label, "leader": row, "members": [],
            "status": "running" if alive else "early-exit", "startedAtUtc": utc(),
            "stdout": str(stdout), "stderr": str(stderr),
        }
        if not alive:
            entry.update({"exitCode": process.poll(), "endedAtUtc": utc(), "registrationReadback": "process already exited"})
        else:
            self.refresh(entry)
        self.data["processes"].append(entry)
        self._write()
        return entry

    def refresh(self, entry):
        leader = entry["leader"]
        entry["members"] = read_group(int(leader["pgid"]), int(leader["sid"]), entry["role"])
        return entry["members"]

    def spawn(self, role, argv, *, cwd, env, command_label, allow_early_exit=False):
        stdout = self.logs / f"{role}.stdout.log"
        stderr = self.logs / f"{role}.stderr.log"
        out = stdout.open("wb")
        err = stderr.open("wb")
        process = None
        try:
            process = subprocess.Popen(argv, cwd=str(cwd), env=env, stdin=subprocess.DEVNULL,
                                       stdout=out, stderr=err, start_new_session=True, close_fds=True)
            self._handles[role] = {"stdout": out, "stderr": err, "process": process}
            entry = self._entry(process, role, stdout, stderr, command_label)
            if entry["status"] == "early-exit" and not allow_early_exit:
                self._close_role(role)
                try:
                    process.wait(timeout=0)
                except subprocess.TimeoutExpired:
                    pass
                tail = stderr.read_text(errors="replace")[-1200:]
                raise RuntimeError(f"TOOL: {role} exited before ready, rc={entry.get('exitCode')}; stderr recorded; {tail[:300]}")
            if entry["status"] == "early-exit":
                code = process.wait(timeout=0)
                entry.update({"status": "exited", "exitCode": code, "endedAtUtc": utc(),
                              "quickCommand": True})
                self._close_role(role)
                self._write()
            return process, entry
        except BaseException:
            if process is not None and process.poll() is not None:
                try:
                    process.wait(timeout=0)
                except subprocess.TimeoutExpired:
                    pass
            if role in self._handles and process is not None and process.poll() is not None:
                self._close_role(role)
            else:
                if not out.closed:
                    out.close()
                if not err.closed:
                    err.close()
            raise

    def _close_role(self, role):
        handles = self._handles.pop(role, None)
        if handles:
            for key in ("stdout", "stderr"):
                handle = handles[key]
                if not handle.closed:
                    handle.close()

    def wait(self, process, entry, timeout, *, check=True):
        try:
            code = process.wait(timeout=timeout)
        except subprocess.TimeoutExpired:
            entry.update({"status": "timeout", "timeoutSeconds": timeout, "timeoutAtUtc": utc()})
            self.refresh(entry)
            self._write()
            raise RuntimeError(f"TOOL: {entry['role']} exceeded {timeout}s; owner ledger retains its original identity")
        finally:
            if process.poll() is not None:
                self._close_role(entry["role"])
        self.refresh(entry)
        entry.update({"status": "exited", "exitCode": code, "endedAtUtc": utc()})
        self._write()
        if code and check:
            raise RuntimeError(f"TOOL: {entry['role']} exited rc={code}; see {entry['stderr']}")
        return entry

    def launch(self, role, argv, *, cwd, env, timeout, command_label, check=True):
        process, entry = self.spawn(role, argv, cwd=cwd, env=env, command_label=command_label, allow_early_exit=True)
        return self.wait(process, entry, timeout, check=check)

    def stop_entry(self, entry, term_seconds=5):
        leader = entry["leader"]
        pgid, sid = int(leader["pgid"]), int(leader["sid"])
        members = read_group(pgid, sid, entry["role"])
        known = {(int(row["pid"]), row.get("startTicks")) for row in entry.get("members", [])}
        known.add((int(leader["pid"]), leader.get("startTicks")))
        anchor = [row for row in members if (int(row["pid"]), row.get("startTicks")) in known]
        handle = self._handles.get(entry["role"], {}).get("process")
        direct_alive = handle is not None and handle.poll() is None and int(handle.pid) == int(leader["pid"])
        owned_session = pgid == sid == int(leader["pid"]) and leader.get("startTicks") is not None
        if not anchor and not direct_alive and not (members and owned_session):
            if not members:
                entry.update({"status": "exited", "exitCode": handle.poll() if handle is not None else None,
                              "cleanupAtUtc": utc(), "remainingPids": []})
                if handle is not None:
                    try:
                        handle.wait(timeout=0)
                    except subprocess.TimeoutExpired:
                        pass
                self._close_role(entry["role"])
                self._write()
                return
            entry.update({"status": "unverified", "cleanupAtUtc": utc(), "remainingPids": [r["pid"] for r in members]})
            self._write()
            if members:
                raise RuntimeError(f"TOOL: {entry['role']} cleanup identity unverified; remaining members retained in ledger")
            return
        try:
            if direct_alive:
                os.kill(int(handle.pid), signal.SIGTERM)
            if anchor or (members and owned_session):
                os.killpg(pgid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        deadline = time.monotonic() + term_seconds
        while time.monotonic() < deadline and read_group(pgid, sid, entry["role"]):
            time.sleep(0.1)
        remaining = read_group(pgid, sid, entry["role"])
        if remaining:
            # 受监督命令均以 start_new_session=True 启动；PGID/SID 已核对后，
            # 即使直接父进程先退出，同一会话里剩下的子进程仍归本条账本记录所有。
            if anchor or owned_session:
                try:
                    os.killpg(pgid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                deadline = time.monotonic() + 2
                while time.monotonic() < deadline and read_group(pgid, sid, entry["role"]):
                    time.sleep(0.1)
        remaining = read_group(pgid, sid, entry["role"])
        if handle is not None:
            try:
                handle.wait(timeout=0)
            except subprocess.TimeoutExpired:
                pass
        self._close_role(entry["role"])
        remaining_pids = [row["pid"] for row in remaining]
        entry.update({"status": "stopped" if not remaining else "unverified", "cleanupAtUtc": utc(),
                      "verifiedOwnerAnchorPids": [row["pid"] for row in anchor], "remainingPids": remaining_pids})
        self._write()
        if remaining:
            raise RuntimeError(f"TOOL: {entry['role']} cleanup incomplete; identity mismatch or members remain in ledger")

    def cleanup(self):
        errors = []
        safe_final = ("stopped", "exited", "early-exit", "expected-exit")
        for entry in reversed(self.data["processes"]):
            if entry.get("status") in safe_final:
                leader = entry.get("leader", {})
                remaining = read_group(int(leader.get("pgid", -1)), int(leader.get("sid", -1)), entry.get("role", "unknown"))
                if remaining:
                    entry.update({"status": "unverified", "remainingPids": [row["pid"] for row in remaining],
                                  "cleanupAtUtc": utc()})
                    self._write()
                    errors.append({"role": entry.get("role"), "type": "RemainingOwnedSessionMembers"})
                continue
            try:
                self.stop_entry(entry)
            except Exception as error:
                errors.append({"role": entry.get("role"), "type": type(error).__name__})
        summary = {
            "atUtc": utc(), "writer": "qa-env/lib/ownership.py", "processCount": len(self.data["processes"]),
            "allStopped": not errors and all(e.get("status") in safe_final for e in self.data["processes"]),
            "errors": errors,
            "processes": [{k: e.get(k) for k in ("role", "status", "exitCode", "timeoutSeconds", "remainingPids")}
                          for e in self.data["processes"]],
        }
        path = self.reports / "cleanup-ledger.json"
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
        os.chmod(tmp, 0o600)
        tmp.replace(path)
        if errors:
            raise RuntimeError("TOOL: cleanup had owned-process errors; see cleanup-ledger.json")
        return summary
