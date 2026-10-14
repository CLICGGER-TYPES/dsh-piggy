// @ts-check
/**
 * 存档模糊测试：随机生成 / 变异旧版存档，跑 normalize / migrate / settlement，
 * 统计抛异常与数据丢失，并给每个崩溃留一份最小复现存档。
 *
 * 用法：
 *   node tools/fuzz-saves.mjs --cases 1500 --seed 20261014 --out ../../results/save-fuzz
 *   node tools/fuzz-saves.mjs --help        # 只看参数说明
 *
 * 参数是严格解析的：不认识的 `--xxx` 或缺少值会直接报错退出（不跑用例、不碰产物目录）。
 *
 * 覆盖的存储面：
 *   core    —— migrate() → readStateFile()（真实读盘路径）→ 结算（recordOnline/decay/diary/pomodoro）→ snapshot() → 一串核心动作
 *   farm    —— 菜园 3.x→4.0 迁移（normalize）+ view + 动作
 *   mine / blindbox / gacha —— 扩展存档 normalize / view
 *
 * 每个用例在 worker 线程里跑，有超时看门狗：死循环（例如等级只涨不减的 while）
 * 会被记成 timeout 崩溃，而不是把整个模糊测试挂住。
 *
 * 只读被测代码，不修改仓库：产物写在 --out 指定的目录（默认仓库外 ../../results/save-fuzz）。
 */
import { isMainThread, parentPort, Worker, workerData } from 'node:worker_threads'
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..')
const FIXTURE = join(REPO, 'test', 'fixtures', 'state-v7-real.json')

// ---------------------------------------------------------------------------
// 随机器（可复现）
// ---------------------------------------------------------------------------

/** mulberry32：同一种子给同一串用例，崩溃能重放。 */
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const isPlainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)

/** 把 JS 值编码成 JSON 文本；非有限数写成 1e999（JSON.parse 会得到 Infinity），跟真实坏档一致。 */
function encode(value) {
  if (value === null) return 'null'
  const type = typeof value
  if (type === 'number') return Number.isFinite(value) ? String(value) : (value > 0 ? '1e999' : '-1e999')
  if (type === 'boolean') return String(value)
  if (type === 'string') return JSON.stringify(value)
  if (type === 'bigint') return value.toString()
  if (Array.isArray(value)) return '[' + value.map(item => encode(item)).join(',') + ']'
  if (type === 'object') {
    return '{' + Object.entries(value)
      .filter(([, item]) => typeof item !== 'function' && item !== undefined)
      .map(([key, item]) => JSON.stringify(key) + ':' + encode(item)).join(',') + '}'
  }
  return 'null'
}

// ---------------------------------------------------------------------------
// 用例生成
// ---------------------------------------------------------------------------

const NOW0 = 1_790_780_277_081
const DAY = 86_400_000
const EDGE_NUMBERS = [
  0, 1, -1, 0.5, -0.5, 0.1, 2, 100, 3600000, DAY,
  1e15, -1e15, 1e308, 1e999, -1e999, 9_007_199_254_740_991, 9_007_199_254_740_993,
  1.2345678901234568e18, 1e-320, 2 ** 53, 2 ** 31, NOW0, NOW0 - 30 * DAY, -NOW0,
]
const CORRUPTION_STRINGS = ['', '猪猪', 'box', 'work', 'study', 'trip', 'fishing', 'crown', 'hat', 'scarf',
  'x'.repeat(300), '🥬'.repeat(200), 'null', '0', '1e999', '\u0000', '\ud800', 'a'.repeat(100000)]
const SAVE_KEYS = [
  'version', 'name', 'bornAt', 'hatched', 'dead', 'diedAt', 'stage', 'ageMs', 'timeScale', 'ageForced',
  'xp', 'weightG', 'satiety', 'happiness', 'cleanliness', 'health', 'coins', 'inventory', 'dress', 'worn',
  'traits', 'lessons', 'courses', 'coursesByStage', 'lessonsByStage', 'interests', 'souvenirs', 'illness',
  'activity', 'work', 'riskMinutes', 'outingStreak', 'restMinutes', 'lastFedAt', 'lastActiveAt', 'lastSeenAt',
  'cooldowns', 'pending', 'pendingSeq', 'memories', 'stats', 'seed', 'form', 'finalForm', 'sex', 'daily',
  'diary', 'pomodoro', 'dex', 'fishing', 'skins', 'profile', 'dialogue', 'wallets', 'extensions',
  'extensionsRemoved', 'extData', 'milestones', 'unlocked',
]
const OLD_SUBJECTS = ['literacy', 'english', 'history', 'philosophy', 'mathematics', 'science', 'physics',
  'chemistry', 'biology', 'it', 'economics', 'go', 'politics', 'geography', 'sing', 'piano', 'doodle',
  'painting', 'pe', 'football', 'engineering', 'chinese', 'music', 'art', 'labour']
const OLD_JOBS = ['odd', 'dish', 'site', 'foreman', 'street', 'tutor', 'office', 'manager', 'researcher']
const TRAITS = ['intel', 'charm', 'strong']

const pick = (rng, list) => list[Math.floor(rng() * list.length) % list.length]
const int = (rng, min, max) => min + Math.floor(rng() * (max - min + 1))

function randomPrimitive(rng, depth, budget) {
  const roll = rng()
  if (roll < 0.25) return pick(rng, EDGE_NUMBERS)
  if (roll < 0.45) return int(rng, -1000, 100000)
  if (roll < 0.6) return pick(rng, [null, true, false])
  if (roll < 0.85) return pick(rng, CORRUPTION_STRINGS.slice(0, 12))
  return randomValue(rng, depth + 1, budget)
}

/** 随机值；节点预算兜住嵌套长数组，免得一个用例就把内存吃光。 */
function randomValue(rng, depth = 0, budget = { n: 0 }) {
  budget.n += 1
  if (budget.n > 3000 || depth >= 3) return randomPrimitive(rng, depth, budget)
  const roll = rng()
  if (roll < 0.45) return randomPrimitive(rng, depth, budget)
  if (roll < 0.72) {
    const out = {}
    const count = int(rng, 0, 4)
    for (let i = 0; i < count; i += 1) out[pick(rng, SAVE_KEYS)] = randomValue(rng, depth + 1, budget)
    return out
  }
  if (roll < 0.95) {
    if (rng() < 0.06 && depth === 0) return Array.from({ length: int(rng, 200, 3000) }, () => randomPrimitive(rng, depth, budget))
    const count = int(rng, 0, 4)
    return Array.from({ length: count }, () => randomValue(rng, depth + 1, budget))
  }
  return null
}

