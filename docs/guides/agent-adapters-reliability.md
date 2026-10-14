# PR #12 可靠性故障复现

2026-10-14，按 WolalaQAQ 的 Windows 复核补 Linux 故障复现；生产修复等待作者推送分支，保留其署名后按 B/C 折入。本次不另写修复。

B 手动运行：

```sh
node --test test/repros/pr12-b-reliability.mjs
```

当前结果为 **0/5 通过、5 条失败**，对应：

- 真实挂载路由在读取请求体期间关闭，释放请求体后旧 Store 的 1500ms 节流保存覆盖新写者存档。
- 真实 WAL rename 后注入一次目录 fsync 故障，取消注入后 `finish()` 未恢复已发布事务。
- 在 Linux 模拟 Windows rename 对空目标目录报 EPERM，锁获取失败；这不是 Windows 实机验证。
- 真实 Worker 以 23 退出后执行主进程生产 `before-quit` 回调，连续两次退出都被阻止。
- 执行主进程生产安装 IPC 回调，保存 Promise 尚未完成就调用安装器；测试不启动真实安装器。

C 手动运行：

```sh
node --test test/repros/pr12-c-reliability.mjs
```

当前结果为 **0/1 通过、1 条失败**：真实 HTTP 接口已关闭，发现文件删除注入一次 EACCES；恢复文件系统后第二次 `close()` 仍返回第一次失败的 Promise，发现文件及接口锁未被清理。

这些 `.mjs` 复现文件由上述命令显式执行，不属于 `npm test` 的 `*.test.js` 常规回归集合；没有 skip、todo 或反向断言来掩盖失败。补丁折入后应将通过的复现迁入常规回归并跑全量检查。常规回归通过不代表上述可靠性缺陷已解决。

每次测试恢复注入的文件系统接口，关闭运行时/Worker，清理临时游戏目录和存档。真实断电、Windows fsync、在途插件卸载和真实安装升级尚未验证。
