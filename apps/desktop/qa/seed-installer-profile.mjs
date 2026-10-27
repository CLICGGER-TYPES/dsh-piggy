// @ts-check
/** Isolated native-installer fixture; never reads personal profiles. */
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { hatchEgg } from '../../../core.js'
import gacha from '../../../extensions/gacha/server.js'
const [profile, root] = process.argv.slice(2)
mkdirSync(profile, { recursive: true })
const state = hatchEgg(Date.now())
state.name = 'Installer QA'
state.coins = 1314
state.inventory.apple = 7
state.isOfflineFeedEnabled = false
state.extData = { gacha: gacha.init() }
writeFileSync(join(profile, 'state.json'), JSON.stringify(state))
writeFileSync(join(profile, 'proxy.json'), JSON.stringify({ mode: 'http', address: '127.0.0.1:9' }))
const extension = join(profile, 'extensions', 'gacha')
cpSync(join(root, 'extensions', 'gacha'), extension, { recursive: true })
const manifest = JSON.parse(readFileSync(join(extension, 'manifest.json'), 'utf8'))
manifest.version = '9.9.9'
writeFileSync(join(extension, 'manifest.json'), JSON.stringify(manifest))
writeFileSync(join(extension, 'owner-marker'), 'keep my version')
