// @ts-check
/**
 * 鱼、钓点、鱼竿、手感（C5 鱼表 + 钓鱼 2.0，数值见 docs/numbers/J1-economy.md 第 4 节）。
 * Times are local clock periods: early/noon/evening/night. 每条鱼住在一个钓点（spot）。
 */

import { FISH_ART } from './fish-art.js'

const fish = (key, label, emoji, spot, rarity, times, behavior, difficulty, minCm, maxCm, price) =>
  Object.freeze({ key, label, emoji, art: FISH_ART[key] ?? '', spot, rarity, times: Object.freeze(times), behavior, difficulty, minCm, maxCm, price })
const ALL_DAY = ['early', 'noon', 'evening', 'night']

export const FISH = Object.freeze([
  // C5 的 15 种（价格、时段、手感都不改，只按水域分到钓点）
  fish('fish_crucian', '鲫鱼', '🐟', 'river', 'common', ['early', 'noon', 'evening'], 'smooth', 12, 12, 32, 8),
  fish('fish_carp', '鲤鱼', '🐟', 'river', 'common', ['noon', 'evening'], 'smooth', 18, 20, 55, 12),
  fish('fish_sardine', '沙丁鱼', '🐟', 'sea', 'common', ['early', 'noon'], 'dash', 22, 10, 26, 14),
  fish('fish_anchovy', '鳀鱼', '🐟', 'sea', 'common', ['early', 'evening'], 'dash', 25, 8, 22, 16),
  fish('fish_perch', '河鲈', '🐠', 'river', 'common', ['noon', 'evening'], 'sink', 28, 16, 38, 18),
  fish('fish_bream', '鳊鱼', '🐟', 'river', 'common', ['early', 'noon'], 'rise', 30, 18, 42, 20),
  fish('fish_catfish', '鲶鱼', '🐡', 'river', 'common', ['evening', 'night'], 'sink', 34, 24, 68, 24),
  fish('fish_mackerel', '青花鱼', '🐟', 'sea', 'common', ['noon', 'evening'], 'mixed', 38, 22, 48, 28),
  fish('fish_salmon', '鲑鱼', '🐟', 'river', 'uncommon', ['early', 'evening'], 'dash', 48, 38, 92, 48),
  fish('fish_puffer', '河豚', '🐡', 'sea', 'uncommon', ['noon'], 'mixed', 55, 18, 40, 62),
  fish('fish_eel', '鳗鱼', '🐍', 'river', 'uncommon', ['evening', 'night'], 'rise', 61, 42, 110, 78),
  fish('fish_tuna', '金枪鱼', '🐟', 'sea', 'uncommon', ['early', 'noon'], 'dash', 66, 70, 180, 96),
  fish('fish_sturgeon', '鲟鱼', '🐟', 'river', 'rare', ['night'], 'sink', 78, 85, 220, 160),
  fish('fish_koi', '黄金锦鲤', '🎏', 'river', 'rare', ['early', 'evening'], 'mixed', 86, 30, 88, 220),
  fish('fish_moon', '月影鱼', '🌙', 'night', 'legend', ['night'], 'mixed', 100, 60, 160, 300),
  // 钓鱼 2.0 新加的 25 种
  fish('fish_loach', '泥鳅', '🐟', 'river', 'common', ALL_DAY, 'smooth', 8, 8, 20, 6),
  fish('fish_crayfish', '小龙虾', '🦞', 'river', 'common', ['noon', 'evening', 'night'], 'sink', 14, 8, 15, 10),
  fish('fish_ricefield_eel', '黄鳝', '🐍', 'river', 'uncommon', ['evening', 'night'], 'rise', 45, 25, 70, 40),
  fish('fish_goldfish', '金鱼', '🐠', 'lake', 'common', ['early', 'noon'], 'smooth', 10, 5, 15, 6),
  fish('fish_grass_carp', '草鱼', '🐟', 'lake', 'common', ['early', 'noon', 'evening'], 'smooth', 20, 30, 90, 10),
  fish('fish_silver_carp', '鲢鱼', '🐟', 'lake', 'common', ['noon', 'evening'], 'rise', 24, 30, 80, 12),
  fish('fish_icefish', '银鱼', '🐟', 'lake', 'common', ['early', 'evening'], 'dash', 26, 5, 12, 14),
  fish('fish_trout', '虹鳟', '🐟', 'lake', 'uncommon', ['early', 'evening'], 'dash', 44, 30, 70, 40),
  fish('fish_crab', '大闸蟹', '🦀', 'lake', 'uncommon', ['evening', 'night'], 'sink', 48, 8, 15, 45),
  fish('fish_mandarin', '鳜鱼', '🐟', 'lake', 'uncommon', ['evening', 'night'], 'mixed', 54, 25, 60, 50),
  fish('fish_pike', '狗鱼', '🐟', 'lake', 'uncommon', ['noon', 'evening'], 'dash', 62, 40, 120, 60),
  fish('fish_paddlefish', '白鲟', '🐟', 'lake', 'rare', ['night'], 'sink', 82, 100, 300, 200),
  fish('fish_lake_shadow', '湖中巨影', '🌑', 'lake', 'legend', ['night'], 'mixed', 98, 200, 500, 600),
  fish('fish_ribbonfish', '带鱼', '🐟', 'sea', 'common', ['evening', 'night'], 'rise', 30, 50, 120, 16),
  fish('fish_croaker', '黄花鱼', '🐟', 'sea', 'common', ['early', 'noon'], 'smooth', 32, 20, 45, 18),
  fish('fish_flounder', '比目鱼', '🐟', 'sea', 'uncommon', ['noon', 'evening'], 'sink', 46, 25, 60, 50),
  fish('fish_octopus', '章鱼', '🐙', 'sea', 'uncommon', ['evening', 'night'], 'mixed', 58, 30, 90, 60),
  fish('fish_swordfish', '旗鱼', '🐟', 'sea', 'rare', ['noon'], 'dash', 84, 150, 300, 220),
  fish('fish_whale_shark', '小鲸鲨', '🦈', 'sea', 'legend', ['early', 'noon'], 'smooth', 95, 300, 600, 700),
  fish('fish_firefly', '萤光鱼', '✨', 'night', 'common', ['night'], 'dash', 28, 5, 15, 10),
  fish('fish_lantern', '灯笼鱼', '🏮', 'night', 'common', ['night'], 'rise', 34, 6, 18, 12),
  fish('fish_ghost', '幽灵鱼', '👻', 'night', 'uncommon', ['night'], 'mixed', 60, 20, 50, 55),
  fish('fish_star_ray', '星斑鳐', '⭐', 'night', 'rare', ['night'], 'sink', 80, 60, 150, 160),
  fish('fish_arowana', '龙鱼', '🐉', 'night', 'rare', ['night'], 'dash', 88, 60, 120, 200),
  fish('fish_night_whale', '夜之鲸', '🐋', 'night', 'legend', ['night'], 'mixed', 100, 400, 900, 600),

  // --- 100 种扩充：四个钓点各 25 种；新鱼先 emoji，插画后续分批补 ---
  // 小河
  fish('fish_white_stripe', '白条', '🐟', 'river', 'common', ['early', 'noon', 'evening'], 'dash', 15, 8, 24, 10),
  fish('fish_moroko', '麦穗鱼', '🐟', 'river', 'common', ['early', 'noon'], 'smooth', 10, 5, 15, 9),
  fish('fish_bitterling', '鳑鲏', '🐠', 'river', 'common', ['noon', 'evening'], 'smooth', 12, 5, 12, 11),
  fish('fish_opsariichthys', '马口鱼', '🐟', 'river', 'common', ['early', 'noon', 'evening'], 'dash', 20, 10, 28, 12),
  fish('fish_yellow_catfish', '黄颡鱼', '🐟', 'river', 'common', ['evening', 'night'], 'sink', 26, 12, 30, 15),
  fish('fish_snakehead', '黑鱼', '🐟', 'river', 'uncommon', ['noon', 'evening', 'night'], 'mixed', 50, 30, 70, 45),
  fish('fish_yellowcheek', '鳡鱼', '🐟', 'river', 'uncommon', ['early', 'noon'], 'dash', 58, 50, 120, 55),
  fish('fish_topmouth_culter', '翘嘴鲌', '🐟', 'river', 'uncommon', ['early', 'evening'], 'rise', 46, 30, 80, 48),
  fish('fish_tilapia', '罗非鱼', '🐟', 'river', 'uncommon', ['noon', 'evening'], 'smooth', 42, 20, 45, 40),
  fish('fish_mud_carp', '鲮鱼', '🐟', 'river', 'uncommon', ['noon', 'evening', 'night'], 'sink', 44, 20, 50, 42),
  fish('fish_chinese_sucker', '胭脂鱼', '🐠', 'river', 'rare', ['evening', 'night'], 'mixed', 72, 40, 100, 170),
  fish('fish_ochetobius', '鳤鱼', '🐟', 'river', 'rare', ['early', 'evening'], 'dash', 76, 60, 150, 190),
  fish('fish_river_spirit', '河神鱼', '🌊', 'river', 'legend', ['night'], 'mixed', 92, 80, 200, 320),
  // 湖
  fish('fish_black_carp', '青鱼', '🐟', 'lake', 'common', ['early', 'noon', 'evening'], 'smooth', 24, 40, 100, 18),
  fish('fish_bighead_carp', '鳙鱼', '🐟', 'lake', 'common', ['early', 'noon'], 'smooth', 22, 35, 90, 16),
  fish('fish_wuchang_bream', '武昌鱼', '🐟', 'lake', 'common', ['noon', 'evening'], 'smooth', 18, 20, 50, 14),
  fish('fish_silver_crucian', '银鲫', '🐟', 'lake', 'common', ['early', 'noon', 'evening'], 'smooth', 14, 10, 30, 12),
  fish('fish_walking_catfish', '塘鲺', '🐟', 'lake', 'common', ['evening', 'night'], 'sink', 28, 15, 40, 19),
  fish('fish_sunfish', '太阳鱼', '🐠', 'lake', 'common', ['noon', 'evening'], 'smooth', 16, 8, 20, 13),
  fish('fish_sharpbelly', '餐条', '🐟', 'lake', 'common', ['early', 'noon'], 'dash', 12, 6, 18, 11),
  fish('fish_lake_bass', '鲈鱼', '🐟', 'lake', 'uncommon', ['noon', 'evening', 'night'], 'mixed', 48, 25, 60, 46),
  fish('fish_longsnout_catfish', '鮰鱼', '🐟', 'lake', 'uncommon', ['evening', 'night'], 'sink', 52, 30, 80, 50),
  fish('fish_zander', '梭鲈', '🐟', 'lake', 'uncommon', ['early', 'evening'], 'dash', 58, 40, 90, 56),
  fish('fish_tench', '丁鱥', '🐟', 'lake', 'uncommon', ['noon', 'evening'], 'sink', 44, 20, 50, 42),
  fish('fish_kaluga', '鳇鱼', '🐟', 'lake', 'rare', ['night'], 'sink', 80, 100, 300, 210),
  fish('fish_arapaima', '巨骨舌鱼', '🐟', 'lake', 'rare', ['noon', 'evening'], 'mixed', 82, 120, 300, 220),
  fish('fish_golden_barbel', '金线鲃', '🐠', 'lake', 'rare', ['night'], 'smooth', 74, 30, 80, 180),
  fish('fish_lake_moon', '湖心月', '🌕', 'lake', 'legend', ['night'], 'mixed', 96, 100, 400, 480),
  // 海边
  fish('fish_pomfret', '鲳鱼', '🐟', 'sea', 'common', ['early', 'noon'], 'smooth', 18, 15, 40, 15),
  fish('fish_seabream', '鲷鱼', '🐠', 'sea', 'common', ['noon', 'evening'], 'smooth', 20, 15, 45, 18),
  fish('fish_sea_bass', '海鲈', '🐟', 'sea', 'common', ['early', 'evening'], 'mixed', 24, 20, 60, 20),
  fish('fish_cod', '鳕鱼', '🐟', 'sea', 'common', ['noon', 'evening', 'night'], 'sink', 26, 30, 80, 23),
  fish('fish_herring', '鲱鱼', '🐟', 'sea', 'common', ['early', 'noon'], 'dash', 16, 10, 30, 13),
  fish('fish_mullet', '鲻鱼', '🐟', 'sea', 'common', ['noon', 'evening'], 'smooth', 22, 20, 50, 15),
  fish('fish_sea_crucian', '海鲫', '🐟', 'sea', 'common', ['early', 'noon'], 'smooth', 14, 10, 25, 11),
  fish('fish_grouper', '石斑鱼', '🐟', 'sea', 'uncommon', ['noon', 'evening', 'night'], 'sink', 52, 30, 90, 56),
  fish('fish_lionfish', '狮子鱼', '🐠', 'sea', 'uncommon', ['evening', 'night'], 'mixed', 60, 20, 40, 60),
  fish('fish_conger', '海鳗', '🐍', 'sea', 'uncommon', ['evening', 'night'], 'rise', 50, 50, 120, 52),
  fish('fish_blue_marlin', '蓝枪鱼', '🐟', 'sea', 'rare', ['noon'], 'dash', 86, 150, 350, 210),
  fish('fish_tiger_shark', '虎鲨', '🦈', 'sea', 'rare', ['noon', 'evening'], 'mixed', 84, 100, 300, 200),
  fish('fish_manta', '魔鬼鱼', '🐟', 'sea', 'rare', ['early', 'noon'], 'sink', 78, 100, 250, 190),
  fish('fish_ocean_whale', '海神鲸', '🐋', 'sea', 'legend', ['early', 'noon'], 'mixed', 98, 300, 900, 650),
  // 夜潭
  fish('fish_sleepwalker', '梦游鱼', '🐟', 'night', 'common', ['night'], 'smooth', 20, 8, 20, 10),
  fish('fish_stardust', '星尘鱼', '✨', 'night', 'common', ['night'], 'dash', 25, 5, 15, 12),
  fish('fish_crescent', '月牙鱼', '🌙', 'night', 'common', ['night'], 'smooth', 18, 6, 18, 10),
  fish('fish_night_curl', '夜光小卷', '🐟', 'night', 'common', ['night'], 'rise', 22, 5, 12, 9),
  fish('fish_black_current', '黑潮鱼', '🐟', 'night', 'common', ['night'], 'sink', 30, 10, 30, 15),
  fish('fish_silver_moon', '银月鱼', '🐟', 'night', 'common', ['night'], 'dash', 26, 8, 24, 12),
  fish('fish_dark_reef', '暗礁鱼', '🐟', 'night', 'common', ['night'], 'mixed', 28, 10, 28, 13),
  fish('fish_starfin', '星鳍鱼', '🐠', 'night', 'common', ['night'], 'smooth', 24, 8, 20, 11),
  fish('fish_ghost_shark', '幽灵鲨', '🦈', 'night', 'uncommon', ['night'], 'mixed', 58, 30, 80, 55),
  fish('fish_night_butterfly', '夜光蝶鱼', '🐠', 'night', 'uncommon', ['night'], 'rise', 46, 15, 40, 48),
  fish('fish_abyss', '深渊鱼', '🐟', 'night', 'uncommon', ['night'], 'sink', 62, 40, 100, 60),
  fish('fish_aurora', '极光鱼', '🌌', 'night', 'uncommon', ['night'], 'dash', 54, 20, 60, 52),
  fish('fish_phantom', '幻影鱼', '👻', 'night', 'uncommon', ['night'], 'mixed', 56, 25, 70, 54),
  fish('fish_galaxy', '星河鱼', '✨', 'night', 'uncommon', ['night'], 'smooth', 50, 20, 50, 50),
  fish('fish_nightmare', '梦魇鱼', '🌑', 'night', 'rare', ['night'], 'mixed', 84, 50, 150, 190),
  fish('fish_night_sky', '夜空鱼', '🌌', 'night', 'rare', ['night'], 'rise', 80, 60, 180, 200),
  fish('fish_moon_arowana', '月光龙鱼', '🐉', 'night', 'rare', ['night'], 'dash', 86, 60, 140, 210),
  fish('fish_abyss_king', '深渊王鱼', '🐋', 'night', 'legend', ['night'], 'mixed', 99, 200, 600, 620),
])

