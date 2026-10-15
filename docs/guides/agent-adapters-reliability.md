# PR #12 可靠性故障复现

2026-10-14，按 WolalaQAQ 的 Windows 复核补 Linux 故障复现；生产修复见文末 2026-10-15 一节，按 B/C 折入并保留其署名。

B 手动运行：

```sh
npm test -- test/repros/pr12-b-reliability.test.js
```

补丁前结果为 **0/5 通过、5 条失败**，对应：

- 真实挂载路由在读取请求体期间关闭，释放请求体后旧 Store 的 1500ms 节流保存覆盖新写者存档。
- 真实 WAL rename 后注入一次目录 fsync 故障，取消注入后 `finish()` 未恢复已发布事务。
- 在 Linux 模拟 Windows rename 对空目标目录报 EPERM，锁获取失败；这不是 Windows 实机验证。
- 真实 Worker 以 23 退出后执行主进程生产 `before-quit` 回调，连续两次退出都被阻止。
- 执行主进程生产安装 IPC 回调，保存 Promise 尚未完成就调用安装器；测试不启动真实安装器。

C 手动运行：

```sh
npm test -- test/repros/pr12-c-reliability.test.js
```

补丁前结果为 **0/1 通过、1 条失败**：真实 HTTP 接口已关闭，发现文件删除注入一次 EACCES；恢复文件系统后第二次 `close()` 仍返回第一次失败的 Promise，发现文件及接口锁未被清理。

原 `.mjs` 文件只在显式执行时运行；2026-10-15 已改为 `.test.js`，六条全部纳入 `npm test`。没有 skip、todo 或反向断言来掩盖失败。

每次测试恢复注入的文件系统接口，关闭运行时/Worker，清理临时游戏目录和存档。真实断电、Windows fsync、在途插件卸载和真实安装升级尚未验证。

## 2026-10-15 补丁验证

WolalaQAQ 的补丁基于 `29d84e4`，拆成 `96fcfd8`（B：同步关闭与工作事务恢复边界）和 `9ef3638`（C：发现文件清理失败后允许重试关闭）。

在 Windows 上运行：

```sh
npm test -- test/repros/pr12-b-reliability.test.js test/repros/pr12-c-reliability.test.js
```

6 条通过 5 条：C 1/1，B 4/5。剩下的「WAL rename 成功后目录 fsync 失败」只能在 Linux 上运行：`syncDirectory()` 在 `process.platform === 'win32'` 时直接返回，注入的 fsync 不会执行，`assert.throws` 必然失败。补丁把 `pending` 的登记放在 rename 之后、目录同步之前，同时补了状态 rename 后的目录同步，正是这条复现要求的顺序。

「外壳安装器启动前必须等待后台保存完成」按生产 `main.js` 的切片执行。补丁把关闭逻辑放进安装 IPC 回调本身，复用 `hostClosing`/`hostClosed`，并从 600ms 定时器里返回等待存档的 Promise，因此复现能观察到 `saving → saved → install`。安装器只在存档写入结束后启动，后台 Worker 已死亡时不阻塞安装；WAL 保留原先的未确认事务。

## 2026-10-15 审查后补充

维护者在 Linux 核对 PR #13：原六条复现基线 0/6、补丁 6/6。另发现安装回调绕过 `prepareToQuit()`，保存失败后缓存拒绝的 `hostClosing`、保留 `quitting=true`，后续退出均被拦截。

安装改用统一关闭函数；失败后只记日志并取消安装，恢复请求和命中轮询，不自动退出。`test/shell-install-retry.test.js` 用真实 Worker、真实存档和被目录占用的临时文件制造写入失败，分别检查恢复后重试安装、正常退出；两条修前都失败，修后通过。连同六条旧复现，Linux 共 8/8 通过，全部纳入常规测试。

目录 fsync 故障注入保留 Linux 路径；Windows 分支验证不尝试目录 fsync，且提交及去重正常，不把未执行的注入计作通过。两平台的检查名称分别说明范围。

原六项 Windows 基线测试的 LF/路径问题已单独修正；继承代理时的回环直连也补独立进程回归。最终 Linux/Win11 常规测试均为 902/902，0 失败、0 跳过；构建与类型检查通过，细节见[验证记录](agent-adapters-validation.md)。请用上述 npm 入口运行局部回归，避免宿主的环境代理接走本机请求。
