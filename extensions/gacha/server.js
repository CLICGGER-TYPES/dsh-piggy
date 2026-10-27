// @ts-check
// 扭蛋扩展 1.2；数值见 docs/numbers/X2-gacha.md。1.2（游戏 0.35.0）：机器里加进商店新上的食物、洗浴和玩具。
// 扭蛋没有自己的币：它不存任何值钱的东西（一抽直接花金币、东西直接进背包），开钱包只会让一抽多收 5% 手续费。
// 扩展只保存自己的幸运值和记录；金币、背包和说话都经宿主 api。

const item = (key, label, emoji, count = 1) => ({ key, label, emoji, count })

export const POOLS = {
  snack: {
    label: '零食机', emoji: '🍬',
    normal: [item('apple', '苹果', '🍎'), item('bread', '面包', '🍞'), item('strawberry', '草莓', '🍓'), item('fish', '小鱼干', '🐟'), item('sweetpotato', '烤红薯', '🍠'), item('bone', '肉骨头', '🍖'),
      item('onigiri', '饭团', '🍙'), item('baozi', '包子', '🧆'), item('corn', '玉米棒', '🌽'), item('jianbing', '煎饼果子', '🫓')],
    rare: [item('rice', '蛋炒饭', '🍚'), item('pumpkin', '南瓜粥', '🎃'), item('cake', '奶油蛋糕', '🎂'), item('skewer', '烤肉串', '🍢'), item('noodle', '大碗拉面', '🍜'),
      item('dumplings', '饺子', '🥟'), item('burger', '汉堡', '🍔'), item('pizza', '披萨', '🍕'), item('fruitplate', '水果拼盘', '🍉')],
    gold: [item('feast', '豪华大餐', '🍱', 3), item('seafoodrice', '海鲜饭', '🥘', 3), item('feast', '豪华大餐', '🍱', 5),
      item('hotpot', '火锅', '🍲', 3), item('sushi', '寿司拼盘', '🍣', 3), item('birthdaycake', '生日蛋糕', '🎂', 2)],
  },
  goods: {
    label: '杂货机', emoji: '🧸',
    normal: [item('soap', '香皂', '🧼'), item('shower', '冲个澡', '🚿'), item('shampoo', '沐浴露', '🧴'), item('balloon', '气球', '🎈'), item('candle', '香薰', '🕯'), item('bait_worm', '蚯蚓鱼饵', '🪱'),
      item('scrubber', '搓澡巾', '🧽'), item('hairwash', '洗发水', '🪮'), item('yarnball', '毛线球', '🧶')],
    rare: [item('bubble', '泡泡浴', '🛁'), item('yoyo', '悠悠球', '🪀'), item('citrusbath', '柚子浴', '🍊'), item('blocks', '积木', '🎲'), item('frisbee', '飞盘', '🥏'), item('bait_shrimp', '鲜虾鱼饵', '🦐'),
      item('mintbath', '薄荷澡', '🌿'), item('marbles', '弹珠', '🔮'), item('duckbath', '小黄鸭浴', '🐤')],
    gold: [item('trampoline', '蹦床', '🤸'), item('carousel', '旋转木马', '🎠'), item('bubbles', '泡泡机', '🫧'), item('deadsea', '死海泥', '🫧', 2), item('bait_glow', '夜光鱼饵', '✨', 5),
      item('toytrain', '小火车', '🚂'), item('castleblocks', '城堡积木', '🏰'), item('forestbath', '森林浴', '🌲', 2)],
  },
  medicine: {
    label: '药箱', emoji: '💊',
    normal: [item('banlangen', '板蓝根', '🌿'), item('pipa-syrup', '枇杷糖浆', '🍯'), item('xiaoshipian', '消食片', '💊'), item('qingliangyou', '清凉油', '🟢'), item('runfulu', '润肤露', '🧴')],
    rare: [item('tuishaoyao', '退烧药', '💊'), item('gancaoji', '甘草剂', '🌾'), item('lanse-xiaoyan', '蓝色消炎水', '🧪'), item('zhitongpian', '止痛片', '💊'), item('bohe-you', '薄荷油', '🍃')],
    gold: [item('baicaodan', '百草丹', '🌿'), item('soul', '还魂丹', '✨')],
  },
}

/** 本地日期从 06:00 开始。Date 的本地字段跟着宿主时区走。 */
export function gameDay(now) {
  const date = new Date(now)
  date.setHours(date.getHours() - 6)
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
}

