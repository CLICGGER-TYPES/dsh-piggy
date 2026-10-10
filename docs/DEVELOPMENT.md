# 开发指南

## 环境与校验

需要 Node.js 20 或更高版本。仓库不把构建工具列为运行时依赖，首次开发先安装已验证的本地工具版本：

```sh
npm install --no-save --package-lock=false esbuild@0.28.2 typescript@5.9.3 @types/node@20.19.43
npm run build
npm test
npm run typecheck
```

`--no-save --package-lock=false` 不修改依赖清单。`npm run build` 把 `src/client/` 生成到根目录 `client.js`；修改客户端源码后必须重新生成并提交该文件。

## 调试模式

在主菜单底部版本号上 3 秒内连续点击 7 次，会出现“调试”App。它可以调整数值、体型和形态，给予物品与每一种鱼，并快进时间。调试状态只保存在内存中，刷新或重启后关闭；页面顶部也有关闭按钮。

## DSH 配置

```yaml
- id: dsh-piggy
  name: dsh-piggy
  config:
    command: pig
    statePath: /abs/path/to/state.json
```

插件提供 `GET /dsh-piggy/state` 和 `POST /dsh-piggy/act`。操作表位于 `routes.js`，请求体上限 2 KB。路由只绑定本机地址。

## 桌面版

```sh
cd apps/desktop
npm install
npm start
npm run dist:linux
npm run dist:win
npm run dist:mac
```

`npm start` 会先把根项目打进 `apps/desktop/game/`。各平台安装包输出到 `apps/desktop/dist/`。macOS 包需在 macOS 构建；正式发布由 GitHub Actions 完成。

### 桌面程序和游戏包怎么分工（外壳 0.3.0 起）

原则：**能放进游戏包的都放进游戏包**，桌面程序（外壳）尽量不动。玩家更新游戏包只要在「更新」里点一下；更新桌面程序要下载安装包，能少则少。

| 放在哪 | 内容 |
|---|---|
| 游戏包（`src/client/desktop/`，打进 `client.js`） | 量猪和面板占多大、把内容钉在窗口锚边、收起时给气泡和面板留位置、窗口摆哪（开关面板不挪、换大小保持脚底、启动复位）、哪里可点 / Windows 鼠标穿透判断、桌面专用样式、去掉原生提示框 |
| 桌面程序（`apps/desktop/`） | 透明置顶窗口、`piggy://` 文件服务、托盘、开机启动、导入存档、游戏包和外壳的下载与切换、内置 emoji 字体文件；以及几个基础动作：`place`（设窗口位置大小 + 可点区域，2px 容差）、`setHit`（穿透开关）、`beginDrag/dragHeartbeat/endDrag`（拖动跟鼠标、只夹猪）、几何推送（窗口、所在屏和所有屏的工作区） |

- 加载顺序：`renderer/index.html` → `loader.js` 载入 `client.js`；游戏包导出了 `desktop` 模块就调用它，否则退回冻结的 `renderer/shell.js`（给回退到老游戏包的人用）。
- **改窗口行为先改游戏包**。只有需要新的基础动作时才动桌面程序，并给 `desktop.version` 加一、游戏包里做好兼容判断。
- 内置 emoji 字体（10MB）留在桌面程序里，避免每次热更新都多下 10MB；用它的样式规则在游戏包里。

## 扩展

番茄钟、钓鱼这类可整体开关的玩法是**扩展**。注册表在 `packages/pet-core/src/data/extensions.js`，每条声明自己占的 App、路由动作、图鉴分区和商品种类；开关在存档 `state.extensions` 里，核心用 `extensionOn(state, key)` 判断。路由层统一拦截关闭扩展的动作，快照里撤下相关商品，客户端（`src/client/extensions.js`）隐藏 App、图鉴分区和角标。这是**内置扩展**（代码在游戏里）。菜园、矿洞这类**在线扩展**（玩家下载安装，代码在 `extensions/<key>/`）怎么写、怎么发，见 [guides/writing-extensions.md](guides/writing-extensions.md)。

