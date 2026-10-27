// @ts-check
/** Private prelaunch fixtures for exact-package QA; never reads personal state. */
import { cpSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { hatchEgg } from '../../../core.js'

const [directory, role] = process.argv.slice(2)
mkdirSync(directory, { recursive: true })
const state = hatchEgg(Date.now())
state.name = role === 'desktop' ? '桌面猪' : '内嵌猪'
state.coins = role === 'desktop' ? 1000 : 500
state.satiety = 90
state.inventory.apple = role === 'desktop' ? 5 : 3
state.isOfflineFeedEnabled = false
state.extData = {}
for (const key of ['farm', 'mine', 'blindbox', 'gacha', 'pig-puzzle']) {
  const extension = (await import(`../../../extensions/${key}/server.js`)).default
  state.extData[key] = extension.init()
  cpSync(new URL(`../../../extensions/${key}/`, import.meta.url), join(directory, 'extensions', key), { recursive: true })
}
writeFileSync(join(directory, 'state.json'), JSON.stringify(state))
writeFileSync(join(directory, 'proxy.json'), JSON.stringify({ mode: 'http', address: '127.0.0.1:9' }))
