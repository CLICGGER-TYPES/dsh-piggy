"""把共享操作装配到任务已有的 QAENV3 实例上。"""
from __future__ import annotations

from collections.abc import Callable, Mapping
from pathlib import Path
from typing import Any

from .actions import Actions
from .cdp_adapter import CdpBrowserAdapter
from .geometry import CoordinateMapper
from .input_adapter import XTestInputAdapter
from .native_adapter import NativeWindowAdapter
from .observe import Observer


def create_operations(*, Cdp, xsession, ledger, proc_stat: Callable,
                      config: Mapping[str, Any],
                      action_log: Callable | None = None):
    """返回共用的 Observer/Actions；任务身份仅由 config 提供。"""
    browser = CdpBrowserAdapter(
        Cdp=Cdp, cdp_port=int(config["cdpPort"]), page_role_urls=config["pageRoleUrls"],
        page_role_probes=config["pageRoleProbes"],
    )
    native = NativeWindowAdapter(
        xsession=xsession, ledger=ledger, proc_stat=proc_stat,
        process_roles=config["processRoles"], native_wm_class=str(config["nativeWmClass"]),
    )
    input_adapter = XTestInputAdapter(
        xsession=xsession, windows=native, private_input_dir=Path(config["privateInputDir"]),
    )
    observer = Observer(browser, native)
    actions = Actions(observer, CoordinateMapper(), input_adapter, log=action_log)
    return observer, actions
