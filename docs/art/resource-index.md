# 生产资源索引与出处

日期：2026-10-28。基线：`7628d86219c242eb5f37e7443a8f497587100f1b`。状态：静态源码整理候选，未运行、未部署、未改动任何资源字节。

机器可读样例：[production-index.json](production-index.json)（8 条代表性记录，不是完整台账）。结构定义：[production-index.schema.json](production-index.schema.json)。审图工具说明：[tools/art-review/README.md](../../tools/art-review/README.md)。

## 这份索引是什么

把仓库内已有的素材清单、出处记录和实际文件 SHA256 对齐，为代表性生产资源建立稳定 ID、版本、角色、来源和输出散列；全量 manifest 的覆盖计数和核对结果单独列出。它是制作侧/文档侧样例，不是完整台账，不是运行时资源，也不进入游戏包。

- 只读取 `assets/pigs/manifest.json`、`assets/fishing/manifest.json`、两个动画 manifest、`docs/art/pig-inventory.csv`、`packages/pet-core/src/data/art-assets.js`、`packages/pet-core/src/data/art-revisions.js` 和实际文件。
- 不复制原稿、不重算图片、不改 `assets/` 下任何字节。
- 不把个人原始绝对路径、逐字提示词原文或未批准资源写进索引；`source.promptRef` 只放仓库内相对路径，钓鱼 manifest 里的原始绝对路径和 prompt 正文不进入索引。

## 这份索引不是什么

- **不是批准记录。** 当前索引里 `approved` 为 0 条。
- 未勾选的审图复选框只表示“没有选中问题”，不是批准。
- 历史反馈 `active=false` 只表示该反馈对应旧版本，不等于问题已解决。
- `docs/art/pig-inventory.csv` 的 `integrated; user reviewed` 只记录“用户看过并已接入”，不是绑定散列的批准。
- 版本字符串里出现 `user-approved-batch1` 也只是来源标签；只有 `reviewDecision.status=approved` 才是批准声明。

## 审核语义

| 值 | 含义 | 当前条数 |
|---|---|---:|
| `approved` | 有明确记录，同时绑定 `assetId + revision + outputSha256` | 0 |
| `user-directed` | 用户明确要求过某次具体变更/选用（如去腮红、9% 压缩接入、采用用户原 GIF），但不是整张素材的批准 | 5 |
| `reviewed` | 制作清单记录“用户看过并已接入”，没有绑定散列的批准记录 | 179 |
| `pending` | 制作清单明确写“等待审阅” | 1 |
| `not-recorded` | 没有可核对的审核记录 | 7 |

`reviewDecision.approval` 只有 `approved` 才为 `true`。发布/打包不能读取 `reviewed`、`user-directed` 或 `pending` 当批准。

## 稳定 ID 与字段

| 字段 | 说明 |
|---|---|
| `assetId` | `pigs:<manifest.key>`、`fishing:<manifest.name>`、`animation:<name>` |
| `path` | 仓库内相对路径，例如 `assets/pigs/base/piglet/idle.png` |
| `revision` | 猪取 manifest `version`，动画取 manifest `revision`；钓鱼没有版本字段，用 `null`，以 `outputSha256` 作为字节身份 |
| `revisionBasis` | 版本字段来源；钓鱼为 `sha256-only` |
| `role` | 猪：`category/actor/action`；钓鱼：`name/usage`；动画：`name/runtimeLoaded` |
| `source` | 工具、仓库内提示词相对路径、参考标识或 manifest 引用；不含原始绝对路径和 prompt 正文 |
| `provenance` | 对应 `PROVENANCE.md` 的仓库内路径 |
| `outputSha256` | 实际文件字节的 SHA256，已逐个核对 |
| `bytes` | 实际文件字节数 |
| `reviewDecision` | 上面的审核语义；`evidence` 指向仓库内可核对记录 |
| `supersedes` | 仅在有直接前序散列时记录；没有证据就为 `null`，不编造版本链 |

猪的稳定 ID 与运行时 art key 对齐：183/183 个 `pigs:<key>` 能在 `art-assets.js` 找到同名 key 和同一路径；183/183 个 `outputSha256` 的前 12 位与 `art-revisions.js` 一致。因此索引不是另起一套命名。

## 覆盖范围

manifest 覆盖 192 条资源；提交的 `production-index.json` 只保留 8 条代表性样例，避免把大型生成台账当成人工审阅过的清单：

- 183 张猪 PNG（`assets/pigs/base|forms|skins|feedback|badges`）；
- 7 张钓鱼 PNG（4 个钓点、浮漂、搏斗、鲫鱼结果）；
- 2 个动画图集（`pet-hand` 运行使用；`piglet-pet` 历史参考，运行不加载）。

`animation:piglet-pet` 的出处边界：该条历史 manifest 记录的原始 GIF 是仓库外的研究资料，在固定基线仓库中不存在，无法按仓库路径解析；索引因此只链接仓库内现有的 `assets/animations/piglet-pet/manifest.json` 和 `assets/animations/piglet-pet/PROVENANCE.md`，不提供也不声称存在可访问的原稿。索引移除不可解析的可选 `sourceRef` 只是字段清理，不改变该资源既有审核状态，也不表示任何新的批准。

