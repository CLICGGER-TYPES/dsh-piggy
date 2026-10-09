// @ts-check
/**
 * 商店、装扮与照护物品 —— 静态数值表（零逻辑、零 IO，见 docs/CONVENTIONS.md）。
 * @module dsh-piggy/data/shop
 */

import { MEDICINES, REVIVE_ITEM } from './illness.js'

/** @type {ShopItem} */
export const DEFAULT_TOY = Object.freeze({
  key: 'ball', label: '小皮球', emoji: '🎾', price: 0, kind: 'toy',
  happiness: 12, satiety: -3, default: true,
})

/**
 * One shelf entry. Everything past `kind` is optional: food carries satiety,
 * medicine carries a tier (and 百草丹 `cureAll`), 装扮 carries a slot and a level gate.
 *
 * @typedef {object} ShopItem
 * @property {string} key
 * @property {string} label
 * @property {string} emoji
 * @property {number} price
 * @property {string} kind
 * @property {number} [satiety]
 * @property {number} [happiness]
 * @property {number} [cleanliness]
 * @property {number} [health]
 * @property {number} [level]
 * @property {boolean} [default]
 * @property {boolean} [needed]
 * @property {string} [slot]
 * @property {number} [tier]
 * @property {boolean} [cureAll]
 * @property {string} [form]   契约类道具：签下它换成哪个形态（data/evolution.js 的 key）
 * @property {string} [useLabel] 背包中的操作文字
 * @property {string} [blurb]
 * @property {number} [rarityBoost] 鱼饵提升少见、稀有、传说鱼权重的倍率
 */
/**
 * 装扮的等级门槛按 B2 的 60 级曲线重排（2026-10-01）：Lv10 约 5 天、Lv20 约 20 天、
 * Lv40 约 2.7 个月、Lv50 约 4 个月 —— 翅膀是养了小半年的猪才穿得上的。
 * @type {ReadonlyArray<ShopItem>}
 */
