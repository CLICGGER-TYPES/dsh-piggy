// @ts-check
/**
 * 经济体系的规则表（设计：docs/design/economy.md；数字：docs/numbers/J1-economy.md）。
 *
 * 只有一种通用货币：金币。所有加减都走 core/economy.js 的 earnCoins / spendCoins / refundCoins，
 * 按来源记账；扩展的来源一律记在 `ext.<扩展名>.` 下，删掉扩展也不影响别的账。
 * @module dsh-piggy/data/economy
 */

/** 三条收入线的时薪区间（净收入，金币/小时）。模拟脚本和测试按它检查。 */
export const INCOME_LINES = Object.freeze({
  /** 主动线：人在玩（钓鱼、挖矿、种地、小游戏）。起步区间和工具满级区间。 */
  active: Object.freeze({ start: Object.freeze([300, 600]), max: Object.freeze([1500, 2500]) }),
  /** 挂机线：猪自己去（打工），沿用职业表。 */
  idle: Object.freeze({ start: Object.freeze([60, 120]), max: Object.freeze([800, 1200]) }),
  /** 奖励线：签到、礼包、番茄钟、成就，占总收入的比例。 */
  reward: Object.freeze({ share: Object.freeze([0.05, 0.10]) }),
})

/** 产出物（鱼、矿、作物等）按稀有度的售价档。 */
export const SELL_TIERS = Object.freeze({
  common: Object.freeze([5, 30]),
  uncommon: Object.freeze([40, 120]),
  rare: Object.freeze([150, 400]),
  legend: Object.freeze([500, 1500]),
})

/** 消耗品按效果点定价：普通档 / 高档每点几金币。 */
export const POINT_PRICE = Object.freeze({ basic: Object.freeze([0.25, 0.35]), premium: Object.freeze([0.5, 0.8]) })

/** 工具升级：每级价格约是上一级的几倍。 */
export const TOOL_STEP = Object.freeze([2.5, 3])

/** 账本的大小上限：存档不会被撑大。 */
export const LEDGER = Object.freeze({
  /** 按天记的留几天。 */
  days: 7,
  /** 总账里最多记多少个来源；超出的并进 `other`。 */
  maxSources: 200,
  /** 每个扩展最多用多少个来源名。 */
  maxSourcesPerExtension: 16,
})

/** 扩展一次动作最多能加多少金币（防止写错的扩展把经济冲垮；菜园整仓出售按 10 万一笔分开加，远在这之下）。 */
export const EXT_EARN_PER_ACTION = 1_000_000

/**
 * 扩展币和金币的兑换（规则 1）：汇率是「1 个扩展币值多少金币」，宿主只认这个区间；
 * 扩展币换成金币按汇率不收费，用金币换扩展币多收 5%，来回倒腾会亏。一次最多换这么多个。
 */
export const EXCHANGE = Object.freeze({ minRate: 0.01, maxRate: 100, buyFee: 0.05, maxAmount: 10_000_000 })

/** 游戏本身的收支来源名 → 中文（调试页「经济」用）。扩展的来源显示成「扩展名 · 来源」。 */
export const SOURCE_LABELS = Object.freeze({
  work: '打工', 'sell.fish': '卖鱼', 'sell.souvenir': '卖纪念品', daily: '签到和礼包', pomodoro: '番茄钟',
  shop: '商店', dress: '装扮', school: '学费', interest: '兴趣班', trip: '旅行', doctor: '看医生',
  dev: '调试', other: '其他',
})