/** 一个像样的旧存档骨架（字段按版本铺开）。 */
function baseSave(rng, version) {
  const hatched = rng() < 0.85
  const bornAt = NOW0 - int(rng, 0, 400) * DAY
  const activity = rng() < 0.35
    ? (version < 11
      ? { kind: 'work', key: 'odd', startedAt: NOW0 - 600000, endsAt: NOW0 + 1800000, cost: 0, label: '打零工', emoji: '🧹' }
      : { kind: pick(rng, ['work', 'study', 'trip', 'interest']), key: pick(rng, [...OLD_JOBS, 'chinese', 'radish', 'park']), startedAt: NOW0 - 600000, endsAt: NOW0 + 1800000 })
    : null
  const courses = {}
  for (const subject of OLD_SUBJECTS.slice(0, 6)) if (rng() < 0.4) courses[subject] = int(rng, 1, 6)
  const save = {
    version,
    name: pick(rng, ['猪猪', '小胖', 'Piggy', '老猪']),
    bornAt,
    hatched,
    dead: false,
    diedAt: null,
    stage: hatched ? pick(rng, ['piglet', 'young', 'middle', 'elder']) : 'box',
    ageMs: int(rng, 0, 60 * DAY),
    timeScale: 1,
    xp: version >= 9 ? int(rng, 0, 8000) : int(rng, 0, 4000),
    weightG: int(rng, 1200, 30000),
    satiety: rng() * 100,
    happiness: rng() * 100,
    cleanliness: rng() * 100,
    health: int(rng, 1, 5),
    coins: int(rng, 0, 60000),
    inventory: { apple: int(rng, 0, 3), pumpkin: int(rng, 0, 2), med1: int(rng, 0, 3), med4: int(rng, 0, 2), shampoo: int(rng, 0, 2) },
    dress: ['scarf', 'strawhat'].slice(0, int(rng, 0, 2)),
    worn: rng() < 0.5 ? ['scarf'] : [],
    traits: { intel: int(rng, 0, 40), charm: int(rng, 0, 40), strong: int(rng, 0, 40) },
    interests: {},
    souvenirs: rng() < 0.5 ? ['贝壳', { key: 'souvenir-shell', label: '贝壳', rarity: 'common' }] : [],
    illness: rng() < 0.2 ? { chain: 0, stage: 1, since: NOW0 - DAY, progressMs: 0 } : null,
    activity,
    riskMinutes: int(rng, 0, 500),
    outingStreak: int(rng, 0, 5),
    restMinutes: int(rng, 0, 300),
    lastFedAt: NOW0 - int(rng, 0, 5) * DAY,
    lastActiveAt: NOW0 - int(rng, 0, 3) * DAY,
    lastSeenAt: NOW0 - int(rng, 0, 2) * DAY,
    cooldowns: {},
    pending: [],
    pendingSeq: 0,
    memories: Array.from({ length: int(rng, 0, 10) }, (_, i) => `[0${i % 9}:00] 记一笔`),
    stats: { turns: 1, messages: 2, tools: 3, jobs: int(rng, 0, 5), coinsEarned: 100, courses: 0, lessons: 0, trips: 0, interests: 0 },
  }
  if (version < 11) {
    save.courses = courses
    save.coursesByStage = { preschool: 0, primary: 0 }
    save.lessonsByStage = { preschool: courses.literacy ?? 0, primary: 0 }
    if (rng() < 0.3) save.work = { job: pick(rng, OLD_JOBS) }
    if (rng() < 0.3) save.souvenirs = ['贝壳', '邮票']
  } else {
    const lessons = {}
    for (const subject of ['chinese', 'mathematics', 'music']) if (rng() < 0.4) lessons[subject] = int(rng, 1, 6)
    save.lessons = lessons
  }
  if (rng() < 0.25) save.dress = [...save.dress, 'crown']
  if (rng() < 0.2) save.form = pick(rng, ['king', 'devil', null])
  if (rng() < 0.2) save.finalForm = 'king'
  if (rng() < 0.2) save.extData = { farm: legacyFarmData(rng), mine: { v: 1, layer: 3, pickaxe: 3, bag: { stone: 5 } } }
  return save
}

/** 把树里的一部分字段换坏。 */
function mutateTree(rng, tree) {
  const ops = int(rng, 1, 7)
  for (let i = 0; i < ops; i += 1) {
    const key = pick(rng, SAVE_KEYS)
    const kind = rng()
    if (kind < 0.2) { delete tree[key]; continue }
    if (kind < 0.35) { tree[key] = null; continue }
    if (kind < 0.5) { tree[key] = pick(rng, EDGE_NUMBERS); continue }
    if (kind < 0.62) { tree[key] = pick(rng, CORRUPTION_STRINGS); continue }
    if (kind < 0.72) { tree[key] = rng() < 0.5 ? [] : {}; continue }
    if (kind < 0.8) {
      const count = int(rng, 50, 5000)
      tree[key] = Array.from({ length: count }, (_, index) => (index % 3 === 0 ? null : index))
      continue
    }
    if (kind < 0.86) { tree.version = pick(rng, [0, 1, 3, 5, 7, 8, 9, 10, 11, 12, 13, -1, 1e999, '12', null, undefined]); continue }
    if (kind < 0.92) { tree[key] = randomValue(rng, 0); continue }
    tree[key] = pick(rng, [Infinity, -Infinity, NOW0, NOW0 - 100 * 365 * DAY, 0])
  }
  // 定向：结算路径上的死循环候选
  if (rng() < 0.25) tree.daily = { signIn: { lastDay: '2026-10-13', index: 3, total: 5, cycle7: true }, online: { day: '2026-10-13', onlineMs: pick(rng, [1e308, 1e15, 2 * 3600000]), given: 0, unclaimed: 0 } }
  if (rng() < 0.25) tree.lastSeenAt = pick(rng, [0, -1, 1, NOW0 - 100 * 365 * DAY, NOW0])
  if (rng() < 0.15) tree.hatched = true
  // 让版本、形态、存活状态经常处在升级路径上
  if (rng() < 0.5) tree.version = pick(rng, [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12])
  return tree
}

/** 3.x 菜园数据。 */
function legacyFarmData(rng) {
  const plots = Array.from({ length: int(rng, 0, 12) }, () => {
    const roll = rng()
    if (roll < 0.35) return null
    if (roll < 0.8) return { crop: rng() < 0.9 ? pick(rng, ['sprout', 'scallion', 'carrot', 'strawberry', 'grape', 'pumpkin', 'corn', 'watermelon', 'tomato', 'lettuce']) : 'mystery-crop', plantedAt: NOW0 - int(rng, 0, 20) * 3600000, watered: rng() < 0.5 }
    return randomValue(rng, 1)
  })
  const seeds = {}
  for (const crop of ['sprout', 'scallion', 'carrot', 'radish', 'strawberry']) if (rng() < 0.6) seeds[crop] = int(rng, 0, 8)
  const harvest = {}
  for (const crop of ['sprout', 'carrot']) if (rng() < 0.5) harvest[crop] = int(rng, 0, 20)
  return {
    version: pick(rng, [2, 3]),
    unlocked: int(rng, 3, 12),
    plots,
    seeds,
    harvest,
    acquired: { ...harvest },
    sprinklers: Array.from({ length: int(rng, 0, 3) }, () => rng() < 0.7),
    fertilizer: int(rng, 0, 5),
    tools: { sickle: rng() < 0.5, can: rng() < 0.4, planter: rng() < 0.3 },
    helper: { hired: rng() < 0.5, level: int(rng, 0, 2), barn: int(rng, 0, 3), stock: {} },
    exp: int(rng, 0, 500),
    refund: 0,
  }
}

