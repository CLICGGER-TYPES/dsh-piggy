# 界面规范（面板、按钮、扩展页面）

改面板、加 App、写扩展页面之前读这一份。**改布局、加控件、换样式要先问用户**——「规则改了」不等于「界面要跟着改」，
擅自动布局被追问过（见文末「已定规矩」）。

## 参考的是谁

| 方面 | 参考 | 用在哪 |
|---|---|---|
| **玩法与数值** | QQ 宠物（怀旧服逆向 [xuemian168/qqpet_automation](https://github.com/xuemian168/qqpet_automation)、浏览器版 [ice-cream-headache](https://github.com/ice-cream-headache/ice-cream-headache.github.io)） | 属性、饥饿/清洁/心情、生病链、打工上学旅行、台词分类（见 `docs/DESIGN.md` 第 2～4 节） |
| **视觉** | 《集合啦！动物森友会》风格：[guokaigdg/animal-island-ui](https://github.com/guokaigdg/animal-island-ui) 的 design-system | 配色、圆角、按钮、主菜单做成 NookPhone 那样的 **App 方块**（见 `docs/DESIGN.md` 5.4）。变量前缀 `--ac-` 就是 Animal Crossing |
| **台词口吻** | QQ 宠物 + 动森村民 | 见 [adding-lines.md](adding-lines.md) |
| **猪的立绘** | 项目自己的 `piglet.svg` | 见 `docs/ART-SPEC.md` |

## 设计变量（`src/client/css-base.js`，声明在面板根节点，不在 `:root`）

**颜色一律用变量**，不写色值。扩展页面里用变量时给兜底值：`var(--ac-text,#794f27)`（旧宿主没有某个变量时不至于没颜色）。

| 变量 | 值 | 用途 |
|---|---|---|
| `--ac-primary` / `-hover` / `-active` / `-bg` | `#19c8b9` 薄荷青系 | 主按钮、焦点环、选中 |
| `--ac-text` / `-text-body` / `-text-2` / `-text-muted` / `-text-disabled` | 棕色系 | 标题 / 正文 / 次要 / 弱化 / 禁用。**不用纯黑** |
| `--ac-bg` / `-bg-content` / `-bg-input` / `-bg-disabled` | 奶油色系 | 面板底 / 内容卡 / 输入和次按钮 / 禁用 |
| `--ac-border` / `-border-light` / `-border-hover` | | 边框**一律 2px** |
| `--ac-radius-sm` 12px · `--ac-radius-card` 20px · `--ac-pill` 50px | | 小件 / 卡片 / 药丸按钮 |
| `--ac-shadow-sm` / `--ac-shadow` / `--ac-shadow-lg` / `--ac-inset` | 暖色阴影 | 层次主要靠边框，阴影只给浮层和按钮 |
| `--ac-success` / `--ac-warning` / `--ac-error` | | 状态 |
| `--ac-hover` / `--ac-active` | 淡蓝 | 图标栏、分段控件的悬停和选中 |
| `--tile-pink` … `--tile-brown`（`css-tiles.js`） | 11 种 | 主菜单 App 方块底色、属性条颜色、扩展货架/图鉴分区的 `color` |

**字号**：正文 11px，次要 10～10.5px，小注 9.5px，标题 12px；大 emoji 和插画按需要。不低于 8.5px，字重不低于 400（按钮和标题 700）。
**动效**：缓动 `--ac-ease`，0.15～0.35s；有动画的地方加 `prefers-reduced-motion` 关掉。

## 现成组件（先找这里，没有再问）

| 要做什么 | 用什么 | 在哪 |
|---|---|---|
| **执行**动作（买、出发、使用、开垦） | `dp-mini`：青色药丸 + 3D 底边（**只有主按钮有 3D 底边**） | `css-tabs.js` |
| 次要按钮（照顾、详情、取消） | `dp-btn`：奶油药丸、柔和浮起；占满一行加 `dp-btn-wide`；淡版主按钮 `dp-mini dp-mini-plain` | `css-tabs.js` |
| 两个并排的按钮 | `dp-actions` 网格 | `css-tabs.js` |
| 分段切换（4 项 / 3 项） | `dp-seg`（`dp-seg-3`），文字不换行 | `css-tabs.js` |
| 列表 / 两列格子 | `dp-list` / `dp-grid`，一行一项 `dp-item`，小标题 `dp-shelf` | `css-tabs.js` |
| 属性条 / 小进度条 | `labelledBar()`（`dp-meter`）/ `dp-progress` | `widgets.js`、`css-base.js` |
| 主菜单 App 方块 | `tile({ emoji, label, color })` / `tileGrid()` | `widgets.js`、`css-tiles.js` |
| 子页面的标题栏和返回 | `drillHeader(ui, tab, title, info)`、`drillTo()` | `widgets.js` |
| 提示条（生病、外出、旧存档） | `dp-alert`（`dp-sick`/`dp-work`/`dp-dead`/`dp-legacy`） | `css-tabs.js` |
| 空状态 | `dp-empty` | `css-tabs.js` |
| 输入框 | `dp-input` | `css-tabs.js` |
| 猪头上冒一句话 | `ctx.showBubble(text, ms)`（不是 toast） | `effects.js` |
| 建 DOM | `el(tag, className, text)`、`button(className, attrs, onClick)` | `dom.js` |

## 已定规矩（用户明确说过的，别再踩）

- **面板要简洁**：不加大段说明文字、刻度条之类的装饰；状态条只在货架里出现（rc.2 被说「好庞杂」）。
- **主菜单图标一律 emoji**，不用手绘 SVG（手绘那版用户明确不要，别恢复）。扩展的 App 图标也用 emoji。
- **改规则不顺手改界面**：只改数值/规则时，按钮、布局保持原样；要动先问（B4 删学段按钮被问「为什么改了」）。
- 面板宽固定 292px（`PANEL_WIDTH`），最高 520px，内容多就在面板里滚动，不加宽。
- 跳到子页面再返回，回到**来的地方**，不是回主菜单。
- 改名这类小编辑用「悬停出现的蜡笔」按钮，不另开页面。
- 重设计要有肉眼可见的视觉变化，先问参考方向、给几个方向挑（「风格不变」≠ 照搬只挪位置）。

## 扩展页面

- 类名用自己的前缀（菜园 `fm-`、矿洞 `mn-`……），样式放自己的 `<style id="dsh-piggy-<key>-style">`。
- 按钮用面板的 `dp-mini` / `dp-btn`（经 `app.button()`），只调内边距和字号；**不要自己造一套按钮**。
- 颜色用 `--ac-*` / `--tile-*` 变量 + 兜底值。玩法自己的主题色（矿石、扭蛋机外壳、稀有度）可以写色值，但只用在「内容」上，
  不用在按钮、边框、文字这些「界面」上。
- 现状：盲盒（明日方舟寻访主题）的按钮是自己的 `bx-btn`（同样用主色变量）、扭蛋/盲盒主题色值较多——
  属于已发布内容，**改它们要升扩展版本、重新发版**，没有用户要求就不动。

## 已知的不统一（之后统一时参考，现在不要顺手改）

- 核心样式里有主题色写死：钓鱼水面（`css-fishing.js`）、图鉴稀有度（`css-dex.js`）、提示条底色（`css-tabs.js` 的 `dp-alert.*`）、
  居民卡（`css-card.js`）。都是「内容色」，没有对应变量。
- 字号用了 20 多种值（大头是 9.5/10/10.5/11/12），圆角有 8 种写死的像素值（多在图鉴、钓鱼）。
  真要统一时先给用户看前后对比。

## 怎么验收界面改动

- 测试通过 ≠ 显示正确。**必须在真实浏览器里看**：浏览器打开 `tools/preview.html`（用构建好的 `client.js` 和假数据画面板），或在桌面版里看；要调数值、给物品，在主菜单版本号上 3 秒内连点 7 下打开调试 App。
- 截图对比改动前后；面板里的文字不能被截、按钮一行内不能换行。
- 桌面版另外按 [desktop-architecture.md](desktop-architecture.md) 验收窗口行为。
