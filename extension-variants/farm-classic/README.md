# 菜园经典兼容版 3.1.0

保留菜园 3.0.0 的画面，接入当前菜园的数据结构与服务端。新版的菜币、地块、作物、背包、工具及帮工进度继续使用原存档，不转换回旧格式。可在 3.1.0 与 4.x 之间安装切换。

构建：`node scripts/farm-classic-bundle.mjs /tmp/piggy-extensions`。在游戏设置的扩展管理中导入生成的 `ext-farm-3.1.0.piggyext`。建议先更新游戏到 0.37.1-rc.4，再安装此兼容包。下载：[GitHub](https://github.com/CLICGGER-TYPES/dsh-piggy/releases/tag/ext-farm-3.1.0) / [Gitee](https://gitee.com/clicgger/dsh-piggy/releases/tag/ext-farm-3.1.0)。新版外观仍是扩展目录里的默认版本。

客户端以仓库 `ext-farm-3.0.0` 标签为来源，增加当前字段/操作适配并隔离 CSS 类名。服务端直接由 `scripts/farm-classic-files.mjs` 复用 `extensions/farm/server.js`，不维护第二份养成规则。`data-bridge.js` 仅适配界面快照和动作名称，不修改存档。

本目录 assets 下的图片逐字节取自 `ext-farm-3.0.0:extensions/farm/assets/`；未复制的图片由构建器复用当前菜园素材。原图制作与许可沿用该标签的 `extensions/farm/PROVENANCE.md`，本轮未重新绘制素材。

不要安装原始 3.0.0 来读取新版数据。新版游戏会在替换文件之前拒绝这种降级，提示使用 3.1.0 兼容版。安装前建议从设置导出存档备份。

源码候选正在准备3.1.2（增加合并钩子），尚未发布；以上下载链接保留已公开版本，不提前指向候选附件。
