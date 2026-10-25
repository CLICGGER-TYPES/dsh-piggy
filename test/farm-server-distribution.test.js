// @ts-check
// 菜园服务端的分发守卫：源码在 src/extensions/farm/，下载产物仍是单文件 extensions/farm/server.js。
// 新鲜度、导出契约、无运行时 import，以及「三文件协议装进隔离临时目录后第一课真的能走」都在这里。
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'

import { hatchEgg } from '../core.js'
import { buildFarmServer } from '../scripts/build-farm-server.mjs'
import { createStore } from '../store.js'
import { createExtRuntime } from '../store/ext-runtime.js'
import { createJournal } from '../store/journal.js'

const NOW = 1_800_259_200_000
const MIN = 60_000
const packageRoot = new URL('..', import.meta.url)
const farmRoot = new URL('../extensions/farm/', import.meta.url)
const generatedUrl = new URL('../extensions/farm/server.js', import.meta.url)
const readFarm = name => readFileSync(new URL(name, farmRoot))
const sha = buffer => createHash('sha256').update(buffer).digest('hex')
const gameVersion = JSON.parse(readFileSync(new URL('package.json', packageRoot), 'utf8')).version

/** 菜园服务端导出的全部名字；少一个老面板或老测试就会断。 */
const NAMED_EXPORTS = [
  'CARE_EXP', 'CROPS', 'EXERT', 'EXP_CAP', 'EXP_PER_LEVEL', 'FERTILIZERS', 'HELPER_PLOTS',
  'HELPER_PRICES', 'HELPER_SHARE', 'HELPER_WINDOW', 'LESSON', 'OLD_HELPER_BARN_PRICES', 'PESTS',
  'PEST_LOSS', 'PEST_MS', 'PLOTS', 'RECLAIM_PRICE', 'STAGES', 'START_PLOTS', 'TOOLS', 'cropFor',
  'default', 'helperRecipe', 'levelOf', 'normalize', 'plotState', 'progress', 'setRandom',
  'settleHelper', 'weatherAt',
]

test('the committed farm server is exactly the readable bundle built from src/extensions/farm', async () => {
  const committed = readFileSync(generatedUrl, 'utf8')
  const rebuilt = await buildFarmServer()
  assert.equal(committed, rebuilt, 'extensions/farm/server.js is stale — run `npm run build`')
  assert.match(committed, /^\/\/ GENERATED FILE\. Edit src\/extensions\/farm\//)
  assert.match(committed, /download protocol is still manifest\.json \+ server\.js \+ client\.js \+ assets/)
  // 不是压成一行的产物：按模块分段，缩进和空行都在。
  assert.ok(committed.split('\n').length > 300, 'the distribution should stay readable, not minified')
  for (const module of ['data.js', 'host.js', 'pure.js', 'plot-rules.js', 'helper.js', 'migration.js', 'actions.js', 'view.js', 'server.js']) {
    assert.match(committed, new RegExp('// src/extensions/farm/' + module.replace('.', '\\.')))
  }
})

test('the generated server has the original named/default exports and no runtime imports', async () => {
  const text = readFileSync(generatedUrl, 'utf8')
  assert.ok(!/^\s*import\s/m.test(text), 'a downloaded single file must not import another module')
  assert.ok(!/\bfrom\s+['"][^'"]+['"]/.test(text.replace(/\/\/.*$/gm, '')), 'no module specifiers at runtime')
  assert.ok(!/\brequire\s*\(/.test(text), 'no CommonJS require')
  const imported = await import(pathToFileURL(new URL(generatedUrl).pathname).href + '?distribution=' + Date.now())
  assert.deepEqual(Object.keys(imported).sort(), NAMED_EXPORTS)
  assert.equal(imported.default.eventVersion, 1)
  assert.equal(typeof imported.default.init, 'function')
  assert.equal(typeof imported.default.view, 'function')
  assert.equal(typeof imported.progress, 'function')
  assert.deepEqual(Object.keys(imported.default.actions).sort(), [
    'buy', 'care', 'careAll', 'clear', 'clearAll', 'collect', 'fertilize', 'harvest', 'harvestAll',
    'hire', 'onboarding', 'plant', 'plantAll', 'sell', 'store', 'unlock', 'upgrade',
  ])
})

test('the three-file download installs in an isolated directory and runs the tutorial there', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-piggy-farm-dist-'))
  let clock = NOW
  const manifestText = readFarm('manifest.json').toString('utf8')
  const manifest = JSON.parse(manifestText)
  const packages = {
    'manifest.json': readFarm('manifest.json'),
    'server.js': readFarm('server.js'),
    'client.js': readFarm('client.js'),
  }
  for (const name of manifest.assets ?? []) packages['assets/' + name] = readFarm('assets/' + name)
  const files = Object.fromEntries(Object.entries(packages).map(([name, value]) => [name, {
    url: 'https://example.test/farm/' + name, sha256: sha(value),
  }]))
  const registry = { extensions: [{ ...manifest, files }] }
  try {
    writeFileSync(join(dir, 'state.json'), JSON.stringify(hatchEgg(NOW)))
    const store = createStore(join(dir, 'state.json'), { now: () => clock, journal: createJournal({ now: () => clock }) })
    const runtime = createExtRuntime(store, {
      gameVersion, now: () => clock, registryUrl: 'https://example.test/registry.json',
      fetch: async url => {
        if (url === 'https://example.test/registry.json') return new Response(JSON.stringify(registry))
        const name = String(url).replace('https://example.test/farm/', '')
        return new Response(packages[name] ?? '', { status: packages[name] === undefined ? 404 : 200 })
      },
    })
    store.ext = runtime
    await runtime.ready
    assert.equal((await runtime.install('farm')).ok, true)
    assert.equal(store.state.extData.farm.version, 5)
    assert.equal(store.state.extData.farm.onboarding.step, 'offer')
    assert.equal(store.state.extData.farm.onboarding.legacy, false)

    assert.equal(runtime.act('farm', 'onboarding', { op: 'start' }).ok, true)
    assert.equal(runtime.act('farm', 'onboarding', { op: 'plant' }).ok, true)
    assert.equal(store.state.extData.farm.onboarding.step, 'planted')
    assert.equal(runtime.act('farm', 'onboarding', { op: 'water' }).ok, true)
    clock += 2 * MIN
    assert.equal(runtime.act('farm', 'onboarding', { op: 'harvest' }).ok, true)
    assert.equal(store.state.extData.farm.onboarding.step, 'done')
    assert.equal(store.state.extData.farm.onboarding.rewarded, true)
    assert.equal(store.state.wallets.farm.balance, 12)
    assert.equal(store.state.extData.farm.seeds.scallion, 1)
    assert.equal(store.state.extData.farm.exp, 0)
    const view = runtime.views(store.state).farm
    assert.equal(view.onboarding.step, 'done')
    assert.equal(view.balance, 12)
    assert.equal(view.seeds.find(seed => seed.key === 'scallion').count, 1)
    store.dispose()
  } finally {
    rmSync(dir, { recursive: true, force: true, maxRetries: 3 })
  }
})
