// @ts-check
// 菜园 4.0：照 QQ 农场改版（设计见 docs/design/farm-qqfarm.md，用户 2026-10-12 定）。用自己的「菜币」，钱包在宿主（api.wallet）。
// 18 块地（开局 6 块，其余荒地 10000 开垦），作物按真实时间自己长；长的时候会长草、生虫、干旱，不管就减产；
// 收完留枯苗要铲掉；多季作物收完回到「长大」再长一季。等级照原版：升下一级要「等级 × 100」经验，种子按等级解锁。
// 一键收获 / 照料 / 铲除 / 播种要先买工具解锁（用户定 C）；帮工猪照旧可雇（D）。
// 随机的东西（产量浮动、灾害什么时候来）都在种下时就定好存进存档，view 只算不写，结果可复现。
//
// 源码拆在 src/extensions/farm/，下载协议仍然只有 manifest.json / server.js / client.js + assets；
// extensions/farm/server.js 由 scripts/build-farm-server.mjs 生成，不要手改。
import { actions } from './actions.js'
import { CROPS, START_PLOTS } from './data.js'
import { HELPER_PLOTS, HELPER_PRICES, HELPER_SHARE, HELPER_WINDOW, helperRecipe, settleHelper } from './helper.js'
import { payRefund } from './host.js'
import { mergeStates } from './merge.js'
import { newGround, normalize } from './migration.js'
import { amountFor } from './plot-rules.js'
import { view } from './view.js'

export { CARE_EXP, CROPS, EXP_CAP, EXP_PER_LEVEL, EXERT, FERTILIZERS, LESSON, OLD_HELPER_BARN_PRICES, PEST_LOSS, PEST_MS, PESTS, PLOTS, RECLAIM_PRICE, STAGES, START_PLOTS, TOOLS } from './data.js'
export { cropFor, levelOf, plotState, setRandom, weatherAt } from './pure.js'
export { normalize } from './migration.js'
export { HELPER_PLOTS, HELPER_PRICES, HELPER_SHARE, HELPER_WINDOW, helperRecipe, settleHelper } from './helper.js'

/** 历史收获次数按「收了一次」算，不按作物个数；旧存档也先 normalize 再统计。 */
export function progress(data) {
  const saved = normalize(structuredClone(data))
  const crops = CROPS.filter(crop => amountFor(saved, 'harvests', crop.key) > 0)
  return [{ name: 'harvest', total: crops.reduce((sum, crop) => Math.min(Number.MAX_SAFE_INTEGER, sum + amountFor(saved, 'harvests', crop.key)), 0), items: crops.map(crop => crop.key) }]
}

const game = {
  eventVersion: 1, progress,
  init() { return normalize({ version: 4, plots: Array.from({ length: START_PLOTS }, () => newGround()) }) },
  actions,
  view,
  // #14 外部桌宠合并：宿主只在目标端已安装且 manifest mergeHook >= 1 时调用。
  mergeStates,
}
// 所有动作走同一道入口：先迁移/补齐、付迁移退款、结算帮工，成功后再结算一次并报成就进度。
for (const [key, action] of Object.entries(game.actions)) {
  game.actions[key] = (data, payload, api) => {
    normalize(data)
    payRefund(data, api)
    settleHelper(data, api?.now)
    const result = action(data, payload, api)
    if (result.ok) {
      settleHelper(data, api?.now)
      if (typeof api?.emit === 'function') for (const { name, ...payload } of progress(data)) api.emit(name, payload)
    }
    return result
  }
}
export default game
