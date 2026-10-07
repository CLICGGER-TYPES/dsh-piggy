# AGENTS.md — 给接手开发的人和 agent

先读这一页，再按需要读下面链接的文档。这里只放「不知道就会做错」的东西。

## 这是什么

**dsh-piggy**：一只养在桌面上的小猪（复刻 QQ 宠物的玩法，界面是动森 NookPhone 风格）。同一份代码两种形态：

- **DSH 插件**（网页面板）：根目录 `index.js` / `routes.js` / `store/` 是宿主，`src/client/` 打包成 `client.js`。
- **桌面版**（Electron）：`apps/desktop/` 是外壳，内置一份游戏包；游戏包可单独热更新，外壳要下载安装包更新。

| 目录 | 内容 |
|---|---|
| `packages/pet-core/src/` | 养成规则（`data/` 数值表、`core/` 纯函数），两种形态共用 |
| `store/`、`index.js`、`routes.js`、`snapshot.js` | 存档、HTTP 路由、给面板的快照 |
| `src/client/` | 面板界面（构建成 `client.js`，**改了源码要 `npm run build` 并提交 `client.js`**） |
| `apps/desktop/` | 桌面外壳（主进程、preload、打包配置） |
| `extensions/<key>/` | 在线扩展（菜园、矿洞、扭蛋、盲盒），玩家下载安装 |
| `docs/` | 文档；`docs/tasks/numbers/` 是用户确认过的数值单 |

## 红线（必须先问用户）

1. **数值、台词、玩法、成就名单、界面布局**都由用户拍板。先出稿（数值单 / 审稿单 / 截图），用户确认后再写代码。
   「规则改了」不等于可以顺手改界面。
2. **大功能先出完整设计**给用户确认再整体做；修 bug 的版本只修 bug，不夹带新功能、不「预留」半成品。
3. **提交信息不署 AI 名字**（不加 Co-Authored-By 等）。格式见 [CONVENTIONS.md](docs/CONVENTIONS.md)「Git」。
4. **发版**：用户验收通过后才发；发版前 CHANGELOG 写好该版小节、README 同步（文字和截图）；GitHub、Gitee 两个渠道都要齐。
   **npm 由维护者手动发**，不要替他发。步骤见 [HANDOFF.md](docs/HANDOFF.md) 第 9 节。
5. **不提交凭据**：令牌（如 `GITEE_TOKEN`）只放 GitHub Secrets；测试机账号密码不进仓库。
6. 改存档结构必须加迁移（`core/upgrades.js` + `STATE_VERSION` + 迁移测试），旧存档不能丢数据。

## 做事的方法

- **先复现再修**：先写能复现的失败测试（或录屏复现），再改代码。
- **按真相重算，不在上一轮结果上累加**：位置、尺寸、计数都从源头重新算。本项目最常见的 bug 就是累加误差（越用越偏）。
- **验收看真实效果**：界面改动在真实浏览器里看；桌面窗口/拖动改动要**真鼠标拖 + 录屏逐帧**（不能只比起止坐标）；
  Windows 分数缩放（125%/150%）的问题只有在那种缩放下才测得出来。
- 说「修好了」之前自己先验证过；没验证的就说没验证。

## 常用命令

```sh
npm install --no-save --package-lock=false esbuild@0.28.2 typescript@5.9.3 @types/node@20.19.43   # 首次
npm run build        # src/client → client.js
npm test             # 全部测试（含规范检查、台词/成就/扩展目录守卫）
npm run typecheck
cd apps/desktop && npm install && npm start           # 跑桌面版
```

## 文档地图

| 想做什么 | 读这个 |
|---|---|
| 了解现状、发版流程、已知问题、测试机 | [docs/HANDOFF.md](docs/HANDOFF.md) |
| 编码规范、提交格式 | [docs/CONVENTIONS.md](docs/CONVENTIONS.md) |
| 写/改在线扩展 | [docs/guides/writing-extensions.md](docs/guides/writing-extensions.md) |
| 给猪加台词 | [docs/guides/adding-lines.md](docs/guides/adding-lines.md) |
| 加成就和徽章 | [docs/guides/adding-achievements.md](docs/guides/adding-achievements.md) |
| 改面板、按钮、扩展页面的样子 | [docs/guides/ui-style.md](docs/guides/ui-style.md) |
| 改桌面窗口、拖动、IPC | [docs/guides/desktop-architecture.md](docs/guides/desktop-architecture.md) |
| 玩法和数值的来源、视觉规范的来源 | [docs/DESIGN.md](docs/DESIGN.md) |
| 立绘、皮肤 | [docs/ART-SPEC.md](docs/ART-SPEC.md)、[docs/guides/skin-pack-format.md](docs/guides/skin-pack-format.md) |
| 开发环境、打包、Gitee 渠道 | [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) |
