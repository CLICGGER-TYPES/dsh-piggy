// @ts-check
/** Only the isolated preview imports extension-private save formats. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import farm, { CROPS } from '../extensions/farm/server.js'
import mine from '../extensions/mine/server.js'
import gacha from '../extensions/gacha/server.js'
import blindbox, { CATALOG } from '../extensions/blindbox/server.js'
import { recordExtensionEvent } from '../core.js'
const modules = { farm, mine, gacha, blindbox }

/** @param {string} folder */
export function installPreviewExtensions(folder) {
  for (const key of Object.keys(modules)) {
    const target = join(folder, 'extensions', key)
    mkdirSync(target, { recursive: true })
    for (const file of ['manifest.json', 'server.js', 'client.js']) writeFileSync(join(target, file), readFileSync(new URL('../extensions/' + key + '/' + file, import.meta.url)))
  }
}

/** @param {any} state @param {string} mode */
export function seedExtensionPreview(state, mode) {
  state.extData = Object.fromEntries(Object.entries(modules).map(([key, module]) => [key, module.init()]))
  state.extData.farm.plots[0] = { crop: 'carrot', stage: 3, wateredAt: null }
  if (mode === 'fresh') return
  state.extData.farm.acquired = mode === 'all' ? Object.fromEntries(CROPS.map(crop => [crop.key, crop.yield * 2])) : { carrot: 24, cabbage: 3 }
  Object.assign(state.extData.mine, { bag: { copper: 1 }, found: mode === 'all' ? { bone: true, fish: true, trex: true } : { bone: true }, deepest: mode === 'all' ? 10 : 3 })
  state.extData.gacha.milestones = { spins: 1, gold: mode === 'all' ? 1 : 0, machines: mode === 'all' ? ['snack', 'goods', 'medicine'] : ['snack'] }
  state.extData.blindbox.owned = Object.fromEntries(CATALOG.slice(0, mode === 'all' ? 10 : 1).map(item => [item.key, 1]))
  for (const [key, module] of Object.entries(modules)) {
    for (const event of module.progress(state.extData[key])) recordExtensionEvent(state, key, event)
  }
}
