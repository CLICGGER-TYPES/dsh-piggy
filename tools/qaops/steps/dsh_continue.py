"""一次 DSH 预览 Continue 操作；selector 与状态谓词由任务提供。"""
from __future__ import annotations

from collections.abc import Callable

from ..actions import Actions
from ..model import ControlSpec, PageRef, PageSnapshot
from ..observe import Observer


def continue_preview(actions: Actions, observer: Observer, page: PageRef,
                     control: ControlSpec, *, ready: Callable[[PageSnapshot], bool],
                     completed: Callable[[PageSnapshot], bool], timeout: float = 8.0):
    before = observer.wait(page, (control,), ready, timeout)
    action = actions.click(page, control)
    after = observer.wait(page, (control,), completed, timeout)
    return {
        "status": "PASS",
        "action": Actions.record_dict(action),
        "beforeReadyState": dict(before.state),
        "afterState": dict(after.state),
    }