export const SHOP = Object.freeze([
  // --- food ---------------------------------------------------------------
  Object.freeze({ key: 'apple', label: '苹果', emoji: '🍎', price: 6, kind: 'food', satiety: 22, happiness: 3 }),
  Object.freeze({ key: 'bread', label: '面包', emoji: '🍞', price: 10, kind: 'food', satiety: 32, happiness: 4 }),
  Object.freeze({ key: 'bone', label: '肉骨头', emoji: '🍖', price: 15, kind: 'food', satiety: 45, happiness: 8 }),
  Object.freeze({ key: 'rice', label: '蛋炒饭', emoji: '🍚', price: 24, kind: 'food', satiety: 58, happiness: 10 }),
  Object.freeze({ key: 'cake', label: '奶油蛋糕', emoji: '🎂', price: 40, kind: 'food', satiety: 80, happiness: 18 }),
  Object.freeze({ key: 'noodle', label: '大碗拉面', emoji: '🍜', price: 66, kind: 'food', satiety: 100, happiness: 26 }),
  Object.freeze({ key: 'fish', label: '小鱼干', emoji: '🐟', price: 12, kind: 'food', satiety: 30, happiness: 7 }),
  Object.freeze({ key: 'pumpkin', label: '南瓜粥', emoji: '🎃', price: 34, kind: 'food', satiety: 62, happiness: 13 }),
  Object.freeze({ key: 'skewer', label: '烤肉串', emoji: '🍢', price: 58, kind: 'food', satiety: 76, happiness: 21 }),
  Object.freeze({ key: 'feast', label: '豪华大餐', emoji: '🍱', price: 130, kind: 'food', satiety: 100, happiness: 34 }),
  Object.freeze({ key: 'strawberry', label: '草莓', emoji: '🍓', price: 9, kind: 'food', satiety: 18, happiness: 8 }),
  Object.freeze({ key: 'sweetpotato', label: '烤红薯', emoji: '🍠', price: 19, kind: 'food', satiety: 42, happiness: 9 }),
  Object.freeze({ key: 'seafoodrice', label: '海鲜饭', emoji: '🥘', price: 76, kind: 'food', satiety: 88, happiness: 27 }),
  // --- fishing bait: one consumed for every cast or auto attempt -----------
  Object.freeze({ key: 'bait_worm', label: '蚯蚓鱼饵', emoji: '🪱', price: 5, kind: 'bait', rarityBoost: 0 }),
  Object.freeze({ key: 'bait_shrimp', label: '鲜虾鱼饵', emoji: '🦐', price: 8, kind: 'bait', rarityBoost: 0.6 }),
  Object.freeze({ key: 'bait_glow', label: '夜光鱼饵', emoji: '✨', price: 18, kind: 'bait', rarityBoost: 1.5 }),
  // --- bath ---------------------------------------------------------------
  Object.freeze({ key: 'soap', label: '香皂', emoji: '🧼', price: 6, kind: 'bath', cleanliness: 35, happiness: 2 }),
  Object.freeze({ key: 'shower', label: '冲个澡', emoji: '🚿', price: 10, kind: 'bath', cleanliness: 50, happiness: 3 }),
  Object.freeze({ key: 'shampoo', label: '沐浴露', emoji: '🧴', price: 14, kind: 'bath', cleanliness: 65, happiness: 6 }),
  Object.freeze({ key: 'bubble', label: '泡泡浴', emoji: '🛁', price: 28, kind: 'bath', cleanliness: 100, happiness: 14 }),
  Object.freeze({ key: 'sauna', label: '泡温泉', emoji: '🧖', price: 58, kind: 'bath', cleanliness: 100, happiness: 24, satiety: -4 }),
  Object.freeze({ key: 'candle', label: '香薰', emoji: '🕯', price: 22, kind: 'bath', cleanliness: 58, happiness: 13 }),
  Object.freeze({ key: 'milkbath', label: '牛奶浴', emoji: '🥛', price: 44, kind: 'bath', cleanliness: 85, happiness: 19 }),
  Object.freeze({ key: 'deadsea', label: '死海泥', emoji: '🫧', price: 78, kind: 'bath', cleanliness: 100, happiness: 27, satiety: -3 }),
  Object.freeze({ key: 'citrusbath', label: '柚子浴', emoji: '🍊', price: 32, kind: 'bath', cleanliness: 76, happiness: 15 }),
  Object.freeze({ key: 'flowerbath', label: '花瓣浴', emoji: '🌸', price: 64, kind: 'bath', cleanliness: 100, happiness: 25 }),
  // --- toys ---------------------------------------------------------------
  Object.freeze({ key: 'yoyo', label: '悠悠球', emoji: '🪀', price: 30, kind: 'toy', happiness: 22, satiety: -4 }),
  Object.freeze({ key: 'blocks', label: '积木', emoji: '🎲', price: 45, kind: 'toy', happiness: 30, satiety: -5 }),
  Object.freeze({ key: 'plush', label: '布偶', emoji: '🧸', price: 75, kind: 'toy', happiness: 42, satiety: -7 }),
  Object.freeze({ key: 'scooter', label: '滑板车', emoji: '🛴', price: 120, kind: 'toy', happiness: 58, satiety: -10, cleanliness: -3 }),
  Object.freeze({ key: 'carousel', label: '旋转木马', emoji: '🎠', price: 260, kind: 'toy', happiness: 80, satiety: -12, cleanliness: -4 }),
  Object.freeze({ key: 'balloon', label: '气球', emoji: '🎈', price: 22, kind: 'toy', happiness: 24, satiety: -3 }),
  Object.freeze({ key: 'puzzle', label: '拼图', emoji: '🧩', price: 60, kind: 'toy', happiness: 34, satiety: -5 }),
  Object.freeze({ key: 'kite', label: '风筝', emoji: '🪁', price: 95, kind: 'toy', happiness: 48, satiety: -7 }),
  Object.freeze({ key: 'rccar', label: '遥控车', emoji: '🏎', price: 180, kind: 'toy', happiness: 62, satiety: -9, cleanliness: -3 }),
  Object.freeze({ key: 'bubbles', label: '泡泡机', emoji: '🫧', price: 220, kind: 'toy', happiness: 74, satiety: -10, cleanliness: -4 }),
  Object.freeze({ key: 'frisbee', label: '飞盘', emoji: '🥏', price: 55, kind: 'toy', happiness: 32, satiety: -6 }),
  Object.freeze({ key: 'drum', label: '小鼓', emoji: '🥁', price: 110, kind: 'toy', happiness: 50, satiety: -7 }),
  Object.freeze({ key: 'trampoline', label: '蹦床', emoji: '🤸', price: 320, kind: 'toy', happiness: 86, satiety: -14, cleanliness: -4 }),
  // --- dress (家当) --------------------------------------------------------
  // Not consumables: buy once, own forever, wear them. Each one needs a level,
  // which is what ties 装扮 to the level axis instead of to the wallet.
  // `slot` is a fixed anchor on the pig (see DRESS_SLOTS); one item per slot,
  // so the artwork can be swapped in later without touching the logic.
  Object.freeze({ key: 'scarf', label: '红围巾', emoji: '🧣', price: 80, kind: 'dress', level: 1, slot: 'neck', blurb: '脖子上暖乎乎的' }),
  Object.freeze({ key: 'strawhat', label: '草帽', emoji: '👒', price: 150, kind: 'dress', level: 3, slot: 'head', blurb: '遮阳，也遮心虚' }),
  Object.freeze({ key: 'sunglasses', label: '墨镜', emoji: '🕶', price: 260, kind: 'dress', level: 5, slot: 'face', blurb: '谁也不知道它在想什么' }),
  Object.freeze({ key: 'overalls', label: '背带裤', emoji: '👖', price: 420, kind: 'dress', level: 8, slot: 'body', blurb: '干体力活穿的' }),
  Object.freeze({ key: 'bowtie', label: '领结', emoji: '🎀', price: 600, kind: 'dress', level: 10, slot: 'neck', blurb: '上班用' }),
  Object.freeze({ key: 'rainboots', label: '雨靴', emoji: '🥾', price: 900, kind: 'dress', level: 13, slot: 'feet', blurb: '踩水坑专用' }),
  Object.freeze({ key: 'cape', label: '披风', emoji: '🦸', price: 1300, kind: 'dress', level: 16, slot: 'back', blurb: '风一吹就飘起来' }),
  Object.freeze({ key: 'flowercrown', label: '花环', emoji: '💐', price: 1800, kind: 'dress', level: 20, slot: 'head', blurb: '春天做的' }),
  Object.freeze({ key: 'tophat', label: '礼帽', emoji: '🎩', price: 2600, kind: 'dress', level: 25, slot: 'head', blurb: '正式场合' }),
  Object.freeze({ key: 'necklace', label: '项链', emoji: '📿', price: 3600, kind: 'dress', level: 30, slot: 'neck', blurb: '据说是祖传的' }),
  Object.freeze({ key: 'wings', label: '翅膀', emoji: '🪽', price: 8000, kind: 'dress', level: 50, slot: 'back', blurb: '能不能飞，谁也没见它飞过' }),
  Object.freeze({ key: 'hairclip', label: '樱桃发夹', emoji: '🍒', price: 240, kind: 'dress', level: 5, slot: 'head', blurb: '小小的樱桃，刚好别在耳边' }),
  Object.freeze({ key: 'vest', label: '毛线背心', emoji: '🧶', price: 720, kind: 'dress', level: 12, slot: 'body', blurb: '一针一线织出来的暖和' }),
  // --- medicine: the twenty stage cures and 百草丹 (data/illness.js) ------
  ...MEDICINES,
  // --- revive -------------------------------------------------------------
  REVIVE_ITEM,
  // --- promotion -----------------------------------------------------------
  Object.freeze({
    key: 'crown', label: '王冠', emoji: '👑', price: 3000, kind: 'promotion', form: 'king',
    useLabel: '加冕', blurb: '戴上变成猪猪王',
  }),
  Object.freeze({
    key: 'contract', label: '恶魔契约', emoji: '😈', price: 6666, kind: 'promotion', form: 'devil',
    useLabel: '签约', blurb: '签下变成恶魔猪',
  }),
])

