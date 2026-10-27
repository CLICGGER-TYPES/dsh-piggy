// @ts-check
/** Private prelaunch fixtures for exact-package QA; never reads personal state. */
import { cpSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { hatchEgg } from '../../../core.js'
import { LINES, LINE_MEMORY } from '../../../data.js'

const [directory, role] = process.argv.slice(2)
mkdirSync(directory, { recursive: true })
const state = hatchEgg(Date.now())
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
  state.extData[key] = extension.init()
  cpSync(new URL(`../../../extensions/${key}/`, import.meta.url), join(directory, 'extensions', key), { recursive: true })
}
writeFileSync(join(directory, 'state.json'), JSON.stringify(state))
writeFileSync(join(directory, 'proxy.json'), JSON.stringify({ mode: 'http', address: '127.0.0.1:9' }))
