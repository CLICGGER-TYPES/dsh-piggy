#!/usr/bin/env python3
"""执行一次确定的客体基线检查，不安装或下载依赖。"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import time
import urllib.request
import zipfile

BASE = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE / "lib"))
from cdp import Cdp
from layout import derive_layout
from ownership import ProcessLedger, utc
from x11 import XSession, _run


def sha256_file(path):
    digest = hashlib.sha256()
    with open(path, "rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def atomic_json(path, value):
    path = pathlib.Path(path)
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.chmod(tmp, 0o600)
    tmp.replace(path)


def file_hash(path, expected, label):
    p = pathlib.Path(path)
    if not p.is_file():
        raise RuntimeError(f"ENV: cached {label} missing")
    actual = sha256_file(p)
    if actual != expected:
        raise RuntimeError(f"ENV: cached {label} SHA256 mismatch")
    return actual


class GuestRun:
    def __init__(self, cfg, label):
        self.cfg = cfg
        self.label = label
        self.layout = derive_layout(cfg, label)
        self.root = pathlib.Path(self.layout["guestRunRoot"])
        if self.root.exists():
            raise RuntimeError("TOOL: guest run root already exists; refusing reuse")
        self.root.mkdir(parents=True, mode=0o700)
        self.out = pathlib.Path(self.layout["evidenceRoot"])
        self.out.mkdir(mode=0o700)
        for name in ("logs", "reports", "screenshots", "artifacts", "tmp"):
            (self.out / name).mkdir(mode=0o700)
        self.progress_path = self.out / "reports" / "progress.jsonl"
        self.ledger = ProcessLedger(self.out, self.layout["runId"])
        self.identity = self.ledger.data
        self.failures = []
        self._write_owner(self.root)
        atomic_json(self.out / "reports" / "run-layout.json", self.layout)

    def _write_owner(self, path):
        path = pathlib.Path(path)
        marker = path / ".qaenv-owner.json"
        atomic_json(marker, {"runId": self.layout["runId"], "writer": "qa-env/guest/runner.py"})

    def stage(self, name, status, **fields):
        row = {"atUtc": utc(), "stage": name, "status": status, **fields}
        with self.progress_path.open("a", encoding="utf-8") as stream:
            stream.write(json.dumps(row, sort_keys=True) + "\n")
        print(f"QAENV_STAGE {row['atUtc']} {name} {status}", flush=True)
        return row

    def owner_dir(self, path):
        path = pathlib.Path(path)
        if path.exists():
            raise RuntimeError(f"TOOL: authorized private path already exists; refusing to reuse: {path}")
        path.mkdir(parents=True, mode=0o700)
        os.chmod(path, 0o700)
        self._write_owner(path)
        return path

    def record_failure(self, exc, classification):
        self.failures.append({"atUtc": utc(), "classification": classification,
                              "errorType": type(exc).__name__, "message": str(exc)[:600]})


def config_paths(cfg, layout):
    cache = pathlib.Path(cfg["guest"]["taskRoot"]) / "cache"
    return {
        "toolRoot": cache / "qa-env", "sourceRoot": cache / "source-3585",
        "depsRoot": cache / "toolchain" / "node_modules",
        "appImage": cache / "M1FINAL.AppImage", "electronZip": cache / "electron-v44.5.1-linux-x64.zip",
    }


def check_guest_tools(cfg):
    required = ["python3", "sha256sum", "tar", "Xvfb", "xauth", "xdpyinfo", "xprop", "xdotool",
                "dbus-run-session", "xfwm4", "ffmpeg", "timeout", "findmnt"]
    missing = [name for name in dict.fromkeys(required) if shutil.which(name) is None]
    if missing:
        raise RuntimeError("ENV: guest tool(s) missing: " + ", ".join(missing))
    browser = pathlib.Path(cfg.get("guest", {}).get("chromiumLauncher", ""))
    if not browser.is_file() or not os.access(browser, os.X_OK):
        raise RuntimeError("ENV: configured Snap Chromium launcher is missing or not executable")
    root = pathlib.Path(cfg["guest"]["taskRoot"])
    result = subprocess.run(["findmnt", "-n", "-o", "FSTYPE", "-T", str(root)],
                            text=True, capture_output=True, timeout=5)
    fs = result.stdout.strip()
    if result.returncode or fs in ("tmpfs", "ramfs"):
        raise RuntimeError(f"ENV: guest task root is not disk-backed ({fs or 'unknown'})")
    return {"requiredTools": list(dict.fromkeys(required)), "guestScratchFilesystem": fs}


def runtime_versions(run, runtime, env, timeout):
    entry = run.ledger.launch("shipping-runtime-probe", [str(runtime), "-p", "JSON.stringify(process.versions)"],
                              env={**env, "ELECTRON_RUN_AS_NODE": "1"}, cwd=pathlib.Path(runtime).parent,
                              timeout=timeout, command_label="M1 Electron/Node runtime probe", check=False)
    stdout_path, stderr_path = pathlib.Path(entry["stdout"]), pathlib.Path(entry["stderr"])
    if entry.get("exitCode"):
        raise RuntimeError(f"TOOL: shipping runtime probe exited {entry['exitCode']}; stderr retained at {stderr_path}")
    try:
        value = json.loads(stdout_path.read_text(encoding="utf-8").strip().splitlines()[-1])
    except (ValueError, IndexError):
        raise RuntimeError("ASSERTION: shipping runtime probe did not return process.versions JSON")
    if value.get("electron") != "44.5.1" or value.get("node") != "24.21.0":
        raise RuntimeError("ASSERTION: shipping runtime version differs from frozen M1 expectation")
    return value


def setup_cache_and_source(run, paths):
    cfg = run.cfg
    inputs = cfg["inputs"]
    for key, expected, label in (
        ("appImage", cfg["hostIdentity"]["appImageSha256"], "M1 AppImage"),
        ("electronZip", cfg["hostIdentity"]["electron44ZipSha256"], "Electron 44 ZIP"),
    ):
        file_hash(inputs[key], expected, label)
    source = pathlib.Path(paths["sourceRoot"])
    tool = pathlib.Path(paths["toolRoot"])
    deps = pathlib.Path(paths["depsRoot"])
    if not source.is_dir() or not (source / "scripts" / "typecheck.mjs").is_file():
        raise RuntimeError("ENV: pinned M1 source cache is incomplete")
    if not (tool / "toolchain-versions.json").is_file() or not (deps / "typescript" / "bin" / "tsc").is_file():
        raise RuntimeError("ENV: offline QA toolkit/dependency cache is incomplete")
    verify_source_manifest(source, inputs["sourceManifest"])
    electron_runtime = pathlib.Path(run.layout["electron44RuntimeRoot"])
    electron_bin = electron_runtime / "electron"
    if not electron_bin.is_file():
        electron_runtime.mkdir(parents=True, mode=0o700)
        with zipfile.ZipFile(inputs["electronZip"]) as archive:
            for member in archive.infolist():
                destination = (electron_runtime / member.filename).resolve()
                if destination != electron_runtime.resolve() and electron_runtime.resolve() not in destination.parents:
                    raise RuntimeError("ASSERTION: Electron ZIP contains an unsafe path")
                if member.is_dir():
                    destination.mkdir(parents=True, exist_ok=True, mode=0o755)
                    continue
                destination.parent.mkdir(parents=True, exist_ok=True, mode=0o755)
                with archive.open(member) as incoming, destination.open("wb") as outgoing:
                    shutil.copyfileobj(incoming, outgoing)
                mode = (member.external_attr >> 16) & 0o777
                os.chmod(destination, mode if mode else 0o644)
        if not electron_bin.is_file():
            raise RuntimeError("ASSERTION: cached Electron ZIP lacks its root electron executable")
        os.chmod(electron_bin, 0o755)
    return source, deps, pathlib.Path(inputs["appImage"])


def verify_source_manifest(source, manifest_path):
    manifest = json.loads(pathlib.Path(manifest_path).read_text(encoding="utf-8"))
    expected = manifest.get("entries", {})
    found = {}
    for root, dirs, files in os.walk(source, followlinks=False):
        root_path = pathlib.Path(root)
        dirs[:] = [name for name in dirs if not (root_path / name).is_symlink()]
        for name in files:
            path = root_path / name
            rel = path.relative_to(source).as_posix()
            if path.is_symlink():
                found[rel] = {"type": "symlink", "target": os.readlink(path)}
            else:
                found[rel] = {"type": "file", "sha256": sha256_file(path), "bytes": path.stat().st_size}
        for name in os.listdir(root_path):
            path = root_path / name
            if path.is_symlink() and path.is_dir():
                found[path.relative_to(source).as_posix()] = {"type": "symlink", "target": os.readlink(path)}
    if found != expected:
        missing = len(set(expected) - set(found))
        extra = len(set(found) - set(expected))
        changed = sum(1 for key in set(found) & set(expected) if found[key] != expected[key])
        raise RuntimeError(f"ASSERTION: pinned source manifest mismatch (missing={missing}, extra={extra}, changed={changed})")


def ensure_sample(run, layout, *, snap=False):
    path = pathlib.Path(layout["sampleInputSnap" if snap else "sampleInputNative"])
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    if not path.exists():
        path.write_text(f"QAENV_SAMPLE_CONTENT:{layout['runId']}\n", encoding="utf-8")
        os.chmod(path, 0o600)
    expected = f"QAENV_SAMPLE_CONTENT:{layout['runId']}"
    if path.read_text(encoding="utf-8").strip() != expected:
        raise RuntimeError("ASSERTION: sample file content marker mismatch")
    return path


def extract_appimage_runtime(run, app_image, layout, env, timeout, expected_appimage_sha):
    extract_root = pathlib.Path(layout["runtimeCacheRoot"])
    extract_root.mkdir(parents=True, exist_ok=True, mode=0o700)
    target = extract_root / "squashfs-root"
    marker = extract_root / ".qaenv-runtime-cache.json"
    if target.exists():
        binary = target / "dsh-piggy-desktop"
        if not binary.is_file():
            raise RuntimeError("TOOL: incomplete previous AppImage extraction cache; refusing to overwrite")
        if not marker.is_file():
            raise RuntimeError("TOOL: existing AppImage extraction has no QAENV identity marker")
        identity = json.loads(marker.read_text(encoding="utf-8"))
        if identity.get("appImageSha256") != expected_appimage_sha or identity.get("desktopSha256") != sha256_file(binary):
            raise RuntimeError("ASSERTION: cached AppImage extraction does not match the pinned artifact")
        return binary
    if marker.exists():
        raise RuntimeError("TOOL: orphan AppImage extraction identity marker without runtime tree")
    entry = run.ledger.launch("m1-appimage-extract", [str(app_image), "--appimage-extract"], cwd=extract_root,
                              env=env, timeout=timeout, command_label="M1 AppImage runtime extraction", check=False)
    if entry.get("exitCode") or not (target / "dsh-piggy-desktop").is_file():
        raise RuntimeError(f"TOOL: M1 AppImage extraction failed, exit={entry.get('exitCode')}; stdout/stderr retained in logs")
    binary = target / "dsh-piggy-desktop"
    atomic_json(marker, {"appImageSha256": expected_appimage_sha, "desktopSha256": sha256_file(binary),
                         "createdAtUtc": utc(), "source": "exact M1FINAL AppImage"})
    return binary


def wait_target(run, port, expected_url=None, timeout=25, process=None, label="application"):
    endpoint = f"http://127.0.0.1:{port}/json/list"
    deadline = time.monotonic() + timeout
    last = None
    while time.monotonic() < deadline:
        if process is not None and process.poll() is not None:
            raise RuntimeError(f"TOOL: {label} exited during readiness wait, rc={process.returncode}; owned stderr retained")
        try:
            with urllib.request.urlopen(endpoint, timeout=1) as response:
                rows = json.load(response)
            pages = [row for row in rows if row.get("type") == "page"]
            if expected_url is not None:
                pages = [row for row in pages if expected_url in row.get("url", "")]
            if pages:
                return pages[0]
        except Exception as error:
            last = type(error).__name__
        time.sleep(0.2)
    raise RuntimeError(f"TOOL: {label} CDP page did not become ready within {timeout}s (last={last or 'no page'})")


def start_appimage(run, xsession, app_image, port, layout, cfg):
    env = xsession.env(user_data=layout["nativeUserData"], temp=layout["nativeTmpDir"])
    env.update({"PIGGY_USERDATA": layout["nativeUserData"], "HOME": str(run.out / "home"),
                "XDG_CONFIG_HOME": str(run.out / "config"),
                "XDG_DATA_HOME": str(run.out / "data")})
    run.stage("appimage-start", "RUNNING", port=port, artifact="M1FINAL AppImage")
    process, entry = run.ledger.spawn("m1-appimage", [str(app_image), "--appimage-extract-and-run", "--no-sandbox",
               "--disable-gpu", "--ozone-platform=x11", f"--remote-debugging-address=127.0.0.1",
               f"--remote-debugging-port={port}", f"--user-data-dir={layout['nativeUserData']}"],
               cwd=run.out, env=env, command_label="M1 AppImage CDP smoke")
    try:
        page = wait_target(run, port, timeout=int(cfg["timeouts"]["appImageReadySeconds"]), process=process, label="M1 AppImage")
        client = Cdp(page["webSocketDebuggerUrl"], timeout=8)
        try:
            page_title = client.evaluate("document.title")
            client.screenshot(run.out / "screenshots" / "m1-appimage.png")
        finally:
            client.close()
        run.stage("appimage-ready", "PASS", pageTitle=page_title or page.get("title", ""))
    finally:
        run.ledger.stop_entry(entry)
    if process.poll() is None:
        raise RuntimeError("TOOL: M1 AppImage remained alive after owned stop")
    run.stage("appimage-stopped", "PASS", exitCode=process.returncode)


def element_box(client, selector):
    expression = f"(()=>{{const e=document.querySelector({json.dumps(selector)});if(!e)return null;const r=e.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,p=document.elementFromPoint(x,y),s=getComputedStyle(e);return {{x,y,w:r.width,h:r.height,visible:r.width>0&&r.height>0&&s.visibility==='visible'&&s.display!=='none'&&s.opacity!=='0',hit:!!p&&(p===e||e.contains(p)),dpr:devicePixelRatio,sx:screenX,sy:screenY,ow:outerWidth,oh:outerHeight,iw:innerWidth,ih:innerHeight}};}})()"
    row = client.evaluate(expression)
    if not row or not row["visible"] or not row["hit"]:
        raise RuntimeError(f"ASSERTION: fixture element is not visibly hit-testable: {selector}")
    return row


def screen_point(box):
    dpr = float(box["dpr"])
    left = (float(box["ow"]) - float(box["iw"])) / 2
    top = float(box["oh"]) - float(box["ih"])
    return ((float(box["sx"]) + left + float(box["x"])) * dpr,
            (float(box["sy"]) + top + float(box["y"])) * dpr)


def find_window(xsession, run_id, owner_entry):
    deadline = time.monotonic() + 12
    while time.monotonic() < deadline:
        matches = _run(["xdotool", "search", "--onlyvisible", "--name", run_id], xsession.xenv, check=False).stdout.split()
        for xid in matches:
            info = xsession.window_info(xid)
            pid = info.get("pid")
            if pid is None:
                continue
            try:
                stat = pathlib.Path(f"/proc/{pid}/stat").read_text().rsplit(")", 1)[1].split()
                if int(stat[2]) == int(owner_entry["leader"]["pgid"]) and int(stat[3]) == int(owner_entry["leader"]["sid"]):
                    return info
            except (OSError, ValueError, IndexError):
                continue
        time.sleep(0.2)
    raise RuntimeError("ASSERTION: visible fixture window did not match the owned process session")


def run_fixture_carrier(run, xsession, carrier, port, layout, cfg, sample):
    fixture_source = BASE / "guest" / "fixture-electron"
    if carrier == "electron":
        fixture = pathlib.Path(layout["electronFixtureRoot"])
        for item in fixture_source.iterdir():
            shutil.copy2(item, fixture / item.name)
        binary = pathlib.Path(layout["electron44RuntimeRoot"]) / "electron"
        user_data = pathlib.Path(layout["electronFixtureUserData"])
        command = [str(binary), str(fixture), "--no-sandbox", "--disable-gpu"]
        env = xsession.env(user_data=user_data)
        env.update({"QAENV_CDP_PORT": str(port), "QAENV_RUN_ID": layout["runId"], "QAENV_USER_DATA": str(user_data)})
        run_key = "electronFixtureReadySeconds"
    else:
        browser = pathlib.Path(cfg["guest"]["chromiumLauncher"])
        user_data = pathlib.Path(layout["chromiumProfile"])
        fixture = pathlib.Path(layout["chromiumFixture"])
        shutil.copyfile(fixture_source / "basic.html", fixture)
        file_url = fixture.as_uri() + "?runId=" + layout["runId"]
        command = [str(browser), f"--user-data-dir={user_data}", f"--remote-debugging-port={port}",
                   "--remote-debugging-address=127.0.0.1", "--no-first-run", "--disable-gpu",
                   "--no-default-browser-check", f"--app={file_url}"]
        env = xsession.env(snap=True)
        run_key = "chromiumReadySeconds"
    run.stage(f"{carrier}-fixture-start", "RUNNING", port=port)
    process, owner = run.ledger.spawn(f"qaenv-{carrier}", command, cwd=run.out, env=env, command_label=f"{carrier} fixture UI")
    expected = layout["runId"]
    try:
        page = wait_target(run, port, expected_url=expected, timeout=int(cfg["timeouts"][run_key]), process=process, label=carrier)
        client = Cdp(page["webSocketDebuggerUrl"], timeout=8)
        try:
            xsession.screenshot(run.out / "screenshots" / f"{carrier}-before-input.png")
            window = find_window(xsession, expected, owner)
            run.identity.setdefault("windows", []).append({"carrier": carrier, **window})
            run.ledger._write()
            run.stage(f"{carrier}-fixture-ready", "PASS", title=page.get("title", ""), window=window["xid"])
            fixture_interactions(run, xsession, client, owner, window, carrier, expected, sample)
        finally:
            client.close()
    finally:
        run.ledger.stop_entry(owner)
    if process.poll() is None:
        raise RuntimeError(f"TOOL: {carrier} fixture remained alive after owned stop")
    run.stage(f"{carrier}-fixture-stopped", "PASS", exitCode=process.returncode)


def fixture_interactions(run, xsession, client, owner, window, carrier, run_id, sample):
    def click_selector(selector):
        box = element_box(client, selector)
        x, y = screen_point(box)
        geometry = window["geometry"]
        if not (0 <= x < int(run.cfg["guest"]["screenWidth"]) and 0 <= y < int(run.cfg["guest"]["screenHeight"])):
            raise RuntimeError(f"ASSERTION: {carrier} element center outside private X screen: {selector}")
        xsession.click(x, y)
        return {"selector": selector, "screenX": round(x, 2), "screenY": round(y, 2),
                "windowX": geometry.get("x"), "windowY": geometry.get("y"), "hitTest": "visible-element-center"}

    actions = []
    actions.append(click_selector("#text-input"))
    xsession.key("ctrl+a")
    marker = f"real-XTest-{run_id}"
    xsession.type_text(marker)
    time.sleep(0.25)
    text_value = client.evaluate("document.querySelector('#input-value').textContent")
    if text_value != f"value: {marker}":
        raise RuntimeError("ASSERTION: real XTest typed text did not reach fixture input")
    actions.append({"action": "type-text", "visibleValueMatched": True})
    actions.append(click_selector("#increment"))
    time.sleep(0.2)
    click_count = client.evaluate("document.querySelector('#click-count').textContent")
    if click_count != "clicks: 1":
        raise RuntimeError("ASSERTION: real XTest button click was not observed")
    actions.append({"action": "click-button", "visibleCounterMatched": True})
    actions.append(click_selector("#scroll-region"))
    xsession.action(["xdotool", "click", "--repeat", "16", "--delay", "55", "5"], timeout=15)
    time.sleep(0.4)
    scroll = client.evaluate("(()=>{const e=document.querySelector('#scroll-region');return {top:e.scrollTop,bottom:e.scrollHeight-e.clientHeight,visible:[...e.querySelectorAll('[data-row]')].filter(x=>x.getBoundingClientRect().bottom<=e.getBoundingClientRect().bottom+1&&x.getBoundingClientRect().top>=e.getBoundingClientRect().top-1).map(x=>x.dataset.row)}})()")
    if not scroll or scroll["top"] <= 0 or "32" not in scroll["visible"]:
        raise RuntimeError("ASSERTION: real XTest wheel did not scroll the fixture to row 32")
    actions.append({"action": "wheel-scroll", "scrollTop": scroll["top"], "lastVisibleRow": "32"})
    actions.append(click_selector("#file-input"))
    time.sleep(0.7)
    dialog = xsession.active_window()
    if not re.search(r"open", dialog.get("title", ""), re.I):
        raise RuntimeError("ASSERTION: XTest file input did not open a visible Open dialog")
    if not dialog.get("pid"):
        raise RuntimeError("ASSERTION: active file dialog has no readable owner PID")
    try:
        stat = pathlib.Path(f"/proc/{dialog['pid']}/stat").read_text().rsplit(")", 1)[1].split()
        if int(stat[2]) != int(owner["leader"]["pgid"]) or int(stat[3]) != int(owner["leader"]["sid"]):
            raise RuntimeError("ASSERTION: GTK file dialog PID is outside the owned fixture session")
    except (OSError, ValueError, IndexError) as error:
        raise RuntimeError("ASSERTION: GTK file dialog owner could not be verified") from error
    transient_match = re.search(r"WM_TRANSIENT_FOR\(WINDOW\): window id # (0x[0-9a-fA-F]+)", dialog.get("properties", ""))
    transient_owner = transient_match.group(1) if transient_match and int(transient_match.group(1), 16) else None
    if transient_owner is not None and int(transient_owner, 16) != int(window["xid"]):
        raise RuntimeError("ASSERTION: GTK dialog transient owner is not the visible fixture window")
    dialog_path = run.out / "screenshots" / f"{carrier}-gtk-open-before-selection.png"
    xsession.screenshot(dialog_path)
    atomic_json(run.out / "reports" / f"{carrier}-gtk-dialog.json", dialog)
    xsession.key("ctrl+l")
    time.sleep(0.25)
    xsession.type_text(str(sample))
    time.sleep(0.25)
    xsession.key("alt+o")
    deadline = time.monotonic() + int(run.cfg["timeouts"]["fileDialogSeconds"])
    selection = None
    while time.monotonic() < deadline:
        try:
            selection = client.evaluate("(()=>({name:document.querySelector('#file-name').textContent,size:document.querySelector('#file-size').textContent,content:document.querySelector('#file-content').textContent}))()")
            if selection and selection["name"] != "file: none":
                break
        except Exception:
            pass
        time.sleep(0.2)
    expected_content = f"QAENV_SAMPLE_CONTENT:{run_id}"
    expected_size = pathlib.Path(sample).stat().st_size
    if not selection or selection["name"] != f"file: {pathlib.Path(sample).name}" or selection["size"] != f"bytes: {expected_size}" or expected_content not in selection["content"]:
        raise RuntimeError("ASSERTION: visible page did not receive the selected sample file name/size/content marker")
    xsession.screenshot(run.out / "screenshots" / f"{carrier}-after-file-selection.png")
    actions.append({"action": "gtk-file-selection", "dialogTitle": dialog["title"],
                    "dialogOwnerPid": dialog["pid"], "transientOwnerXid": transient_owner,
                    "ownerRelation": "transient-window-match" if transient_owner else "owned-process-session",
                    "selectedNameMatched": True,
                    "selectedSizeMatched": True, "contentMarkerMatched": True})
    atomic_json(run.out / "reports" / f"{carrier}-actions.json", {"runId": run_id, "actions": actions,
                "finalVisibleState": selection, "sampleBytes": expected_size,
                "inputFilesPropertyWrittenByHarness": False})
    run.stage(f"{carrier}-real-input", "PASS", actionCount=len(actions), fileDialogOwnerVerified=True)


def typecheck(run, source, deps, runtime, timeout):
    source = pathlib.Path(source)
    deps = pathlib.Path(deps)
    links = [source / "node_modules", source / "apps" / "desktop" / "node_modules"]
    created = []
    try:
        for link in links:
            if link.exists() or link.is_symlink():
                raise RuntimeError(f"TOOL: refusing existing node_modules path in isolated source: {link}")
            link.symlink_to(deps, target_is_directory=True)
            created.append(link)
        env = {"PATH": "/usr/local/bin:/usr/bin:/bin", "HOME": str(run.out / "home"),
               "TMPDIR": str(run.out / "tmp"), "XDG_CONFIG_HOME": str(run.out / "config"),
               "XDG_CACHE_HOME": str(run.out / "cache"), "XDG_DATA_HOME": str(run.out / "data"),
               "ELECTRON_RUN_AS_NODE": "1", "DSH_PIG_TSC": str(deps / "typescript" / "bin" / "tsc"),
               "DSH_PIG_TYPES": str(deps / "@types")}
        run.stage("project-typecheck", "RUNNING", typescript="5.9.3", sourceCommit=run.cfg["hostIdentity"]["sourceCommit"])
        entry = run.ledger.launch("project-typecheck", [str(runtime), str(source / "scripts" / "typecheck.mjs"), "--quiet"],
                                  cwd=source, env=env, timeout=timeout,
                                  command_label="M1 source project typecheck", check=False)
        if entry.get("exitCode"):
            raise RuntimeError(f"ASSERTION: project typecheck exited {entry['exitCode']}; full diagnostics retained")
        run.stage("project-typecheck", "PASS", exitCode=0, stdout=str(pathlib.Path(entry["stdout"]).relative_to(run.out)),
                  stderr=str(pathlib.Path(entry["stderr"]).relative_to(run.out)))
    finally:
        for link in reversed(created):
            if link.is_symlink() and link.resolve() == deps.resolve():
                link.unlink()


def controlled_failures(run, runtime, cfg):
    env = {"PATH": "/usr/local/bin:/usr/bin:/bin", "HOME": str(run.out / "home"),
           "TMPDIR": str(run.out / "tmp"), "ELECTRON_RUN_AS_NODE": "1"}
    # 该负例只验证测试工具自身，不触碰产品逻辑，并保留预期退出码。
    started = utc()
    out = run.out / "logs" / "controlled-early-exit.stdout.log"
    err = run.out / "logs" / "controlled-early-exit.stderr.log"
    with out.open("wb") as stdout, err.open("wb") as stderr:
        proc = subprocess.Popen([str(runtime), "-e", "process.exit(23)"], cwd=run.out, env=env,
                                stdin=subprocess.DEVNULL, stdout=stdout, stderr=stderr,
                                start_new_session=True, close_fds=True)
        entry = run.ledger._entry(proc, "expected-early-exit", out, err, "controlled expected exit 23")
        code = proc.wait(timeout=int(cfg["timeouts"]["shortChildSeconds"]))
    entry.update({"status": "expected-exit", "exitCode": code, "endedAtUtc": utc(), "expectedExitCode": 23,
                  "startedAtUtc": started})
    run.ledger._write()
    if code != 23:
        raise RuntimeError("ASSERTION: controlled early exit did not preserve its expected exit code")
    run.stage("controlled-early-exit", "PASS", expectedExitCode=23)
    process, entry = run.ledger.spawn("expected-timeout", ["sleep", "15"], cwd=run.out, env=env,
                                      command_label="controlled bounded timeout")
    try:
        run.ledger.wait(process, entry, 0.5)
        raise RuntimeError("ASSERTION: bounded timeout child unexpectedly returned before its deadline")
    except RuntimeError as error:
        if "exceeded 0.5s" not in str(error):
            raise
        run.ledger.stop_entry(entry, term_seconds=2)
    if process.poll() is None or entry.get("status") != "stopped":
        raise RuntimeError("ASSERTION: timeout child was not stopped by its recorded owner")
    run.stage("controlled-timeout-cleanup", "PASS", timeoutSeconds=0.5, ownerStatus=entry["status"])


def cleanup_owned_directories(run):
    rid = run.layout["runId"]
    candidates = [
        run.layout["nativeShortRoot"] + "/n", run.layout["nativeShortRoot"] + "/x", run.layout["nativeShortRoot"] + "/r",
        run.layout["snapRunRoot"] + "/p", run.layout["snapRunRoot"] + "/t", run.layout["snapRunRoot"] + "/x", run.layout["snapRunRoot"] + "/r",
        run.layout["nativeUserData"], run.layout["electronFixtureRoot"], run.layout["electron44RuntimeRoot"],
        run.layout["electronFixtureUserData"],
        str(pathlib.Path(run.layout["nativeXauthority"]).parent), str(pathlib.Path(run.layout["sampleInputNative"]).parent),
    ]
    removed = []
    for raw in candidates:
        path = pathlib.Path(raw)
        if not path.exists():
            continue
        marker = path / ".qaenv-owner.json"
        # 只删除带有本次 runId 所有者标记的目录。
        if not marker.is_file():
            run.identity.setdefault("cleanupWarnings", []).append({"path": str(path), "reason": "owner marker absent; left in place"})
            run.ledger._write()
            continue
        try:
            value = json.loads(marker.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            value = {}
        if value.get("runId") != rid:
            run.identity.setdefault("cleanupWarnings", []).append({"path": str(path), "reason": "owner marker mismatch; left in place"})
            run.ledger._write()
            continue
        shutil.rmtree(path)
        removed.append(str(path))
    for name in ("native", "fixture", "display", "inputs"):
        parent = run.root / name
        try:
            parent.rmdir()
        except OSError:
            pass
    return removed


def prepare_owned_roots(run):
    # 创建前拒绝复用残留路径，清理时不删除共享父目录。
    native_children = [pathlib.Path(run.layout["nativeShortRoot"]) / name for name in ("n", "x", "r")]
    snap_children = [pathlib.Path(run.layout["snapRunRoot"]) / name for name in ("p", "t", "x", "r")]
    for path in native_children + snap_children:
        if path.exists():
            raise RuntimeError(f"TOOL: short owned directory already exists; refusing cleanup/reuse: {path}")
    for parent in (pathlib.Path(run.layout["nativeShortRoot"]), pathlib.Path(run.layout["snapRunRoot"])):
        parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    for path in native_children + snap_children:
        path.mkdir(mode=0o700)
        run._write_owner(path)
    for key in ("nativeUserData", "electronFixtureRoot", "electron44RuntimeRoot", "electronFixtureUserData"):
        path = pathlib.Path(run.layout[key])
        if path.exists():
            raise RuntimeError(f"TOOL: per-run path already exists; refusing reuse: {path}")
        path.mkdir(parents=True, mode=0o700)
        run._write_owner(path)
    auth_parent = pathlib.Path(run.layout["nativeXauthority"]).parent
    if auth_parent.exists():
        raise RuntimeError(f"TOOL: per-run display directory already exists; refusing reuse: {auth_parent}")
    auth_parent.mkdir(parents=True, mode=0o700)
    run._write_owner(auth_parent)
    for key in ("sampleInputNative",):
        parent = pathlib.Path(run.layout[key]).parent
        parent.mkdir(parents=True, mode=0o700)
        run._write_owner(parent)
def preflight_cached(cfg, paths, run):
    environment = check_guest_tools(cfg)
    expected = cfg["toolchainVersions"]
    deps = pathlib.Path(paths["depsRoot"])
    versions = {}
    for package, wanted in expected["packages"].items():
        package_path = deps.joinpath(*package.split("/"), "package.json")
        if not package_path.is_file():
            # 带作用域的包名直接映射到对应的 node_modules 子路径。
            package_path = deps / package / "package.json"
        if not package_path.is_file():
            raise RuntimeError(f"ENV: offline dependency missing: {package}")
        actual = json.loads(package_path.read_text(encoding="utf-8")).get("version")
        versions[package] = actual
        if actual != wanted:
            raise RuntimeError(f"ASSERTION: offline dependency version mismatch for {package}")
    runtime_zip = pathlib.Path(cfg["inputs"]["electronZip"])
    file_hash(runtime_zip, cfg["hostIdentity"]["electron44ZipSha256"], "Electron 44 ZIP")
    for key in ("nativeTmpDir", "nativeXdgRuntimeDir", "chromiumTmpDir", "chromiumXdgRuntimeDir"):
        budget = run.layout["socketBudgetBytes"][key]
        if budget >= 107:
            raise RuntimeError(f"CONFIG: AF_UNIX socket budget too close to limit for {key}: {budget}/107")
    run.stage("guest-preflight", "PASS", filesystem=environment["guestScratchFilesystem"],
              dependencyVersions=versions, socketBudget=run.layout["socketBudgetBytes"])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", required=True)
    parser.add_argument("--run-label", choices=("a", "b"), required=True)
    parser.add_argument("--cleanup-only", action="store_true")
    args = parser.parse_args()
    cfg = json.loads(pathlib.Path(args.config).read_text(encoding="utf-8"))
    if args.cleanup_only:
        layout = derive_layout(cfg, args.run_label)
        root = pathlib.Path(layout["guestRunRoot"])
        out = pathlib.Path(layout["evidenceRoot"])
        identity_path = out / "reports" / "identity.json"
        if not identity_path.is_file():
            return 0
        ledger = object.__new__(ProcessLedger)
        ledger.root, ledger.logs, ledger.reports = out, out / "logs", out / "reports"
        ledger.path = identity_path
        ledger._handles = {}
        ledger.data = json.loads(identity_path.read_text(encoding="utf-8"))
        try:
            cleanup = ledger.cleanup()
        except Exception as error:
            cleanup = {"allStopped": False, "errorType": type(error).__name__}
            atomic_json(out / "reports" / "cleanup-only.json", cleanup)
            return 3
        run = object.__new__(GuestRun)
        run.cfg, run.label, run.layout, run.root, run.out = cfg, args.run_label, layout, root, out
        run.ledger, run.identity, run.failures = ledger, ledger.data, []
        removed = cleanup_owned_directories(run)
        prior_report_path = out / "reports" / "report.json"
        report = json.loads(prior_report_path.read_text(encoding="utf-8")) if prior_report_path.exists() else {"runId": layout["runId"]}
        report["cleanupOnlyVerification"] = {"allStopped": cleanup.get("allStopped", False), "removedDirectories": removed}
        if run.identity.get("cleanupWarnings"):
            report["cleanupOnlyVerification"]["allStopped"] = False
            report["cleanupOnlyVerification"]["warnings"] = run.identity["cleanupWarnings"]
        atomic_json(prior_report_path, report)
        atomic_json(out / "reports" / "cleanup-only.json", {"allStopped": cleanup.get("allStopped", False),
                    "removedDirectories": removed, "verifiedAtUtc": utc()})
        print(f"QAENV_CLEANUP {layout['runId']} {'PASS' if cleanup.get('allStopped') else 'FAIL'}", flush=True)
        return 0 if cleanup.get("allStopped") and not run.identity.get("cleanupWarnings") else 3
    run = None
    status = "FAIL"
    result = {}
    try:
        run = GuestRun(cfg, args.run_label)
        run.stage("run-start", "RUNNING", label=args.run_label)
        paths = config_paths(cfg, run.layout)
        prepare_owned_roots(run)
        preflight_cached(cfg, paths, run)
        source, deps, app_image = setup_cache_and_source(run, paths)
        app_run_node = extract_appimage_runtime(run, app_image, run.layout,
                                               {"PATH": "/usr/local/bin:/usr/bin:/bin", "HOME": str(run.out / "home"),
                                                "TMPDIR": str(run.out / "tmp")},
                                               int(cfg["timeouts"]["runtimeProbeSeconds"]),
                                               cfg["hostIdentity"]["appImageSha256"])
        versions = runtime_versions(run, app_run_node, {"PATH": "/usr/local/bin:/usr/bin:/bin", "HOME": str(run.out / "home"),
                                                         "TMPDIR": str(run.out / "tmp")},
                                    int(cfg["timeouts"]["runtimeProbeSeconds"]))
        run.identity.update({"runtimeVersions": versions, "sourceCommit": cfg["hostIdentity"]["sourceCommit"],
                             "appImageSha256": cfg["hostIdentity"]["appImageSha256"],
                             "electron44ZipSha256": cfg["hostIdentity"]["electron44ZipSha256"]})
        run.ledger._write()
        if args.run_label == "a":
            typecheck(run, source, deps, app_run_node, int(cfg["timeouts"]["typecheckSeconds"]))
            run.identity["typecheck"] = {"status": "PASS", "runId": run.layout["runId"]}
        else:
            run.identity["typecheck"] = {"status": "REUSED_FROM_A", "runId": f"{cfg['task']['taskId'].lower()}-{cfg['task']['runBatchId']}-a"}
            run.stage("project-typecheck", "REUSED_FROM_A", sourceCommit=cfg["hostIdentity"]["sourceCommit"])
        run.ledger._write()
        xsession = XSession(cfg, run, run.layout)
        xsession.start(("appImageCdp", "electronFixtureCdp", "snapChromiumCdp"))
        ports = run.identity["ports"]
        # 分别记录正式 AppImage runtime 与隔离 Electron fixture runtime。
        start_appimage(run, xsession, app_image, ports["appImageCdp"], run.layout, cfg)
        sample_native = ensure_sample(run, run.layout)
        sample_snap = ensure_sample(run, run.layout, snap=True)
        run_fixture_carrier(run, xsession, "electron", ports["electronFixtureCdp"], run.layout, cfg, sample_native)
        run_fixture_carrier(run, xsession, "chromium", ports["snapChromiumCdp"], run.layout, cfg, sample_snap)
        if args.run_label == "a":
            controlled_failures(run, app_run_node, cfg)
            run.identity["controlledFailureCleanup"] = {"status": "PASS", "runId": run.layout["runId"]}
        else:
            run.identity["controlledFailureCleanup"] = {"status": "REUSED_FROM_A", "runId": f"{cfg['task']['taskId'].lower()}-{cfg['task']['runBatchId']}-a"}
        run.ledger._write()
        status = "PASS"
    except KeyboardInterrupt as exc:
        status = "INTERRUPTED"
        if run:
            run.record_failure(exc, "TOOL")
    except Exception as exc:
        status = "FAIL"
        if run:
            classification = "ENV" if "ENV:" in str(exc) else "ASSERTION" if "ASSERTION:" in str(exc) else "TOOL"
            run.record_failure(exc, classification)
    finally:
        if run is not None:
            try:
                cleanup = run.ledger.cleanup()
            except Exception as exc:
                status = "FAIL"
                run.record_failure(exc, "TOOL")
                cleanup = {"allStopped": False, "errorType": type(exc).__name__}
            screenshots = []
            for image in sorted((run.out / "screenshots").glob("*.png")):
                screenshots.append({"name": image.name, "bytes": image.stat().st_size, "sha256": sha256_file(image)})
            atomic_json(run.out / "reports" / "screenshot-index.json", {"count": len(screenshots), "items": screenshots})
            try:
                removed = cleanup_owned_directories(run)
            except Exception as exc:
                status = "FAIL"
                run.record_failure(exc, "TOOL")
                removed = []
            if run.identity.get("cleanupWarnings"):
                status = "FAIL"
                run.record_failure(RuntimeError("TOOL: one or more owned directories could not be verified and were left in place"), "TOOL")
            report = {"runId": run.layout["runId"], "status": status, "finishedAtUtc": utc(),
                      "failure": run.failures[-1] if run.failures else None,
                      "runtimeVersions": run.identity.get("runtimeVersions"),
                      "cleanup": cleanup, "ownedDirectoriesRemoved": removed,
                      "cleanupWarnings": run.identity.get("cleanupWarnings", []),
                      "testScope": ["offline typecheck", "M1 AppImage CDP startup/screenshot/stop",
                                    "Electron44 and Snap Chromium real XTest input/GTK file selection",
                                    "owned early-exit and timeout cleanup"],
                      "noProductRegressionSuite": True, "automaticRetry": False}
            atomic_json(run.out / "reports" / "report.json", report)
            run.identity.update({"status": status, "finishedAtUtc": utc()})
            run.ledger._write()
            run.stage("run-finish", status)
    if run is None:
        print(json.dumps({"status": status, "error": "run setup failed before evidence root"}, ensure_ascii=False))
    else:
        print(json.dumps({"status": status, "runId": run.layout["runId"],
                          "evidenceRoot": str(run.out), "runReport": str(run.out / "reports" / "report.json")}, ensure_ascii=False))
    return 0 if status == "PASS" else 130 if status == "INTERRUPTED" else 2


if __name__ == "__main__":
    raise SystemExit(main())