function normalize(data) {
  if (!Number.isInteger(data.luck) || data.luck < 0) data.luck = 0
  if (!Number.isInteger(data.seq) || data.seq < 0) data.seq = 0
  if (!Array.isArray(data.history)) data.history = []
  if (typeof data.freeDay !== 'string') data.freeDay = ''
  return data
}

function choose(pool, random) {
  const r = Math.max(0, Math.min(0.999999999, Number(random()) || 0))
  return pool[Math.floor(r * pool.length)]
}

function roll(data, machine, random) {
  const r = Math.max(0, Math.min(0.999999999, Number(random()) || 0))
  const rarity = data.luck >= 20 || r < 0.03 ? 'gold' : r < 0.20 ? 'rare' : 'normal'
  data.luck = rarity === 'gold' ? 0 : data.luck + 1
  const picked = choose(POOLS[machine][rarity], random)
  const count = rarity === 'normal' ? (machine === 'medicine' ? 1 : 3) : rarity === 'rare' ? (machine === 'medicine' ? 1 : 2) : picked.count
  return { key: picked.key, label: picked.label, emoji: picked.emoji, count, rarity }
}


/** The old 30-entry history is a lower bound, never an invented lifetime total. */
function milestones(data) {
  const saved = data.milestones !== null && typeof data.milestones === 'object' && !Array.isArray(data.milestones) ? data.milestones : {}
  const history = (Array.isArray(data.history) ? data.history : []).filter(got =>
    got !== null && typeof got === 'object' && Number.isSafeInteger(got.count) && got.count > 0 && Object.values(POOLS).some(pool => pool[got.rarity]?.some(item => item.key === got.key)))
  const counter = value => Number.isSafeInteger(value) && value >= 0 ? value : 0
  const machines = Array.isArray(saved.machines) ? saved.machines.filter(key => Object.hasOwn(POOLS, key)) : []
  if (Object.hasOwn(POOLS, data.last?.machine) && Array.isArray(data.last?.items) && data.last.items.some(got => got !== null && typeof got === 'object' && Number.isSafeInteger(got.count) && got.count > 0 && POOLS[data.last.machine][got.rarity]?.some(item => item.key === got.key))) machines.push(data.last.machine)
  return { spins: Math.max(counter(saved.spins), history.length), gold: Math.max(counter(saved.gold), history.filter(item => item.rarity === 'gold').length), machines: [...new Set(machines)] }
}

export function progress(data) {
  const saved = milestones(data)
  return [{ name: 'spin', total: saved.spins }, { name: 'machine', items: saved.machines }, { name: 'gold', total: saved.gold }]
}

function reportProgress(data, api) {
  if (typeof api.emit !== 'function') return
  for (const { name, ...payload } of progress(data)) api.emit(name, payload)
}

// #14 外部桌宠合并钩子：扭蛋没有自己的币，只有运气值、记录和里程碑。
// 运气/序号取高，记录按新旧拼起来留最近 30 条，里程碑两边累计相加；没有版本号的数据只提示认不出的字段。
const MERGE_FIELDS = ['luck', 'seq', 'history', 'last', 'freeDay', 'milestones']
const SAFE = Number.MAX_SAFE_INTEGER
const RARITIES = ['normal', 'rare', 'gold']
/** 存档里的 key 会拼进新对象：`__proto__` 这类名字一律不收。 */
const safeKey = key => key !== '__proto__' && key !== 'constructor' && key !== 'prototype'

function forMerge(data, side) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('扭蛋数据（' + side + '）不是对象，无法合并')
  return normalize(structuredClone(data))
}

/** 只留下游戏里真出得来的记录（机器里确实有这个稀有度的这个东西）。 */
function cleanGot(got) {
  if (got === null || typeof got !== 'object' || !RARITIES.includes(got.rarity)) return null
  const amount = Math.floor(Number(got.count))
  if (typeof got.key !== 'string' || !Number.isSafeInteger(amount) || amount <= 0) return null
  if (!Object.values(POOLS).some(pool => (pool[got.rarity] ?? []).some(entry => entry.key === got.key))) return null
  return { key: got.key, label: String(got.label ?? ''), emoji: String(got.emoji ?? ''), count: amount, rarity: got.rarity }
}

function cleanList(list) {
  return (Array.isArray(list) ? list : []).map(cleanGot).filter(item => item !== null)
}

function cleanLast(last) {
  if (last === null || typeof last !== 'object' || !Object.hasOwn(POOLS, last.machine)) return null
  const items = cleanList(last.items)
  if (items.length === 0) return null
  const id = Math.floor(Number(last.id))
  return { id: Number.isSafeInteger(id) && id > 0 ? id : 0, machine: last.machine, items }
}

