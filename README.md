<p align="center"><img src="assets/pigs/base/piglet/idle.png" width="128" alt="dsh-piggy 的小猪"></p>

<h1 align="center">dsh-piggy</h1>

<p align="center">一只住在 <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a> 里，也能独立住在桌面上的猪。</p>

养一只会长大、上学、打工、旅行，也会跟你搭话的小猪。用鼠标就能完成全部玩法；忙的时候，它会用背包里的东西照顾自己。游戏不注册模型工具，也不向对话注入宠物状态，照顾小猪不消耗模型 token。

## 界面预览

大农场可以在 DSH 中展开，也能在桌面版里开独立窗口。种菜、浇水、除草、收菜，或者雇帮工猪替你照料。

<p align="center">
  <img src="docs/screenshots/readme-rc-farm-big.png" width="900" alt="本次 RC的真实界面：大农场、地块和底部工具栏">
</p>

<table>
  <tr>
    <td align="center"><img src="docs/screenshots/readme-rc-home.png" width="290" alt="本次 RC：小猪旁的 App 主菜单"><br>主菜单</td>
    <td align="center"><img src="docs/screenshots/readme-rc-farm-small.png" width="290" alt="本次 RC：面板中的小农场与照料工具"><br>小农场</td>
  </tr>
</table>

以上为游戏 **0.37.1-rc.1 / 菜园 4.0.9** 的实际截图（主菜单和小农场页面本次未改）；来源和拍摄条件见[截图记录](docs/screenshots/readme-rc-capture.md)。本次游戏和外壳为 RC 预发布；稳定版仍为游戏 **0.37.0 / 外壳 0.6.6**。在线菜园已更新到 **4.0.9**。

## 安装

