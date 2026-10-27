<p align="center"><img src="assets/pigs/base/piglet/idle.png" width="128" alt="dsh-piggy 的小猪"></p>

<h1 align="center">dsh-piggy</h1>

<p align="center">一只住在 <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a> 里，也能独立住在桌面上的猪。</p>

养一只会长大、上学、打工、旅行，也会跟你搭话的小猪。玩法是 QQ 宠物式的单机养成，界面是动森 NookPhone 风格；同一份代码有两种形态：住在 DeepSeek Harness 网页里的 DSH 插件，和独立的桌面版。鼠标就能完成全部玩法；忙的时候，它会用背包里的东西照顾自己。游戏不注册模型工具，也不向对话注入宠物状态，照顾小猪不消耗模型 token。

## 快速安装与稳定版下载

> **当前稳定版：游戏与 DSH 插件 0.37.1，桌面外壳 0.6.7。** 下面的安装、下载和玩法都指这个正式版；预览版单独提供，以下稳定版下载不包含 RC。

| 部分 | 稳定版 |
|---|---|
| 游戏与 DSH 插件（GitHub 稳定版） | 0.37.1 |
| npm `latest` | 0.37.0 |
| 桌面外壳 | 0.6.7 |
| 菜园扩展 | 4.0.10；经典兼容版 3.1.0，均单独发布 |
| 矿洞扩展 | 3.0.1，单独发布 |

稳定版下载：

