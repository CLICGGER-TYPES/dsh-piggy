#!/usr/bin/env python3
"""Local art-review server with private, version-aware structure checks."""
import argparse, json, mimetypes, os, re, tempfile, threading
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit

SCHEMA = 1
MEANING = "checked_means_structure_needs_revision"
MAX_BODY = 8192
MAX_NOTE = 2000
OMITTED = object()
HEX64 = re.compile(r"^[0-9a-fA-F]{64}$")
ISSUE_FIELDS = ("id", "sha256", "label", "image", "working_original", "needs_revision", "reason", "note", "updated_at")


class RegistryError(Exception): pass
class StateError(Exception): pass
class ConfigError(ValueError): pass


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="microseconds").replace("+00:00", "Z")


def within(path, base):
    try: return os.path.commonpath([os.path.realpath(path), os.path.realpath(base)]) == os.path.realpath(base)
    except (OSError, ValueError): return False


class ReviewState:
    def __init__(self, root, state_dir):
        self.root = os.path.realpath(root)
        self.state_dir = os.path.realpath(state_dir)
        if within(self.root, self.state_dir) or within(self.state_dir, self.root):
            raise ConfigError("--root and --state-dir must be disjoint directories")
        self.registry_path = os.path.join(self.state_dir, "registry.json")
        self.issues_path = os.path.join(self.state_dir, "structure-issues.json")
        self.lock = threading.Lock()
        os.makedirs(self.state_dir, mode=0o700, exist_ok=True)
        self.ensure_issues_file()

    def ensure_issues_file(self):
        """Create an empty issues list once; never touch existing user checks."""
        if os.path.lexists(self.issues_path):
            return
        try:
            fd = os.open(self.issues_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        except FileExistsError:
            return
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write("[]\n")
            f.flush()
            os.fsync(f.fileno())

    def load_registry(self):
        try:
            with open(self.registry_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except FileNotFoundError:
            return {}
        except (OSError, ValueError) as exc:
            raise RegistryError(str(exc)) from exc
        images = data.get("images") if isinstance(data, dict) else None
        if not isinstance(images, list):
            raise RegistryError("registry.images must be a list")
        entries = {}
        for entry in images:
            if not isinstance(entry, dict): continue
            ident, sha = entry.get("id"), entry.get("sha256")
            if isinstance(ident, str) and ident and isinstance(sha, str) and HEX64.match(sha):
                if ident in entries:
                    raise RegistryError(f"registry.images has duplicate id: {ident}")
                entries[ident] = entry
        return entries

    def load_issues(self):
        try:
            with open(self.issues_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except FileNotFoundError:
            return [], None
        except (OSError, ValueError) as exc:
            raise StateError(str(exc)) from exc
        if isinstance(data, list):
            issues, updated_at = data, None
        elif isinstance(data, dict) and isinstance(data.get("issues"), list):
            issues, updated_at = data["issues"], data.get("updated_at")
        else:
            raise StateError("structure-issues.json has an invalid shape")
        clean = [i for i in issues if isinstance(i, dict)]
        for issue in clean:
            if not isinstance(issue.get("note"), str):
                issue["note"] = ""
        return clean, updated_at if isinstance(updated_at, str) else None

    def save_issues(self, issues, updated_at):
        payload = {"schema": SCHEMA, "meaning": MEANING, "issues": issues, "updated_at": updated_at}
        fd, tmp = tempfile.mkstemp(prefix=".structure-issues.", suffix=".tmp", dir=self.state_dir)
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
                f.write("\n")
                f.flush()
                os.fsync(f.fileno())
            os.chmod(tmp, 0o600)
            os.replace(tmp, self.issues_path)
        except BaseException:
            try: os.unlink(tmp)
            except OSError: pass
            raise

    def build_state(self):
        registry = self.load_registry()
        with self.lock:
            issues, updated_at = self.load_issues()
        out = []
        for issue in issues:
            item = {key: issue.get(key) for key in ISSUE_FIELDS}
            reg = registry.get(item["id"])
            item["active"] = bool(reg and reg.get("sha256") == item["sha256"])
            out.append(item)
        if updated_at is None and out:
            updated_at = max((i.get("updated_at") or "" for i in out), default="") or None
        return {"schema": SCHEMA, "meaning": MEANING, "issues": out, "updated_at": updated_at}

    def update_issue(self, ident, sha, needs_revision, note=OMITTED):
        registry = self.load_registry()
        entry = registry.get(ident)
        if entry is None:
            return 404, {"error": "unknown_id"}
        if entry.get("sha256") != sha:
            return 409, {"error": "sha256_mismatch"}
        if note is not OMITTED and (not isinstance(note, str) or len(note) > MAX_NOTE):
            return 400, {"error": "invalid_note"}
        with self.lock:
            issues, _ = self.load_issues()
            kept_note = ""
            for issue in issues:
                if issue.get("id") == ident and issue.get("sha256") == sha:
                    kept_note = issue.get("note") or ""
                    break
            before = len(issues)
            issues = [i for i in issues
                      if not (i.get("id") == ident and i.get("sha256") == sha)]
            changed = len(issues) != before
            if needs_revision:
                stamp = now_iso()
                issues.append({
                    "id": ident,
                    "sha256": sha,
                    "label": entry.get("label", ""),
                    "image": entry.get("image", ""),
                    "working_original": entry.get("working_original", ""),
                    "needs_revision": True,
                    "reason": "structure",
                    "note": kept_note if note is OMITTED else note,
                    "updated_at": stamp,
                })
                changed = True
            if changed:
                self.save_issues(issues, now_iso())
        return 200, self.build_state()


class ReviewServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(self, address, handler, state):
        self.state = state
        super().__init__(address, handler)


class Handler(BaseHTTPRequestHandler):
    server_version = "ArtReview/1.0"

    def _send_bytes(self, status, body, content_type):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self._send_bytes(status, body, "application/json; charset=utf-8")

    def send_error(self, code, message=None, explain=None):
        self.close_connection = True
        try:
            name = HTTPStatus(code).phrase.lower().replace(" ", "_")
        except ValueError:
            name = "error"
        self._json(code, {"error": name})

    def _origin_ok(self):
        origin = self.headers.get("Origin")
        if origin is None:
            return True
        port = self.server.server_port
        return origin in (f"http://127.0.0.1:{port}", f"http://localhost:{port}")

    def _route_path(self):
        try:
            return urlsplit(self.path).path
        except ValueError:
            return ""

    def do_GET(self):
        if not self._origin_ok():
            return self._json(HTTPStatus.FORBIDDEN, {"error": "forbidden_origin"})
        path = self._route_path()
        if path == "/__review/state":
            try:
                return self._json(HTTPStatus.OK, self.server.state.build_state())
            except (RegistryError, StateError, OSError):
                return self._json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "state_unavailable"})
        if path.startswith("/__review/"):
            return self._json(HTTPStatus.NOT_FOUND, {"error": "not_found"})
        return self._serve_static(path)

    do_HEAD = do_GET

    def do_POST(self):
        if not self._origin_ok():
            return self._json(HTTPStatus.FORBIDDEN, {"error": "forbidden_origin"})
        if self._route_path() != "/__review/issue":
            return self._json(HTTPStatus.NOT_FOUND, {"error": "not_found"})
        media = self.headers.get("Content-Type", "").split(";", 1)[0].strip().lower()
        if media != "application/json":
            return self._json(HTTPStatus.UNSUPPORTED_MEDIA_TYPE,
                              {"error": "content_type_must_be_application_json"})
        raw_length = self.headers.get("Content-Length")
        try:
            length = int(raw_length) if raw_length is not None else -1
        except ValueError:
            length = -1
        if length < 0:
            return self._json(HTTPStatus.BAD_REQUEST, {"error": "valid_content_length_required"})
        if length > MAX_BODY:
            self.close_connection = True
            return self._json(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, {"error": "body_too_large"})
        raw = self.rfile.read(length)
        if len(raw) != length:
            return self._json(HTTPStatus.BAD_REQUEST, {"error": "incomplete_body"})
        try:
            data = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, ValueError):
            return self._json(HTTPStatus.BAD_REQUEST, {"error": "invalid_json"})
        if not isinstance(data, dict):
            return self._json(HTTPStatus.BAD_REQUEST, {"error": "json_object_required"})
        ident, sha, needs = data.get("id"), data.get("sha256"), data.get("needs_revision")
        if not isinstance(ident, str) or not ident or len(ident) > 256:
            return self._json(HTTPStatus.BAD_REQUEST, {"error": "invalid_id"})
        if not isinstance(sha, str) or not HEX64.match(sha):
            return self._json(HTTPStatus.BAD_REQUEST, {"error": "invalid_sha256"})
        if not isinstance(needs, bool):
            return self._json(HTTPStatus.BAD_REQUEST, {"error": "needs_revision_must_be_boolean"})
        note = data["note"] if "note" in data else OMITTED
        if note is not OMITTED and (not isinstance(note, str) or len(note) > MAX_NOTE):
            return self._json(HTTPStatus.BAD_REQUEST, {"error": "invalid_note"})
        try:
            status, payload = self.server.state.update_issue(ident, sha, needs, note)
        except (RegistryError, StateError, OSError):
            return self._json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "state_unavailable"})
        return self._json(status, payload)

    def _serve_static(self, raw_path):
        try:
            decoded = unquote(raw_path, errors="strict")
        except (UnicodeDecodeError, ValueError):
            return self._json(HTTPStatus.BAD_REQUEST, {"error": "invalid_path"})
        rel = decoded.lstrip("/")
        if "\x00" in rel or "\\" in rel:
            return self._json(HTTPStatus.NOT_FOUND, {"error": "not_found"})
        parts = [part for part in rel.split("/") if part not in ("", ".")]
        if not parts:
            parts = ["index.html"]
        if any(part == ".." for part in parts):
            return self._json(HTTPStatus.NOT_FOUND, {"error": "not_found"})
        candidate = os.path.realpath(os.path.join(self.server.state.root, *parts))
        if not within(candidate, self.server.state.root):
            return self._json(HTTPStatus.NOT_FOUND, {"error": "not_found"})
        if within(candidate, self.server.state.state_dir):
            return self._json(HTTPStatus.NOT_FOUND, {"error": "not_found"})
        if os.path.isdir(candidate):
            candidate = os.path.realpath(os.path.join(candidate, "index.html"))
            if not within(candidate, self.server.state.root):
                return self._json(HTTPStatus.NOT_FOUND, {"error": "not_found"})
            if within(candidate, self.server.state.state_dir):
                return self._json(HTTPStatus.NOT_FOUND, {"error": "not_found"})
        if not os.path.isfile(candidate):
            return self._json(HTTPStatus.NOT_FOUND, {"error": "not_found"})
        try:
            with open(candidate, "rb") as f:
                body = f.read()
        except OSError:
            return self._json(HTTPStatus.NOT_FOUND, {"error": "not_found"})
        content_type = mimetypes.guess_type(candidate)[0] or "application/octet-stream"
        if content_type.startswith("text/") or content_type in ("application/javascript", "application/json"):
            content_type += "; charset=utf-8"
        self._send_bytes(HTTPStatus.OK, body, content_type)


def main():
    parser = argparse.ArgumentParser(description="Local art review and structure-check server")
    parser.add_argument("--root", required=True, help="public review directory")
    parser.add_argument("--state-dir", required=True, help="private state directory (not served)")
    parser.add_argument("--port", type=int, default=9388)
    args = parser.parse_args()
    if not 0 <= args.port <= 65535:
        parser.error("--port must be between 0 and 65535")
    try:
        state = ReviewState(args.root, args.state_dir)
    except ConfigError as exc:
        parser.error(str(exc))
    server = ReviewServer(("127.0.0.1", args.port), Handler, state)
    print(f"art-review: http://127.0.0.1:{server.server_port} root={state.root} state-dir={state.state_dir}",
          flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