可以只装 DSH 插件，也可以只养桌面猪。目前两种形态使用独立存档；桌面版可从 DSH 导入，具体见[桌面版指南](docs/guides/desktop.md)。可选的外部桌宠模式与合并同步仍在[讨论设计](https://github.com/CLICGGER-TYPES/dsh-piggy/issues/14)，本次 RC 尚未加入。

### DSH 插件

```sh
dsh plugin --profile web add dsh-piggy
```

安装后重启 DSH，再刷新页面。如果社区目录按 `dsh-plugin-*` 搜索，也可安装 [`dsh-plugin-piggy`](https://www.npmjs.com/package/dsh-plugin-piggy)；它加载同一个游戏，每个 profile 只需装其中一个。

使用本地源码时，克隆本仓库后运行 `dsh plugin --profile web add /path/to/dsh-piggy`。

### 桌面版

从 [GitHub 稳定版](https://github.com/CLICGGER-TYPES/dsh-piggy/releases/latest)下载对应系统的文件。国内 Windows 用户也可用 [Gitee 发行版](https://gitee.com/clicgger/dsh-piggy/releases)，其检查更新、游戏包与在线扩展走 Gitee；Linux 和 macOS 安装包只在 GitHub 提供。

| 系统 | 下载文件 |
|---|---|
| Windows | `setup.exe` 安装版或 `portable.exe` 便携版 |
| Linux | `AppImage`，添加执行权限后运行 |
| macOS | Apple 芯片选 `arm64.dmg`，Intel 选 `x64.dmg` |

macOS 包暂未签名，第一次打开请在访达中右键应用并选择“打开”。更多说明见[安装与存档](docs/guides/desktop.md)。

游戏包和桌面外壳分别更新：「设置 → 更新」可查看两个版本。Windows 安装版和 Linux AppImage 支持在 App 内下载并重启安装外壳；Windows 便携版及未签名 macOS 版需到发布页手动替换。游戏 v0.33.0 起需要 0.6.x 外壳，旧外壳会保留自带游戏并提示先升级桌面程序。详见[更新说明](docs/guides/updates.md)。

## 开始养猪

1. 第一次见到“猪递”纸盒时，连续点三下，把猪接回家。
2. 左键摸摸它，右键打开主菜单；桌面版拖动小猪可以换位置。
3. 从商店买食物、洗浴用品和玩具，用背包里的东西照顾它。离线照顾默认开启，可在设置里关闭。
4. 想种菜、挖矿、抽扭蛋或盲盒，去「设置 → 扩展」安装对应玩法。下载不了时，也可以从文件导入官方扩展包。

详细玩法和命令见[玩法指南](docs/guides/gameplay.md)。

## 可以玩些什么

| 玩法 | 内容 |
|---|---|
| 养成与生活 | 成长、学习、工作、旅行、生病与照顾；33 种职业支持短班，15 个旅行地点可带回 52 种纪念品。离开时自动吃东西、洗澡、玩玩具，回来有记录 |
| 菜园 | 29 种作物、18 块地，按真实时间生长，离线照算；浇水、除草、杀虫、施肥、多季收获，也能雇帮工猪。小农场与大农场共用同一份进度 |
| 矿洞 | 20 层矿洞、5 级镐，探索矿脉、宝箱、化石与电梯；可雇小矿工猪 |
| 盲盒与扭蛋 | 盲盒有 3★～6★ 摆件、卡池与保底，收藏进图鉴；三台扭蛋机每天首次免费，幸运值满 20 必出金色 |
| 钓鱼与番茄钟 | 40 种鱼、4 个钓点、4 把鱼竿，三种收线玩法；也能让猪自己出门钓鱼，或陪你专注一段时间 |
| 外观与收藏 | 免费内置皮肤、职业外观、自定义 PNG 皮肤包（兼容原 SVG 包），以及成就、纪念品和摆件图鉴 |
| 桌面陪伴 | 猪与面板分成两个窗口；大小按百分比调，可设网络代理和全屏时隐藏。猪会眨眼、打滚、打盹、追蝴蝶，散步默认关闭 |

金币按来源记账，扩展可以有自己的币，并按汇率兑换；删除扩展时余额自动换回金币。扩展可单独开关、删除、更新；当前菜园版本 4.0.9 需要游戏 0.37.0。在线扩展只安装本项目发布并通过校验的文件，详见[扩展安装说明](docs/design/extension-download.md)。

小猪使用一套无描边平涂透明 PNG，不同状态会换成对应立绘；支持内置彩色 emoji 字体与系统字体切换。商店、背包中的“装扮”入口暂时隐藏，已有记录保留。换肤见[玩家教程](docs/guides/skins.md)，自定义皮肤从[制作教程](docs/guides/creating-skins.md)开始。

遇到问题时，可到「设置 → 日志 → 导出日志」保存运行记录；桌面版会弹出“另存为”。日志包含版本、动作、扩展下载与报错，方便反馈时定位。

## 本次 RC：0.37.1-rc.2（预发布）

| 部分 | 版本 |
|---|---|
| 游戏与 DSH 插件 | 0.37.1-rc.2 |
| 桌面外壳 | 0.6.7-rc.2 |
| 菜园扩展 | 4.0.9，单独发布 |
| 矿洞扩展 | 3.0.1，单独发布 |

这次新增「设置 → 存档」：导出完整存档 ZIP，带到另一台设备或另一份安装里预览、自动备份后导入，DSH 和桌面可以互相搬运。也修复了 Linux 桌面版喂食、玩耍、摸头时画面上沿被原生窗口形状裁掉的问题，戴帽子的猪也能完整显示。存档导入导出、动作形状和此前的桌面体验修复都在本版里；完整改动见 [CHANGELOG](CHANGELOG.md)。

**已知限制：** Linux 部分 GNOME/rootless Xwayland 环境仍有 pixman 启动崩溃，尚未解决；隔离显示的测试通过不能代替这些环境的验收。macOS 点击远处透明空白的问题尚未实机验证。本次不宣称已修复这些问题，也不保证完全排除单帧残影。存档导入导出会替换当前猪，不合并两只猪；正式版发布前请先保留自己的备份。

RC 下载：[GitHub v0.37.1-rc.2](https://github.com/CLICGGER-TYPES/dsh-piggy/releases/tag/v0.37.1-rc.2) / [Gitee v0.37.1-rc.2](https://gitee.com/clicgger/dsh-piggy/releases/tag/v0.37.1-rc.2)。稳定版更新提示不会把 RC 当成正式版推荐。npm 暂未同步，默认 DSH 安装命令仍安装稳定版；提前测试可从本标签源码安装。

## 文档与开发

- [文档中心](docs/README.md) · [玩法与养成规则](docs/guides/gameplay.md)
- [桌面版安装与存档](docs/guides/desktop.md) · [游戏包与外壳更新](docs/guides/updates.md)
- [在线扩展](docs/design/extension-download.md) · [经济体系](docs/design/economy.md)
- [第三方 agent 接入](docs/guides/agent-adapters.md) · [开发与调试](docs/DEVELOPMENT.md)
- [维护交接](docs/HANDOFF.md) · [路线图](docs/ROADMAP.md) · [版本记录](CHANGELOG.md)

来自 PR #12/#13 的运行时提供进程内工作事件提交，以及默认关闭的本机认证接口。桌面源码或无窗口入口显式传入 `--work-events` 后开启；其他 agent 可以通过协议投递工作事件。DSH 当前仍向自己的内嵌猪提交，不会自动转发给桌宠。

```sh
npm install --no-save --package-lock=false esbuild@0.28.2 typescript@5.9.3 @types/node@20.19.43
npm run build
npm test
npm run typecheck
```

欢迎画猪、报问题或贡献代码。当前立绘只有一套无描边平涂画风，原有形象与制作要求见[小猪画风](docs/art/pig-style.md)。可以先开 Issue 交流，也欢迎 Fork 项目，养一只符合自己喜好的猪。

本 RC 的「设置 → 存档」提供 ZIP 导出、导入预览、失败恢复与替换前自动备份，DSH 和桌面可手动迁移；只做整档替换，不合并两只猪。备份范围、上限与验收要求见[存档传输说明](docs/design/save-transfer.md)。

## 贡献者

这个项目有一半是玩家帮忙做出来的，谢谢每一位交出代码、画作和想法的朋友（按首次贡献时间排序）：

| 贡献者 | 贡献 |
|---|---|
| [@1nuoiscute](https://github.com/1nuoiscute) | 猪猪王原型与恶魔猪形态、肥猪体型和胖胖猪动作立绘；十六项成就与小猪徽章系统（[#6](https://github.com/CLICGGER-TYPES/dsh-piggy/pull/6)）；扩展公共进度事件与十二项扩展成就（[#7](https://github.com/CLICGGER-TYPES/dsh-piggy/pull/7)） |
| [@anupamme](https://github.com/anupamme) | 报告桌面版更新依赖的安全问题（[#5](https://github.com/CLICGGER-TYPES/dsh-piggy/pull/5)） |
| [@tetezi](https://github.com/tetezi) | 面板动作时猪窗口置顶、右键不误摸、脏和生病状态的苍蝇/病毒图标、恢复桌面版状态变色与心情优先级调整，附回归测试（[#8](https://github.com/CLICGGER-TYPES/dsh-piggy/pull/8)，随 [#9](https://github.com/CLICGGER-TYPES/dsh-piggy/pull/9) 合入） |
| [@WolalaQAQ](https://github.com/WolalaQAQ) | 运行时与 DSH 适配器拆分、工作事件接口、持久去重和事务恢复，以及后续可靠性补丁；协助完成 Windows、DSH 和 OpenCode 独立复核（[#12](https://github.com/CLICGGER-TYPES/dsh-piggy/pull/12)、[#13](https://github.com/CLICGGER-TYPES/dsh-piggy/pull/13)） |
| [@Flappy-Boy](https://github.com/Flappy-Boy) | 反馈更新说明滚动回顶、菜园快速点击丢操作、矿洞连续挖掘站位异常，并提供复现步骤（[#16](https://github.com/CLICGGER-TYPES/dsh-piggy/issues/16)、[#17](https://github.com/CLICGGER-TYPES/dsh-piggy/issues/17)、[#18](https://github.com/CLICGGER-TYPES/dsh-piggy/issues/18)） |

想加玩法、想画猪、想报 bug 都欢迎：到 [Issues](https://github.com/CLICGGER-TYPES/dsh-piggy/issues) 说一声，或直接提 [Pull Request](https://github.com/CLICGGER-TYPES/dsh-piggy/pulls)（Gitee 用户可以在 [Gitee 仓库](https://gitee.com/clicgger/dsh-piggy) 提 Issue）。合并进来的贡献会记在这张表里。

## 致谢与许可

**不同状态的小猪图**（`assets/pigs/feedback/`）的灵感来自 [PigHub](https://pighub.top/) 上的猪猪图片：以那里的猪猪为参考，由 AI（OpenAI 图像生成，codex 操作）重新画成本项目的样子，没有直接复制原图。谢谢 PigHub 和图片作者！如果你是原图作者，觉得侵犯了你的权利或不喜欢这样使用，请[开 issue](https://github.com/CLICGGER-TYPES/dsh-piggy/issues) 告诉我们，我们会删除相关图片。

视觉风格参考 [animal-island-ui](https://github.com/guokaigdg/animal-island-ui)，玩法数值参考资料见 [THIRD-PARTY.md](THIRD-PARTY.md)。项目采用 [MIT License](LICENSE)；小猪立绘改自 [Noto Emoji](https://github.com/googlefonts/noto-emoji) 的 🐖，按 Apache 2.0 发布（见 [THIRD-PARTY.md](THIRD-PARTY.md)）。
