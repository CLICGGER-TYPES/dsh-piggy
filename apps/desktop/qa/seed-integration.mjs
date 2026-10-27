// @ts-check
/** Private prelaunch fixtures for exact-package QA; never reads personal state. */
import { cpSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { hatchEgg } from '../../../core.js'
import { LINES, LINE_MEMORY } from '../../../data.js'

// Optional third argument selects an additional farm-v5 fixture. It is applied
// only to this private profile before any desktop/DSH process starts. The
// default fixture is unchanged so the existing identity/asset assertions keep
// the same data they had before the farm cases were added.
const [directory, role, fixture = 'default'] = process.argv.slice(2)
const MINUTE = 60000
const HOUR = 3600000
const FARM_FIXTURES = {
  // Six cabbage plots planted 25 minutes ago: real 18h maturity, ~17h35m left.
  natural: { plantedMinutesAgo: 25 },
  // Six cabbage plots already ripe: helper settles on the first real view,
  // harvests into helper.stock and replants the same crop before "collect".
  ripe: { plantedMinutesAgo: 18 * 60 + 12 },
}

/** Farm v5 data shape; stock stays zero until the desktop host really settles. */
function farmFixture(base, kind, now) {
  const preset = FARM_FIXTURES[kind]
  if (preset === undefined) return base
  const plantedAt = now - preset.plantedMinutesAgo * MINUTE
  // Every pest is strictly in the future, so the plots cannot be degraded by
  // the fixture itself; growth only comes from the real maturity time.
  const future = now + 365 * 24 * HOUR
  const data = structuredClone(base)
  data.version = 5
  data.unlocked = 6
  data.plots = Array.from({ length: 18 }, (_, index) => index < 6 ? {
    crop: 'cabbage', season: 1, plantedAt, boostMs: 0, roll: 0,
    pests: { weed: future, bug: future, dry: future },
  } : null)
  data.seeds = { cabbage: 12 }
  data.harvest = {}
  data.acquired = {}
  data.harvests = {}
  data.exp = 10000
  data.onboarding = { step: 'done', rewarded: true, legacy: false, plantedAt: null, wateredAt: null }
  data.helper = {
    ...data.helper,
    hired: true, level: 1, barn: 0, lastAt: plantedAt, usedMs: 0,
    cursor: 0, pending: null,
    targets: Array.from({ length: 18 }, (_, index) => index < 6 ? 'cabbage' : null),
    stock: { ...data.helper.stock },
  }
  return data
}

mkdirSync(directory, { recursive: true })
const now = Date.now()
const state = hatchEgg(now)
state.name = role === 'desktop' ? '桌面猪' : '内嵌猪'
state.coins = role === 'desktop' ? 1000 : 500
state.satiety = 90
state.inventory.apple = role === 'desktop' ? 5 : 3
state.isOfflineFeedEnabled = false
if (role !== 'desktop') {
  // A legitimate prelaunch history gives this lazy pig a back-pet reply.
  // The browser still has to perform pet + reply through the real UI/routes.
  state.personality = 'lazy'
  state.dialogue.greetedAt = Date.now()
  const recent = LINES.petBack.map((line, index) => ({ line, index }))
    .filter(({ line }) => (!line.personalities || line.personalities.includes('lazy')) && !line.replies?.length)
    .map(({ index }) => index)
  if (recent.length > LINE_MEMORY) throw new Error('Reply fixture history no longer excludes all non-reply back lines')
  state.dialogue.lastByScene.petBack = recent
}
state.extData = {}
for (const key of ['farm', 'mine', 'blindbox', 'gacha', 'pig-puzzle']) {
  const extension = (await import(`../../../extensions/${key}/server.js`)).default
  state.extData[key] = key === 'farm' ? farmFixture(extension.init(), fixture, now) : extension.init()
  cpSync(new URL(`../../../extensions/${key}/`, import.meta.url), join(directory, 'extensions', key), { recursive: true })
}
writeFileSync(join(directory, 'state.json'), JSON.stringify(state))
writeFileSync(join(directory, 'proxy.json'), JSON.stringify({ mode: 'http', address: '127.0.0.1:9' }))
