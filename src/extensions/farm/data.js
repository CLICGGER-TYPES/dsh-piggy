// @ts-check
// 菜园 4.0 的静态数值表：地块、价格、作物、工具、肥料、灾害、生长阶段和第一课。
// 这里只放常量，规则在 pure.js / plot-rules.js / helper.js，组装在 server.js。
/** 地：一共 18 块，开局 6 块熟地。 */
export const PLOTS = 18
export const START_PLOTS = 6
/** 每开垦一块荒地（原版 10000 元宝）。 */
export const RECLAIM_PRICE = 10000
/** 原版 InstallFace：每样灾害平均 4 小时来一次；每样灾害收获时少 2 个；产量浮动 −3～+2。 */
export const PEST_MS = 4 * 3600000
export const PEST_LOSS = 2
/** 照料一次（浇水、除草、杀虫）的经验。 */
export const CARE_EXP = 2
/** 升下一级要「当前等级 × 100」经验；EXP_CAP 是坏存档（1e308 / Infinity）的经验上限，正常玩到不了。 */
export const EXP_PER_LEVEL = 100, EXP_CAP = Number.MAX_SAFE_INTEGER
/** 「玩会累」：种、收、照料一块地扣多少饱食（data/economy.js 的建议值）。 */
export const EXERT = 0.2
/** 第一课（用户 2026-10-24 定）：每档存档一次，课内 1 颗种子、3 分钟熟，浇一次最早 2 分钟；12 菜币 + 1 颗小葱种子、0 经验。 */
export const LESSON = { reward: 12, seed: 'scallion', ripeMs: 180000, wateredMs: 120000 }
export const HOUR_MS = 3600000
/**
 * 作物：原版 20 种照 Crop.xml / seed.xml，后 9 种是菜园原有的，按原版规律定（设计稿 3.5）。
 * level 解锁等级；price 种子价；hours 成熟时间；exp 每次收获经验；yield 基础产量；sell 单价；seasons 收几季。
 */