样例覆盖：3 条去腮红幼年猪（含 review 绑定与 `supersedes`）、1 条 `pending` 猪动作、1 条 `reviewed` 徽章、1 条钓鱼场景、2 个动画图集。其余资源仍由 manifest 与实际文件散列支持；需要全量核对时按同一算法重新生成，不把 192 条都提交成台账。

已核对：

- 猪 manifest 183/183 条路径与文件 SHA256 一致；
- 钓鱼 7/7 条 `export_sha256` 与实际文件一致；
- 动画 2/2 个文件散列与 manifest 一致；
- art key 183/183、revision 前缀 183/183 一致。

不在本索引范围：字体 `piggy-emoji.woff2`、历史 `ui-*.svg`、桌面图标/托盘、扩展美术包（各自有 manifest）、`docs/art/reviews` 下的历史审图图、仓库外的原稿和未批准候选。它们需要各自的出处记录，不能拿本索引冒充全覆盖。

## 历史批准清单的边界

`docs/art/reviews/no-outline/manifest.json` 有 181 条 `user-approved` 记录，key 与当前 181 张猪图重叠，但**输出散列 0/181 与当前文件一致**。它批准的是旧的无描边版本，不是当前文件；不能把它当作当前资源的批准，也不能据此推断“已批准所以可以改字节”。

同样，用户批准的素材字节在本任务中视为不可变；索引只登记现有字节，不重新导出、不替换、不“顺手优化”。

## 审图记录到生产 ID 的映射

审图服务的 ID 是 `actor/scene`（例如 `gardener/idle`），`registry.json` 里的 `sha256` 是当轮 `working_original` 的散列，不等于生产输出散列。只有两边字节一致时才建立映射。

2026-10-28 只读核对现有审图登记，107 条记录中有 3 条与当前生产文件字节一致：

| 审图 ID | 生产 assetId | 当前 outputSha256 | 审核状态 |
|---|---|---|---|
| `piglet-no-blush/idle` | `pigs:piglet` | `7543c26400e0e94f52e1139858db688fd47f5fa30e2e37a330be449bc273a957` | 无勾选；不是批准 |
| `piglet-no-blush/blink` | `pigs:piglet-blink` | `8d487ac28119c441d084993a0b00cd971febd65f3a82afc7d541134424374858` | 无勾选；不是批准 |
| `piglet-no-blush/shy-pet` | `pigs:piglet-shy-pet` | `d20a491df29b361ebb532a1792c45472f5783df09934efdc1374637b5f255a4e` | 无勾选；不是批准 |

其余 104 条审图登记（含桌面图标/托盘的两条去腮红记录）没有和当前生产文件散列对上，不建立映射，也不按文件名猜。要补全映射，需要在发布时保留 `delivery-manifest.json` 的 `character/scene → original/export/sha256` 关系，并在每轮发布后只读核对 `registry.json` 的散列；对不上就归为旧版本历史。

## 发布器与索引的关系

- `publish.py` 写 `registry.json` 时使用 `id = character/scene`、`sha256 = 原稿散列`、`working_original = 原稿路径`；它不写生产索引，也不改 `structure-issues.json`。
- 生产索引的 `assetId` 是稳定命名空间，不与审图 ID 混用；两者只在字节一致时映射。
- 同一稿重复发布不会覆盖勾选/备注；换图后旧反馈保留，但 `active` 会变成 `false`，需要人工处理，不能自动结案。
- 任何“未勾选”“旧反馈 inactive”“文件夹叫 approved”都不产生批准。

## 生成与校验

索引由一次只读静态转换生成：读 manifest/CSV，重新计算实际文件 SHA256，校验全量 192 条的清单散列和 art key/版本前缀，然后只取 8 条代表性样例写 `production-index.json`，全量计数保留在 `coverage`。转换不执行产品代码、不启动服务、不跑测试、不改资源。

人工校验示例（只读）：

```sh
sha256sum assets/pigs/base/piglet/idle.png assets/fishing/scene-river.png
python3 -m json.tool docs/art/production-index.json > /dev/null
```

资源新增或批准状态变化后应重新生成索引；不要手工改 `outputSha256`，也不要在没有新证据时把 `reviewed` 改成 `approved`。

## T06 验收提示

T06 在 149 上用隔离目录启动审图服务（见工具 README），通过真实浏览器核对：

1. 审图页仍保留原有布局、复选框语义、`actor/scene` ID 和旧 URL（`index.html`、`comparison.html`、`designs.html` 等）。
2. 勾选/备注保存后刷新、重启仍存在；换图后旧反馈仍在 `previous_versions`；同一稿重复发布不清空备注。
3. 用上面的 3 条映射和紧凑索引样例（8 条）里的猪/钓鱼/动画记录，对照审图页/游戏 UI 中实际显示的资源，逐个核对 `outputSha256`；其余资源按 manifest 抽查。
4. 明确记录：未勾选不是批准；当前 `approved` 为 0；历史 no-outline 批准不覆盖当前散列。

本次源码整理没有运行上述步骤，也没有启动服务；T06 的浏览器证据才是运行时验收。