/** 4.0 菜园数据。 */
function modernFarmData(rng) {
  const unlocked = int(rng, 6, 18)
  const plots = Array.from({ length: 18 }, (_, index) => {
    if (index >= unlocked) return null
    const roll = rng()
    if (roll < 0.4) return null
    if (roll < 0.55) return { fallow: true, stubble: rng() < 0.5, pests: { dry: rng() < 0.5 ? 0 : null, weed: rng() < 0.5 ? 0 : null } }
    if (roll < 0.7) return { crop: pick(rng, ['radish', 'carrot', 'corn']), withered: true }
    return {
      crop: pick(rng, ['radish', 'apple', 'grape', 'carrot', 'pumpkin', 'coconut']),
      season: int(rng, 1, 2),
      plantedAt: NOW0 - int(rng, 0, 40) * 3600000,
      boostMs: pick(rng, [0, 3600000, 7 * 3600000]),
      roll: int(rng, -3, 2),
      pests: { weed: NOW0 + int(rng, -5, 5) * 3600000, bug: NOW0 + int(rng, -5, 5) * 3600000, dry: NOW0 + int(rng, -5, 5) * 3600000 },
    }
  })
  return {
    version: 4,
    unlocked,
    plots,
    seeds: { radish: int(rng, 0, 5), carrot: int(rng, 0, 5) },
    harvest: { radish: int(rng, 0, 30) },
    acquired: { radish: int(rng, 0, 30) },
    harvests: { radish: int(rng, 0, 10) },
    tools: { sickle: rng() < 0.5, sprayer: rng() < 0.5, rake: false, planter: rng() < 0.5 },
    fert: { 'fert-1': int(rng, 0, 3) },
    exp: int(rng, 0, 3000),
    refund: 0,
    helper: { hired: rng() < 0.5, level: int(rng, 0, 2), barn: int(rng, 0, 3), usedMs: int(rng, 0, 3600000), lastAt: NOW0 - int(rng, 0, 2) * 3600000, cursor: int(rng, 0, 17), stock: {} },
  }
}

/** 通用扩展数据（矿洞 / 盲盒 / 扭蛋）。 */
function extDataFor(rng, key) {
  if (key === 'mine') {
    if (rng() < 0.5) return { v: 1, layer: int(rng, 1, 10), pickaxe: int(rng, 1, 3), bag: { stone: int(rng, 0, 9) }, energy: 10, day: '2026-10-01' }
    return { v: 2, layer: int(rng, 1, 20), pickaxe: int(rng, 1, 5), bag: { stone: int(rng, 0, 9) }, maps: {}, found: {}, run: int(rng, 0, 3), bombs: int(rng, 0, 2) }
  }
  if (key === 'blindbox') {
    if (rng() < 0.5) return { series: { s1: { have: { 'ser-1': int(rng, 0, 3) }, shards: int(rng, 0, 5) } } }
    return { v: 2, owned: { 'ser-1': int(rng, 0, 6) }, certs: int(rng, 0, 20), pity: { standard: int(rng, 0, 40), limited: 0 }, pulls: int(rng, 0, 60), last: null, seq: int(rng, 0, 5) }
  }
  return { luck: int(rng, 0, 30), freeDay: '2026-10-01', history: [{ key: 'ser-1', label: 'x', count: 1, rarity: 'rare' }], last: null, seq: int(rng, 0, 3) }
}

/** 摇一个用例。 */
function buildCase(rng, id) {
  const roll = rng()
  const now = NOW0
  const now2 = NOW0 + int(rng, 0, 3) * DAY + int(rng, 0, 24) * 3600000
  if (roll < 0.4) {
    const version = pick(rng, [2, 3, 4, 5, 7, 7, 8, 8, 9, 9, 10, 11, 11, 12, 12])
    const tree = version === 7 && rng() < 0.5 ? JSON.parse(readFileSync(FIXTURE, 'utf8')) : baseSave(rng, version)
    mutateTree(rng, tree)
    return { id, target: 'core', json: encode(tree), now, now2, strategy: version === 7 ? 'shaped-v7-real' : `shaped-v${version}`, version }
  }
  if (roll < 0.58) {
    // 单字段扫射：其余字段保持像样，只把一个字段换成各种坏值，好走进只查一遍的深层代码
    const tree = rng() < 0.4 ? JSON.parse(readFileSync(FIXTURE, 'utf8')) : baseSave(rng, pick(rng, [9, 10, 11, 12, 12]))
    const key = pick(rng, SAVE_KEYS)
    tree[key] = pick(rng, [null, 0, -1, 1, 1e308, 1e999, '', 'x', 'box', true, false, [], {}, [null], { a: 1 },
      randomValue(rng, 1), { online: { onlineMs: 1e308 } }, { chain: 99, stage: 99 }, { endsAt: 'x' },
      [{ key: '贝壳' }], Array.from({ length: 3000 }, (_, index) => index)])
    if (rng() < 0.25) tree.version = pick(rng, [3, 5, 7, 9, 11, 12, 13, 1e999])
    return { id, target: 'core', json: encode(tree), now, now2, strategy: `sweep-${key}`, version: tree.version }
  }
  if (roll < 0.68) {
    const count = int(rng, 1, 6)
    const tree = {}
    for (let i = 0; i < count; i += 1) tree[pick(rng, SAVE_KEYS)] = randomValue(rng, 0)
    return { id, target: 'core', json: encode(tree), now, now2, strategy: 'random-keyed', version: tree.version }
  }
  if (roll < 0.74) {
    const garbage = pick(rng, ['[]', '"猪"', 'null', '0', 'true', '{}', '{', 'not json', '[1,2,3', '', '{"version":'])
    if (rng() < 0.5) return { id, target: 'core', json: encode(randomValue(rng, 0)), now, now2, strategy: 'random-tree', version: undefined }
    return { id, target: 'core', json: garbage, now, now2, strategy: 'malformed-text', version: undefined }
  }
  if (roll < 0.9) {
    const legacy = rng() < 0.6
    const tree = legacy ? legacyFarmData(rng) : modernFarmData(rng)
    if (rng() < 0.4) mutateExtension(rng, tree)
    return { id, target: 'farm', json: encode(tree), now, now2, strategy: legacy ? 'farm-legacy-3.x' : 'farm-modern-4.0', version: tree.version }
  }
  const key = pick(rng, ['mine', 'blindbox', 'gacha'])
  const tree = extDataFor(rng, key)
  if (rng() < 0.4) mutateExtension(rng, tree)
  return { id, target: key, json: encode(tree), now, now2, strategy: `${key}-legacy`, version: tree.v }
}

const EXT_KEYS = ['v', 'version', 'layer', 'pickaxe', 'bag', 'maps', 'found', 'run', 'bombs', 'unlocked', 'plots', 'seeds',
  'harvest', 'acquired', 'harvests', 'tools', 'fert', 'exp', 'refund', 'helper', 'sprinklers', 'fertilizer',
  'owned', 'certs', 'pity', 'pulls', 'last', 'seq', 'luck', 'freeDay', 'history', 'milestones', 'series', 'pending']

function mutateExtension(rng, tree) {
  const ops = int(rng, 1, 6)
  for (let i = 0; i < ops; i += 1) {
    const key = pick(rng, EXT_KEYS)
    const kind = rng()
    if (kind < 0.25) { delete tree[key]; continue }
    if (kind < 0.45) { tree[key] = null; continue }
    if (kind < 0.6) { tree[key] = pick(rng, EDGE_NUMBERS); continue }
    if (kind < 0.75) { tree[key] = pick(rng, CORRUPTION_STRINGS.slice(0, 10)); continue }
    if (kind < 0.9) { tree[key] = randomValue(rng, 0); continue }
    tree[key] = Array.from({ length: int(rng, 60, 3000) }, () => randomPrimitive(rng, 3, { n: 0 }))
  }
  if (rng() < 0.4) tree.version = pick(rng, [0, 1, 2, 3, 4, 5, -1, 1e999, '4'])
  if (rng() < 0.35) tree.exp = pick(rng, [1e308, 1e999, 1e15, 500])
  return tree
}

// ---------------------------------------------------------------------------
// Worker：跑一个用例
// ---------------------------------------------------------------------------