/** Shop shelves, in the order the panel shows them. */
export const KIND_ORDER = Object.freeze(['food', 'bath', 'toy', 'bait', 'dress', 'medicine', 'revive', 'promotion'])

export const KIND_LABEL = Object.freeze({
  food: '食物',
  bath: '洗浴',
  toy: '玩具',
  bait: '鱼饵',
  dress: '装扮',
  medicine: '药品',
  revive: '复活',
  promotion: '晋升',
})

/** Which care action spends which shelf. */
export const CARE_KIND = Object.freeze({ feed: 'food', bathe: 'bath', play: 'toy' })

/**
 * 装扮点位 —— 猪身上固定的几个锚点。
 *
 * 每个点位同时只挂一件；以后换成真正的立绘时，只需要改 client.js 里
 * `.dp-slot[data-slot="…"]` 的偏移，逻辑和存档都不用动。
 */
export const DRESS_SLOTS = Object.freeze([
  Object.freeze({ key: 'head', label: '头' }),
  Object.freeze({ key: 'face', label: '脸' }),
  Object.freeze({ key: 'neck', label: '脖子' }),
  Object.freeze({ key: 'body', label: '身子' }),
  Object.freeze({ key: 'back', label: '背后' }),
  Object.freeze({ key: 'feet', label: '脚' }),
])

export const dressSlotByKey = key => DRESS_SLOTS.find(entry => entry.key === key) ?? null

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

export const itemByKey = key => SHOP.find(item => item.key === key) ?? null

export const itemsOfKind = kind => SHOP.filter(item => item.kind === kind)

/** Every item a care action will accept: the shelf, plus the free default toy. */
export function careItems(kind) {
  const bought = itemsOfKind(kind)
  return kind === 'toy' ? [DEFAULT_TOY, ...bought] : bought
}
