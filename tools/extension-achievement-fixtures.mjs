// @ts-check
/** Only the isolated preview imports extension-private save formats. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import farm, { CROPS } from '../extensions/farm/server.js'
import mine from '../extensions/mine/server.js'
import gacha from '../extensions/gacha/server.js'
import blindbox, { CATALOG } from '../extensions/blindbox/server.js'
import { recordExtensionEvent } from '../core.js'
import { generateMap } from '../extensions/mine/server.js'
const modules = { farm, mine, gacha, blindbox }

/** @param {string} folder */
export function installPreviewExtensions(folder) {
  for (const key of Object.keys(modules)) {
    const target = join(folder, 'extensions', key)
    mkdirSync(target, { recursive: true })
    for (const file of ['manifest.json', 'server.js', 'client.js']) writeFileSync(join(target, file), readFileSync(new URL('../extensions/' + key + '/' + file, import.meta.url)))
    // 当前扩展已带图片，试玩也必须复制 manifest 列出的资源。
    const manifest = JSON.parse(readFileSync(join(target, 'manifest.json'), 'utf8'))
    mkdirSync(join(target, 'assets'), { recursive: true })
    for (const name of manifest.assets ?? []) writeFileSync(join(target, 'assets', name), readFileSync(new URL('../extensions/' + key + '/assets/' + name, import.meta.url)))
  }
}

/** @param {any} state @param {string} mode */
export function seedExtensionPreview(state, mode) {
  state.extData = Object.fromEntries(Object.entries(modules).map(([key, module]) => [key, module.init()]))
  const crop = mode === 'near' ? CROPS[14].key : 'carrot'
  state.extData.farm.plots[0] = { crop, season: 1, plantedAt: Date.now() - 40 * 3600000, boostMs: 0, roll: 0,
    pests: { weed: 1e15, bug: 1e15, dry: 1e15 } }
  if (mode === 'fresh') return
  // 历史示例已收过菜，关闭一次性试种引导，避免挡住正常收获。
  state.extData.farm.onboarding = { step: 'done', rewarded: true, legacy: true, plantedAt: null, wateredAt: null }
  const farmKinds = mode === 'all' ? 15 : mode === 'near' ? 14 : 2
  state.extData.farm.harvests = Object.fromEntries(CROPS.slice(0, farmKinds).map((item, index) => [item.key, index === 0 ? (mode === 'all' ? 86 : mode === 'near' ? 86 : 8) : 1]))
  state.extData.farm.exp = 2000
  Object.assign(state.extData.mine, { bag: { copper: 1 }, oreCount: 1, found: mode === 'all' || mode === 'near' ? { bone: true, fish: true, trex: true } : { bone: true }, deepest: mode === 'all' ? 20 : mode === 'near' ? 19 : 3 })
  if (mode === 'near') {
    const data = state.extData.mine
    data.layer = 19; data.pickaxe = 5
    const ladder = generateMap(19, data.run, 5).findIndex(cell => cell.kind === 'ladder')
    data.maps[19] = { open: [0, 1, 2, 3, 4, 5, ladder], hits: {} }
  }
  state.extData.gacha.milestones = { spins: 1, gold: mode === 'all' || mode === 'near' ? 1 : 0, machines: mode === 'all' || mode === 'near' ? ['snack', 'goods', 'medicine'] : ['snack'] }
  state.extData.blindbox.owned = Object.fromEntries(CATALOG.slice(0, mode === 'all' || mode === 'near' ? 10 : 1).map(item => [item.key, 1]))
  for (const [key, module] of Object.entries(modules)) {
    for (const event of module.progress(state.extData[key])) recordExtensionEvent(state, key, event)
  }
}
