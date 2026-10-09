// @ts-check
/**
 * 鱼、钓点、鱼竿、手感（C5 鱼表 + 钓鱼 2.0，数值见 docs/numbers/J1-economy.md 第 4 节）。
 * Times are local clock periods: early/noon/evening/night. 每条鱼住在一个钓点（spot）。
 */

const fish = (key, label, emoji, spot, rarity, times, behavior, difficulty, minCm, maxCm, price) =>
  Object.freeze({ key, label, emoji, spot, rarity, times: Object.freeze(times), behavior, difficulty, minCm, maxCm, price })
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