## 发布

游戏版本来自根 `package.json`，桌面外壳版本来自 `apps/desktop/package.json`。npm 目前由维护者在本机手动发布，不由标签工作流执行：

1. 修改根包和别名包的版本号，把 `packages/dsh-plugin-piggy/package.json` 的 `dependencies.dsh-piggy` 同步到同一版本；在 CHANGELOG 写该版本小节，运行 `npm run build && npm test && npm run typecheck` 并提交。
2. 打对应的 `v*` 标签并推送，等 `.github/workflows/release.yml` 的游戏包和三个桌面构建 job 完成，确认 GitHub Release 的安装包与游戏包齐全。
3. 在发布提交的根目录执行 `npm publish --access public`，按 npm 提示完成本机身份验证；不要把凭据写进仓库。
4. 执行 `npm view dsh-piggy version`，确认公开版本与标签相同。
5. 进入 `packages/dsh-plugin-piggy/`，执行 `npm publish --access public` 发布别名包，再用 `npm view dsh-plugin-piggy version` 核对。

### Gitee 渠道

Gitee（[clicgger/dsh-piggy](https://gitee.com/clicgger/dsh-piggy)）是独立的一套发行：Gitee 发出去的游戏包和桌面外壳里，检查更新、下载游戏包、在线扩展都只走 gitee.com，不依赖 GitHub。

- **渠道**：地址集中在 `channels/github.js`、`channels/gitee.js`；`node scripts/set-channel.mjs <github|gitee>` 把选中的复制成 `channel.js`（游戏）和 `apps/desktop/lib/channel.js`（外壳）。仓库里提交的永远是 github，`test/channel.test.js` 守着。
- **发版**：推 `v*` 标签时 `.github/workflows/release-gitee.yml` 只负责构建：先用默认渠道跑测试，再切到 gitee 渠道打游戏包和 Windows 安装包（Gitee 只发 Windows，Linux / macOS 只在 GitHub），用 `scripts/scan-channel.mjs` 扫掉 GitHub 地址，存成 artifact。**往 Gitee 推一律在维护者本机做**：`GITEE_TOKEN=<令牌> bash scripts/gitee-publish.sh vX.Y.Z`（推代码和标签、建发行版、上传、核对、删旧安装包）。
- **大小限制**：Gitee 发行版附件单个 ≤100MB、单仓库总量 ≤1GB。Gitee 安装包用 `apps/desktop/electron-builder.gitee.cjs`（最大压缩、只留中英文语言包）和 `tools/slim-emoji-font.py`（只留游戏里用到的 emoji + 常用表情，约 1MB）；GitHub 安装包不受影响，仍带整套 emoji。超过 100MB 的文件 CI 不上传并给出警告。
- **在线扩展**：每个扩展在 GitHub、Gitee 各发一个 `ext-<key>-<版本>` 发行版；`node scripts/extension-entry.mjs <key> --host gitee` 生成 `extensions/registry-gitee.json` 的条目（校验值和 GitHub 那份相同）。Gitee 上传：`GITEE_TOKEN=… node scripts/gitee-release.mjs ensure ext-<key>-<版本>`，再 `upload <id> extensions/<key>/{manifest.json,server.js,client.js}`。

社区目录使用的 `dsh-plugin-piggy` 是 `packages/dsh-plugin-piggy/` 里的独立 npm 包。它作为 DSH bundle 加载原始 `dsh-piggy` 依赖，不复制游戏代码；发布后在隔离 profile 验证别名能解析到原插件，每个 profile 只安装其中一个包。

## 主要目录

```text
src/client/                 浏览器界面源码
packages/pet-core/src/      跨 DSH/桌面共用的养成规则
apps/desktop/               Electron 外壳
assets/                     内置立绘
test/                       插件与客户端测试
docs/                       玩家、制作者和开发文档
```

编码约定见 [CONVENTIONS.md](CONVENTIONS.md)，美术规格见 [ART-SPEC.md](ART-SPEC.md)。
