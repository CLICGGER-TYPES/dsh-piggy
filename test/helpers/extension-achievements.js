// @ts-check
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { createStore } from '../../store.js'
import { createJournal } from '../../store/journal.js'
import { createExtRuntime } from '../../store/ext-runtime.js'
import { hatchEgg } from '../../core.js'
export const NOW = 1_800_000_000_000
export const KEYS = ['farm', 'mine', 'gacha', 'blindbox']

export async function setupExtensions(initial = {}, overrides = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'pig-ext-achievements-'))
  const state = hatchEgg(NOW)
  state.coins = 20000
  state.extData = initial
  const packages = {}
  for (const key of KEYS) {
    packages[key] = {}
    for (const file of ['manifest.json', 'server.js', 'client.js']) packages[key][file] = readFileSync(new URL('../../extensions/' + key + '/' + file, import.meta.url), 'utf8')
    if (overrides[key]) Object.assign(packages[key], overrides[key])
    if (Object.hasOwn(initial, key)) {
      const target = join(dir, 'extensions', key)
      mkdirSync(target, { recursive: true })
      for (const [file, value] of Object.entries(packages[key])) writeFileSync(join(target, file), value)
    }
  }
  writeFileSync(join(dir, 'state.json'), JSON.stringify(state))
  const store = createStore(join(dir, 'state.json'), { now: () => NOW, journal: createJournal({ now: () => NOW }) })
  const entries = KEYS.map(key => ({ ...JSON.parse(packages[key]['manifest.json']), files: Object.fromEntries(Object.entries(packages[key]).map(([file, value]) =>
    [file, { url: 'https://example.test/' + key + '/' + file, sha256: createHash('sha256').update(value).digest('hex') }])) }))
  const runtime = createExtRuntime(store, { gameVersion: '0.32.0', now: () => NOW, registryUrl: 'https://example.test/registry.json',
    fetch: async url => {
      if (url === 'https://example.test/registry.json') return new Response(JSON.stringify({ extensions: entries }))
      const [key, file] = String(url).replace('https://example.test/', '').split('/')
      return new Response(packages[key]?.[file] ?? '', { status: packages[key]?.[file] === undefined ? 404 : 200 })
    } })
  store.ext = runtime
  await runtime.ready
  return { dir, store, runtime, dispose() { store.dispose(); rmSync(dir, { recursive: true, force: true, maxRetries: 3 }) } }
}
