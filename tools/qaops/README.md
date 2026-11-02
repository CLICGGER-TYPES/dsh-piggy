# Linux 原生 UI 验收操作

`tools/qaops` 是内部 Linux/X11 操作库。它复用调用方已建立的 QAENV3 `Cdp`、`XSession`、`ProcessLedger` 和 `proc_stat`；不复制 C7、lease、guard、X server 启动或进程清理逻辑。

## 支持范围

当前输入 adapter 依赖 Linux `/proc`、X11 和 `xdotool`，真实 native 输入只在 Linux X11/XTest 环境支持。native bounds 取自 owned XID 的 `xwininfo` 屏幕绝对 client 起点与 client 尺寸；不使用 reparent frame-relative 的 `xdotool getwindowgeometry` Y，也不再套用 `_NET_FRAME_EXTENTS`。XSession 的 `LC_ALL=C.UTF-8` 保证 xwininfo 英文字段名稳定。CI 只在 Linux runner 执行 Python 标准库契约；Windows 现有 Node CI 不代表 Windows native backend 已实现。

业务调用共享同一个 `create_operations`、`Observer`、`Actions`。selectors、端口、owned process role、WM class、私有输入路径和 page role probe 都由调用方配置。page role probe 是只读 CDP 表达式，实际值会在观察时重新核对；URL 与 role 必须唯一匹配。

## 配置和装配

```python
from qaops import ControlSpec, create_operations

operations = {
    "cdpPort": phase.ports["browserCdp"],
    "pageRoleUrls": task_config["pageRoleUrls"],
    "pageRoleProbes": task_config["pageRoleProbes"],
    "processRoles": task_config["processRoles"],
    "nativeWmClass": task_config["nativeWmClass"],
    "privateInputDir": str(task_roots["privateInput"]),
}
observer, actions = create_operations(
    Cdp=qaenv_cdp.Cdp,
    xsession=existing_xsession,
    ledger=existing_process_ledger,
    proc_stat=qaenv_ownership.proc_stat,
    config=operations,
    action_log=write_safe_action_record,
)
```

game 的只读角色 probe 可使用 `(()=>window.__dshPiggyShell?.role||null)()`，期望值为 `pet`。DSH probe 应检查不含 query 的本地 origin/path；不要把一次性 auth URL 或 query token 放进角色绑定、日志或截图。

## 两个业务入口

DSH Continue 由任务提供控件 selector 和 before/after 状态谓词：

```python
from qaops.steps import continue_preview

role = task_config["dshRole"]
page = observer.unique_page(role, operations["pageRoleUrls"][role])
result = continue_preview(
    actions, observer, page,
    ControlSpec("continue", task_config["continueSelector"]),
    ready=task_config["previewReady"],
    completed=task_config["previewClosed"],
)
```

桌面孵化点击复用同一对象；点击次数及每次的进度谓词仍由任务配置提供：

```python
from qaops.steps import hatch_clicks

role = task_config["desktopRole"]
page = observer.unique_page(role, operations["pageRoleUrls"][role])
result = hatch_clicks(
    actions, observer, page,
    ControlSpec("egg", task_config["eggSelector"]),
    click_count=task_config["hatchClickCount"],
    progress_after=task_config["hatchProgressAfter"],
)
```

`Actions.click` / `context_click` 使用真实 native button event。定位动作包含 150 ms 指针稳定、实际 pointer 读回、按当前 DPR/窗口 bounds 反算 viewport 并在当前 page 上 `elementFromPoint` 命中验证。滚动发 wheel button event；拖动发 button-down、逐步相对 native motion、button-up，并在 finally 中释放。键盘和文字输入要求配置控件保持焦点且 owned native window active。

文字内容不会进入 argv 或动作日志。`type_text` 经 mode-0600 临时文件描述符交给输入工具，完成后覆盖并 unlink；私有输入文件失败时清理失败会报错，不会报告成功。截图由 `Observer.capture_viewport` / `capture_native` 按需显式采集，结果分别标记 `viewport` 或 `native-fullscreen`；操作库不会在文字输入时自动截图。

## 离线契约

本库不启动 VM、应用、浏览器、X server 或 SSH。Linux CI 只执行 fakes 上的坐标桥、click API、drag 释放/路径及隐私清理契约：

```sh
python3 -m unittest discover -s tools/qaops/tests -p 'test_*.py' -v
```

这些测试不是 DSH 或桌面 UI 验收。两个真实 UI 入口需由各自 task-owned lease 独立验证。

从仓库根目录导入本工具时，把 `tools` 加到 Python 模块搜索路径：

```sh
PYTHONPATH=tools python3 -c 'from qaops import Actions, Observer, create_operations'
```
