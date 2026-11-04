# release/ — 发布相关文件

本目录集中放“还没公开”或“不随安装器自动安装”的发布资产。它不在 npm 包的 `files` 清单里，运行时也不会直接加载这里的文件；在线安装和游戏内更新仍只读公开的 `extensions/registry*.json`。

## candidates/

`candidates/extensions/` 是在线扩展的待发目录：

- `registry.json`：GitHub 渠道候选。
- `registry-gitee.json`：Gitee 渠道候选。

条目由 `node scripts/extension-entry.mjs <key> [--host gitee]` 生成后写入对应文件，保持与 `extensions/<key>/` 的 `manifest.json`、文件哈希和附件地址一致。候选不是公开版本：只有通过附件回读的条目才能晋级到 `extensions/registry.json` / `extensions/registry-gitee.json`。

`scripts/extension-release-check.mjs` 默认优先读取这里的候选目录；没有候选时才回退公开目录。它只读回读，不上传、不改目录。

## extension-variants/

`extension-variants/farm-classic/` 是经典菜园的手动导入变体：沿用 `farm` 这个 key，客户端保留旧画面，服务端复用当前 `extensions/farm/server.js` 的同一份字节。它不进入桌面安装器的五项可选扩展，需要用户手动导入。

构建：

```bash
node scripts/farm-classic-bundle.mjs <输出目录>
```

在游戏设置的扩展管理中导入生成的 `ext-farm-<版本>.piggyext`。变体内容同样受版本、合并钩子和最低游戏版本约束，改动时按扩展发版流程处理。

## 晋级规则：先附件回读，再晋级目录

1. 完成扩展源码修改并运行 `npm run build`，确认测试通过。
2. 升 `manifest.json` 版本，生成两个渠道的目录条目，写入 `release/candidates/extensions/`。
3. 按渠道上传 `.piggyext` 附件（`minGame < 0.36.1` 的版本还要平铺上传旧宿主需要的文件）。附件不放进本目录。
4. 运行 `node scripts/extension-release-check.mjs`（可用 `--host github|gitee|both`、`--key` 限定范围）。脚本会按候选里的 URL 实际下载并核对整包、包内身份、逐文件哈希和旧宿主文件；非零退出时停止，不能晋级。
5. 只有该渠道附件回读通过后，才把该渠道候选条目晋级到公开的 `extensions/registry.json` 或 `extensions/registry-gitee.json`，版本、哈希和文件列表保持不变。
6. 提交并推送公开目录后，用全新存档在线安装一次验证。

两个渠道独立推进：一边暂停或取消发行时，另一边可以使用较新的候选；暂停的渠道继续保留自己的候选和旧公开版本，不能因为另一渠道已发布就提前晋级。

仓库不再为旧的根目录路径保留兼容软链；脚本、测试和文档统一引用 `release/` 下的新位置。