async function workerMain() {
  const { migrate, STATE_VERSION, decay, recordOnline, writeDiaryIfNewDay, settlePomodoro, extensionOn,
    act, buy, startWork, startStudy, startInterest, startTrip, hatch, chat, signIn, useItem, seeDoctor } = await import('../core.js')
  const { SHOP, JOBS, SUBJECTS, INTERESTS, TRIPS, itemByKey, subjectByKey, TRAIT_ORDER, BOX_TICKET } = await import('../packages/pet-core/src/data.js')
  const { MEMORY_LIMIT } = await import('../packages/pet-core/src/core/constants.js')
  const { readStateFile } = await import('../store/state-file.js')
  const { snapshot } = await import('../snapshot.js')
  const farm = (await import('../extensions/farm/server.js')).default
  const farmMod = await import('../extensions/farm/server.js')
  const mine = (await import('../extensions/mine/server.js')).default
  const mineMod = await import('../extensions/mine/server.js')
  const blindbox = (await import('../extensions/blindbox/server.js')).default
  const blindboxMod = await import('../extensions/blindbox/server.js')
  const gacha = (await import('../extensions/gacha/server.js')).default

  const tmp = mkdtempSync(join(tmpdir(), 'dsh-piggy-fuzz-'))
  const savePath = join(tmp, 'state.json')
  const cleanTmp = () => {
    for (const name of readdirSync(tmp)) { try { rmSync(join(tmp, name), { recursive: true, force: true }) } catch { /* 忽略清理失败 */ } }
  }

  const asObject = value => (value !== null && typeof value === 'object' && !Array.isArray(value) ? value : null)
  const RETIRED_MEDS = new Set(['med1', 'med2', 'med3', 'med4'])
  const SHOP_KEYS = new Set(SHOP.map(entry => entry.key))

  function fakeApi(now, balance = 1_000_000) {
    const wallet = {
      currency: { label: '币', emoji: '🪙', rate: 1 },
      balance: () => balance,
      earn(n) { balance += Number(n) || 0; return n },
      spend(n) { const cost = Number(n) || 0; if (!(balance >= cost)) return false; balance -= cost; return true },
    }
    return {
      now, wallet,
      coins: () => balance,
      balance: () => balance,
      earn(n) { balance += Number(n) || 0; return n },
      spend(n) { const cost = Number(n) || 0; if (!(balance >= cost)) return false; balance -= cost; return true },
      give() { return true },
      take() { return true },
      count() { return 0 },
      say() {},
      exert() {},
      emit() { return true },
    }
  }

  /** 每轮统一收集：抛错记 stage+name+message，超时由父进程记。 */
  function runCase(c) {
    const rng = mulberry32((c.id + 1) * 2654435761)
    const crashes = []
    /** 慢阶段的进度上报：worker 被超时杀掉时，父进程知道卡在哪一步。 */
    const mark = stage => { try { parentPort.postMessage({ kind: 'progress', id: c.id, stage }) } catch { /* ignore */ } }
    const attempt = (stage, fn) => {
      try { return { ok: true, value: fn() } } catch (error) {
        crashes.push({
          stage,
          name: error instanceof Error ? error.constructor.name : typeof error,
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? String(error.stack).split('\n').slice(0, 6).join('\n') : '',
        })
        return { ok: false, value: undefined }
      }
    }
    const result = { crashes, losses: [], shape: [], rejected: null, stages: {} }

    let raw
    try { raw = JSON.parse(c.json) } catch { result.rejected = 'invalid-json'; return result }

    const isCore = c.target === 'core'
    if (isCore) {
      const migrated = attempt('core:migrate', () => migrate(structuredClone(raw), c.now))
      if (!migrated.ok) { result.stages.migrate = 'threw'; return result }
      if (migrated.value === null) { result.rejected = 'migrate-null'; return result }
      result.stages.migrate = migrated.value.version
      const state = migrated.value

      result.losses = coreLosses(raw, state, rng)
      result.shape = shapeViolations(state)

      // 真实读盘路径：写文件 → readStateFile（含 migrate、备份逻辑）
      writeFileSync(savePath, c.json)
      mark('core:readStateFile')
      const loaded = attempt('core:readStateFile', () => readStateFile(savePath, c.now, null))
      cleanTmp()
      if (loaded.ok && loaded.value?.state !== null) {
        result.stages.load = loaded.value.state?.version
        if (loaded.value.state.version !== STATE_VERSION) result.shape.push(`readStateFile version=${loaded.value.state.version}`)
      }

      // 结算：跟 store/api.js freshen() 同一串。时间差原样保留——正是要测
      // 「lastSeenAt 很旧的老存档」把结算拖成死循环的可能。
      mark('core:recordOnline')
      attempt('core:recordOnline', () => recordOnline(state, 0, c.now2))
      mark('core:decay')
      attempt('core:decay', () => decay(state, c.now2))
      mark('core:writeDiary')
      attempt('core:writeDiary', () => writeDiaryIfNewDay(state, c.now2))
      mark('core:pomodoro')
      attempt('core:pomodoro', () => { if (extensionOn(state, 'pomodoro')) settlePomodoro(state, c.now2) })
      mark('core:snapshot-after-load')
      attempt('core:snapshot-after-load', () => snapshot(makeShim(state, c.now2)))

      const ops = ['feed', 'bathe', 'play', 'pet', 'buy', 'startWork', 'startStudy', 'startInterest', 'startTrip', 'hatch', 'chat', 'signIn', 'useItem', 'seeDoctor']
      const chosen = Array.from({ length: 6 }, () => pick(rng, ops))
      for (const op of chosen) {
        attempt(`core:op-${op}`, () => {
          if (op === 'buy') return buy(state, pick(rng, SHOP_KEYS.size ? [...SHOP_KEYS] : ['apple']), c.now2)
          if (op === 'startWork') return startWork(state, pick(rng, JOBS.map(job => job.key)), c.now2)
          if (op === 'startStudy') return startStudy(state, pick(rng, SUBJECTS.map(subject => subject.key)), null, c.now2)
          if (op === 'startInterest') return startInterest(state, pick(rng, INTERESTS.map(entry => entry.key)), c.now2)
          if (op === 'startTrip') return startTrip(state, pick(rng, TRIPS.map(entry => entry.key)), c.now2)
          if (op === 'useItem') { const keys = Object.keys(state.inventory ?? {}); return useItem(state, keys.length ? pick(rng, keys) : 'apple', c.now2) }
          if (op === 'hatch') return hatch(state, c.now2)
          if (op === 'chat') return chat(state, 'idle', c.now2)
          if (op === 'signIn') return signIn(state, c.now2)
          if (op === 'seeDoctor') return seeDoctor(state, c.now2)
          return act(state, op, c.now2)
        })
      }
      attempt('core:snapshot-after-ops', () => snapshot(makeShim(state, c.now2)))
      return result
    }

    const data = raw
    if (c.target === 'farm') {
      farmMod.setRandom(() => 0.5)
      mark('farm:normalize')
      const normalized = attempt('farm:normalize', () => farmMod.normalize(structuredClone(data)))
      const inputVersion = asObject(data)?.version
      if (normalized.ok && isPlainObject(normalized.value) && inputVersion !== 4) {
        result.losses = farmLosses(asObject(data) ?? {}, normalized.value)
      }
      mark('farm:view')
      attempt('farm:view', () => farm.view(structuredClone(data), fakeApi(c.now2)))
      runFarmActions(attempt, farm, data, fakeApi(c.now2), rng, 'farm-raw', mark)
      if (normalized.ok) runFarmActions(attempt, farm, structuredClone(normalized.value), fakeApi(c.now2), mulberry32(c.id + 11), 'farm-normalized', mark)
      farmMod.setRandom(Math.random)
      return result
    }
    if (c.target === 'mine') {
      mark('mine:normalize')
      attempt('mine:normalize', () => mineMod.normalize(structuredClone(data)))
      mark('mine:view')
      attempt('mine:view', () => mine.view(structuredClone(data), fakeApi(c.now2)))
      return result
    }
    if (c.target === 'blindbox') {
      mark('blindbox:normalize')
      attempt('blindbox:normalize', () => blindboxMod.normalize(structuredClone(data)))
      mark('blindbox:view')
      attempt('blindbox:view', () => blindbox.view(structuredClone(data), fakeApi(c.now2)))
      return result
    }
    mark('gacha:view')
    attempt('gacha:view', () => gacha.view(structuredClone(data), fakeApi(c.now2)))
    return result
  }

  function makeShim(state, nowMs) {
    return {
      freshen: () => state,
      drainPending: () => [],
      ext: null,
      state,
    }
  }

  function coreLosses(before, after, rng) {
    const out = []
    const b = asObject(before)
    if (b === null) return out
    const version = typeof b.version === 'number' && Number.isFinite(b.version) ? b.version : 0
    if (b.hatched === true && b.dead !== true && after.hatched !== true) out.push({ check: 'hatched', detail: 'hatched true → false' })
    if (b.dead === true && after.dead !== true) out.push({ check: 'dead', detail: 'dead true → false' })
    if (Number.isFinite(b.coins) && b.coins >= 0 && after.coins < Math.floor(b.coins)) out.push({ check: 'coins', detail: `${b.coins} → ${after.coins}` })
    if (typeof b.name === 'string' && b.name.trim() !== '' && after.name !== b.name) out.push({ check: 'name', detail: `"${b.name}" → "${after.name}"` })
    if (Number.isFinite(b.bornAt) && b.bornAt > 0 && after.bornAt !== b.bornAt) out.push({ check: 'bornAt', detail: `${b.bornAt} → ${after.bornAt}` })
    if (version >= 9 && Number.isInteger(b.xp) && b.xp >= 0 && after.xp !== b.xp) out.push({ check: 'xp', detail: `${b.xp} → ${after.xp}` })
    for (const [key, count] of Object.entries(asObject(b.inventory) ?? {})) {
      if (!Number.isFinite(count) || count <= 0 || RETIRED_MEDS.has(key)) continue
      if (!SHOP_KEYS.has(key) && key !== BOX_TICKET.key) continue
      if (!(Number(after.inventory?.[key]) >= Math.floor(count))) out.push({ check: 'inventory', detail: `${key}: ${Math.floor(count)} → ${after.inventory?.[key]}` })
    }
    for (const key of Array.isArray(b.dress) ? b.dress : []) {
      if (key === 'crown' || key === 'royal-crown') continue
      const item = itemByKey(key)
      if (item === null || item.kind !== 'dress') continue
      if (!Array.isArray(after.dress) || !after.dress.includes(key)) out.push({ check: 'dress', detail: `${key} lost` })
    }
    if (version >= 11) {
      for (const [key, count] of Object.entries(asObject(b.lessons) ?? {})) {
        if (!Number.isFinite(count) || count <= 0 || subjectByKey(key) === null) continue
        if (!(Number(after.lessons?.[key]) >= Math.floor(count))) out.push({ check: 'lessons', detail: `${key}: ${Math.floor(count)} → ${after.lessons?.[key]}` })
      }
    }
    for (const key of TRAIT_ORDER) {
      const count = asObject(b.traits)?.[key]
      if (!Number.isFinite(count) || count < 0) continue
      if (!(Number(after.traits?.[key]) >= Math.floor(count))) out.push({ check: 'traits', detail: `${key}: ${Math.floor(count)} → ${after.traits?.[key]}` })
    }
    const kept = new Set((Array.isArray(after.souvenirs) ? after.souvenirs : []).map(entry => asObject(entry)?.key))
    for (const entry of Array.isArray(b.souvenirs) ? b.souvenirs : []) {
      const key = typeof entry === 'string' ? entry : asObject(entry)?.key
      if (typeof key !== 'string' || key === '') continue
      if (!kept.has(key)) out.push({ check: 'souvenirs', detail: `${key} lost` })
    }
    const memories = (Array.isArray(b.memories) ? b.memories : []).filter(entry => typeof entry === 'string').slice(-MEMORY_LIMIT)
    for (const memory of memories) if (!Array.isArray(after.memories) || !after.memories.includes(memory)) out.push({ check: 'memories', detail: memory.slice(0, 50) })
    return out
  }

  function shapeViolations(state) {
    const out = []
    const as = asObject(state)
    if (as === null) return ['migrate returned a non-object']
    if (typeof state.name !== 'string') out.push('name not string')
    if (!Number.isFinite(state.coins) || state.coins < 0) out.push(`coins=${state.coins}`)
    if (typeof state.stage !== 'string') out.push('stage not string')
    if (!Array.isArray(state.dress) || !Array.isArray(state.worn)) out.push('dress/worn not array')
    if (!Array.isArray(state.souvenirs)) out.push('souvenirs not array')
    if (!Array.isArray(state.memories)) out.push('memories not array')
    if (!Array.isArray(state.pending)) out.push('pending not array')
    if (asObject(state.inventory) === null) out.push('inventory not object')
    if (asObject(state.traits) === null) out.push('traits not object')
    if (asObject(state.stats) === null) out.push('stats not object')
    if (asObject(state.cooldowns) === null) out.push('cooldowns not object')
    if (!(state.activity === null || asObject(state.activity) !== null)) out.push('activity malformed')
    if (!(state.illness === null || asObject(state.illness) !== null)) out.push('illness malformed')
    if (typeof state.version !== 'number' || state.version !== STATE_VERSION) out.push(`version=${state.version}`)
    return out
  }

  function runFarmActions(attempt, farmModule, data, api, rng, label, mark) {
    const ops = [
      () => farmModule.actions.buy(data, { item: pick(rng, ['radish', 'carrot', 'fert-1', 'sickle', 'helper-hire']), count: pick(rng, [1, 2, 99]) }, api),
      () => farmModule.actions.plant(data, { plot: int(rng, 0, 19), item: pick(rng, ['radish', 'carrot', 'coconut']) }, api),
      () => farmModule.actions.care(data, { plot: int(rng, 0, 19), kind: pick(rng, ['weed', 'bug', 'dry', undefined]) }, api),
      () => farmModule.actions.harvest(data, { plot: int(rng, 0, 19) }, api),
      () => farmModule.actions.clear(data, { plot: int(rng, 0, 19), force: rng() < 0.5 }, api),
      () => farmModule.actions.fertilize(data, { plot: int(rng, 0, 19), item: 'fert-1' }, api),
      () => farmModule.actions.sell(data, { item: pick(rng, ['radish', '*']), count: pick(rng, [1, 5]) }, api),
      () => farmModule.actions.unlock(data, { plot: pick(rng, [0, 3, 6, 17, 18]) }, api),
      () => farmModule.actions.harvestAll(data, {}, api),
      () => farmModule.actions.careAll(data, {}, api),
      () => farmModule.actions.clearAll(data, {}, api),
      () => farmModule.actions.plantAll(data, { item: 'radish' }, api),
      () => farmModule.actions.store(data, { item: 'strawberry', count: 1 }, api),
    ]
    const chosen = Array.from({ length: 5 }, () => pick(rng, ops))
    chosen.forEach((op, index) => { mark(`${label}:action-${index}`); attempt(`${label}:action-${index}`, op) })
    mark(`${label}:view-after-actions`)
    attempt(`${label}:view-after-actions`, () => farmModule.view(data, api))
  }

  /** 3.x→4.0 迁移的不变量（OLD_YIELD 与 extensions/farm/server.js 保持一致）。 */
  function farmLosses(before, after) {
    const out = []
    const OLD_YIELD = { sprout: 2, scallion: 3, coriander: 3, lettuce: 3, cabbage: 3, strawberry: 3, blueberry: 4, carrot: 4, sweetpotato: 3, tomato: 4, corn: 5, pumpkin: 2, sunflower: 3, watermelon: 2, grape: 3, melon: 2 }
    if (after.version !== 4) out.push({ check: 'version', detail: `version=${after.version}` })
    if (!(after.unlocked >= 6 && after.unlocked <= 18)) out.push({ check: 'unlocked', detail: `unlocked=${after.unlocked}` })
    for (const [key, count] of Object.entries(asObject(before.seeds) ?? {})) {
      if (!Number.isFinite(count) || count <= 0) continue
      if (!(Number(after.seeds?.[key]) >= Math.floor(count))) out.push({ check: 'farm-seeds', detail: `${key}: ${Math.floor(count)} → ${after.seeds?.[key]}` })
    }
    for (const [key, count] of Object.entries(asObject(before.harvest) ?? {})) {
      if (!Number.isFinite(count) || count <= 0) continue
      if (!(Number(after.harvest?.[key]) >= Math.floor(count))) out.push({ check: 'farm-harvest', detail: `${key}: ${Math.floor(count)} → ${after.harvest?.[key]}` })
    }
    if (asObject(before.helper)?.hired === true && after.helper?.hired !== true) out.push({ check: 'farm-helper', detail: 'hired true → false' })
    const tools = asObject(before.tools) ?? {}
    if (tools.sickle === true && after.tools?.sickle !== true) out.push({ check: 'farm-tools', detail: 'sickle lost' })
    if (tools.can === true && after.tools?.sprayer !== true) out.push({ check: 'farm-tools', detail: '洒水器 → 喷雾桶 丢失' })
    if (tools.planter === true && after.tools?.planter !== true) out.push({ check: 'farm-tools', detail: 'planter lost' })
    // 旧地里的作物：迁移会按旧产量折进仓库；表里没有的作物会被丢掉
    const harvestBefore = asObject(before.harvest) ?? {}
    const expectedHarvest = {}
    for (const plot of Array.isArray(before.plots) ? before.plots : []) {
      const inner = asObject(plot)
      if (inner === null || typeof inner.crop !== 'string') continue
      const yieldCount = OLD_YIELD[inner.crop]
      if (yieldCount === undefined) { out.push({ check: 'farm-plot-crop', detail: `未知作物被丢弃: ${inner.crop}` }); continue }
      expectedHarvest[inner.crop] = (expectedHarvest[inner.crop] ?? Math.floor(Number(harvestBefore[inner.crop]) || 0)) + yieldCount
    }
    for (const [crop, expected] of Object.entries(expectedHarvest)) {
      if (!(Number(after.harvest?.[crop]) >= expected)) out.push({ check: 'farm-plot-yield', detail: `${crop}: ${harvestBefore[crop] ?? 0}(地 +${expected - Math.floor(Number(harvestBefore[crop]) || 0)}) → ${after.harvest?.[crop]}` })
    }
    const sprinklers = Array.isArray(before.sprinklers) ? before.sprinklers.filter(on => on === true).length : 0
    // 与 migrate() 的 count() 一致：负数、Infinity 都归 0
    const expectedRefund = sprinklers * 3000 + Math.max(0, Math.floor(Number(before.fertilizer) || 0)) * 20
    if (Number(after.refund) !== expectedRefund) out.push({ check: 'farm-refund', detail: `${after.refund} ≠ ${expectedRefund}` })
    return out
  }

  parentPort.on('message', msg => {
    if (msg.kind === 'control') { parentPort.postMessage({ control: runControls() }); return }
    if (msg.kind !== 'run') return
    let report
    try { report = runCase(msg.case) } catch (error) {
      report = { crashes: [{ stage: 'harness', name: error instanceof Error ? error.constructor.name : 'Error', message: error instanceof Error ? error.message : String(error), stack: String(error?.stack ?? '').split('\n').slice(0, 6).join('\n') }], losses: [], shape: [], rejected: null, stages: {} }
    }
    parentPort.postMessage({ id: msg.case.id, report })
  })

  /**
   * 阳性对照：故意造一批「确实丢了数据」的 before/after，检查每个不变量真的会响。
   * 全绿说明上面 0 丢失不是检查器失灵，而是真没丢。
   */
  function runControls() {
    /** @type {Array<[string, Record<string, unknown>, Record<string, unknown>]>} */
    const cases = [
      ['hatched', { hatched: true }, { hatched: false }],
      ['dead', { dead: true }, { dead: false }],
      ['coins', { coins: 100 }, { coins: 40 }],
      ['name', { name: '猪猪' }, { name: 'x' }],
      ['bornAt', { bornAt: 123 }, { bornAt: 456 }],
      ['xp', { version: 12, xp: 500 }, { xp: 499 }],
      ['inventory', { version: 12, inventory: { apple: 3 } }, { inventory: {} }],
      ['dress', { version: 12, dress: ['scarf'] }, { dress: [] }],
      ['lessons', { version: 12, lessons: { chinese: 2 } }, { lessons: {} }],
      ['traits', { version: 12, traits: { intel: 3 } }, { traits: { intel: 0 } }],
      ['souvenirs', { version: 12, souvenirs: ['贝壳'] }, { souvenirs: [] }],
      ['memories', { version: 12, memories: ['[08:00] 记一笔'] }, { memories: [] }],
    ]
    return cases.map(([check, before, after]) => ({
      check,
      fired: coreLosses(before, Object.assign({ inventory: {}, dress: [], lessons: {}, traits: {}, souvenirs: [], memories: [] }, after)).some(entry => entry.check === check),
    })).concat([
      { check: 'farm-seeds', fired: farmLosses({ seeds: { sprout: 3 } }, { version: 4 }).some(entry => entry.check === 'farm-seeds') },
      { check: 'farm-plot-crop', fired: farmLosses({ plots: [{ crop: 'nonexistent' }] }, { version: 4, harvest: {} }).some(entry => entry.check === 'farm-plot-crop') },
      { check: 'farm-plot-yield', fired: farmLosses({ plots: [{ crop: 'sprout' }] }, { version: 4, harvest: {} }).some(entry => entry.check === 'farm-plot-yield') },
      { check: 'farm-tools', fired: farmLosses({ tools: { can: true } }, { version: 4, tools: {} }).some(entry => entry.check === 'farm-tools') },
      { check: 'farm-refund', fired: farmLosses({ sprinklers: [true] }, { version: 4, refund: 0 }).some(entry => entry.check === 'farm-refund') },
    ])
  }
}

