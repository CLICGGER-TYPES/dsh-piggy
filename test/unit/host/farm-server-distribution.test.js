// @ts-check
// 菜园服务端的分发守卫：源码在 src/extensions/farm/，下载产物仍是单文件 extensions/farm/server.js。
// 新鲜度、导出契约、无运行时 import，以及「三文件协议装进隔离临时目录后第一课真的能走」都在这里。
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { hatchEgg } from '../../../core.js'
import { buildFarmServer } from '../../../scripts/build-farm-server.mjs'
import { createStore } from '../../../store.js'
import { createExtRuntime } from '../../../store/ext-runtime.js'
import { createJournal } from '../../../store/journal.js'

const NOW = 1_800_259_200_000
const MIN = 60_000
const packageRoot = new URL('../../..', import.meta.url)
const farmRoot = new URL('../../../extensions/farm/', import.meta.url)
const generatedUrl = new URL('../../../extensions/farm/server.js', import.meta.url)
const readFarm = name => readFileSync(new URL(name, farmRoot))
const sha = buffer => createHash('sha256').update(buffer).digest('hex')
const gameVersion = JSON.parse(readFileSync(new URL('package.json', packageRoot), 'utf8')).version

/** 菜园服务端导出的全部名字；少一个老面板或老测试就会断。 */
const NAMED_EXPORTS = [
  'CARE_EXP', 'CROPS', 'EXERT', 'EXP_CAP', 'EXP_PER_LEVEL', 'FERTILIZERS', 'HELPER_CYCLE_MS', 'HELPER_MAX', 'HELPER_PLOTS',
  'HELPER_PLOTS_PER_WORKER', 'HELPER_PRICES', 'HELPER_REST_AT', 'HELPER_REST_MS', 'HELPER_SHARE', 'HELPER_STAGGER_MS', 'HELPER_WINDOW', 'HELPER_WORK_MS', 'HELPER_WORK_WINDOW_MS', 'LESSON', 'OLD_HELPER_BARN_PRICES', 'PESTS',
  'PEST_LOSS', 'PEST_MS', 'PLOTS', 'RECLAIM_PRICE', 'STAGES', 'START_PLOTS', 'TOOLS', 'cropFor',
  'default', 'helperEnergyAt', 'helperNextWorkAt', 'helperPatrolOnDuty', 'helperRecipe', 'helperWorkingAt', 'levelOf', 'normalize', 'plotState', 'progress', 'setHelperEnergy', 'setRandom',
  'settleHelper', 'weatherAt',
  // v9 巡逻区 / 偷窃
  'HELPER_PATROL_ZONE_PLOTS', 'THEFT_GAP_HELPER', 'THEFT_GAP_NO_HELPER', 'THEFT_GUARD_CHANCE', 'THEFT_HEAVY_CHANCE',
  'THEFT_HEAVY_LOSS', 'THEFT_LOG_MAX', 'THEFT_LOOKBACK_MS', 'THEFT_LOSS_CAP', 'THEFT_MAX_EVENTS', 'THEFT_NORMAL_LOSS',
  'THEFT_SOON_MS', 'alignTheft', 'hasTheftTargets', 'helperPatrolWorkers', 'nextTheftAt', 'normalizeTheft',
  'patrolOwnerOfZone', 'patrolZoneCount', 'patrolZoneOf', 'patrolZoneRange', 'patrolZones', 'pickTheftTarget',
  'resolveTheft', 'setTheft', 'settleTheftOnly', 'skipTheftClock', 'theftEnabled', 'theftView', 'zoneGuardState',
  'zoneGuardedAt',
]

test('the generated farm server on disk is exactly the readable bundle built from src/extensions/farm', async () => {
  assert.ok(existsSync(generatedUrl), 'extensions/farm/server.js is missing — run `npm run build` first')
  const generated = readFileSync(generatedUrl, 'utf8')
  const rebuilt = await buildFarmServer()
  assert.equal(generated, rebuilt, 'extensions/farm/server.js is stale — run `npm run build`')
  assert.match(generated, /^\/\/ GENERATED FILE\. Edit src\/extensions\/farm\//)
  assert.match(generated, /download protocol is still manifest\.json \+ server\.js \+ client\.js \+ assets/)
  // 不是压成一行的产物：按模块分段，缩进和空行都在。
  assert.ok(generated.split('\n').length > 300, 'the distribution should stay readable, not minified')
  for (const module of ['data.js', 'host.js', 'pure.js', 'plot-rules.js', 'helper.js', 'migration.js', 'actions.js', 'view.js', 'server.js']) {
    assert.match(generated, new RegExp('// src/extensions/farm/' + module.replace('.', '\\.')))
  }
})

test('the generated server has the original named/default exports and no runtime imports', async () => {
  const text = readFileSync(generatedUrl, 'utf8')
  assert.ok(!/^\s*import\s/m.test(text), 'a downloaded single file must not import another module')
  assert.ok(!/\bfrom\s+['"][^'"]+['"]/.test(text.replace(/\/\/.*$/gm, '')), 'no module specifiers at runtime')
  assert.ok(!/\brequire\s*\(/.test(text), 'no CommonJS require')
  const imported = await import(generatedUrl.href + '?distribution=' + Date.now())
  assert.deepEqual(Object.keys(imported).sort(), [...NAMED_EXPORTS].sort())
  assert.equal(imported.default.eventVersion, 1)
  assert.equal(typeof imported.default.init, 'function')
  assert.equal(typeof imported.default.view, 'function')
  assert.equal(typeof imported.progress, 'function')
  assert.deepEqual(Object.keys(imported.default.actions).sort(), [
    'buy', 'care', 'careAll', 'clear', 'clearAll', 'collect', 'fertilize', 'harvest', 'harvestAll',
    'hire', 'hireAdditional', 'onboarding', 'plant', 'plantAll', 'sell', 'setHelperRest', 'setHelperRole',
    'setHelperSchedule', 'store', 'toggleHelper', 'unlock', 'upgrade',
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
    assert.equal(store.state.extData.farm.version, 9)
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