/**
 * 鱼咬钩后的搏斗玩法（G 批次，用户 2026-10-05：三种都要，每次随机一种）：
 * ring 圆盘点击、bar 竖条拉锯、pull 拉力收线。
 */
export const FISH_FIGHTS = Object.freeze(['ring', 'bar', 'pull'])

export const fishByKey = key => FISH.find(entry => entry.key === key) ?? null

/** 钓点：开了才能去；夜潭只在晚上开。 */
export const FISH_SPOTS = Object.freeze([
  Object.freeze({ key: 'river', label: '小河', emoji: '🏞', price: 0, times: null }),
  Object.freeze({ key: 'lake', label: '湖', emoji: '🏕', price: 1500, times: null }),
  Object.freeze({ key: 'sea', label: '海边', emoji: '🏖', price: 4000, times: null }),
  Object.freeze({ key: 'night', label: '夜潭', emoji: '🌌', price: 9000, times: Object.freeze(['night']) }),
])
export const fishSpotByKey = key => FISH_SPOTS.find(spot => spot.key === key) ?? null

/**
 * 鱼竿（用户 2026-10-09：根据鱼竿优化手感）。bite 咬钩等多久（毫秒），difficulty 搏斗难度乘数，
 * 用户 2026-10-10：等咬钩要快，收入靠后面的搏斗难度压，不靠拖长等待——所以等待短、难度乘数都在 1 以上。
 * rare 稀有 / 传说鱼的权重乘数，zone 搏斗时绿区宽度乘数，hold 拉力玩法的耐拉乘数。
 */
