# 任务卡

> 接手维护请先读 [维护交接文档](../../HANDOFF.md)；下面的分工和状态是历次批次的历史记录。

总规划：复刻 QQ 宠物 70-80% 的单机玩法，社区以后做。分工：

| 谁 | 做什么 |
|---|---|
| Claude | 框架（批次 0）、任务卡、数值确认单、每批验收 review |
| DSH agent | 按卡执行：修 bug、填数据表、写页签 UI、补测试 |
| 用户 | 确认每批的数值单，在真实 DSH 里体验 |

## 批次一览

| 卡 | 内容 | 谁做 | 状态 |
|---|---|---|---|
| B0 | 框架：pet-core 库、分段结算、随机数种子、存档逐级升级、台词框架 | Claude | ✅ 已合入 main |
| [B1](B1-stability.md) | 稳定：修审查出的 bug | **DSH agent** | ✅ 已合入，Claude 已验收（鉴权：用户决定不做） |
| B2 | 成长：成长值 + 照顾系数、60 级、幼年/青年/成年、性别、去掉老年和老死（[数值单](../../numbers/B2-growth.md) ✅） | Claude | ✅ 已合入 |
| B3 | 疾病：5 条链、20 种专用药、概率发病、吃错药加重（[数值单](../../numbers/B3-illness.md) ✅） | Claude | ✅ 已合入 |
| B4 | 学习→职业：九门课课时、33 种职业、证书、掉落（[数值单](../../numbers/B4-study-jobs.md) ✅） | Claude | ✅ 已合入 |
| [B5](B5-daily.md) | 日常：签到 12 天、在线礼包（每小时）、宠物日记（[数值单](../../numbers/B5-daily.md) ✅） | **DSH agent** | ✅ 已合入 |
| [B9](B9-home-card.md) | 九宫格主屏、居民卡、打工方块、横幅只在状态页（截图 docs/screenshots/b9-*.png） | Claude | ✅ 已合入 |
| [B8](B8-tiles.md) | 学习/商店/背包改成动森手机式方块（两层都是方块），截图在 docs/screenshots/b8-*.png | Claude | ✅ 已合入 |
| B6 | 台词全量 + 闲聊 + 免打扰（动画、右键菜单暂不动）（[审稿单](../../numbers/B6-lines.md)） | Claude | ✅ 已合入（用户：不审，按稿直接上） |


**C 批次（2026-10-01 起）**：调试解锁、番茄钟、加冕道具化、图鉴、钓鱼、换肤、胖猪与六款角色外观 —— 见 [C-round.md](C-round.md)。C1–C8 已随 v0.27.0 发布，桌面依赖安全修复已随 v0.27.1 发布；C8 的用户体验反馈待收集，当前状态见[交接记录](../HANDOFF-2026-10-03.md)。

**I 批次（2026-10-06，待用户过卡）**：桌面版窗口几何重做，根治「更新后右键偏移、拖动异常、上下屏被弹」。用户要求换底层逻辑而不是继续打补丁，见 [I-round.md](I-round.md)。

**F 批次（2026-10-04，进行中）**：v0.27.1 玩家反馈的体验修复（气泡、皮肤尺寸、装扮脱下、兴趣课、收起时的反馈、图鉴按钮、点外面收起面板、npm 改手动发版），目标 v0.27.2，见 [F-round.md](F-round.md)。之后的顺序：G 丝滑（性能 + 动画规范）→ X 扩展中心（钓鱼、番茄钟改成可开关的扩展）→ H 作息模式 → N 新玩法（盲盒抽卡 + 衣柜、种菜、小游戏合集，都做成扩展，先玩法后美术）。

**E 批次（已调整，见卡顶说明）**：现实作息先行，城市/天气与全游戏日界迁移分阶段验收；任务边界、数值确认和存档门槛见 [E-round.md](E-round.md)，原始目标设计见[计划书](../../design/real-world-cycle.md)。尚未开工。

四张数值单用户已于 2026-10-01 确认（全部按建议值）。**不改确认过的数字**；觉得不合理就写在卡里，等用户定。

## 后续计划（待拆卡）