/** 免费那一抽按天记：今天任一边抽过，合并后今天就不再免费；否则留较晚的那天。 */
function mergeFreeDay(a, b, today) {
  const looksLikeDay = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  if (a === today || b === today) return today
  if (looksLikeDay(a) && looksLikeDay(b)) return a > b ? a : b
  return looksLikeDay(a) ? a : looksLikeDay(b) ? b : ''
}

function mergeStates(target, source, now = Date.now()) {
  const t = forMerge(target, '桌宠'), s = forMerge(source, '内嵌猪')
  const history = [...cleanList(t.history), ...cleanList(s.history)].slice(0, 30)
  const lastT = cleanLast(t.last), lastS = cleanLast(s.last)
  const last = lastS !== null && (lastT === null || lastS.id > lastT.id) ? lastS : lastT
  // 老数据没有 milestones（第一次抽卡时才补），先按记录和历史推出来再相加。
  const tMilestones = milestones(t), sMilestones = milestones(s)
  const data = {
    luck: Math.min(SAFE, Math.max(t.luck, s.luck)),
    seq: Math.max(t.seq, s.seq, last?.id ?? 0),
    history,
    last,
    freeDay: mergeFreeDay(t.freeDay, s.freeDay, gameDay(now)),
    milestones: {
      spins: Math.min(SAFE, tMilestones.spins + sMilestones.spins),
      gold: Math.min(SAFE, tMilestones.gold + sMilestones.gold),
      machines: [...new Set([...tMilestones.machines, ...sMilestones.machines])].filter(key => Object.hasOwn(POOLS, key)),
    },
  }
  for (const key of Object.keys(t)) if (!MERGE_FIELDS.includes(key) && safeKey(key)) data[key] = t[key]
  const unknown = Object.keys(s).filter(key => !MERGE_FIELDS.includes(key))
  const warnings = unknown.length > 0 ? ['扭蛋：内嵌猪有当前版本不认识的字段（' + unknown.slice(0, 6).join('、') + '），没有合并'] : []
  // 记录和里程碑保持自洽：两边累计相加，但也不能少于历史里看得见的次数。
  data.milestones = milestones(data)
  normalize(data)
  return { data, warnings, conflicts: [] }
}

export default {
  eventVersion: 1,
  progress,
  mergeStates,
  init() { return { luck: 0, freeDay: '', history: [], last: null, seq: 0 } },

  actions: {
    spin(data, payload, api, random = Math.random) {
      if (!Object.hasOwn(POOLS, payload.machine)) return { ok: false, reason: 'unknown-machine' }
      if (payload.count !== 1 && payload.count !== 10) return { ok: false, reason: 'unknown-count' }
      normalize(data)
      data.milestones = milestones(data)
      const day = gameDay(api.now)
      const free = payload.count === 1 && data.freeDay !== day
      if (!free && !api.spend(payload.count === 10 ? 540 : 60)) return { ok: false, reason: 'poor' }
      if (free) data.freeDay = day
      const items = []
      for (let i = 0; i < payload.count; i += 1) {
        const got = roll(data, payload.machine, random)
        if (!api.give(got.key, got.count)) throw new Error('物品不存在：' + got.key)
        items.push(got)
      }
      data.milestones.spins = Math.min(Number.MAX_SAFE_INTEGER, data.milestones.spins + items.length)
      data.milestones.gold = Math.min(Number.MAX_SAFE_INTEGER, data.milestones.gold + items.filter(item => item.rarity === 'gold').length)
      data.milestones.machines = [...new Set([...data.milestones.machines, payload.machine])]
      data.seq += 1
      data.last = { id: data.seq, machine: payload.machine, items }
      data.history = items.concat(data.history).slice(0, 30)
      reportProgress(data, api)
      const best = items.find(got => got.rarity === 'gold')
      api.say(best ? '金色的！！是' + best.label + '！' : items.length === 1 ? '又是' + items[0].label + '……' : '十颗扭蛋都放进背包啦！')
      return { ok: true }
    },
  },

  view(data, api) {
    const d = normalize(structuredClone(data))
    return {
      machines: Object.entries(POOLS).map(([key, pool]) => ({ key, label: pool.label, emoji: pool.emoji })),
      coins: api.coins(), prices: { one: 60, ten: 540 }, free: d.freeDay !== gameDay(api.now),
      luck: d.luck, pityLeft: Math.max(0, 20 - d.luck), last: d.last, history: d.history,
    }
  },
}
