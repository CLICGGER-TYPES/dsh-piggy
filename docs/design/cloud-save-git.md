# 云存档：用 git 同步整档（设计稿）

> 2026-10-30 · 用户已定的范围：**单独一个私有数据仓库**（不进源码库）、**退出时提交 + 运行中 10 分钟防抖**、不引入第三方网盘 API，只走 git；仍然坚持「同一时间只一台在线」。

## 1. 为什么要做

现在跨机器只能手动「设置 → 存档」导出 ZIP，再到另一台导入：容易忘、没有历史、出问题只能回滚到"上一次记得导出"的时候。

git 免费提供三件我们正缺的东西：版本历史、远端存储、冲突可见。存档本身只有 ~10 KB（含 `extensions/`、`skins/` 一般也就几 MB），完全放得下。

## 2. 范围

**做**

- 存档自动提交到一个**私有** data repo，并在退出时推送
- 启动、读档之前先拉取远端，比本地新才替换
- 冲突时保留双方，绝不产生"半个存档"
- 复用现有打包/校验/替换能力，不重新实现

**不做**

- 多端实时并发编辑（仍要求同一时间只一台在线）
- 替代手动 ZIP 导入导出（两者共用同一套打包）
- 加密（v1 不做，见 §8 开放问题）
- 除 git 之外的任何存储后端

## 3. 复用什么

| 现有模块 | 用途 |
|---|---|
| `runtime/save-zip.js` | 打包/解包整档（`save.zip`，与手动导出一致） |
| `runtime/save-transfer.js` | 导入预览、替换前备份、失败恢复 |
| `runtime/save-transaction.js` | 原子替换与回滚 |
| `runtime/owner-lock.js` | 单写者锁 |
| `runtime/merge-service.js` | 真要合并两只猪时的预览/撤销 |

新增的只有 **transport**：把 `save.zip` 放进工作树、`git add/commit/push`；拉取端 `git pull` 后走既有导入流程。

## 4. 数据仓库

```
dsh-piggy-data/
├── save.zip        # 整档，和「设置 → 存档」导出的同一份
├── meta.json       # { schemaVersion, stateVersion, lastSeenAt, device, exportedAt }
└── README.md
```

`meta.json` 让拉取端在解包前就能判断新旧，不必先解开 ZIP 再决定要不要。

提交信息固定成一行，方便 `git log` 扫：

```
save: 2026-10-30T09:55+08:00 Lv.5 18867c
```

## 5. 时序

### 启动（必须在读档之前）

1. `git -C <data> pull --ff-only`
2. 读 `meta.json`：`lastSeenAt` 不新于本地 → 直接进游戏
3. 新于本地 → 解包到临时目录 → 走 `save-transfer` 的导入校验
4. 校验通过：备份本地 → 原子替换；失败：保留现场、提示、**不替换**

这一步要插在 `runtime/index.js` 的 `open()` **之前**，而 `open()` 现在是同步的。两个选择：
把 `open()` 改成先 `await` 一次 git 拉取（影响启动路径），或在插件 `apply()` 里先 await 拉取再
`ensureRuntime()`（不影响 runtime 内部）。**倾向后者**：适配器已经有一个 `controller.init()`
的异步阶段，把拉取放那里，失败就降级为"只用本地档"。

### 运行中

- 监听存档写入（现有 `store.flush()` 之后），**10 分钟防抖**：距上次提交不足 10 分钟就不提交
- 只在真的写了盘之后才考虑（`dirty` 标志），避免空提交

### 退出

- 优雅退出（`ctx.effect` 的 dispose、`controller.close()`）时强制提交 + 推送一次
- 进程被强杀：下次启动时比对 `meta.exportedAt` 与本地 `lastSeenAt`，不一致就补推

## 6. 冲突

- 默认**新盖旧**：`lastSeenAt` 大者胜；被覆盖的一方先备份到 `<data>/.conflicts/<时间戳>/`
- `pull --ff-only` 失败（远端有新提交）→ 先 `fetch` 比较 `meta.json`，再决定覆盖或提示
- 真要合并 → 交给 `merge-service`（已有预览/撤销），transport 层不自己写合并规则

## 7. 凭证与隐私

- 复用宿主已有的 git 凭证（Windows 上是 GCM，Linux/macOS 是 keychain 或 SSH key），**插件不存密钥**
- 首次推送会弹一次登录窗；无人值守场景写文档让用户配 SSH key
- 失败只提示「凭证不可用」，日志里绝不打印 token
- 设置页必须显著提示：**必须是私有仓库**（存档含名字、主人称呼、回忆、日记）

## 8. 设置项

| 键 | 默认 | 说明 |
|---|---|---|
| `enabled` | false | 关闭时完全不碰 git |
| `remote` | — | 如 `git@github.com:me/dsh-piggy-data.git` |
| `branch` | `main` | |
| `debounceMs` | 600000 | 10 分钟 |
| `pushOnExit` | true | |
| `pullOnStart` | true | |
| `device` | 主机名 | 写进 `meta.json`，方便看出"上次是哪台同步的" |

## 9. 测试

- 单测：`meta.json` 新旧判定、防抖计时、`pull` 失败回退、导入校验失败时本地不动
- 集成：临时目录建两个 bare 仓库，模拟 A 推 → B 拉；再模拟"B 有新提交时 A 也推"的冲突
- 手测：两个 `DSH_HOME` 跑一遍导出 → 推送 → 拉取 → 导入

## 10. 风险与开放问题

1. **启动时序**：拉取放在插件 `apply()` 的异步阶段是目前最省侵入的做法；如果将来要严格保证
   "读到的一定是远端最新"，得把 `open()` 改成异步。
2. **仓库误建为公开**：只在设置页提示不够，考虑首次启用时检测 `remote` 的可访问性并警告。
3. **加密**：存档里有个人信息，v1 依赖"私有仓库 + 平台权限"；加密（age/openssl）放 v2。
4. **多设备记录**：`meta.device` 要不要在设置页显示"上次同步来自哪台"？