1. **设置 App + 图标风格切换**：主菜单 App 图标的系统 Emoji／内置 SVG 切换已实现，当前设备本地保存选择，缺图回退 Emoji，未提升存档版本。后续可逐步覆盖 App 内部的状态和道具 Emoji。
2. **自定义导演系统**：C 批次明确延期，规则、事件编辑方式和安全边界尚未拆卡。
3. **游戏内社区功能**：好友、联机等玩法等单机稳定后再规划；第三方插件目录的发现与自荐进度见[交接记录](../HANDOFF-2026-10-03.md)。
4. **装扮展示重设计**：商店和背包入口暂时隐藏，保留已购和穿戴记录；未来入口、购买方式、与皮肤/图鉴关系待用户确认。
5. **npm 发版流程**：v0.27.0、v0.27.1 已由用户本机手动发布；CI 的 npm job 因没有 `NPM_TOKEN` 失败。下版前选择自动发布认证或明确的手动发布流程。

## 协作规则

1. **两边在不同目录干活**，避免 `git add` 把对方做了一半的东西提交进去：
   - DSH agent：原目录 `/zyx/DSH/workspaces/dsh-pig`，直接在 `main` 上提交（DSH 加载的就是这个目录）
   - Claude：worktree `/zyx/DSH/workspaces/dsh-pig-claude`，分支 `claude/core`；每完成一块、测试全绿后由 Claude **rebase 到最新 main 再快进合入**，冲突由 Claude 解决
   - DSH agent **不要**合并、rebase 或改动 `claude/*` 分支
2. 开工前 `git log --oneline -10` 看最近有什么合进来了。
3. 一张卡一段连续提交，提交信息 `fix(pig)` / `feat(pig)` 开头，写清改了什么、为什么。**只 `git add` 自己改的文件，不用 `git add -A`**。
4. 每修一个 bug / 加一个功能，先写一条**会红的测试**，再改代码让它变绿。
5. 每张卡完成时，在卡末尾「验证记录」写：`npm test` 结果、`npm run typecheck` 结果、截图路径。
6. **存档版本号归 Claude 管**：`core/upgrades.js` 和 `STATE_VERSION` 只有 Claude 改。DSH agent 需要新存档字段时，用 `ensureXxx(state)` 补默认值（参考 `core/lines.js` 的 `ensureDialogue`）。

## 框架约定（B0 之后）

| 要做的事 | 用什么 |
|---|---|
| 领域逻辑 | `packages/pet-core/src/core/`，根目录 `core.js` 只是再导出 |
| 数值表 | `packages/pet-core/src/data/`，新表记得加进 `data.js` barrel |
| 随机 | `core/random.js` 的 `roll(state)` / `chance(next, p)` / `pickOne(next, list)`。**禁止 `Math.random()`**（`test/core-boundary.test.js` 会拦） |
| 时间推进 | `decay()` 分段分步（5 分钟一步）；新的「随时间变化」的系统挂在 `settlement.js` 的 `step()` 里 |
| 改存档结构 | `core/upgrades.js` 表尾加一级 + `STATE_VERSION` +1 + 迁移测试（样本在 `test/fixtures/`） |
| 猪说话 | `say(state, scene, nowMs)`；新场景加在 `data/lines.js` |
| 消息 | `announce()` 返回带递增 `id` 的消息；客户端按 id 去重 |

## 验收（每张卡通用）

```sh
npm run build && npm test && npm run typecheck
```

真实界面：起一个 **3084 隔离实例**，不碰正在使用的 3080、3082、3083。复制存档后将测试 profile 的 `dsh-piggy` 插件链接指向当前任务 worktree，避免加载到旧版：

```sh
TEST_DSH_HOME=/tmp/dsh-piggy-e-test
mkdir -p "$TEST_DSH_HOME"
cp -a ~/.dsh/profiles ~/.dsh/llm-deepseek ~/.dsh/storages ~/.dsh/dsh-piggy "$TEST_DSH_HOME"/
# 将 "$TEST_DSH_HOME/profiles/web/node_modules/dsh-piggy" 指向当前任务 worktree
cd /zyx/DSH/deepseek-harness
DSH_HOME="$TEST_DSH_HOME" pnpm dsh web --no-open --port 3084
```

逐个页签截图，存到 `docs/screenshots/`。