export const RODS = Object.freeze([
  Object.freeze({ level: 1, key: 'bamboo', label: '竹竿', emoji: '🎋', price: 0, bite: Object.freeze([3000, 8000]), difficulty: 1.6, rare: 0.8, zone: 0.9, hold: 0.9 }),
  Object.freeze({ level: 2, key: 'carbon', label: '碳素竿', emoji: '🎣', price: 800, bite: Object.freeze([2500, 6500]), difficulty: 1.4, rare: 1, zone: 1, hold: 1 }),
  Object.freeze({ level: 3, key: 'pro', label: '专业竿', emoji: '🪝', price: 2500, bite: Object.freeze([2000, 5000]), difficulty: 1.25, rare: 1.3, zone: 1.12, hold: 1.1 }),
  Object.freeze({ level: 4, key: 'legend', label: '传说竿', emoji: '🔱', price: 7000, bite: Object.freeze([1500, 4000]), difficulty: 1.1, rare: 1.5, zone: 1.25, hold: 1.2 }),
])
export const rodByLevel = level => RODS.find(rod => rod.level === level) ?? RODS[0]

/**
 * 手感（用户 2026-10-09：根据鱼的种类优化手感和速度区间）。每种游法一个速度区间，按鱼的难度在区间里取值：
 * - smooth 平稳：慢、匀，适合新手；
 * - dash 冲刺：平时不快，时不时猛冲一下（burst 是每帧冲的概率，burstScale 冲多快）；
 * - sink / rise 下沉 / 上浮：一直往一个方向拽（drift，像素/秒）；
 * - mixed 多变：快慢不定、方向乱变（jitter）。
 */
export const FISH_FEEL = Object.freeze({
  smooth: Object.freeze({ speed: Object.freeze([0.6, 0.95]), burst: 0, burstScale: 1, drift: 0, jitter: 0 }),
  dash: Object.freeze({ speed: Object.freeze([0.75, 1.2]), burst: 0.025, burstScale: 5, drift: 0, jitter: 0.1 }),
  sink: Object.freeze({ speed: Object.freeze([0.8, 1.1]), burst: 0.006, burstScale: 3, drift: -26, jitter: 0.05 }),
  rise: Object.freeze({ speed: Object.freeze([0.8, 1.1]), burst: 0.006, burstScale: 3, drift: 26, jitter: 0.05 }),
  mixed: Object.freeze({ speed: Object.freeze([0.85, 1.45]), burst: 0.018, burstScale: 4, drift: 0, jitter: 0.35 }),
})
