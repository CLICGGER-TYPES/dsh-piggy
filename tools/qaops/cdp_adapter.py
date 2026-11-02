"""Frozen QAENV3 CDP 观测实现；只读验证页面目标与截图。"""
from __future__ import annotations

import base64
import json
import urllib.request
from pathlib import Path
from typing import Any, Mapping, Sequence

from .model import ControlObservation, ControlSpec, PageRef, PageSnapshot, Point, QAOperationError, ScreenshotRef, ViewportMetrics


class CdpBrowserAdapter:
    def __init__(self, *, Cdp, cdp_port: int, page_role_urls: Mapping[str, str],
                 page_role_probes: Mapping[str, tuple[str, Any]], command_timeout: float = 8):
        self.Cdp = Cdp
        self.cdp_port = int(cdp_port)
        self.page_role_urls = dict(page_role_urls)
        self.page_role_probes = dict(page_role_probes)
        self.command_timeout = command_timeout

    def _target_rows(self):
        endpoint = f"http://127.0.0.1:{self.cdp_port}/json/list"
        try:
            opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
            with opener.open(endpoint, timeout=self.command_timeout) as response:
                rows = json.load(response)
        except Exception as error:
            raise QAOperationError("ENVIRONMENT", f"CDP target list unavailable ({type(error).__name__})") from None
        if not isinstance(rows, list):
            raise QAOperationError("ENVIRONMENT", "CDP target list has an invalid shape")
        return rows

    def page_candidates(self, role: str, expected_url: str):
        if (role not in self.page_role_urls or self.page_role_urls[role] != expected_url
                or role not in self.page_role_probes):
            raise QAOperationError("ACTION_NOCOVER", "page role and configured URL do not match")
        candidates = []
        for row in self._target_rows():
            if (row.get("type") == "page" and row.get("url") == expected_url
                    and isinstance(row.get("webSocketDebuggerUrl"), str) and self._role_matches(row, role)):
                candidates.append(PageRef(str(row.get("id", "")), role, expected_url))
        return candidates

    def _role_matches(self, target, role: str) -> bool:
        client = None
        try:
            client = self.Cdp(target["webSocketDebuggerUrl"], timeout=self.command_timeout)
            return self._role_matches_client(client, role)
        except Exception as error:
            raise QAOperationError("ACTION_NOCOVER", f"configured page role read failed ({type(error).__name__})") from None
        finally:
            if client is not None:
                client.close()

    def _role_matches_client(self, client, role: str) -> bool:
        expression, expected = self.page_role_probes[role]
        result = client.command("Runtime.evaluate", {
            "expression": expression, "returnByValue": True, "awaitPromise": True,
        })
        if result.get("exceptionDetails"):
            raise QAOperationError("ACTION_NOCOVER", "configured page role probe could not be evaluated")
        return result.get("result", {}).get("value") == expected

    def _fresh_target(self, page: PageRef):
        if self.page_role_urls.get(page.role) != page.url:
            raise QAOperationError("ACTION_NOCOVER", "page role binding changed")
        rows = [row for row in self._target_rows()
                if row.get("id") == page.target_id and row.get("type") == "page"
                and row.get("url") == page.url and row.get("webSocketDebuggerUrl")]
        if len(rows) != 1:
            raise QAOperationError("ACTION_NOCOVER", "configured page target is no longer unique and current")
        return rows[0]

    def _with_client(self, page: PageRef, callback):
        target = self._fresh_target(page)
        client = None
        try:
            client = self.Cdp(target["webSocketDebuggerUrl"], timeout=self.command_timeout)
            if not self._role_matches_client(client, page.role):
                raise QAOperationError("ACTION_NOCOVER", "fresh page no longer reports its configured role")
            return callback(client)
        except QAOperationError:
            raise
        except Exception as error:
            raise QAOperationError("ENVIRONMENT", f"CDP observation failed ({type(error).__name__})") from None
        finally:
            if client is not None:
                client.close()

    @staticmethod
    def _evaluate_value(client, expression):
        result = client.command("Runtime.evaluate", {
            "expression": expression, "returnByValue": True, "awaitPromise": True,
        })
        remote = result.get("result", {})
        if result.get("exceptionDetails"):
            raise QAOperationError("ACTION_NOCOVER", "page observation could not be evaluated")
        return remote.get("value")

    @classmethod
    def _evaluate(cls, client, expression):
        value = cls._evaluate_value(client, expression)
        if not isinstance(value, dict):
            raise QAOperationError("ACTION_NOCOVER", "page observation returned no structured state")
        return value

    def snapshot(self, page: PageRef, controls: Sequence[ControlSpec]) -> PageSnapshot:
        specs = [{"key": item.key, "selector": item.selector} for item in controls]
        expression = """(() => {
 const specs=__SPECS__, out={metrics:{innerWidth,innerHeight,outerWidth,outerHeight,devicePixelRatio},
   state:{readyState:document.readyState,hasFocus:document.hasFocus()},controls:{}};
 for(const spec of specs){
  let els=[];try{els=[...document.querySelectorAll(spec.selector)]}catch(_){out.controls[spec.key]={invalidSelector:true};continue}
  const rows=els.map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e),x=r.left+r.width/2,y=r.top+r.height/2;
   const visible=r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>.01;
   const h=document.elementFromPoint(x,y);return{visible,centerHit:!!h&&(h===e||e.contains(h)),center:{x,y},
    rect:{x:r.x,y:r.y,width:r.width,height:r.height}}});
  out.controls[spec.key]={count:rows.length,...(rows.length===1?rows[0]:{})};
 }
 return out;
})()""".replace("__SPECS__", json.dumps(specs, ensure_ascii=False))
        state = self._with_client(page, lambda client: self._evaluate(client, expression))
        metrics = state.get("metrics", {})
        try:
            viewport = ViewportMetrics(float(metrics["innerWidth"]), float(metrics["innerHeight"]),
                                       float(metrics["outerWidth"]), float(metrics["outerHeight"]),
                                       float(metrics["devicePixelRatio"]))
        except (KeyError, TypeError, ValueError):
            raise QAOperationError("ACTION_NOCOVER", "page geometry is incomplete") from None
        observed = {}
        for spec in controls:
            row = state.get("controls", {}).get(spec.key, {})
            if row.get("invalidSelector"):
                raise QAOperationError("ACTION_NOCOVER", "configured selector could not be evaluated")
            center = row.get("center")
            rect = row.get("rect") or {}
            observed[spec.key] = ControlObservation(
                count=int(row.get("count", 0)), visible=bool(row.get("visible", False)),
                center_hit=bool(row.get("centerHit", False)),
                center=Point(float(center["x"]), float(center["y"])) if center else None,
                rect={key: float(value) for key, value in rect.items()},
            )
        return PageSnapshot(page, viewport, observed, state.get("state", {}))

    def hit_test(self, page: PageRef, point: Point, control: ControlSpec) -> dict[str, Any]:
        expression = """(() => {const selector=__SELECTOR__,x=__X__,y=__Y__,els=[...document.querySelectorAll(selector)],
 p=document.elementFromPoint(x,y),e=els.length===1?els[0]:null,r=e?.getBoundingClientRect(),s=e?getComputedStyle(e):null;
 return{count:els.length,visible:!!r&&r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>.01,
 hit:!!p&&!!e&&(p===e||e.contains(p)),pageRole:__ROLE__};})()"""
        expression = (expression.replace("__SELECTOR__", json.dumps(control.selector))
                      .replace("__X__", json.dumps(point.x)).replace("__Y__", json.dumps(point.y))
                      .replace("__ROLE__", json.dumps(page.role)))
        result = self._with_client(page, lambda client: self._evaluate(client, expression))
        result["targetId"] = page.target_id
        result["pageTargetId"] = page.target_id
        result["hit"] = bool(result.get("count") == 1 and result.get("visible") and result.get("hit"))
        return result

    def focused(self, page: PageRef, control: ControlSpec) -> bool:
        expression = """(() => {const es=[...document.querySelectorAll(__SELECTOR__)];
 return es.length===1&&document.activeElement===es[0]&&document.hasFocus();})()""".replace(
            "__SELECTOR__", json.dumps(control.selector))
        return self._with_client(page, lambda client: self._evaluate_value(client, expression)) is True

    def console(self, page: PageRef, since: Any = None):
        def read(client):
            client.command("Runtime.enable")
            client.command("Runtime.evaluate", {"expression": "void 0", "returnByValue": True})
            events = list(getattr(client, "events", ()))
            start = int(since or 0)
            safe = []
            for index, row in enumerate(events[start:], start=start):
                if row.get("method") not in ("Runtime.consoleAPICalled", "Log.entryAdded", "Runtime.exceptionThrown"):
                    continue
                params = row.get("params", {})
                safe.append({"cursor": index + 1, "method": row.get("method"),
                             "type": params.get("type") or params.get("entry", {}).get("level"),
                             "timestamp": params.get("timestamp") or params.get("entry", {}).get("timestamp")})
            return safe
        return self._with_client(page, read)

    def capture_viewport(self, page: PageRef, path: Path) -> ScreenshotRef:
        if path.exists() or path.is_symlink():
            raise QAOperationError("ENVIRONMENT", "viewport screenshot path already exists")
        def save(client):
            client.command("Page.enable")
            result = client.command("Page.captureScreenshot", {
                "format": "png", "fromSurface": True, "captureBeyondViewport": False,
            })
            encoded = result.get("data")
            if not encoded:
                raise QAOperationError("ACTION_NOCOVER", "CDP screenshot contained no image data")
            path.parent.mkdir(parents=True, exist_ok=True)
            with path.open("xb") as stream:
                stream.write(base64.b64decode(encoded))
        self._with_client(page, save)
        width, height = self._png_size(path)
        return ScreenshotRef(str(path), "viewport", width, height)

    @staticmethod
    def _png_size(path: Path):
        with path.open("rb") as stream:
            header = stream.read(24)
        if len(header) < 24 or header[:8] != b"\x89PNG\r\n\x1a\n":
            raise QAOperationError("ENVIRONMENT", "captured screenshot is not a PNG")
        return int.from_bytes(header[16:20], "big"), int.from_bytes(header[20:24], "big")
