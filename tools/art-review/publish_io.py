#!/usr/bin/env python3
"""Filesystem and publication I/O shared by the art-review publisher.

The publisher may keep --public and --state-dir on different filesystems. Old
bytes are therefore copied to a private backup (never renamed across roots),
and restoration writes a temporary file inside the destination filesystem
before the final atomic replace.
"""
import hashlib
import json
import os
import re
import shutil
import tempfile
from pathlib import Path

SAFE_COMPONENT = re.compile(r'^[A-Za-z0-9][A-Za-z0-9._-]*$')
HEX64 = re.compile(r'^[0-9a-fA-F]{64}$')


class ReviewError(ValueError):
    """A review publication was rejected or could not be completed safely."""


def sha256_file(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def within(path, base):
    try:
        return os.path.commonpath([str(Path(path).resolve()), str(Path(base).resolve())]) == str(Path(base).resolve())
    except (OSError, RuntimeError, ValueError):
        return False


def ensure_disjoint(source, public, state_dir):
    pairs = [('--source', source, '--public', public),
             ('--source', source, '--state-dir', state_dir),
             ('--public', public, '--state-dir', state_dir)]
    for left_name, left, right_name, right in pairs:
        if left == right or within(left, right) or within(right, left):
            raise ReviewError(f'{left_name} and {right_name} must be disjoint directories')


def safe_component(value, field):
    if not isinstance(value, str) or not SAFE_COMPONENT.fullmatch(value):
        raise ReviewError(f'{field} must be a single safe path component')
    return value


def source_file(value, field, public, state_dir):
    if not isinstance(value, str) or not value:
        raise ReviewError(f'{field} must be a non-empty path string')
    try:
        path = Path(value).resolve(strict=True)
    except (OSError, RuntimeError) as exc:
        raise ReviewError(f'{field} does not exist: {value}') from exc
    if not path.is_file():
        raise ReviewError(f'{field} is not a file: {value}')
    if within(path, public) or within(path, state_dir):
        raise ReviewError(f'{field} must not point inside --public or --state-dir')
    return path


def public_target(public, relative, field):
    candidate = (public / relative).resolve()
    if candidate == public or not within(candidate, public):
        raise ReviewError(f'{field} escapes --public: {relative}')
    return candidate


def write_bytes_atomic(path, data, mode=0o600):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=f'.{path.name}.', suffix='.tmp', dir=str(path.parent))
    try:
        with os.fdopen(fd, 'wb') as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temporary, mode)
        os.replace(temporary, path)
    except BaseException:
        try:
            os.unlink(temporary)
        except OSError:
            pass
        raise


def write_json(path, data):
    payload = (json.dumps(data, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
    write_bytes_atomic(path, payload)


def read_bytes_or_none(path):
    try:
        return path.read_bytes()
    except FileNotFoundError:
        return None


def restore_bytes(path, data):
    if data is None:
        try:
            path.unlink()
        except FileNotFoundError:
            pass
    else:
        write_bytes_atomic(path, data)


def copy_into_place(source, target):
    """Copy source to a temporary file beside target, then atomically replace target."""
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_name(f'.{target.name}.{os.getpid()}.tmp')
    try:
        if temporary.exists() or temporary.is_symlink():
            temporary.unlink()
        shutil.copy2(source, temporary)
        os.replace(temporary, target)
    except BaseException:
        try:
            temporary.unlink()
        except OSError:
            pass
        raise


def backup_target(target, backup):
    """Copy old target bytes into the private state root; never rename across roots."""
    backup.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(target, backup)


def format_failures(label, failures, rollback_root):
    lines = [f'{label}; recovery artifacts preserved under {rollback_root}']
    for target, backup, error in failures:
        source = backup if backup else '(new file, no backup)'
        lines.append(f'  {target} <- {source}: {error}')
    return '\n'.join(lines)


def rollback_files(written, backups):
    """Restore old bytes on the destination filesystem. Return unresolved failures."""
    by_target = {target: backup for target, backup in backups}
    failures = []
    for target in reversed(written):
        backup = by_target.get(target)
        try:
            if backup is None:
                if target.is_symlink() or target.exists():
                    target.unlink()
            else:
                copy_into_place(backup, target)
        except Exception as exc:
            failures.append((str(target), str(backup) if backup else None, str(exc)))
    return failures


def commit_staged(public, staged, rollback_root):
    """Backup old targets, then atomically place each staged file.

    Backups are copies in the private state root, so public and state roots may
    live on different filesystems. On failure, restoration copies back through
    a temporary file in the destination directory. Incomplete restoration is
    reported with the preserved backup paths instead of being swallowed.
    """
    written, backups = [], []
    try:
        for relative in sorted(staged):
            target = public_target(public, relative, 'staged file')
            if target.is_dir():
                raise ReviewError(f'public target is a directory: {relative}')
            if target.exists() or target.is_symlink():
                backup = rollback_root / relative
                backup_target(target, backup)
                backups.append((target, backup))
            copy_into_place(staged[relative], target)
            written.append(target)
    except BaseException as exc:
        failures = rollback_files(written, backups)
        if failures:
            raise ReviewError(format_failures('rollback incomplete', failures, rollback_root)) from exc
        raise
    return written, backups


def archive_stale(public, state_dir, stamp, previous_files, files):
    """Move previously advertised files out of the public root after a registry switch."""
    warnings = []
    stale = {relative for relative in previous_files if isinstance(relative, str) and relative}
    for relative in sorted(stale - files):
        pure = Path(relative)
        if pure.is_absolute() or '\\' in relative or '\x00' in relative or any(part in ('..', '') for part in pure.parts):
            continue
        try:
            old = (public / relative).resolve()
        except (OSError, RuntimeError, ValueError):
            continue
        if old == public or not within(old, public) or not old.is_file():
            continue
        archived = state_dir / 'previous-publications' / stamp / relative
        try:
            archived.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(old), str(archived))
        except Exception as exc:
            warnings.append(f'could not archive {relative}: {exc}')
    return warnings
