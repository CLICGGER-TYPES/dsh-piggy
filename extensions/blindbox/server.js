// @ts-check
// 盲盒扩展 2.1 · 宿主部分：照明日方舟寻访的规矩（用户 2026-10-05）。
// 设计 docs/design/blindbox.md，数值 docs/numbers/X1-blindbox.md。
// 只出摆件。星级 3★～6★；常驻寻访 + 限时寻访，每 14 天轮换 UP；50 抽后每抽 6★ +2%；
// 重复的加潜能（最多 6 潜）并给资质凭证，凭证在商店换东西。只能改自己的数据，别的都走 api。
// 3.0（游戏 0.35.0）：资质凭证放进宿主钱包（api.wallet，manifest 里 buyable: false，只能挣不能用金币买），
// 删掉盲盒时按 1 张 15 金币结清。data.certs 只剩「还没搬进钱包的」，每次动作开头搬走。

const PRICE_ONE = 300
const PRICE_TEN = 2700
const TICKET = 'boxticket'
const RATES = { 6: 0.02, 5: 0.08, 4: 0.50, 3: 0.40 }
const PITY_FROM = 50
const PITY_STEP = 0.02
const UP_SHARE = { standard: { 6: 0.5, 5: 0.5 }, limited: { 6: 0.7, 5: 0.5 } }
const CERTS = { 3: 1, 4: 5, 5: 15, 6: 40 }
const MAX_POTENTIAL = 6
const ROTATE_DAYS = 14
const START = Date.UTC(2026, 9, 5) // 2026-10-05，第一期
const DAY = 86_400_000

const fig = (key, emoji, label, stars, blurb) => ({ key, emoji, label, stars, blurb })

/** 全部摆件（1.0 的 21 个 key 原样保留）。 */
export const CATALOG = [
  fig('goldpig', '🐷', '金猪', 6, '农场里唯一一只没人敢吃的猪'),
  fig('whale', '🐳', '大鲸鱼', 6, '它打个喷嚏，整片海都下了一场雨'),
  fig('lantern', '🏮', '灯笼小摊', 6, '只在你最饿的那天晚上出现'),
  fig('unicorn', '🦄', '独角兽', 6, '头上的角其实是一根没吃完的甜筒'),
  fig('dragon', '🐉', '小龙', 6, '会喷火，主要用来烤红薯'),
  fig('moon', '🌕', '月亮', 6, '晚上替你看着猪，白天去睡觉'),
  fig('dolphin', '🐬', '海豚', 5, '据说会笑，其实是天生长这样'),
  fig('fox', '🦊', '狐狸', 5, '看起来很聪明，其实只是眼睛细'),
  fig('panda', '🐼', '熊猫', 5, '黑眼圈不是熬夜，是天生的'),
  fig('flamingo', '🦩', '火烈鸟', 5, '单脚站一整天，从来不喊累'),
  fig('peacock', '🦚', '孔雀', 5, '开屏只给喜欢的人看'),
  fig('koala', '🐨', '考拉', 5, '一天睡二十个小时，剩下四个小时在想睡觉'),
  fig('sushi', '🍣', '寿司台', 5, '转啊转，转到你面前就是缘分'),
  fig('carousel', '🎠', '旋转木马', 5, '永远在追前面那匹，永远追不上'),
  fig('cow', '🐄', '奶牛', 4, '慢慢嚼，慢慢想，什么都不急'),
  fig('dog', '🐕', '小狗', 4, '看家第一名，看饭盆也是第一名'),
  fig('octopus', '🐙', '章鱼', 4, '八只手，一次能拿八个零食'),
  fig('turtle', '🐢', '海龟', 4, '游了一百年，还是不着急'),
  fig('seal', '🦭', '海豹', 4, '在沙滩上晒成一条软软的面包'),
  fig('ramen', '🍜', '拉面', 4, '深夜十二点的热气是有魔法的'),
  fig('oden', '🍢', '关东煮', 4, '一串接一串，停不下来'),
  fig('dumpling', '🥟', '饺子', 4, '里面包了什么？不要问'),
  fig('hedgehog', '🦔', '刺猬', 4, '抱一下会疼，但它也想被抱'),
  fig('owl', '🦉', '猫头鹰', 4, '晚上不睡觉，白天装深沉'),
  fig('chick', '🐥', '小鸡', 3, '每天叫得比闹钟准，就是没有关闭按钮'),
  fig('duck', '🦆', '鸭子', 3, '走路一摇一摆，自信是天生的'),
  fig('rabbit', '🐇', '兔子', 3, '耳朵比胆子大'),
  fig('sheep', '🐑', '绵羊', 3, '数它的时候它也在数你'),
  fig('shell', '🐚', '贝壳', 3, '贴在耳边能听见大海，也能听见饭点'),
  fig('crab', '🦀', '螃蟹', 3, '横着走也能走得很远'),
  fig('onigiri', '🍙', '饭团', 3, '捏得圆圆的，像猪的脸'),
  fig('dango', '🍡', '团子', 3, '三个一串，刚好一人一个'),
  fig('tea', '🍵', '热茶', 3, '喝一口，今天就算结束了'),
  fig('mushroom', '🍄', '蘑菇', 3, '长得很可爱，但千万别吃'),
  fig('snail', '🐌', '蜗牛', 3, '慢一点没关系，家一直背在身上'),
  fig('cactus', '🌵', '仙人掌', 3, '不用浇水，也不用抱'),
]
const byKey = key => CATALOG.find(entry => entry.key === key) ?? null
const ofStars = stars => CATALOG.filter(entry => entry.stars === stars)

