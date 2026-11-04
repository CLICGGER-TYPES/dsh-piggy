<p align="center"><img src="assets/pigs/base/piglet/idle.png" width="112" alt="dsh-piggy 的小猪"></p>

<h1 align="center">dsh-piggy</h1>

<p align="center">一只住在 <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a> 里，也能独立住在桌面上的猪。</p>

<p align="center">
  <a href="https://github.com/CLICGGER-TYPES/dsh-piggy/releases"><img src="https://img.shields.io/github/v/release/CLICGGER-TYPES/dsh-piggy?include_prereleases&label=release" alt="release"></a>
  <a href="https://www.npmjs.com/package/dsh-piggy"><img src="https://img.shields.io/npm/v/dsh-piggy?label=npm" alt="npm"></a>
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-2f6f4e" alt="platform">
  <a href="LICENSE"><img src="https://img.shields.io/github/license/CLICGGER-TYPES/dsh-piggy" alt="license"></a>
</p>

<p align="center"><img src="docs/screenshots/readme-panel-home.png" width="380" alt="小猪与主菜单"></p>

养一只会长大、上学、打工、旅行，也会跟你搭话的小猪。QQ 宠物式的单机养成，动森 NookPhone 风格的界面；同一份代码提供两种形态：住在 DeepSeek Harness 网页里的 DSH 插件，和独立的桌面版。

鼠标就能完成全部玩法。忙的时候，它会用背包里的东西照顾自己。游戏不注册模型工具，也不向对话注入宠物状态，照顾小猪不消耗模型 token。

## 亮点

- **养成**：最高 60 级，33 种职业，15 个旅行地点，12 种性格，1008 句台词。
- **菜园**：29 种作物、18 块地，按真实时间生长；浇水、除草、杀虫、施肥、多季收获，可雇帮工并安排巡逻。
- **小游戏**：20 层矿洞、盲盒与扭蛋、40 种鱼的钓鱼、番茄钟。
- **桌面多猪**：最多 4 个宠物窗口，共享同一 owner 的金币、背包和菜园。
- **本地优先**：存档在你自己机器上；云同步和局域网联机都默认关闭，需要时显式开启。
- **可扩展**：皮肤包、动作/音效素材包、在线扩展，都有格式校验和回退。

## 两种形态

| | DSH 插件 | 桌面版 |
|---|---|---|
| 运行位置 | DeepSeek Harness 页面内 | 独立 Electron 应用 |
| 安装 | `dsh plugin add` | 下载安装包或便携版 |
| 小猪 | 单猪 | 单猪，最多 4 个窗口 |
| 存档 | DSH 自己的存档 | 本地 userData，可导入 DSH 存档 |
| 适合 | 边工作边养 | 常驻桌面、多猪、托盘 |

两边的猪默认各自独立；需要合并时走导出/预览/备份后的完整档迁移，不会静默覆盖。

## 快速开始

### DSH 插件

```sh
dsh plugin --profile web add dsh-piggy
```

安装后重启 DSH 并刷新页面。也可以安装别名包 [`dsh-plugin-piggy`](https://www.npmjs.com/package/dsh-plugin-piggy)，同一个 profile 只需装其中一个。

> 不带版本号安装 npm `latest`。想用预览版请显式指定版本，例如 `dsh-piggy@0.37.2-rc.11`；npm 标签和 GitHub Release 可能不同步，以发布页为准。

### 桌面版

从 [Releases](https://github.com/CLICGGER-TYPES/dsh-piggy/releases) 下载：

| 系统 | 文件 |
|---|---|
| Windows | `setup.exe` 安装版，或 `portable.exe` 便携版 |
| Linux | `AppImage`，添加执行权限后运行 |
| macOS | Apple 芯片选 `arm64.dmg`，Intel 选 `x64.dmg` |

macOS 包暂未签名，第一次打开请在访达中右键应用并选择“打开”。国内 Windows 用户可使用[夸克网盘](https://pan.quark.cn/s/2c571e9aaecc)。

## 玩法

1. 第一次见到“猪递”纸盒时，连续点三下，把猪接回家。
2. 左键摸摸它，右键打开主菜单；桌面版拖动小猪可以换位置。
3. 从商店买食物、洗浴用品和玩具，用背包里的东西照顾它。离线照顾默认开启。
4. 想种菜、挖矿、抽扭蛋或盲盒，去「设置 → 扩展」安装对应玩法。

完整规则见[玩法指南](docs/guides/gameplay.md)。

## 文档

| 文档 | 内容 |
|---|---|
| [桌面版安装与存档](docs/guides/desktop.md) | 安装、数据目录、迁移 |
| [玩法指南](docs/guides/gameplay.md) | 养成、菜园、矿洞、钓鱼、番茄钟 |
| [外部桌宠](docs/guides/external-pet.md) | DSH 与桌面猪的连接和合并 |
| [多 agent 共用一只桌宠](docs/guides/multi-agent-pet.md) | 工作事件投递、发现、429 退避 |
| [皮肤制作](docs/guides/creating-skins.md) | 自定义 PNG/SVG 皮肤 |
| [新增动作](docs/guides/adding-actions.md) / [新增音效](docs/guides/adding-sounds.md) | 素材包格式与校验 |
| [发布渠道与历史版本](docs/guides/releases.md) | 稳定版、RC、npm、夸克、Gitee |

## 开发

```sh
npm install
npm run build
npm test
npm run typecheck
```

要求 Node 22+。构建会生成 `client.js`、菜园扩展和素材版本，这些产物不提交。

## 版本与发布

- 稳定版：游戏 0.37.1 / 桌面外壳 0.6.7。
- 预览版：游戏 0.37.2-rc.11 / 桌面外壳 0.6.8-rc.9。
- npm `latest` 目前仍是 0.37.0；`rc` 标签由维护者手动发布。
- Gitee 不再发布新版本；历史附件只作回退。

发布页、校验文件和国内渠道见[发布渠道说明](docs/guides/releases.md)，逐版本变更见 [CHANGELOG](CHANGELOG.md)。

## 反馈

遇到问题时，到「设置 → 日志 → 导出日志」保存运行记录，附上游戏/外壳/扩展版本、系统和缩放、操作步骤，提交到 [GitHub Issues](https://github.com/CLICGGER-TYPES/dsh-piggy/issues)。

## 许可

MIT。第三方素材与字体许可见 [THIRD-PARTY.md](THIRD-PARTY.md)。
