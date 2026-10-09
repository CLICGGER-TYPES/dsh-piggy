// @ts-check
/**
 * 日常玩法：签到 7 天、在线礼包、宠物日记的数值与文案。
 *
 * 数值以 docs/numbers/B5-daily.md（用户 2026-10-01 确认）为准 —— 不要随手改，
 * 觉得不合理就写进任务卡等人拍板。零逻辑、零 IO（见 docs/CONVENTIONS.md）。
 *
 * @module dsh-piggy/data/daily
 */

/**
 * 一签的奖励：金币和/或物品。物品按 `key` 进背包，key 对不上货架也照发
 * （B3 的药可能还没上架）。
 * @typedef {object} DailyReward
 * @property {number} coins
 * @property {ReadonlyArray<{ key: string, count: number }>} items
 */

/** @param {number} coins @param {Array<[string, number]>} [items] @returns {DailyReward} */
const reward = (coins, items = []) => Object.freeze({ coins, items: Object.freeze(items.map(([key, count]) => Object.freeze({ key, count }))) })
/**
 * 7 天签到礼包（G1，用户 2026-10-05 确认，见 docs/numbers/G1-signin-7.md），价值由低到高，
 * 第 7 天大礼含还魂丹。领完第 7 天回到第 1 天；断签不清零。
 * @type {ReadonlyArray<DailyReward>}
 */
export const SIGN_IN_REWARDS = Object.freeze([
  reward(0, [['apple', 3], ['soap', 2]]),
  reward(100),
  reward(0, [['rice', 2], ['plush', 1]]),
  reward(0, [['banlangen', 1], ['xiaoshipian', 1], ['pipa-syrup', 1], ['bubble', 2]]),
  reward(200, [['skewer', 2]]),
  reward(0, [['baicaodan', 1]]),
  reward(0, [['soul', 1], ['feast', 2]]),
])

export const SIGN_IN_CYCLE = SIGN_IN_REWARDS.length

/**
 * 在线礼包：只算真实时间，不受调试页的时间倍率影响。
 * 「在线」= 面板在轮询，两次轮询间隔不超过 `pollGapMaxMs`。
 */
export const ONLINE_GIFT = Object.freeze({
  /** 每在线满这么久给一个。 */
  perGiftMs: 60 * 60 * 1000,
  /** 每天最多几个（06:00 刷新）。 */
  perDay: 8,
  /** 没领的最多攒几个，攒满就不再给。 */
  unclaimedMax: 3,
  /** 两次轮询间隔超过这个值，中间那段不算在线。 */
  pollGapMaxMs: 30 * 1000,
})

/**
 * 礼包内容概率表：每个礼包从下表抽一项。
 * `kind` + `maxPrice` 从货架上现取（B3/B4 上架新物品后自动进池子），
 * `keys` 是点名要的固定几样。
 * @type {ReadonlyArray<{ chance: number, kind?: string, kinds?: ReadonlyArray<string>, maxPrice?: number,
 *   coins?: ReadonlyArray<number>, keys?: ReadonlyArray<string> }>}
 */
export const GIFT_TABLE = Object.freeze([
  Object.freeze({ chance: 0.40, kind: 'food', maxPrice: 40 }),
  Object.freeze({ chance: 0.25, kinds: Object.freeze(['bath', 'toy']), maxPrice: 60 }),
  Object.freeze({ chance: 0.20, coins: Object.freeze([30, 80]) }),
  Object.freeze({ chance: 0.10, kind: 'medicine', maxPrice: 30 }),
  Object.freeze({ chance: 0.04, keys: Object.freeze(['feast', 'carousel', 'bubbles']) }),
  Object.freeze({ chance: 0.01, keys: Object.freeze(['baicaodan']) }),
])

/**
 * 盲盒券（用户 2026-10-05：签到和在线礼包偶尔送盲盒）。盲盒是下载的扩展，
 * 所以只有装了、开着盲盒的猪才会掉券；券在盲盒里能免费开一个。
 */
export const BOX_TICKET = Object.freeze({ key: 'boxticket', label: '盲盒券', emoji: '🎟', extension: 'blindbox' })
export const BOX_TICKET_CHANCE = Object.freeze({ signIn: 0.15, gift: 0.12 })

/** 日记最多留几篇，更早的删掉。 */
export const DIARY_MAX = 60