/** 限时寻访的主题，每 14 天轮一个。 */
export const THEMES = [
  { key: 'farm', emoji: '🌾', label: '农场好朋友', up6: 'goldpig', up5: ['fox', 'peacock'] },
  { key: 'beach', emoji: '🏖', label: '海边假日', up6: 'whale', up5: ['dolphin', 'flamingo'] },
  { key: 'night', emoji: '🌙', label: '深夜食堂', up6: 'lantern', up5: ['sushi', 'carousel'] },
]

/** 现在是第几期（从 0 起）和这一期还剩几天。 */
export function period(nowMs) {
  const elapsed = Math.max(0, nowMs - START)
  const index = Math.floor(elapsed / (ROTATE_DAYS * DAY))
  const daysLeft = Math.max(1, Math.ceil(((index + 1) * ROTATE_DAYS * DAY - elapsed) / DAY))
  return { index, daysLeft }
}

/** 两个卡池这一期的 UP。 */
export function banners(nowMs) {
  const { index, daysLeft } = period(nowMs)
  const six = ofStars(6)
  const five = ofStars(5)
  const theme = THEMES[index % THEMES.length]
  // 常驻的 UP 避开限时的，免得两个池子 UP 同一个。
  let s6 = six[index % six.length]
  if (s6.key === theme.up6) s6 = six[(index + 1) % six.length]
  const s5 = [five[(index * 2) % five.length], five[(index * 2 + 1) % five.length]]
  return [
    { key: 'standard', emoji: '📦', label: '常驻寻访', up6: [s6.key], up5: s5.map(entry => entry.key), daysLeft },
    { key: 'limited', emoji: theme.emoji, label: '限时寻访 · ' + theme.label, up6: [theme.up6], up5: theme.up5, daysLeft },
  ]
}

/** 这一抽 6★ 的概率（since = 这个保底组上次出 6★ 以来已经抽了几次）。第 51 抽起 +2%，第 99 抽必出。 */
export function sixChance(since) {
  return since < PITY_FROM ? RATES[6] : Math.min(1, RATES[6] + (since - PITY_FROM + 1) * PITY_STEP)
}

/** 把数据补成 2.0 的样子；1.0 的数据（按系列）换算过来，只做一次。 */
export function normalize(data) {
  if (data.v !== 2) {
    const owned = {}
    let certs = 0
    const old = data.series !== null && typeof data.series === 'object' ? data.series : {}
    for (const s of Object.values(old)) {
      if (s === null || typeof s !== 'object') continue
      for (const [key, count] of Object.entries(s.have ?? {})) {
        if (byKey(key) !== null && Number(count) > 0) owned[key] = Math.min(MAX_POTENTIAL, (owned[key] ?? 0) + Math.floor(Number(count)))
      }
      certs += Math.max(0, Math.floor(Number(s.shards) || 0)) * 2
    }
    for (const field of Object.keys(data)) delete data[field]
    Object.assign(data, { v: 2, owned, certs, pity: { standard: 0, limited: 0 }, pulls: 0, last: null, seq: 0 })
  }
  if (data.owned === null || typeof data.owned !== 'object') data.owned = {}
  if (data.pity === null || typeof data.pity !== 'object') data.pity = { standard: 0, limited: 0 }
  for (const group of ['standard', 'limited']) if (!Number.isInteger(data.pity[group])) data.pity[group] = 0
  if (!Number.isInteger(data.certs)) data.certs = 0
  if (!Number.isInteger(data.pulls)) data.pulls = 0
  if (!Number.isInteger(data.seq)) data.seq = 0
  return data
}