// ---------------------------------------------------------------------------
// 父进程：调度、统计、最小化、写产物
// ---------------------------------------------------------------------------

function spawn(slot) {
  const worker = new Worker(new URL(import.meta.url), { workerData: { slot: slot.index } })
  slot.worker = worker
  return worker
}

function ask(slot, msg, timeoutMs) {
  return new Promise(resolve => {
    const worker = slot.worker
    let settled = false
    const finish = value => { if (settled) return; settled = true; clearTimeout(timer); worker.off('message', onMessage); worker.off('error', onError); resolve(value) }
    const timer = setTimeout(() => finish({ timeout: true }), timeoutMs)
    const onMessage = data => {
      if (data?.kind === 'progress') { slot.lastStage = data.stage; return }
      finish(data)
    }
    const onError = error => finish({ workerError: String(error?.message ?? error) })
    worker.on('message', onMessage)
    worker.on('error', onError)
    worker.postMessage(msg)
  })
}

async function restart(slot) {
  const worker = slot.worker
  try { worker.removeAllListeners(); await worker.terminate() } catch { /* ignore */ }
  spawn(slot)
}

function signatureOf(crash) {
  return `${crash.stage}|${crash.name}|${String(crash.message).slice(0, 120)}`
}

function matchesReport(report, signature) {
  return Array.isArray(report?.crashes) && report.crashes.some(crash => signatureOf(crash) === signature)
}

