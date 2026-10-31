#!/usr/bin/env python3
"""使用单份配置完成预检、布局导出和 QAENV A/B 两次基线运行。"""
from __future__ import annotations

import argparse
import datetime
import gzip
import hashlib
import json
import os
import pathlib
import re
import shlex
import shutil
import stat
import subprocess
import tarfile
import time
from datetime import timezone

HERE = pathlib.Path(__file__).resolve().parents[1]
REPO = HERE.parents[1]
import sys
sys.path.insert(0, str(HERE / "lib"))
from layout import derive_batch


def q(value):
    return shlex.quote(str(value))


def utc():
    return datetime.datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def sha256(path):
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


def missing_values(value, path="config"):
    if isinstance(value, dict):
        for key, child in value.items():
            missing_values(child, f"{path}.{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            missing_values(child, f"{path}[{index}]")
    elif isinstance(value, str) and ("REPLACE_WITH" in value or value == ""):
        raise ValueError(f"CONFIG: fill private value at {path}")


def command_exists(name):
    return shutil.which(name) is not None


def check_private_path(path, label, *, require_private=False):
    target = pathlib.Path(path)
    if not target.is_file():
        raise RuntimeError(f"ENV: configured {label} is missing")
    if require_private and stat.S_IMODE(target.stat().st_mode) & 0o077:
        raise RuntimeError(f"CONFIG: {label} must not be group/other accessible")
    return target


def preflight(cfg, *, require_new_run=True):
    required = ("ssh", "scp", "tmux", "ssh-keygen", "virsh", "python3", "git", "tar", "sha256sum", "findmnt", "timeout")
    missing = [name for name in required if not command_exists(name)]
    if missing:
        raise RuntimeError("ENV: missing host tool(s): " + ", ".join(missing))
    host = cfg["host"]
    ssh = cfg["ssh"]
    repo_root = pathlib.Path(host["repoRoot"]).resolve()
    if repo_root != REPO.resolve():
        raise RuntimeError("CONFIG: host.repoRoot must identify this isolated QAENV worktree")
    if host.get("sourceCommit") != "3585c2f758b108fc1bfdb954ab3543e333cdf06c":
        raise RuntimeError("CONFIG: sourceCommit must remain the pushed M1 baseline")
    for key in ("appImage", "toolchainArchive", "electron44Zip"):
        path = check_private_path(host[key], key)
        if sha256(path) != host[key + "Sha256"]:
            raise RuntimeError(f"ENV: configured artifact SHA mismatch: {key}")
    if not os.access(host["appImage"], os.X_OK):
        raise RuntimeError("ENV: M1 AppImage is not executable")
    identity = check_private_path(ssh["identityFile"], "SSH identity file", require_private=True)
    known_hosts = check_private_path(ssh["knownHostsFile"], "pinned known_hosts file")
    if sha256(known_hosts) != ssh["knownHostsSha256"]:
        raise RuntimeError("ENV: pinned known_hosts file SHA mismatch")
    fingerprints = subprocess.run(["ssh-keygen", "-lf", str(known_hosts), "-E", "sha256"],
                                  capture_output=True, text=True, timeout=8, check=False)
    if fingerprints.returncode or ssh["hostKeyFingerprint"] not in fingerprints.stdout:
        raise RuntimeError("ENV: pinned SSH host-key fingerprint is not present")
    if not ("SHA256:" in ssh["hostKeyFingerprint"]):
        raise RuntimeError("CONFIG: SSH host-key fingerprint must use SHA256 form")
    if stat.S_IMODE(identity.stat().st_mode) & 0o077:
        raise RuntimeError("CONFIG: SSH identity file permissions must be 0600 or stricter")

    lease_cfg = cfg["lease"]
    lease_file = check_private_path(lease_cfg["leaseFile"], "root lease JSON")
    guard_file = check_private_path(lease_cfg["guardFile"], "root resource-guard JSON")
    lease = json.loads(lease_file.read_text(encoding="utf-8"))
    guard = json.loads(guard_file.read_text(encoding="utf-8"))
    lease_id = lease.get("leaseId")
    if (lease_id != lease_cfg["id"] or lease.get("uuid") != lease_cfg["guestUuid"] or
            lease.get("uri") != lease_cfg["qemuUri"] or
            (lease.get("task") or lease.get("currentTestTask")) != lease_cfg["task"] or
            lease.get("actor") != lease_cfg["actor"]):
        raise RuntimeError("ENV: configured lease identity/task/actor does not match root lease")
    if lease.get("ownershipReservedByDispatcher") is not True:
        raise RuntimeError("ENV: root lease no longer reserves this guest")
    authorized = lease.get("authorizedTaskGuestDirectories")
    if not isinstance(authorized, list) or not authorized:
        raise RuntimeError("ENV: root lease does not include its authorized guest directory allowlist")
    authorized = [pathlib.PurePosixPath(item) for item in authorized if isinstance(item, str) and item.startswith("/")]
    def covered(path):
        wanted_path = pathlib.PurePosixPath(path)
        return any(wanted_path == parent or parent in wanted_path.parents for parent in authorized)
    required_roots = [cfg["guest"]["taskRoot"], str(pathlib.Path(cfg["guest"]["taskRoot"]) / "cache")]
    for layout in derive_batch(cfg):
        required_roots.extend((layout["guestRunRoot"], layout["nativeShortRoot"] + "/n",
                               layout["nativeShortRoot"] + "/x", layout["nativeShortRoot"] + "/r",
                               layout["snapRunRoot"] + "/p", layout["snapRunRoot"] + "/t",
                               layout["snapRunRoot"] + "/x", layout["snapRunRoot"] + "/r"))
    unauthorized = [path for path in required_roots if not covered(path)]
    if unauthorized:
        raise RuntimeError("ENV: lease does not authorize all derived guest paths")
    guard_pid = int(guard.get("guardPid", -1))
    expected_guard_pid = int(lease_cfg.get("guardPid") or guard_pid)
    if (guard.get("leaseId") != lease_id or guard.get("task") != lease_cfg["task"] or
            guard.get("actor") != lease_cfg["actor"] or guard.get("guest", {}).get("uuid") != lease_cfg["guestUuid"] or
            guard.get("guest", {}).get("uri") != lease_cfg["qemuUri"] or guard.get("status") != "watching" or
            guard_pid <= 0 or guard_pid != expected_guard_pid):
        raise RuntimeError("ENV: resource guard is not watching the same active lease")
    try:
        os.kill(guard_pid, 0)
        cmdline = pathlib.Path(f"/proc/{guard_pid}/cmdline").read_bytes().replace(b"\0", b" ")
    except OSError as error:
        raise RuntimeError("ENV: configured resource guard process is not alive") from error
    if b"resource-guard.py" not in cmdline or str(lease_cfg["guestUuid"]).encode() not in cmdline:
        raise RuntimeError("ENV: live guard PID command identity differs from the supplied lease")
    sample = guard.get("lastSampleAt")
    if not sample:
        raise RuntimeError("ENV: resource guard has not recorded a sample")
    sampled = datetime.datetime.fromisoformat(sample.replace("Z", "+00:00"))
    if (datetime.datetime.now(timezone.utc) - sampled).total_seconds() > 15:
        raise RuntimeError("ENV: resource guard sample is stale")
    state = subprocess.run(["virsh", "-c", lease_cfg["qemuUri"], "domstate", lease_cfg["guestUuid"]],
                           capture_output=True, text=True, timeout=10, check=False)
    if state.returncode or state.stdout.strip() != "running":
        raise RuntimeError("ENV: leased VM is not already running; QAENV never boots a VM")
    current = subprocess.run(["virsh", "-c", lease_cfg["qemuUri"], "list", "--uuid"],
                             capture_output=True, text=True, timeout=10, check=False)
    running_uuids = [line.strip() for line in current.stdout.splitlines() if line.strip()]
    if current.returncode or running_uuids != [lease_cfg["guestUuid"]]:
        raise RuntimeError("ENV: current libvirt running-VM set is not exactly the authorized VM")
    run_root = pathlib.Path(host["runRoot"]).resolve()
    if ".work" not in run_root.parts or run_root == pathlib.Path("/"):
        raise RuntimeError("CONFIG: host runRoot must stay under a .work directory")
    if require_new_run and run_root.exists():
        raise RuntimeError("TOOL: host runRoot already exists; choose a fresh runBatchId/output directory")
    session = f"{cfg['task']['sessionPrefix']}-{cfg['task']['runBatchId']}"
    if not re.fullmatch(r"[A-Za-z0-9_-]{3,64}", session):
        raise RuntimeError("CONFIG: tmux session name is invalid/too long")
    exists = subprocess.run(["tmux", "has-session", "-t", session], stdout=subprocess.DEVNULL,
                            stderr=subprocess.DEVNULL, check=False)
    if exists.returncode == 0:
        raise RuntimeError("TOOL: task-named tmux session already exists")
    if cfg["guest"]["screenWidth"] != 1600 or cfg["guest"]["screenHeight"] != 1000:
        raise RuntimeError("CONFIG: QAENV basic GTK fixture requires the approved 1600x1000 private display")
    return {"leaseMatched": True, "guardPidMatched": True, "guardSampleFresh": True,
            "guestRootsAuthorized": True, "vmAlreadyRunning": True, "runningVMCount": len(running_uuids), "tmuxSession": session,
            "hostRunRoot": str(run_root), "appImageSha256": host["appImageSha256"],
            "toolchainSha256": host["toolchainArchiveSha256"], "electron44ZipSha256": host["electron44ZipSha256"]}


def source_manifest_from_archive(archive_path):
    entries = {}
    with tarfile.open(archive_path, "r:gz") as archive:
        for member in archive.getmembers():
            if member.isdir():
                continue
            if member.issym():
                entries[member.name] = {"type": "symlink", "target": member.linkname}
            elif member.isfile():
                stream = archive.extractfile(member)
                digest = hashlib.sha256()
                for block in iter(lambda: stream.read(1024 * 1024), b""):
                    digest.update(block)
                entries[member.name] = {"type": "file", "sha256": digest.hexdigest(), "bytes": member.size}
            else:
                raise RuntimeError(f"TOOL: unsupported source archive member type: {member.name}")
    return {"commit": "3585c2f758b108fc1bfdb954ab3543e333cdf06c", "entries": entries}


def build_local_artifacts(cfg, run_root):
    repo = pathlib.Path(cfg["host"]["repoRoot"]).resolve()
    wanted = cfg["host"]["sourceCommit"]
    if wanted != "3585c2f758b108fc1bfdb954ab3543e333cdf06c":
        raise RuntimeError("CONFIG: source commit must remain the pushed M1 baseline")
    check = subprocess.run(["git", "-C", str(repo), "cat-file", "-e", wanted + "^{tree}"],
                           capture_output=True, timeout=10, check=False)
    if check.returncode:
        raise RuntimeError("ENV: requested M1 source commit object is unavailable")
    branch = subprocess.run(["git", "-C", str(repo), "branch", "--show-current"], capture_output=True,
                            text=True, check=True).stdout.strip()
    if branch != "chore/qa-baseline-20261101":
        raise RuntimeError("CONFIG: QAENV tool worktree is not on chore/qa-baseline-20261101")
    ancestor = subprocess.run(["git", "-C", str(repo), "merge-base", "--is-ancestor", wanted, "HEAD"],
                              capture_output=True, check=False)
    if ancestor.returncode:
        raise RuntimeError("CONFIG: current QAENV tool branch does not descend from the pushed M1 baseline")
    run_root = pathlib.Path(run_root)
    for name in ("artifacts", "logs", "reports", "scripts"):
        (run_root / name).mkdir(parents=True, exist_ok=True, mode=0o700)
    source_archive = run_root / "artifacts" / "source-3585.tar.gz"
    with source_archive.open("wb") as raw:
        with gzip.GzipFile(fileobj=raw, mode="wb", mtime=0, compresslevel=4) as compressed:
            result = subprocess.run(["git", "-C", str(repo), "archive", "--format=tar", wanted],
                                    stdout=compressed, stderr=subprocess.PIPE, timeout=180, check=False)
    if result.returncode:
        raise RuntimeError("TOOL: git archive of M1 baseline failed")
    manifest = source_manifest_from_archive(source_archive)
    source_manifest = run_root / "artifacts" / "source-3585-manifest.json"
    atomic_json(source_manifest, manifest)
    toolkit_archive = run_root / "artifacts" / "qa-env-toolkit.tar.gz"
    with tarfile.open(toolkit_archive, "w:gz", compresslevel=6) as archive:
        base = repo / "tools" / "qa-env"
        for path in sorted(base.rglob("*")):
            if "__pycache__" in path.parts or path.suffix == ".pyc":
                continue
            archive.add(path, arcname=(pathlib.Path("qa-env") / path.relative_to(base)).as_posix(), recursive=False)
    hashes = {"sourceArchive": sha256(source_archive), "sourceManifest": sha256(source_manifest),
              "toolkitArchive": sha256(toolkit_archive)}
    atomic_json(run_root / "reports" / "local-artifacts.json", {
        "createdAtUtc": utc(), "sourceCommit": wanted, "sourceEntryCount": len(manifest["entries"]),
        "artifacts": {key: {"path": str(run_root / "artifacts" / name), "sha256": hashes[key],
                             "bytes": (run_root / "artifacts" / name).stat().st_size}
                      for key, name in (("sourceArchive", source_archive.name), ("sourceManifest", source_manifest.name),
                                        ("toolkitArchive", toolkit_archive.name))},
        "noPackageInstall": True, "sourceFromGitArchive": True,
    })
    return {"sourceArchive": source_archive, "sourceManifest": source_manifest,
            "toolkitArchive": toolkit_archive, "hashes": hashes}


def guest_config(cfg, layout):
    guest_root = pathlib.Path(cfg["guest"]["taskRoot"])
    cache = guest_root / "cache"
    run_root = pathlib.Path(layout["guestRunRoot"])
    return {
        "schemaVersion": 1,
        "task": {"taskId": cfg["task"]["taskId"], "actor": cfg["task"]["actor"], "runBatchId": cfg["task"]["runBatchId"]},
        "guest": {key: cfg["guest"][key] for key in ("taskRoot", "nativeShortRootParent", "snapShortRootParent", "chromiumLauncher", "displayBase", "displayCount", "screenWidth", "screenHeight", "portBase", "portCount")},
        "hostIdentity": {"sourceCommit": cfg["host"]["sourceCommit"], "appImageSha256": cfg["host"]["appImageSha256"],
                         "electron44ZipSha256": cfg["host"]["electron44ZipSha256"]},
        "inputs": {"sourceManifest": str(cache / "source-3585-manifest.json"),
                   "appImage": str(cache / "M1FINAL.AppImage"), "electronZip": str(cache / "electron-v44.5.1-linux-x64.zip")},
        "toolchainVersions": json.loads((pathlib.Path(cfg["host"]["repoRoot"]) / "tools" / "qa-env" / "toolchain-versions.json").read_text(encoding="utf-8")),
        "timeouts": cfg["timeouts"], "runRoot": str(run_root),
    }


def make_remote_command(cfg, command):
    ssh = cfg["ssh"]
    host = f"{ssh['user']}@{ssh['host']}"
    args = ["ssh", "-T", "-i", ssh["identityFile"], "-p", str(ssh["port"]),
            "-o", "BatchMode=yes", "-o", "IdentitiesOnly=yes", "-o", "ConnectTimeout=10",
            "-o", "ServerAliveInterval=10", "-o", "ServerAliveCountMax=3", "-o", "StrictHostKeyChecking=yes",
            "-o", f"UserKnownHostsFile={ssh['knownHostsFile']}", host, command]
    return " ".join(q(arg) for arg in args)


def make_scp_command(cfg, local_path, remote_path, *, reverse=False):
    ssh = cfg["ssh"]
    host = f"{ssh['user']}@{ssh['host']}"
    opts = ["scp", "-P", str(ssh["port"]), "-i", ssh["identityFile"], "-o", "BatchMode=yes",
            "-o", "IdentitiesOnly=yes", "-o", "ConnectTimeout=10", "-o", "StrictHostKeyChecking=yes",
            "-o", f"UserKnownHostsFile={ssh['knownHostsFile']}"]
    left, right = (f"{host}:{remote_path}", str(local_path)) if reverse else (str(local_path), f"{host}:{remote_path}")
    return " ".join(q(arg) for arg in [*opts, left, right])


def remote_cache_items(cfg, local_artifacts):
    host = cfg["host"]
    root = pathlib.Path(cfg["guest"]["taskRoot"])
    cache = root / "cache"
    return [
        (local_artifacts["sourceArchive"], cache / "source-3585.tar.gz", local_artifacts["hashes"]["sourceArchive"]),
        (local_artifacts["sourceManifest"], cache / "source-3585-manifest.json", local_artifacts["hashes"]["sourceManifest"]),
        (local_artifacts["toolkitArchive"], cache / "qa-env-toolkit.tar.gz", local_artifacts["hashes"]["toolkitArchive"]),
        (pathlib.Path(host["toolchainArchive"]), cache / "toolchain-deps.tar.gz", host["toolchainArchiveSha256"]),
        (pathlib.Path(host["appImage"]), cache / "M1FINAL.AppImage", host["appImageSha256"]),
        (pathlib.Path(host["electron44Zip"]), cache / "electron-v44.5.1-linux-x64.zip", host["electron44ZipSha256"]),
    ]


def build_transport(cfg, run_root, layouts, artifacts):
    guest_root = pathlib.Path(cfg["guest"]["taskRoot"])
    cache = guest_root / "cache"
    session = f"{cfg['task']['sessionPrefix']}-{cfg['task']['runBatchId']}"
    log = run_root / "logs" / "transport.log"
    rcfile = run_root / "host-exit-code.txt"
    lines = ["#!/usr/bin/env bash", "set -euo pipefail", f"exec > >(tee -a {q(log)}) 2>&1",
             f"RCFILE={q(rcfile)}", "finish(){ rc=$?; trap - EXIT; printf '%s\\n' \"$rc\" > \"$RCFILE\"; exit \"$rc\"; }", "trap finish EXIT",
             f"{make_remote_command(cfg, 'mkdir -p ' + q(cache) + ' ' + q(cache / 'configs') + ' ' + q(guest_root / 'runs'))}",
             f"FSTYPE=$({make_remote_command(cfg, 'findmnt -n -o FSTYPE -T ' + q(guest_root))})",
             'case "$FSTYPE" in tmpfs|ramfs) echo "ENV: task root is RAM-backed; require disk-backed /var/tmp"; exit 30;; esac']
    for local_path, remote_path, expected in remote_cache_items(cfg, artifacts):
        tmp_remote = str(remote_path) + ".part-" + cfg["task"]["runBatchId"]
        probe = make_remote_command(cfg, f"if [ -f {q(remote_path)} ]; then printf PRESENT; else printf MISSING; fi")
        lines += [f"CACHE_STATE=$({probe})", f"if [ \"$CACHE_STATE\" = MISSING ]; then",
                  make_scp_command(cfg, local_path, tmp_remote),
                  make_remote_command(cfg, f"printf '%s  %s\\n' {q(expected)} {q(tmp_remote)} | sha256sum -c - >/dev/null && mv {q(tmp_remote)} {q(remote_path)}"),
                  "elif [ \"$CACHE_STATE\" = PRESENT ]; then",
                  make_remote_command(cfg, f"printf '%s  %s\\n' {q(expected)} {q(remote_path)} | sha256sum -c - >/dev/null"),
                  "else echo 'TOOL: unexpected remote-cache probe response'; exit 31; fi"]
    lines.append(make_remote_command(cfg, f"chmod 700 {q(cache / 'M1FINAL.AppImage')}"))
    cache_manifest = run_root / "artifacts" / "guest-cache-manifest.json"
    items = {str(remote): expected for _, remote, expected in remote_cache_items(cfg, artifacts)}
    atomic_json(cache_manifest, {"task": cfg["task"]["taskId"], "sourceCommit": cfg["host"]["sourceCommit"], "items": items})
    cache_manifest_remote = cache / "qa-env-cache-manifest.json"
    extracted_manifest_remote = cache / "qa-env-extracted-manifest.json"
    lines += [make_scp_command(cfg, cache_manifest, str(cache_manifest_remote) + ".part-" + cfg["task"]["runBatchId"]),
              make_remote_command(cfg, f"mv {q(str(cache_manifest_remote)+'.part-'+cfg['task']['runBatchId'])} {q(cache_manifest_remote)}")]
    extract = (f"set -e; if [ -f {q(extracted_manifest_remote)} ]; then cmp -s {q(cache_manifest_remote)} {q(extracted_manifest_remote)}; "
               f"else test ! -e {q(cache / 'source-3585')}; test ! -e {q(cache / 'qa-env')}; test ! -e {q(cache / 'toolchain')}; "
               f"mkdir -m 700 -p {q(cache / 'source-3585')} {q(cache / 'toolchain')}; "
               f"tar -xzf {q(cache / 'source-3585.tar.gz')} -C {q(cache / 'source-3585')}; "
               f"tar -xzf {q(cache / 'qa-env-toolkit.tar.gz')} -C {q(cache)}; "
               f"tar -xzf {q(cache / 'toolchain-deps.tar.gz')} -C {q(cache / 'toolchain')}; "
               f"chmod 700 {q(cache / 'source-3585')} {q(cache / 'qa-env')} {q(cache / 'toolchain')}; "
               f"cp {q(cache_manifest_remote)} {q(extracted_manifest_remote)}; fi")
    lines.append(make_remote_command(cfg, extract))
    for layout in layouts:
        guest_cfg = guest_config(cfg, layout)
        local_cfg = run_root / "scripts" / f"{layout['runId']}-guest-config.json"
        atomic_json(local_cfg, guest_cfg)
        remote_config = cache / "configs" / f"{layout['runId']}.json"
        lines.append(make_scp_command(cfg, local_cfg, str(remote_config) + ".part-" + cfg["task"]["runBatchId"]))
        lines.append(make_remote_command(cfg, f"mv {q(str(remote_config)+'.part-'+cfg['task']['runBatchId'])} {q(remote_config)}"))
    for layout in layouts:
        run_id = layout["runId"]
        run_root_guest = pathlib.Path(layout["guestRunRoot"])
        lines.append(make_remote_command(cfg, f"test ! -e {q(run_root_guest)}"))
        remote_cfg = cache / "configs" / f"{run_id}.json"
        guest_entry = cache / "qa-env" / "guest" / "runner.py"
        timeout_seconds = int(cfg["timeouts"]["runSeconds"])
        runner_env = f"env -i PATH=/usr/local/bin:/usr/bin:/bin HOME={q(cache)} LANG=C.UTF-8 LC_ALL=C.UTF-8 TZ=UTC PYTHONDONTWRITEBYTECODE=1"
        remote_run = make_remote_command(cfg, f"{runner_env} timeout --signal=INT --kill-after=12s {timeout_seconds}s python3 {q(guest_entry)} --config {q(remote_cfg)} --run-label {layout['label']}")
        remote_cleanup = make_remote_command(cfg, f"{runner_env} python3 {q(guest_entry)} --config {q(remote_cfg)} --run-label {layout['label']} --cleanup-only")
        lines += ["set +e", remote_run, "GUEST_RC=$?", remote_cleanup, "CLEANUP_RC=$?", "set -e",
                  'if [ "$GUEST_RC" -eq 0 ] && [ "$CLEANUP_RC" -ne 0 ]; then GUEST_RC=$CLEANUP_RC; fi']
        evidence = pathlib.Path(layout["guestRunRoot"]) / "evidence.tar.gz"
        out_root = run_root_guest / "out"
        fallback_report = out_root / "reports" / "report.json"
        pack = (f"if [ ! -d {q(out_root)} ]; then mkdir -m 700 -p {q(out_root / 'reports')} {q(out_root / 'logs')}; "
                f"printf '%s\\n' '{{\"runId\":\"{run_id}\",\"status\":\"FAIL\",\"failureClass\":\"TOOL\",\"reason\":\"guest runner exited before evidence initialization\"}}' > {q(fallback_report)}; fi; "
                f"tar -czf {q(evidence)} -C {q(pathlib.Path(layout['guestRunRoot']))} out")
        lines.append(make_remote_command(cfg, pack))
        local_export = run_root / "artifacts" / f"{run_id}-evidence.tar.gz"
        lines.append(make_scp_command(cfg, str(local_export), str(evidence), reverse=True))
        lines += [f"if [ \"$GUEST_RC\" -ne 0 ]; then echo \"QAENV: {run_id} failed with guest rc=$GUEST_RC; stopping before next run\"; exit \"$GUEST_RC\"; fi"]
    lines += ["exit 0"]
    script = run_root / "scripts" / "transport-and-verify.sh"
    script.write_text("\n".join(lines) + "\n", encoding="utf-8")
    os.chmod(script, 0o700)
    return script, session


def run_batch(cfg, pre):
    run_root = pathlib.Path(cfg["host"]["runRoot"]).resolve()
    run_root.mkdir(parents=True, mode=0o700)
    for name in ("logs", "reports", "scripts", "artifacts"):
        (run_root / name).mkdir(mode=0o700)
    atomic_json(run_root / "reports" / "preflight.json", {"atUtc": utc(), **pre})
    local_artifacts = build_local_artifacts(cfg, run_root)
    layouts = derive_batch(cfg)
    layout_report = {"authorizationStatus": "ROOT_LEASE_DIRECTORY_ALLOWLIST_REQUIRED",
                     "generatedAtUtc": utc(), "runs": layouts,
                     "vmBootRequestedByTool": False, "hostDisplayUse": False}
    atomic_json(run_root / "reports" / "layout.json", layout_report)
    cfg_report = run_root / "reports" / "config-sanitized.json"
    atomic_json(cfg_report, {"task": cfg["task"], "guest": cfg["guest"], "hostIdentity": {
        "sourceCommit": cfg["host"]["sourceCommit"], "appImageSha256": cfg["host"]["appImageSha256"],
        "toolchainArchiveSha256": cfg["host"]["toolchainArchiveSha256"],
        "electron44ZipSha256": cfg["host"]["electron44ZipSha256"]}, "timeouts": cfg["timeouts"]})
    script, session = build_transport(cfg, run_root, layouts, local_artifacts)
    rcfile = run_root / "host-exit-code.txt"
    start = subprocess.run(["tmux", "new-session", "-d", "-s", session, "bash", "--noprofile", "--norc", str(script)],
                           capture_output=True, text=True, timeout=8, check=False)
    if start.returncode:
        raise RuntimeError("TOOL: could not create the task-owned tmux session")
    atomic_json(run_root / "reports" / "progress.json", {"runBatchId": cfg["task"]["runBatchId"],
                "startedAtUtc": utc(), "phase": "transport", "status": "running", "tmuxSession": session})
    deadline = time.monotonic() + int(cfg["timeouts"]["hostSeconds"])
    while time.monotonic() < deadline:
        if rcfile.is_file():
            break
        active = subprocess.run(["tmux", "has-session", "-t", session], stdout=subprocess.DEVNULL,
                                stderr=subprocess.DEVNULL, check=False)
        if active.returncode:
            break
        time.sleep(1)
    if not rcfile.is_file():
        try:
            subprocess.run(["tmux", "send-keys", "-t", session, "C-c"], timeout=3, check=False)
            time.sleep(5)
        finally:
            subprocess.run(["tmux", "kill-session", "-t", session], timeout=3, check=False)
        result = {"runBatchId": cfg["task"]["runBatchId"], "status": "TOOL_TIMEOUT", "finishedAtUtc": utc(),
                  "tmuxSession": session, "hostLog": str(run_root / "logs" / "transport.log"),
                  "automaticRetry": False}
        atomic_json(run_root / "reports" / "progress.json", result)
        return 40
    code = int(rcfile.read_text(encoding="utf-8").strip())
    subprocess.run(["tmux", "kill-session", "-t", session], timeout=3, check=False)
    evidence_records = []
    for layout in derive_batch(cfg):
        archive_path = run_root / "artifacts" / f"{layout['runId']}-evidence.tar.gz"
        if archive_path.is_file():
            evidence_records.append({"runId": layout["runId"], "path": str(archive_path),
                                     "bytes": archive_path.stat().st_size, "sha256": sha256(archive_path)})
    atomic_json(run_root / "reports" / "evidence-index.json", {"archives": evidence_records})
    result = {"runBatchId": cfg["task"]["runBatchId"], "status": "PASS" if code == 0 else "FAIL",
              "exitCode": code, "finishedAtUtc": utc(), "tmuxSession": session,
              "hostLog": str(run_root / "logs" / "transport.log"), "evidenceArchives": [
                  record for record in evidence_records],
              "automaticRetry": False}
    atomic_json(run_root / "reports" / "progress.json", result)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return code


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", required=True)
    parser.add_argument("command", choices=("print-layout", "preflight", "verify"))
    args = parser.parse_args()
    cfg_path = pathlib.Path(args.config).resolve()
    if args.command != "print-layout":
        if stat.S_IMODE(cfg_path.stat().st_mode) & 0o077:
            raise RuntimeError("CONFIG: private QAENV config must be mode 0600")
    cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
    missing_values(cfg)
    if args.command == "print-layout":
        print(json.dumps({"authorizationStatus": "LAYOUT_ONLY_ROOT_AUTHORIZATION_REQUIRED",
                          "runs": derive_batch(cfg)}, ensure_ascii=False, indent=2))
        return 0
    pre = preflight(cfg, require_new_run=True)
    if args.command == "preflight":
        print(json.dumps(pre, ensure_ascii=False, indent=2))
        return 0
    return run_batch(cfg, pre)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        classification = "ENV" if "ENV:" in str(error) else "CONFIG_OR_TOOL"
        print(json.dumps({"status": "FAIL_FAST", "classification": classification,
                          "errorType": type(error).__name__, "message": str(error)[:500]}, ensure_ascii=False), file=sys.stderr)
        raise SystemExit(2)