function rollStars(since, random) {
  const p6 = sixChance(since)
  const r = random()
  if (r < p6) return 6
  // 6★ 概率涨了，其余三档按原来的比例分剩下的。
  const rest = (r - p6) / (1 - p6)
  const total = RATES[5] + RATES[4] + RATES[3]
  if (rest < RATES[5] / total) return 5
  if (rest < (RATES[5] + RATES[4]) / total) return 4
  return 3
}

function pickFigure(stars, banner, random) {
  const up = stars === 6 ? banner.up6 : stars === 5 ? banner.up5 : []
  const share = UP_SHARE[banner.key]?.[stars] ?? 0
  if (up.length > 0 && random() < share) return byKey(up[Math.min(up.length - 1, Math.floor(random() * up.length))])
  const pool = ofStars(stars).filter(entry => !up.includes(entry.key))
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))]
}

/** 得到一个：没有就 1 潜；有就潜能 +1 并给凭证（满潜后加倍）。 */
function grant(data, figure) {
  const before = data.owned[figure.key] ?? 0
  if (before === 0) { data.owned[figure.key] = 1; return { isNew: true, potential: 1, certs: 0 } }
  const full = before >= MAX_POTENTIAL
  const certs = CERTS[figure.stars] * (full ? 2 : 1)
  data.owned[figure.key] = Math.min(MAX_POTENTIAL, before + 1)
  data.certs += certs
  return { isNew: false, potential: data.owned[figure.key], certs }
}

/** 把 data.certs 里攒着的凭证搬进钱包（老存档的、这次重复给的）；老宿主没有钱包就留在 data 里。 */
function settleCerts(data, api, source) {
  if (!api.wallet || data.certs <= 0) return
  api.wallet.earn(data.certs, source)
  data.certs = 0
}

/** 手里一共多少凭证。 */
const certBalance = (data, api) => (api.wallet ? api.wallet.balance() : 0) + data.certs

/** 花凭证；不够返回 false。 */
function spendCerts(data, api, amount) {
  settleCerts(data, api, 'migrate')
  if (api.wallet) return api.wallet.spend(amount, 'shop')
  if (data.certs < amount) return false
  data.certs -= amount
  return true
}

function remember(data, banner, items) {
  data.seq += 1
  data.last = { id: data.seq, banner, items }
}

function lineFor(items) {
  const best = items.reduce((top, got) => (got.stars > top.stars ? got : top), items[0])
  const figure = byKey(best.key)
  if (best.stars === 6) return '六星！是' + figure.label + '！快看它在发光！'
  if (items.length === 10) return best.stars === 5 ? '十连出了个五星' + figure.label + '，还不错' : '十连……全是熟面孔，凭证多了一把'
  if (best.stars === 5) return '五星！' + figure.label + '，我要把它摆在最显眼的地方'
  return best.isNew ? '是' + figure.label + '！新朋友' : '又是' + figure.label + '……潜能 +1'
}

/** 凭证商店。 */
const SHOP = [
  { key: 'ticket', emoji: '🎟', label: '盲盒券', cost: 20, note: '免费寻访 1 次' },
  { key: 'pick5', emoji: '⭐', label: '指定一个五星', cost: 120, note: '从还没有的五星里挑一个' },
  { key: 'pick6', emoji: '🌟', label: '指定一个六星', cost: 300, note: '从还没有的六星里挑一个' },
  { key: 'feast', emoji: '🍱', label: '豪华大餐', cost: 8, note: '放进背包' },
  { key: 'baicaodan', emoji: '💊', label: '百草丹', cost: 30, note: '什么病都能治，放进背包' },
]


/** Collection proofs also include certificate exchanges. */
export function progress(data) {
  const saved = normalize(structuredClone(data))
  const figures = CATALOG.filter(figure => Number.isSafeInteger(saved.owned[figure.key]) && saved.owned[figure.key] > 0)
  return [{ name: 'figure', items: figures.map(figure => figure.key) }, { name: 'six-star', items: figures.filter(figure => figure.stars === 6).map(figure => figure.key) }]
}

function reportProgress(data, api) {
  if (typeof api.emit !== 'function') return
  for (const { name, ...payload } of progress(data)) api.emit(name, payload)
}

