// @ts-check
/**
 * dsh-piggy · data — the static game tables.
 *
 * Numbers and names only, no behaviour. The illness chains, thresholds, the
 * nine school subjects, the job/trip idea and the item categories are lifted
 * from QQ 宠物 (怀旧服 v1.2.4) as documented by xuemian168/qqpet_automation's
 * reverse engineering and the original asset tree:
 *
 *   img_res/study/  xx-* (小学) · dx-* (大学) · yjs-* (研究生)
 *                   art 美术 · chinese 语文 · labouring 劳动 · manner 礼仪 ·
 *                   mathematics 数学 · music 音乐 · pe 体育 · politics 政治 ·
 *                   wushu 武术
 *   img_res/work/   the job set
 *   img_res/food/   food art, one entry per dish
 *   img_res/commodity/  the sundries — bath things and toys
 *   models.py       ActiveOption { work, study, trip, ill, die }
 *                   PetInfo { growth, hunger, clean, health, mood, yb,
 *                             intel 智力, charm 魅力, strong 武力 }
 *                   StoreInventory { food, commodity, medicine, background }
 *
 * The last one is the reason care costs an item: the original keeps **food**,
 * **commodity** and **medicine** as separate inventory categories, and its own
 * heal path is "find the matching medicine in the bag → use it → recover".
 * Feeding, bathing and playing work the same way here.
 *
 * Attribute scale: QQ Pet counts in the thousands and its hunger ceiling grows
 * with level (3000 + 100 × min(level, 30)); this pig draws 0-100 bars instead,
 * with the QQ Pet thresholds rescaled:
 *   hunger 720/3100 ≈ 23%  → satiety < 25
 *   clean  1080/3100 ≈ 35% → cleanliness < 35
 *   mood   100/1000 = 10%  → happiness < 35 (a little kinder)
 *   health 5 → 5, unchanged — 0 is still death.
 *
 * @module dsh-piggy/data
 */

export * from './data/minutes.js'
export * from './data/traits.js'
export * from './data/illness.js'
export * from './data/life.js'
export * from './data/growth.js'
export * from './data/jobs.js'
export * from './data/school.js'
export * from './data/interests.js'
export * from './data/travel.js'
export * from './data/shop.js'
export * from './data/drops.js'
export * from './data/lines.js'
export * from './data/lines-more.js'
export * from './data/profile.js'
export * from './data/daily.js'
export * from './data/diary-book.js'
export * from './data/evolution.js'
export * from './data/pomodoro.js'
export * from './data/weight.js'
export * from './data/fish.js'
export * from './data/extensions.js'
export * from './data/skins.js'
export * from './data/economy.js'

export { ACHIEVEMENTS } from './data/achievements.js'

export { EXTENSION_EVENT_VERSION, EXTENSION_EVENT_LIMITS, EXTENSION_EVENTS } from './data/extension-events.js'