const isObject = value => value !== null && typeof value === 'object'

function pathsOf(value, prefix, depth, out, budget) {
  if (out.length >= budget.maxPaths || depth > budget.maxDepth) return out
  out.push(prefix)
  if (Array.isArray(value)) {
    for (let index = 0; index < Math.min(value.length, 8); index += 1) pathsOf(value[index], [...prefix, index], depth + 1, out, budget)
  } else if (isObject(value)) {
    const keys = Object.keys(value).slice(0, 24)
    for (const key of keys) pathsOf(value[key], [...prefix, key], depth + 1, out, budget)
  }
  return out
}

function deepCopy(value) {
  return value === undefined ? undefined : JSON.parse(encode(value))
}

function parseJsonOrNull(text) {
  try { return JSON.parse(text) } catch { return null }
}

function withPath(root, path, replacement) {
  const copy = deepCopy(root)
  if (path.length === 0) return replacement
  let cursor = copy
  for (let i = 0; i < path.length - 1; i += 1) {
    cursor = cursor?.[path[i]]
    if (cursor === undefined || cursor === null) return copy
  }
  const last = path[path.length - 1]
  if (replacement === DELETED) delete cursor[last]
  else cursor[last] = replacement
  return copy
}

const DELETED = Symbol('deleted')

/** 父进程侧最小化：每次候选都在 worker 里重跑，超时算「仍崩溃」（死循环也要能缩）。 */
async function minimize(slot, baseCase, signature, timeoutMs, maxTests) {
  const hang = signature.includes('|timeout|')
  const probeMs = hang ? Math.min(timeoutMs, 700) : timeoutMs
  const budget = { maxPaths: hang ? 16 : 40, maxDepth: 3 }
  let best = deepCopy(parseJsonOrNull(baseCase.json))
  let tests = 0
  const stillCrashes = async candidate => {
    if (tests >= maxTests) return false
    tests += 1
    const caseCopy = { ...baseCase, json: encode(candidate) }
    const reply = await ask(slot, { kind: 'run', case: caseCopy }, probeMs)
    if (reply.timeout) { await restart(slot); return hang }
    if (reply.report === undefined) return false
    return matchesReport(reply.report, signature)
  }
  let improved = true
  let rounds = 0
  while (improved && tests < maxTests && rounds < 4) {
    improved = false
    rounds += 1
    for (const path of pathsOf(best, [], 0, [], budget)) {
      for (const candidate of [null, 0, '', [], {}, true, DELETED]) {
        if (path.length === 0 && candidate !== null && candidate !== DELETED) continue
        const next = withPath(best, path, candidate)
        if (encode(next) === encode(best)) continue
        if (await stillCrashes(next)) { best = next; improved = true; break }
      }
      if (improved) break
    }
  }
  return { value: best, tests }
}