export const CROPS = [
  { key: 'radish', emoji: '🥕', label: '白萝卜', level: 1, price: 80, hours: 14, exp: 10, yield: 24, sell: 18, seasons: 1 },
  { key: 'apple', emoji: '🍎', label: '苹果', level: 1, price: 75, hours: 20, exp: 12, yield: 24, sell: 18, seasons: 1 },
  { key: 'grape', emoji: '🍇', label: '葡萄', level: 1, price: 70, hours: 17, exp: 11, yield: 24, sell: 18, seasons: 1 },
  { key: 'carrot', emoji: '🥕', label: '胡萝卜', level: 2, price: 90, hours: 16, exp: 12, yield: 25, sell: 20, seasons: 1 },
  { key: 'peach', emoji: '🍑', label: '桃子', level: 2, price: 85, hours: 16, exp: 14, yield: 25, sell: 20, seasons: 1 },
  { key: 'watermelon', emoji: '🍉', label: '西瓜', level: 2, price: 90, hours: 19, exp: 15, yield: 25, sell: 20, seasons: 1 },
  { key: 'potato', emoji: '🥔', label: '土豆', level: 3, price: 120, hours: 17, exp: 14, yield: 22, sell: 22, seasons: 1 },
  { key: 'chili', emoji: '🌶️', label: '辣椒', level: 3, price: 110, hours: 16, exp: 16, yield: 22, sell: 22, seasons: 1 },
  { key: 'banana', emoji: '🍌', label: '香蕉', level: 3, price: 95, hours: 20, exp: 18, yield: 22, sell: 22, seasons: 1 },
  { key: 'tomato', emoji: '🍅', label: '西红柿', level: 4, price: 110, hours: 18, exp: 18, yield: 26, sell: 24, seasons: 1 },
  { key: 'eggplant', emoji: '🍆', label: '茄子', level: 4, price: 120, hours: 20, exp: 20, yield: 26, sell: 24, seasons: 1 },
  { key: 'pea', emoji: '🫛', label: '豌豆', level: 4, price: 120, hours: 20, exp: 20, yield: 26, sell: 24, seasons: 1 },
  { key: 'pineapple', emoji: '🍍', label: '菠萝', level: 4, price: 110, hours: 28, exp: 18, yield: 26, sell: 24, seasons: 1 },
  { key: 'corn', emoji: '🌽', label: '玉米', level: 5, price: 105, hours: 19, exp: 22, yield: 20, sell: 28, seasons: 1 },
  { key: 'pomelo', emoji: '🍈', label: '柚子', level: 5, price: 120, hours: 22, exp: 32, yield: 20, sell: 28, seasons: 2 },
  { key: 'strawberry', emoji: '🍓', label: '草莓', level: 6, price: 130, hours: 24, exp: 26, yield: 24, sell: 18, seasons: 1, food: 'strawberry', foodLabel: '草莓' },
  { key: 'pumpkin', emoji: '🎃', label: '南瓜', level: 7, price: 300, hours: 22, exp: 28, yield: 28, sell: 30, seasons: 2, food: 'pumpkin', foodLabel: '南瓜粥' },
  { key: 'orange', emoji: '🍊', label: '橘子', level: 7, price: 160, hours: 24, exp: 26, yield: 28, sell: 30, seasons: 2 },
  { key: 'pomegranate', emoji: '🍎', label: '石榴', level: 8, price: 170, hours: 27, exp: 20, yield: 30, sell: 32, seasons: 3 },
  { key: 'coconut', emoji: '🥥', label: '椰子', level: 9, price: 190, hours: 30, exp: 28, yield: 30, sell: 35, seasons: 3 },
  { key: 'scallion', emoji: '🧅', label: '小葱', level: 1, price: 70, hours: 14, exp: 10, yield: 24, sell: 18, seasons: 1 },
  { key: 'sprout', emoji: '🌱', label: '豆芽', level: 1, price: 75, hours: 15, exp: 10, yield: 25, sell: 18, seasons: 1 },
  { key: 'coriander', emoji: '🌿', label: '香菜', level: 2, price: 85, hours: 16, exp: 12, yield: 24, sell: 20, seasons: 1 },
  { key: 'lettuce', emoji: '🥗', label: '生菜', level: 2, price: 90, hours: 17, exp: 13, yield: 25, sell: 20, seasons: 1 },
  { key: 'cabbage', emoji: '🥬', label: '小白菜', level: 3, price: 100, hours: 18, exp: 15, yield: 24, sell: 22, seasons: 1 },
  { key: 'blueberry', emoji: '🫐', label: '蓝莓', level: 5, price: 140, hours: 22, exp: 22, yield: 26, sell: 26, seasons: 1 },
  { key: 'sweetpotato', emoji: '🍠', label: '红薯', level: 6, price: 150, hours: 24, exp: 24, yield: 26, sell: 28, seasons: 1, food: 'sweetpotato', foodLabel: '烤红薯' },
  { key: 'sunflower', emoji: '🌻', label: '向日葵', level: 7, price: 170, hours: 26, exp: 26, yield: 28, sell: 30, seasons: 1 },
  { key: 'melon', emoji: '🍈', label: '哈密瓜', level: 9, price: 200, hours: 30, exp: 28, yield: 30, sell: 34, seasons: 1 },
]
/** 解锁一键操作的工具（先买才有，用户定 C）。 */
export const TOOLS = [{ key: 'sickle', label: '收割镰', price: 1000, note: '解锁一键收获' }, { key: 'sprayer', label: '喷雾桶', price: 600, note: '解锁一键照料' }, { key: 'rake', label: '平地耙', price: 800, note: '解锁一键铲除' }, { key: 'planter', label: '播种器', price: 1800, note: '解锁一键播种' }]
/** 肥料（原版 props.xml）：施一次多长几小时，可以连着施。 */
export const FERTILIZERS = [{ key: 'fert-1', label: '普通肥料', price: 500, hours: 2 }, { key: 'fert-2', label: '快速肥料', price: 800, hours: 3.5 }, { key: 'fert-3', label: '急速肥料', price: 1000, hours: 5 }]
/** 灾害：长草、生虫、干旱，各自独立。 */
export const PESTS = ['weed', 'bug', 'dry']
/** 生长阶段（按这一季走过的比例）：种子、发芽、小苗、长大、开花、成熟。多季作物收完回到「长大」。 */
export const STAGES = ['seed', 'sprout', 'seedling', 'growing', 'flowering', 'ripe']
export const STAGE_AT = [0, 1 / 6, 2 / 6, 3 / 6, 4 / 6, 1]
export const REGROW_AT = 3 / 6
/** 3.x 存档的旧数据，迁移时用：旧产量（算历史收获次数）、旧洒水器和旧肥料按原价退成菜币。 */
export const OLD_YIELD = { sprout: 2, scallion: 3, coriander: 3, lettuce: 3, cabbage: 3, strawberry: 3, blueberry: 4, carrot: 4, sweetpotato: 3, tomato: 4, corn: 5, pumpkin: 2, sunflower: 3, watermelon: 2, grape: 3, melon: 2 }
export const OLD_SPRINKLER = 3000, OLD_FERTILIZER = 20
export const OLD_HELPER_BARN_PRICES = [0, 1000, 3000, 9000] // 3.0.0 卖过的农具档单价：迁移时按买到的档位 1..barn 累计退菜币
