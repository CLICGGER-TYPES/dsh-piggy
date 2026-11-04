# 多 agent 共用一只桌宠（rc.9 最小契约）

适用：DSH、OpenCode 或其他本机 agent 通过工作事件接口投递给同一只桌面猪。

## 能做什么

- 任意 agent 把真实工作作为事件 `POST` 到本机 `work-endpoint`，让猪成长。
- 桌面是唯一存档 writer；DSH 仍负责面板、照顾动作和合并。
- 多个来源按 `(source, id)` 去重，共享 7 天窗口和 20,000 条收据上限。

## 不能做什么

- 不能读存档、不能打开面板、不能执行 `/act`、不能合并。
- 不能跨设备或走公网；只监听 `127.0.0.1`。
- 不共享聊天正文、工具参数或输出；协议只有事件字段。
- 不保证每来源配额；公共窗口满时返回 `429`，各 agent 自己退避。

## 发现

优先级：

1. `PIGGY_USERDATA/work-endpoint`
2. 平台默认 userData 的 `piggy/work-endpoint`
3. `$DSH_HOME/dsh-piggy/desktop-app.json`

一个 endpoint 目录 = 一只猪。多猪时每只猪一个目录/令牌，协议不加 `pigId`。

## 429 与公平性

- 收据满了返回 `429` + `Retry-After: 60`。
- 不要立刻重试；按 `Retry-After` 退避。
- 建议每个 agent 自己限速，例如每会话每秒不超过几条真实工作。
- 去重键是 `(source, id)`；不同框架看到同一份工作算两次，除非 agent 自己关掉其中一个来源。

## 关闭

桌面设置 →「外部连接」总开关。关闭后 endpoint 停止，所有 agent 都不能投递；不需要逐个吊销。

## 当前边界

- 来源已经写进收据，runtime worker 已能按来源聚合最近 7 天（`workEventSources`）；桌面设置页的「最近投递」只读列表尚未接 UI（后续切片）。
- 同用户本机信任：能读 `pair.json` 的进程也可能拿到照顾/合并权限；第一版不解决，需要独立系统用户或后续 per-client 配对。
- Windows/Linux 为承诺平台；macOS 不承诺。