const DEFAULT_OUT = join(REPO, '..', '..', 'results', 'save-fuzz')

/** 每个选项的默认值；`numeric: true` 的值必须能解析成有限数。 */
const OPTIONS = {
  cases: { numeric: true, fallback: 1500 },
  seed: { numeric: true, fallback: 20261014 },
  jobs: { numeric: true, fallback: 4 },
  timeout: { numeric: true, fallback: 1500 },
  minimize: { numeric: true, fallback: 8 },
  out: { numeric: false, fallback: null },
}

const USAGE = `用法：node tools/fuzz-saves.mjs [选项]

选项（括号里是默认值）：
  --cases <n>      跑多少例（1500）
  --seed <n>       随机种子，决定整串用例（20261014）
  --jobs <n>       并行 worker 数（4）
  --timeout <ms>   单例看门狗超时，超时算死循环（1500）
  --out <dir>      产物目录（${DEFAULT_OUT}）
  --minimize <n>   最多最小化几个崩溃签名（8）
  -h, --help       只打印本说明后退出，不跑用例、不碰任何目录
`

/**
 * 严格解析命令行。不认识的参数或缺少值直接抛错——必须在 mkdirSync / rmSync 之前跑完，
 * 否则拼错的参数会按默认值跑起来、还会把 outDir/crashes 里已归档的崩溃证据清掉。
 * 返回 { help: true }，或解析好的 { help: false, count, seed, jobs, timeoutMs, outDir, minimizeCrashes }。
 */
function parseArgs(argv) {
  if (argv.includes('--help') || argv.includes('-h')) return { help: true }
  const values = {}
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith('--')) throw new Error(`无法识别的参数：${token}`)
    const name = token.slice(2)
    if (!Object.hasOwn(OPTIONS, name)) throw new Error(`未知参数：${token}`)
    if (Object.hasOwn(values, name)) throw new Error(`参数重复：${token}`)
    const value = argv[index + 1]
    if (value === undefined || value.startsWith('--')) throw new Error(`参数 ${token} 缺少值`)
    values[name] = value
    index += 1
  }
  for (const [name, spec] of Object.entries(OPTIONS)) {
    if (!spec.numeric || !Object.hasOwn(values, name)) continue
    if (!Number.isFinite(Number(values[name]))) throw new Error(`参数 --${name} 必须是数字，收到：${values[name]}`)
  }
  const value = name => (Object.hasOwn(values, name) ? values[name] : OPTIONS[name].fallback)
  return {
    help: false,
    count: Number(value('cases')),
    seed: Number(value('seed')),
    jobs: Math.max(1, Number(value('jobs'))),
    timeoutMs: Number(value('timeout')),
    outDir: resolve(value('out') ?? DEFAULT_OUT),
    minimizeCrashes: Number(value('minimize')),
  }
}