- [GitHub 稳定版 0.37.1](https://github.com/CLICGGER-TYPES/dsh-piggy/releases/tag/v0.37.1)
- [夸克网盘：Windows 国内渠道](https://pan.quark.cn/s/2c571e9aaecc)

夸克网盘只提供 Windows 安装包的手动下载，不替代客户端现有的游戏包/外壳自动更新渠道。npm由维护者确认后通过GitHub Actions可信发布，主包与别名包同步；RC只更新`rc`标签，保持稳定入口。npm `latest`目前仍是0.37.0，与GitHub稳定游戏0.37.1分别标示。

> 本轮预览版：游戏0.37.2-rc.5 / 外壳0.6.8-rc.3。包含指定猪脸图标、五项离线可选扩展、默认piggy数据目录及可选DSH桌宠联动。测试版需手动查看，不主动提示更新。

预览版下载：[夸克 Windows 完整版](https://pan.quark.cn/s/6b55bc9dc8c9) · [GitHub](https://github.com/CLICGGER-TYPES/dsh-piggy/releases/tag/v0.37.2-rc.5) · [Gitee Windows 瘦包](https://gitee.com/clicgger/dsh-piggy/releases/tag/v0.37.2-rc.5)。

夸克目录含安装器、便携版、六个扩展包（含经典菜园备选）、说明和校验清单，共10文件。GitHub和夸克完整版内含游戏；完整Windows安装器另附五项默认不选的离线扩展。Gitee受100MiB限制，首次启动需联网下载游戏。

本轮另外修复菜园托管地串行生长与旧扩展下载缺件：菜园4.2.0／经典3.2.0按自然时长并行生长，帮工负责照料、收获及现有同种种子补种。原有进度保留。

已有菜园的玩家：更新游戏后，到「设置 → 扩展」点击「刷新」，再更新菜园到4.2.0。安装器只补缺失项，不会覆盖已有扩展版本。

<details>
<summary>当前 Windows 安装效果（RC5 公开包实拍）</summary>

完整安装器随包提供五项离线扩展，默认不选，保留已有版本与进度。图标采用用户指定猪脸，安装器、应用、卸载程序、桌面/开始菜单快捷方式及托盘已在 Windows 云端虚拟机核对。

<img src="docs/screenshots/readme-rc5-windows-installer.png" width="500" alt="RC5公开包原生安装器：指定猪脸与五项默认未选的离线扩展">

桌面实际显示：<img src="docs/screenshots/readme-rc5-windows-desktop.png" width="78" alt="Windows桌面实际猪脸快捷方式">

[开始菜单实拍](docs/screenshots/readme-rc5-windows-start.png) · [拍摄条件与校验记录](docs/screenshots/readme-current-capture.md#2026-10-27-rc5-公开包验收)

</details>

[历史RC3夸克Windows完整版](https://pan.quark.cn/s/62eefaa3c173)继续保留；它是游戏0.37.2-rc.3 / 外壳0.6.8-rc.2，不是本轮RC5。

Gitee 受附件容量限制，仅保留最新版本的 Windows 安装器，旧游戏包仍供回退；需要正式版安装器请使用上方 GitHub 或夸克入口。此前 RC2 的 Windows 安装器、更新清单和游戏包已归档；RC3、RC4国内原始包另有独立归档。

[国内旧版主归档（夸克）](https://pan.quark.cn/s/a4484e98dec8)保留此前14个版本，其中6个版本有完整Windows双包、8个更早版本只剩游戏包。[RC3国内原始包归档](https://pan.quark.cn/s/80a3aa07111e)另存游戏0.37.2-rc.3 / 外壳0.6.8-rc.2的原Gitee安装版、便携版、游戏包、更新清单和校验文件。[RC4国内原始包归档](https://pan.quark.cn/s/a1712a93536c)保留其原Gitee瘦包与校验文件。历史安装器首次启动依赖的游戏包继续保留在Gitee。

### DSH 插件

```sh
dsh plugin --profile web add dsh-piggy
```

不带版本号会安装npm `latest`（目前0.37.0）；本轮预览版已同步npm，用下面的精确版本安装：

```sh
dsh plugin --profile web add dsh-piggy@0.37.2-rc.5
```

发布页上的标签和 npm 上的包不是同一份清单，npm 由维护者按版本发布，两者可能相差一段时间。DSH 插件也不会自动跟 npm `latest` 升级，没有后台更新：装哪一版、什么时候换，都由你在自己的 DSH 里执行命令决定（游戏里的更新页只给命令和发布页入口，不替你执行）。

安装后重启 DSH，再刷新页面。如果社区目录按 `dsh-plugin-*` 搜索，也可安装 [`dsh-plugin-piggy`](https://www.npmjs.com/package/dsh-plugin-piggy)；它加载同一个游戏，每个 profile 只需装其中一个。

使用本地源码时，克隆本仓库后运行 `dsh plugin --profile web add /path/to/dsh-piggy`。

### 桌面版

从 [GitHub 稳定版](https://github.com/CLICGGER-TYPES/dsh-piggy/releases/latest)下载对应系统的文件。国内 Windows 用户可从上方夸克入口下载正式版，或从 [Gitee 最新预览版](https://gitee.com/clicgger/dsh-piggy/releases)下载 RC。Linux 和 macOS 安装包只在 GitHub 提供。

| 系统 | 下载文件 |
|---|---|
| Windows | `setup.exe` 安装版或 `portable.exe` 便携版 |
| Linux | `AppImage`，添加执行权限后运行 |
| macOS | Apple 芯片选 `arm64.dmg`，Intel 选 `x64.dmg` |

macOS 包暂未签名，第一次打开请在访达中右键应用并选择“打开”。更多说明见[桌面版安装与存档](docs/guides/desktop.md)。

## 精选界面预览

以下为 **0.37.2-rc.5 公开包实拍**，来自Linux云端虚拟机中的直接AppImage和真实DSH；稳定版界面仍以0.37.1为准。[拍摄条件与校验记录](docs/screenshots/readme-current-capture.md#2026-10-27-rc5-公开包验收)。

<p align="center"><img src="docs/screenshots/readme-rc5-farm-natural.png" width="900" alt="RC5公开包大农场：六块小白菜同时自然生长，帮工照料，显示真实剩余时间"></p>

大农场保留18块地与底部工具区，帮工照料的地块同时自然生长。大农场可在DSH中展开，也能在桌面版开独立窗口。[查看DSH小农场实拍](docs/screenshots/readme-rc5-farm-dsh.png)。

## 新手上手

1. 第一次见到“猪递”纸盒时，连续点三下，把猪接回家。
2. 左键摸摸它，右键打开主菜单；桌面版拖动小猪可以换位置。
3. 从商店买食物、洗浴用品和玩具，用背包里的东西照顾它。离线照顾默认开启，可在设置里关闭。
4. 想种菜、挖矿、抽扭蛋或盲盒，去「设置 → 扩展」安装对应玩法。下载不了时，也可以从文件导入官方扩展包。

详细玩法和命令见[玩法指南](docs/guides/gameplay.md)。

## 玩法简述

| 玩法 | 内容 |
|---|---|
| 养成与生活 | 成长最高 60 级；33 种职业支持短班，15 个旅行地点可带回 52 种纪念品；12 种性格、1008 句台词；离开时自动吃东西、洗澡、玩玩具，回来有记录 |
| 菜园 | 29 种作物、18 块地，按真实时间生长，离线照算；浇水、除草、杀虫、施肥、多季收获，也能雇帮工猪。小农场与大农场共用同一份进度 |
| 矿洞 | 20 层矿洞、5 级镐，探索矿脉、宝箱、化石与电梯；可雇小矿工猪 |
| 盲盒与扭蛋 | 盲盒有 3★～6★ 摆件、卡池与保底，收藏进图鉴；三台扭蛋机每天首次免费，幸运值满 20 必出金色 |
| 钓鱼与番茄钟 | 40 种鱼、4 个钓点、4 把鱼竿，三种收线玩法；也能让猪自己出门钓鱼，或陪你专注一段时间 |
| 外观与收藏 | 免费内置皮肤、职业外观、自定义 PNG 皮肤包（兼容原 SVG 包）、五种体型药水，以及成就、纪念品和摆件图鉴。基础 16 项成就，菜园、矿洞、扭蛋和盲盒各有 3 项扩展成就 |
| 桌面陪伴 | 猪与面板分成两个窗口；小猪大小按百分比调整，可设网络代理和全屏时隐藏。猪会眨眼、打滚、打盹、追蝴蝶，散步默认关闭 |

金币按来源记账，扩展可以有自己的币，并按汇率兑换；删除扩展时余额自动换回金币。扩展可单独开关、删除、更新；在线扩展会检查最低游戏版本，只安装本项目发布并通过校验的文件，详见[扩展安装说明](docs/design/extension-download.md)。

小猪使用一套无描边平涂透明 PNG，不同状态会换成对应立绘；支持内置彩色 emoji 字体与系统字体切换。商店、背包中的“装扮”入口暂时隐藏，已有记录保留。换肤见[玩家教程](docs/guides/skins.md)，自定义皮肤从[制作教程](docs/guides/creating-skins.md)开始。

## 更新、存档与问题反馈

### 更新

游戏包和桌面外壳分开更新：「设置 → 更新」会分别显示两个版本。Windows 安装版和 Linux AppImage 支持在 App 内下载并重启安装外壳；Windows 便携版及未签名 macOS 版需到发布页手动替换。旧外壳会保留自带游戏，并提示先升级桌面程序。

预览版（RC）只出现在版本列表里，默认折叠，不弹气泡、不亮红点，也不进入「更新到最新」；想试就自己点开安装，不点不会动。只换游戏包不会带上窗口功能，预览版条目会同时给出配套外壳版本和手动下载入口。详见[更新说明](docs/guides/updates.md)。

### 存档

稳定版中DSH插件和桌面版各养一只猪，存档独立；桌面版可从DSH导入。「设置 → 存档」提供完整 ZIP 导出、导入预览、失败恢复与替换前自动备份，DSH 和桌面可手动迁移；只做整档替换，不合并两只猪。稳定版存档为v14；RC5为v15，升级时迁移旧档。RC5默认仍各自独立，也可显式连接外部桌宠，并在预览和备份后选择合并；见[外部桌宠指南](docs/guides/external-pet.md)。备份范围、上限与验收要求见[存档传输说明](docs/design/save-transfer.md)。

从外壳0.6.8-rc.3起（本轮RC5安装包已包含），桌面默认数据目录已统一：Windows 为 `%APPDATA%\piggy\`，Linux 为 `~/.local/share/piggy/`（支持 `XDG_DATA_HOME`），macOS 为 `~/Library/Application Support/piggy/`。目录内直接放 `state.json`、`extensions/`，不再重复嵌套。升级首次启动迁移原桌面存档与扩展并保留旧目录；已有新存档不会被覆盖。DSH 插件的存档位置保持原有规则。

### 问题反馈

遇到问题时，可到「设置 → 日志 → 导出日志」保存运行记录；桌面版会弹出“另存为”。日志包含版本、动作、扩展下载与报错，方便反馈时定位。请附上游戏/外壳/扩展版本、系统与缩放、操作步骤和日志，到 [GitHub Issues](https://github.com/CLICGGER-TYPES/dsh-piggy/issues) 或 [Gitee Issues](https://gitee.com/clicgger/dsh-piggy/issues) 反馈。

## 开发文档

- [文档中心](docs/README.md) · [玩法与养成规则](docs/guides/gameplay.md)
- [桌面版安装与存档](docs/guides/desktop.md) · [游戏包与外壳更新](docs/guides/updates.md)
- [在线扩展](docs/design/extension-download.md) · [经济体系](docs/design/economy.md)
- [第三方 agent 接入](docs/guides/agent-adapters.md) · [开发与调试](docs/DEVELOPMENT.md)
- [维护交接](docs/HANDOFF.md) · [路线图](docs/ROADMAP.md) · [版本记录](CHANGELOG.md)

```sh
npm install --no-save --package-lock=false esbuild@0.28.2 typescript@5.9.3 @types/node@20.19.43
npm run build
npm test
npm run typecheck
```

完整变更与验证范围见 [CHANGELOG](CHANGELOG.md)，后续计划见 [ROADMAP](docs/ROADMAP.md)。

<details>
<summary><strong>RC5 已发布预览版：功能与验收范围</strong></summary>

游戏0.37.2-rc.5／外壳0.6.8-rc.3已在GitHub、Gitee与npm rc交付，夸克提供Windows完整版。正式入口保持不变，测试版只供主动查看。

- 菜园4.2.0／经典3.2.0自然托管：所有托管地按原时长同时生长，帮工照料、成熟收仓，现有同种种子补种；取消旧加速队列、六小时停工及生产时薪预算。历史盲盒/菜园缺件已补回。
- 完整Windows安装器内含游戏、五项离线可选扩展及指定猪脸图标，默认不勾选，仅补缺失项，已有版本/进度保留。
- 可选DSH外部桌宠模式：显式许可连接，内嵌暂停，断线阻止操作旧快照；合并需预览/备份/确认，可撤销。默认仍独立养两只。
- 默认piggy数据目录已随外壳生效；整屏透明舞台仍可选，双窗口保持默认。旧版托盘恢复入口、装扮缩放、Linux辅助窗口通知和台词等修复继续包含。
- 公开完整安装器/便携包在Windows原生验收19项通过；实际AppImage和公开npm精确版本在真实DSH/Linux验收23项通过，pageerror0。六块地逐一原生点击和两次实际快照均同步推进，成熟收仓144个、补种剩6种子，重复收仓不重发。
- 边界：原用户Windows 500%自动消失仍未同条件复现，恢复入口不能当作根因结案；macOS、混合DPI、硬件GPU和原生Wayland未做本轮原生验收。

完整变更和版本记录见[CHANGELOG](CHANGELOG.md)，后续工作见[ROADMAP](docs/ROADMAP.md)。

</details>

<details>
<summary><strong>0.37.2-rc.1 预览版（外壳 0.6.8-rc.1，历史）</strong></summary>

- 桌面可选整屏透明舞台：保留双窗口为默认，已完成本轮 Windows/Linux 虚拟机回归，尚未切换默认。
- 菜园 4.1.5 候选：清爽平涂纸感重排、缩小底部图文入口、选地改为四角标记；随本次 RC 提供。
- 礼包侧边与跨到期点击：讲话时待领礼包向工作区内侧摆放，按住跨过自动关闭时间仍可领取；已在 Linux 和 Windows 虚拟机场景验证。
- 桌面启动诊断与托盘恢复：补入口加载失败、重复启动、首帧前崩溃的提示和日志；托盘“恢复小猪”只恢复本机显示位置与 100% 比例，不动养成存档；该入口需要更新到配套外壳，单独更新游戏包不会增加托盘菜单。真实用户的启动问题仍需要日志定位。
- 存档：本候选将养成存档从 v14 迁移到 v15；升级前应保留完整备份，回退旧游戏时恢复对应旧档。菜园 4.1.5 / 经典 3.1.1 候选要求游戏 0.37.2（本 RC 可用）。
- 边界：Windows 500% 下自动消失的反馈尚未复现、尚未定位，恢复入口不是根因修复；macOS 未做原生验收。此版本仍为预览版，不能当成稳定版功能。

</details>

## 贡献者

这个项目有一半是玩家帮忙做出来的，谢谢每一位交出代码、画作和想法的朋友（按首次贡献时间排序）：

| 贡献者 | 贡献 |
|---|---|
| [@1nuoiscute](https://github.com/1nuoiscute) | 猪猪王原型与恶魔猪形态、肥猪体型和胖胖猪动作立绘；十六项成就与小猪徽章系统（[#6](https://github.com/CLICGGER-TYPES/dsh-piggy/pull/6)）；扩展公共进度事件与十二项扩展成就（[#7](https://github.com/CLICGGER-TYPES/dsh-piggy/pull/7)） |
| [@anupamme](https://github.com/anupamme) | 报告桌面版更新依赖的安全问题（[#5](https://github.com/CLICGGER-TYPES/dsh-piggy/pull/5)） |
| [@tetezi](https://github.com/tetezi) | 面板动作时猪窗口置顶、右键不误摸、脏和生病状态的苍蝇/病毒图标、恢复桌面版状态变色与心情优先级调整，附回归测试（[#8](https://github.com/CLICGGER-TYPES/dsh-piggy/pull/8)，随 [#9](https://github.com/CLICGGER-TYPES/dsh-piggy/pull/9) 合入） |
| [@WolalaQAQ](https://github.com/WolalaQAQ) | 运行时与 DSH 适配器拆分、工作事件接口、持久去重和事务恢复，以及后续可靠性补丁；按游戏能力控制 Windows 鼠标转发（[#19](https://github.com/CLICGGER-TYPES/dsh-piggy/pull/19)），异步外壳 I/O 与更新生命周期（[#15](https://github.com/CLICGGER-TYPES/dsh-piggy/pull/15)）、Windows 菜单与小猪窗口层级恢复及回归测试（[#21](https://github.com/CLICGGER-TYPES/dsh-piggy/pull/21)）；提出并参与可选DSH外部桌宠方向讨论（[#14](https://github.com/CLICGGER-TYPES/dsh-piggy/issues/14)）；并协助完成 Windows、DSH 和 OpenCode 独立复核（[#12](https://github.com/CLICGGER-TYPES/dsh-piggy/pull/12)、[#13](https://github.com/CLICGGER-TYPES/dsh-piggy/pull/13)） |
| [@Flappy-Boy](https://github.com/Flappy-Boy) | 反馈更新说明滚动回顶、菜园快速点击丢操作、矿洞连续挖掘站位异常，并提供复现步骤（[#16](https://github.com/CLICGGER-TYPES/dsh-piggy/issues/16)、[#17](https://github.com/CLICGGER-TYPES/dsh-piggy/issues/17)、[#18](https://github.com/CLICGGER-TYPES/dsh-piggy/issues/18)） |

欢迎画猪、报问题或贡献代码。当前立绘只有一套无描边平涂画风，原有形象与制作要求见[小猪画风](docs/art/pig-style.md)。可以先开 Issue 交流，也欢迎 Fork 项目，养一只符合自己喜好的猪。想加玩法、想画猪、想报 bug 都欢迎：到 [Issues](https://github.com/CLICGGER-TYPES/dsh-piggy/issues) 说一声，或直接提 [Pull Request](https://github.com/CLICGGER-TYPES/dsh-piggy/pulls)（Gitee 用户可以在 [Gitee 仓库](https://gitee.com/clicgger/dsh-piggy) 提 Issue）。合并进来的贡献会记在这张表里。

## 致谢与许可

**不同状态的小猪图**（`assets/pigs/feedback/`）的灵感来自 [PigHub](https://pighub.top/) 上的猪猪图片：以那里的猪猪为参考，由 AI（OpenAI 图像生成，codex 操作）重新画成本项目的样子，没有直接复制原图。谢谢 PigHub 和图片作者！如果你是原图作者，觉得侵犯了你的权利或不喜欢这样使用，请[开 issue](https://github.com/CLICGGER-TYPES/dsh-piggy/issues) 告诉我们，我们会删除相关图片。

视觉风格参考 [animal-island-ui](https://github.com/guokaigdg/animal-island-ui)，玩法数值参考资料见 [THIRD-PARTY.md](THIRD-PARTY.md)。项目采用 [MIT License](LICENSE)；小猪立绘改自 [Noto Emoji](https://github.com/googlefonts/noto-emoji) 的 🐖，按 Apache 2.0 发布（见 [THIRD-PARTY.md](THIRD-PARTY.md)）。
