"""一次桌面孵化操作；目标 selector 与期望状态由任务提供。"""
from __future__ import annotations

from collections.abc import Callable

from ..actions import Actions
from ..model import ControlSpec, PageRef, PageSnapshot
from ..observe import Observer


def hatch_clicks(actions: Actions, observer: Observer, page: PageRef, pig: ControlSpec, *,
                 click_count: int, progress_after: Callable[[int, PageSnapshot], bool],
                 timeout: float = 5.0):
    if click_count < 1:
        raise ValueError("click_count must be positive")
    before = observer.snapshot(page, (pig,))
    records = []
    after = before
    for index in range(1, click_count + 1):
        records.append(Actions.record_dict(actions.click(page, pig)))
        after = observer.wait(page, (pig,), lambda state, i=index: progress_after(i, state), timeout)
    return {
        "status": "PASS",
        "actions": records,
        "beforeState": dict(before.state),
        "afterState": dict(after.state),
    }