export default {
  eventVersion: 1,
  progress,
  init() { return normalize({}) },

  actions: {
    /** 寻访：banner 是 standard / limited，count 1 或 10；ticket 为真时用一张盲盒券抽 1 次。 */
    open(data, payload, api, random = Math.random) {
      normalize(data)
      settleCerts(data, api, 'migrate')
      const banner = banners(api.now).find(entry => entry.key === payload.banner)
      if (banner === undefined) return { ok: false, reason: 'unknown' }
      const count = payload.count === 10 ? 10 : 1
      if (payload.ticket === true && count === 1) {
        if (!api.take(TICKET, 1)) return { ok: false, reason: 'no-ticket' }
      } else if (!api.spend(count === 10 ? PRICE_TEN : PRICE_ONE)) {
        return { ok: false, reason: 'poor' }
      }
      const items = []
      for (let i = 0; i < count; i += 1) {
        const stars = rollStars(data.pity[banner.key], random)
        data.pity[banner.key] = stars === 6 ? 0 : data.pity[banner.key] + 1
        const figure = pickFigure(stars, banner, random)
        items.push({ key: figure.key, stars, ...grant(data, figure) })
      }
      data.pulls += count
      settleCerts(data, api, 'duplicate')
      remember(data, banner.key, items)
      reportProgress(data, api)
      api.say(lineFor(items))
      return { ok: true }
    },

    /** 把老存档里的凭证搬进钱包（打开盲盒页时客户端调一次）。 */
    sync(data, _payload, api) {
      normalize(data)
      settleCerts(data, api, 'migrate')
      return { ok: true }
    },

    /** 凭证商店：item 是商品 key；指定星级时 pick 是要的摆件。 */
    buy(data, payload, api) {
      normalize(data)
      const entry = SHOP.find(item => item.key === payload.item)
      if (entry === undefined) return { ok: false, reason: 'unknown' }
      if (certBalance(data, api) < entry.cost) return { ok: false, reason: 'no-certs' }
      if (entry.key === 'pick5' || entry.key === 'pick6') {
        const figure = byKey(payload.pick)
        if (figure === null || figure.stars !== (entry.key === 'pick6' ? 6 : 5)) return { ok: false, reason: 'unknown' }
        if ((data.owned[figure.key] ?? 0) > 0) return { ok: false, reason: 'owned' }
        if (!spendCerts(data, api, entry.cost)) return { ok: false, reason: 'no-certs' }
        data.owned[figure.key] = 1
        remember(data, 'shop', [{ key: figure.key, stars: figure.stars, isNew: true, potential: 1, certs: 0 }])
        reportProgress(data, api)
        api.say('用凭证换来了' + figure.label + '！')
        return { ok: true }
      }
      // 先扣凭证再给东西；给不出去（物品不存在）就整笔撤回——宿主对出错的动作会回滚。
      if (!spendCerts(data, api, entry.cost)) return { ok: false, reason: 'no-certs' }
      const given = entry.key === 'ticket' ? api.give(TICKET, 1) : api.give(entry.key, 1)
      if (!given) throw new Error('物品不存在：' + entry.key)
      return { ok: true }
    },
  },

  view(data, api) {
    const d = normalize(structuredClone(data))
    const catalog = CATALOG.map(entry => ({ ...entry, potential: d.owned[entry.key] ?? 0, acquired: (d.owned[entry.key] ?? 0) > 0 }))
    const certs = certBalance(d, api)
    return {
      prices: { one: PRICE_ONE, ten: PRICE_TEN },
      tickets: api.count(TICKET),
      coins: api.coins(),
      certs,
      /** 还没搬进钱包的凭证（老存档）。 */
      pendingCerts: api.wallet ? d.certs : 0,
      pulls: d.pulls,
      last: d.last,
      banners: banners(api.now).map(banner => {
        const since = d.pity[banner.key]
        return { ...banner, since, sixChance: sixChance(since), pityLeft: Math.max(0, PITY_FROM - since) }
      }),
      catalog,
      shop: SHOP,
      shelf: { key: 'blindbox', label: '盲盒', emoji: '🎁', color: 'orange',
        currency: { label: '资质凭证', emoji: '📜', balance: certs },
        items: SHOP.map(item => {
          const stars = item.key === 'pick5' ? 5 : item.key === 'pick6' ? 6 : 0
          const pick = stars ? catalog.filter(entry => entry.stars === stars && !entry.acquired).map(({ key, emoji, label }) => ({ key, emoji, label })) : null
          return { key: item.key, emoji: item.emoji, label: item.label, note: item.note, price: item.cost,
            disabled: certs < item.cost || (pick !== null && pick.length === 0), pick }
        }) },
      dex: { key: 'figures', label: '摆件', emoji: '🧸', color: 'orange', style: 'holo', entries: catalog },
    }
  },
}