async function main() {
  let options
  try {
    options = parseArgs(process.argv.slice(2))
  } catch (error) {
    process.stderr.write(`${error?.message ?? error}\n\n${USAGE}`)
    process.exitCode = 2
    return
  }
  if (options.help) {
    process.stdout.write(USAGE)
    return
  }
  const { count, seed, jobs, timeoutMs, outDir, minimizeCrashes } = options
  const rng = mulberry32(seed)
  const cases = Array.from({ length: count }, (_, index) => buildCase(rng, index))

  mkdirSync(join(outDir, 'crashes'), { recursive: true })
  for (const name of readdirSync(join(outDir, 'crashes'))) rmSync(join(outDir, 'crashes', name), { recursive: true, force: true })
  process.stdout.write(`模糊测试：cases=${count} seed=${seed} jobs=${jobs} timeout=${timeoutMs}ms out=${outDir}\n`)

  const slots = Array.from({ length: jobs }, (_, index) => ({ index, worker: null, lastStage: null }))
  for (const slot of slots) spawn(slot)

  // 阳性对照：故意丢字段，确认每个不变量都会响
  const control = await ask(slots[0], { kind: 'control' }, 10_000)
  const controls = control?.control ?? []
  const controlFailed = controls.filter(entry => entry.fired !== true)
  process.stdout.write(`阳性对照：${controls.length - controlFailed.length}/${controls.length} 个不变量会响${controlFailed.length ? `，未响：${controlFailed.map(entry => entry.check).join(',')}` : ''}\n`)

  const stats = {
    total: cases.length, ran: 0, rejected: 0, timedOut: 0,
    byTarget: {}, crashSignatures: new Map(), crashReports: [], losses: new Map(), shapes: new Map(), lossReports: [],
  }
  const started = Date.now()
  let next = 0

  const absorb = (c, reply, slot) => {
    stats.ran += 1
    const bucket = stats.byTarget[c.target] ?? { ran: 0, crash: 0, rejected: 0, timeout: 0, losses: 0 }
    bucket.ran += 1
    if (reply.timeout) {
      stats.timedOut += 1
      bucket.timeout += 1
      const stage = slot?.lastStage ?? `${c.target}:unknown`
      absorbCrash(c, { stage, name: 'Timeout', message: `>${timeoutMs}ms 未返回`, stack: '' }, true)
      stats.byTarget[c.target] = bucket
      return
    }
    const report = reply.report ?? {}
    if (report.rejected !== null && report.rejected !== undefined) { stats.rejected += 1; bucket.rejected += 1 }
    for (const crash of report.crashes ?? []) absorbCrash(c, crash, false)
    bucket.crash += (report.crashes ?? []).length
    for (const loss of report.losses ?? []) {
      const entry = stats.losses.get(loss.check) ?? { check: loss.check, count: 0, examples: [] }
      entry.count += 1
      if (entry.examples.length < 5) entry.examples.push({ id: c.id, target: c.target, strategy: c.strategy, version: c.version, detail: loss.detail, json: c.json.length > 4000 ? c.json.slice(0, 4000) : c.json })
      stats.losses.set(loss.check, entry)
      bucket.losses += 1
    }
    for (const shape of report.shape ?? []) {
      const entry = stats.shapes.get(shape) ?? { check: shape, count: 0, examples: [] }
      entry.count += 1
      if (entry.examples.length < 3) entry.examples.push({ id: c.id, target: c.target, strategy: c.strategy, json: c.json.slice(0, 2000) })
      stats.shapes.set(shape, entry)
    }
    stats.byTarget[c.target] = bucket
  }

  const absorbCrash = (c, crash, timeout) => {
    const signature = timeout ? `${crash.stage}|timeout|${crash.message}` : signatureOf(crash)
    const entry = stats.crashSignatures.get(signature) ?? { signature, stage: crash.stage, name: crash.name, message: crash.message, stack: crash.stack, count: 0, caseIds: [], firstCase: c, timeout }
    entry.count += 1
    entry.caseIds.push(c.id)
    if (entry.firstCase === undefined) entry.firstCase = c
    stats.crashSignatures.set(signature, entry)
  }

  const slotLoop = async slot => {
    for (;;) {
      const index = next
      next += 1
      if (index >= cases.length) break
      const c = cases[index]
      slot.lastStage = `${c.target}:dispatch`
      const reply = await ask(slot, { kind: 'run', case: c }, timeoutMs)
      if (reply.timeout) await restart(slot)
      if (reply.workerError !== undefined) {
        process.stderr.write(`worker 出错（slot ${slot.index}）：${reply.workerError}\n`)
        await restart(slot)
      }
      absorb(c, reply, slot)
    }
  }
  await Promise.all(slots.map(slotLoop))
  const elapsedMs = Date.now() - started
  process.stdout.write(`跑完 ${stats.ran} 例（${elapsedMs}ms），拒绝 ${stats.rejected}，超时 ${stats.timedOut}，崩溃签名 ${stats.crashSignatures.size}\n`)

  // 最小复现
  const crashList = [...stats.crashSignatures.values()].sort((a, b) => b.count - a.count)
  let minimizedCount = 0
  for (const entry of crashList.slice(0, minimizeCrashes)) {
    const base = entry.firstCase
    try {
      const budget = entry.signature.includes('|timeout|') ? 40 : 160
      const result = await minimize(slots[0], base, entry.signature, timeoutMs, budget)
      entry.minimized = result.value
      entry.minimizeTests = result.tests
      minimizedCount += 1
      process.stdout.write(`  最小化 ${entry.signature.slice(0, 80)}：${result.tests} 次尝试\n`)
    } catch (error) {
      entry.minimized = deepCopy(parseJsonOrNull(base.json))
      entry.minimizeError = String(error?.message ?? error)
    }
  }

  // 写产物
  const crashIndex = []
  crashList.forEach((entry, index) => {
    const value = entry.minimized ?? deepCopy(parseJsonOrNull(entry.firstCase.json))
    const slug = `${String(index + 1).padStart(2, '0')}-${(entry.stage + '-' + entry.name).replace(/[^a-zA-Z0-9-]+/g, '-').slice(0, 40)}`
    const file = join('crashes', `${slug}.json`)
    writeFileSync(join(outDir, file), JSON.stringify({
      target: entry.firstCase.target,
      stage: entry.stage,
      error: entry.name,
      message: entry.message,
      stack: entry.stack,
      count: entry.count,
      caseIds: entry.caseIds.slice(0, 20),
      minimized: entry.minimized !== undefined,
      minimizeTests: entry.minimizeTests ?? null,
      save: value,
    }, null, 2))
    crashIndex.push({ file, target: entry.firstCase.target, stage: entry.stage, error: entry.name, message: entry.message, count: entry.count, caseIds: entry.caseIds.slice(0, 20), minimized: entry.minimized !== undefined })
  })
  writeFileSync(join(outDir, 'crashes', 'index.json'), JSON.stringify(crashIndex, null, 2))

  const losses = [...stats.losses.values()].sort((a, b) => b.count - a.count)
  const shapes = [...stats.shapes.values()].sort((a, b) => b.count - a.count)
  writeFileSync(join(outDir, 'losses.json'), JSON.stringify(losses, null, 2))
  writeFileSync(join(outDir, 'shapes.json'), JSON.stringify(shapes, null, 2))

  const summary = {
    generatedAt: new Date().toISOString(),
    cases: count, seed, jobs, timeoutMs, elapsedMs, ran: stats.ran, rejected: stats.rejected, timedOut: stats.timedOut,
    byTarget: stats.byTarget,
    crashes: crashIndex,
    losses: losses.map(entry => ({ check: entry.check, count: entry.count })),
    shapes: shapes.map(entry => ({ check: entry.check, count: entry.count })),
    minimized: minimizedCount,
    controls,
  }
  writeFileSync(join(outDir, 'run-summary.json'), JSON.stringify(summary, null, 2))

  process.stdout.write('\n=== 崩溃 ===\n')
  if (crashIndex.length === 0) process.stdout.write('跑 ' + stats.ran + ' 例未崩溃\n')
  for (const entry of crashIndex) process.stdout.write(`[${entry.count}] ${entry.target} ${entry.stage} ${entry.error}: ${entry.message}\n`)
  process.stdout.write('\n=== 数据丢失（按 check 计数）===\n')
  for (const entry of losses) process.stdout.write(`[${entry.count}] ${entry.check}\n`)
  if (losses.length === 0) process.stdout.write('无\n')
  process.stdout.write('\n=== 形状异常 ===\n')
  for (const entry of shapes) process.stdout.write(`[${entry.count}] ${entry.check}\n`)
  if (shapes.length === 0) process.stdout.write('无\n')
  process.stdout.write(`\n产物：${outDir}\n`)

  for (const slot of slots) { try { slot.worker.removeAllListeners(); await slot.worker.terminate() } catch { /* ignore */ } }
}

if (isMainThread) await main()
else await workerMain()
