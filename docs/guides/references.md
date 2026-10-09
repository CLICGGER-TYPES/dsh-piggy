# 参考项目总表

这个项目做到现在，用户让参考过的、我们实际参考过的外部项目都列在这里（2026-10-08 从文档、任务卡、代码注释和历史记录里整理，许可逐个核对过）。
**做新东西之前先查这张表**：要做的东西如果和表里某一项相关，先去看它，别自己从头想。

## 用的时候守三条

1. **以本项目为准**：参考项目的做法和本项目现在的做法冲突时，一律以本项目为准（用户 2026-10-08 定）。参考是用来补「还没有的」，不是用来改「已经有的」。
2. **按「能怎么用」那一列来**：
   - **可引用**：MIT / BSD / Apache / ISC 等宽松许可，代码或样式可以照抄或引进来，要在 `THIRD-PARTY.md` 记一笔；
   - **只借思路**：GPL 或许可不明的项目，只看玩法、规则、手感，**代码、素材一行都不抄**；
   - **只参考数值 / 规则**：事实性的数值和规则名可以用，原版素材一律不用。
3. **新参考了什么，加进这张表**（写清是什么、许可、能怎么用、用在哪）。

---

## 玩法与数值

| 项目 | 许可 | 能怎么用 | 用在哪 |
|---|---|---|---|
| [xuemian168/qqpet_automation](https://github.com/xuemian168/qqpet_automation)（QQ 宠物怀旧服逆向） | MIT（原创部分） | 只参考数值和名称 | 属性阈值、疾病链、科目、物品名（`docs/DESIGN.md` 第 2～4 节） |
| [ice-cream-headache.github.io](https://github.com/ice-cream-headache/ice-cream-headache.github.io)（浏览器版 QQ 宠物） | MIT | 只参考界面截图 | 宠物在上、图标栏在下、属性条的布局 |
| 明日方舟「寻访」（游戏） | 商业游戏 | 只参考规则（星级、出率、50 抽保底递增、UP、潜能、资质凭证） | 盲盒扩展（`docs/numbers/X1-blindbox.md`）；不用任何原版素材 |
| [Mantan21/Genshin-Impact-Wish-Simulator](https://github.com/Mantan21/Genshin-Impact-Wish-Simulator)、[mtfn/genshin-pity-calculator](https://github.com/mtfn/genshin-pity-calculator) | MIT | 可引用（实际只借了保底计数思路） | 盲盒保底（软保底 / 硬保底计数） |
| [mant0u0/Gashapon](https://github.com/mant0u0/Gashapon)（转蛋机网页） | **没有许可证** | 只看效果，不抄代码和素材 | 扭蛋机的手感（摇机器、转把手、胶囊弹出），动画是自己写的 |
| [jeremyckahn/farmhand](https://github.com/jeremyckahn/farmhand) | **GPL-2.0** | 只借思路，不抄代码 | 菜园（按真实时间长、浇水、离线照算） |
| [h1ddengames/Motherload-Clone](https://github.com/h1ddengames/Motherload-Clone) / 原版 Motherload | **GPL-3.0** / 商业游戏 | 只借规则 | 矿洞（往下挖、越深越值钱、回地面卖） |
| [cswendrowski/FoundryVTT-Obligatory-Fishing-Minigame](https://github.com/cswendrowski/FoundryVTT-Obligatory-Fishing-Minigame) | MIT | 可引用（UI 写法可以借） | 钓鱼搏斗小游戏（Stardew 式钓鱼条） |
| [alexeagleson/stardew-fishing](https://github.com/alexeagleson/stardew-fishing) | **没有许可证** | 只看效果 | 同上 |
| Google Emoji Kitchen | Google 版权，无开源许可 | 只借点子，不描图 | 「千奇百怪的小猪」（`docs/design/pig-kitchen-art.md`） |

## 界面与卡片

| 项目 | 许可 | 能怎么用 | 用在哪 |
|---|---|---|---|
| [guokaigdg/animal-island-ui](https://github.com/guokaigdg/animal-island-ui)（动森风格组件库，[在线演示](https://guokaigdg.github.io/animal-island-ui/)） | MIT | 可引用（设计变量、组件规格、CSS 写法）；**不引入它的 React 组件库** | 全部 `--ac-*` 设计变量；**居民卡**照它的 Card `pattern-*`（点点底纹、同色描边，`src/client/css-card.js`）；表单、按钮规格。做新组件先查它，见 [界面规范](ui-style.md) |
| 《集合啦！动物森友会》NookPhone、居民卡（游戏） | 商业游戏 | 只参考感觉 | 主菜单九宫格 App 方块、居民卡的「简介卡」感觉；不用任何原版素材 |
| 闪卡（`src/client/css-holo.js`） | 本项目自己写的 | — | 盲盒摆件和扩展图鉴的闪卡：渐变底、斜向流光、悬停跟随倾斜 |

## 美术与字体

| 项目 | 许可 | 能怎么用 | 用在哪 |
|---|---|---|---|
| [Noto Emoji](https://github.com/googlefonts/noto-emoji) 的 🐖 | 图片 Apache 2.0 | 可引用（要署名、附许可） | 小猪立绘的底图，所有猪图都是它的衍生（`THIRD-PARTY.md`、`LICENSE-noto-emoji.txt`） |
| Noto Color Emoji 字体 | SIL OFL 1.1 | 可引用 | 桌面版和网页版自带的 emoji 字体 |
| Nunito、Noto Sans SC | SIL OFL 1.1 | 可引用（从 Google Fonts 加载，不随包分发） | 界面字体 |

## 动效、渲染、手绘、配色

细节和规矩见 [动效、渲染、手绘和配色](motion-libraries.md)。

| 项目 | 许可 | 能怎么用 | 定位 |
|---|---|---|---|
| [Motion](https://motion.dev) | MIT | 可引用 | 首选：弹簧、回弹、编排 |
| [mo.js](https://mojs.github.io) | MIT | 可引用 | 爆点和形状特效 |
| [Rough.js](https://roughjs.com) | MIT | 可引用 | 手绘风点缀 |
| [Chroma.js](https://gka.github.io/chroma.js/) | BSD-3 + Apache 2.0 | 可引用 | 配色计算（优先在工具和测试里用） |
| [canvas-confetti](https://github.com/catdad/canvas-confetti) | ISC | 可引用 | 彩带。现在盲盒、扭蛋的彩带是自己写的；要更丰富时可以换它 |
| [PixiJS](https://pixijs.com)、[Three.js](https://threejs.org) | MIT | 可引用 | 重型 2D / 3D，特殊场景才考虑 |
| [GSAP](https://gsap.com) | 非开源（可撤销的免费许可） | 只参考，不引入 | 学缓动节奏和编排思路 |
| XPBD（论文算法） | — | 可按论文自己实现 | 后续思路：猪被绳子吊着晃（未开工） |

## 工具链和平台（参考它们的文档）

| 项目 | 用在哪 |
|---|---|
| [DeepSeek Harness（DSH）](https://github.com/deepseek-ai/deepseek-harness) | 插件宿主：插件格式、面板加载方式 |
| [Electron](https://www.electronjs.org)、[electron-builder](https://github.com/electron-userland/electron-builder) | 桌面外壳和打包 |
| [Open-Meteo](https://open-meteo.com)（天气、地理编码接口） | 待定的城市天气功能（`docs/archive/tasks/E-round.md`），用前先看它的使用条款 |
