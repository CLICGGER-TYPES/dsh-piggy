# 路线图与待办

**本页是唯一的待办清单**（2026-10-15 更新）。HANDOFF 与项目总目录 README 只交代当前状态和本页链接；任务卡记录执行证据，不另开待办。旧版完整内容见[归档路线图（2026-10-15）](archive/ROADMAP-2026-10-15-before-runtime-cleanup.md)，更早的[09-30 路线图](archive/ROADMAP-2026-09-30.md)和[历史任务索引](archive/tasks/README.md)。

## 当前基线与候选

| 项目 | 当前值 | 状态 |
|---|---|---|
| 当前主线 | `main`，已纳入完整候选 `1e46ef3` | 整合前基线 `c20ab95`；版本仍为游戏 0.37.0、外壳 0.6.6、存档 v14；未发新版本 |
| 菜园扩展 | 4.0.8（最低游戏版本 0.37.0） | 本轮扩展版本 |
| 整合候选 | [`codex/runtime-037-candidate`](https://github.com/CLICGGER-TYPES/dsh-piggy/tree/codex/runtime-037-candidate) | PR #12/#13 的 A/B/C 与体验修复，准确阶段提交见[验证记录](guides/agent-adapters-validation.md)；完整候选已进入 main，原分支保留供复核，未发版 |

历史阶段记录：PR #12/#13 的 A/B/C 候选曾在主机、Linux CLI、Windows 11 CLI 各完成 **1106/1106**；Esc 后续阶段 host **1115/1115**，Windows Node24 新增 Esc 测试 9/9。这些是对应历史版本的结果，不代表最新候选在三平台都跑过同一全量。

最新候选客户端 SHA-256：`5476f34e95817e2aa28d09886572b5159dacb7d5ecfb66dac5eed0fb8008b8be`。主机全量 **1124/1124**、build/typecheck 通过。作者随后在原生 Windows / Node24 独立复核完整候选 **1124/1124**，构建和类型检查通过；[作者记录](https://github.com/CLICGGER-TYPES/dsh-piggy/pull/12#issuecomment-6191689370)。此前 Windows 动画相关 **9/9** 为历史单独执行；macOS 未验收。

## 当前阶段

1. **体验问题阶段收尾，后续暂缓**：追蝴蝶与旋转/跳跃整段动画命中扫掠已修并完成几何复验；Linux 与 Windows 新版原生流程按下方实际覆盖记录。Windows 新版全新存档孵化已完成，macOS 未实机验证。用户已查看本机启动效果，要求余下问题以后处理；保留下方限制和待办。
2. **整合收口**：作者已完成完整候选 Windows、DSH Desktop 和真实 OpenCode 联动复核，没有发现通用接入、提交恢复或 DSH 兼容阻断项。按用户后续指示将 `1e46ef3` 快进整合至 main，保留全部阶段提交与贡献署名；原 PR 按移植整合结果收口，不另发版。

## 体验问题（暂停新功能）

整合和目录核对后，暂停新玩法与功能开发，优先复现和诊断以下体验反馈。静态代码观察不作为根因结论：

- Linux 白块：补录慢/快两段真实 QMP 拖动，共 830 帧，实际约 50.1/48.9fps，最大帧间隔 31/28ms；逐帧图和颜色检查未发现白块、第二只猪或拖动反向跳跃。本次保留待机/反馈动画，现有分析器的松手后位移检查仍报 6.5/3.5px，不能写作全部通过。首次启动还遇到 Xwayland 崩溃，重开同一隔离候选后成功，根因未定。未据此宣称用户白块反馈已修复。证据：本机总目录 `tasks/results/linux-drag-film/results.json`。
- Windows 桌面抖动/单帧叠影：新版 Win11 125% 原生购买、双焦点 Esc、底部 motion reserve 空白点击穿透、拖动和正常退出重启持久化通过；场景由 1158,659 到 701,451，输入约 (-458,-209)，误差 1px，viewport 固定 356×284。当前原生 BitBlt 录制 132 帧，约 21.66fps、最大间隔 78.26ms，逐帧未见白块或第二只猪；仍不能排除单帧残影。新版全新存档孵化已通过。旧纸盒未响应点击的那轮原因未知；本轮纸盒已正常戳开，不能称为已修复。证据见本机总目录 `tasks/results/windows-hit-followup/`。
- Linux 新版原生流程：隔离新存档孵化、两焦点 Esc、底部空白点击穿透、viewport 固定 356×284 拖动（位移 -220,-70 精确对应）、正常 quit 与 `state.json.runtime.lock` 创建/释放通过。284 帧录像约 49.9fps、最大帧间隔 34ms，未见丢猪、反向步或重影；待机约 3.5px 仍使旧严格工具 FAIL。证据 `tasks/results/linux-motion-native/run-20261015T1450Z/results.json`；guest/SSH/lock 已清理，VM 已恢复关机。
- 换皮肤后猪变小：普通体型幼年猪的默认→薄荷→默认真实 DSH UI 复验差异 0px。扩展隔离 QA fixture（主代理独立重跑）发现胖体型默认→薄荷可见高度 68.3408→45.5622px，缩小约 33.3%；源码只在默认皮肤应用体重叠层及其尺寸，属于现有显示规则，暂不擅自改动，待用户验收决定。职业皮肤和带透明边框 PNG 均约 45.562px；测试 SVG 为 46.170px。强制自定义睡姿仅验证图片路径与 framing，不代表真实睡眠流程或用户存档已复现。证据在本机总目录 `tasks/results/skin-size-expanded/root-verification.json` 及 `tasks/results/skin-size-browser/latest/`。
- 小面板 Esc：已修复并完成主机 1115/1115、Windows Node24 新增 9/9，以及 Linux/Windows 两种焦点状态的原生验收。菜园内层弹窗逐层取消及大窗口返回面板在 Linux 通过；修复随独立候选交付，尚未发版。
- 小猪点击命中区域偏小：追蝴蝶修前 9/61 采样越界（最远约 4.08px）、修后 0/61。后续将 `motion-envelope.js` 整合到测量流程，按 `dp-spin` / `dp-jump` CSS `animationName` 计算整段运动范围；旋转 roll20/67 修前最大越界 30.206px、修后 0/67，cure14/59 修前最大 29.51px、修后 0/59；蝴蝶修后 0/61。窗口 outline 随尺寸固定预留，idle 时不计入 hit 区域；Darwin 保持原 footprint 未修。host 全量 1124/1124，build/typecheck 通过；Windows Node24 动画相关 9/9。几何探针强制动画，不等同自然复现。主代理统一验证证据见 `tasks/results/rotation-hit-probe/root-verification.json`。
- macOS：用户报告点击离猪很远的透明空白处也会显示/激活猪窗口，干扰其他应用。Linux 点测 (940,600) 时宠物焦点由 true 变 false，焦点落到终端；这不能证明 Mac 反馈。用户补充的系统、外壳版本和触发步骤尚未收到，Mac 未实机复现，不判定根因。

## 暂缓项目

以下项目保留为以后重新排期的用户决定或技术事项，本阶段不启动：

- 帮工农具档未来用途；盲盒/扭蛋是否采用插画界面；胖胖体型是否使用反馈图；生日蛋糕是否奖励；5 张待定反馈图的去留；装扮入口重设计。
- 学校改版（[G3 数值单](numbers/G3-school.md)）、E 批次现实作息/城市天气（[方案](design/real-world-cycle.md)、[历史任务卡](archive/tasks/E-round.md)）、导演系统和游戏内社区。
- 扩展下载使用系统代理的实现。已知可行方向是 Node 24 环境代理支持；此前只获准处理超时重试。
- 帮工时钟回拨死区、桌面主进程拆分、接近文件行数上限的模块预拆、Gitee 附件空间管理，以及 GNOME 启动提示和屏幕顶边面板重叠等历史技术项。背景和原始状态保存在[归档路线图](archive/ROADMAP-2026-10-15-before-runtime-cleanup.md)。

## 最近完成

- PR #12/#13 的 A/B/C 候选与稳定 v0.37.0 基线整合，并完成主机 Node 26.11.1、Linux CLI Node 24.21.0、Windows 11 Node 24.21.0 的全量测试（每处 1106/1106）、构建和类型检查；该结果为历史整合阶段；后续候选随本轮独立分支交付。Linux/Windows 原生结果见下方记录，详见本机总目录任务卡 `tasks/2026-10-15-runtime-integration-and-cleanup.md`。
- DSH 插件实际加载、state/act、slash command、重启，以及隔离浏览器真实流程均已通过。用户授权后使用 Playwright 1.63 + Chromium headless 的独立 profile；正常 UI Continue、右键打开面板、孵化、商店买苹果 500→494、苹果 0→1；刷新和重启 DSH 后仍精确为 494/1。未用个人浏览器 profile 或真实 DSH_HOME。3 条 console 加载错误仅来自主动拦截 Google Fonts，没有其他 app error。证据：本机总目录 `tasks/results/runtime-c-dsh-ui/run-20261015T063137Z/result.json`。
- Linux 原生孵化、买苹果、本地导入菜园 4.0.8、小/大农场、兑换、买种子、两次退出重启后的存档，以及 HTTP 401/200/404 和重复重启去重均已通过。Esc 原生流程覆盖 pet focus 和 panel focus 两态；菜园中 dialog/popup 状态依次为 1/1→0/1→0/0→扩展关闭，panel focus 保持 true。证据：本机总目录 `tasks/results/runtime-c-linux-ui/ux-results.json`。Linux VM 临时文件、进程和锁已清理并恢复原关机状态。
- Win11 125%：完整源码包校验后实际启动，孵化、商店购买（494 金币/1 苹果）、透明区点击穿透、Esc、正常退出与重启持久化通过；退出后进程/存档锁释放。Windows 开发启动使用 Electron 44.5.1，未测安装器或 Windows 大农场。原先临时目录残缺/脚本启动错误已与产品结果分开；首轮 Network Service 日志没有确立根因。证据：本机总目录 `tasks/results/runtime-c-windows-ui/results.json`。
- 菜园 4.0.8 与游戏 0.37.0 的已审界面实现和 Linux VM 走查，记录见[农场界面验收](art/farm-ui-redraw.md)。
- **目录迁移**：11 项目录核验通过，8 棵 Git 工作树 HEAD 与脏文件 SHA 保留。活动 PR #12 物理路径保留，`worktrees/pr12-source` 为兼容入口。执行明细与核验结果见本机总目录 `tasks/results/directory-migration/execution-20261015T034356.445314Z.jsonl`、`tasks/results/directory-migration/root-verification.json`。

更早的已完成工作、历史分阶段结果与原始待办见[归档路线图](archive/ROADMAP-2026-10-15-before-runtime-cleanup.md)及 [CHANGELOG](../CHANGELOG.md)。
