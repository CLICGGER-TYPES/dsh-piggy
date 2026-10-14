// @ts-check
/** A 拆分的兼容边界：公开 API、默认存档、命令注册与旧游戏包。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as plugin from '../index.js'
import { defaultStatePath } from '../store/state-file.js'
import { createGameRuntime } from '../runtime/index.js'
import { startHost } from '../apps/desktop/lib/host.js'
import { packGame } from '../apps/desktop/scripts/pack-game.mjs'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

test('A 保持根插件公开 API', () => {
  assert.deepEqual(Object.keys(plugin).sort(), ['JOBS','MAX','SCHOOL_STAGES','SHOP','SUBJECTS','TRAITS','TRAIT_ORDER','TRIPS','apply','dispatch','inject','jobByKey','name','performAction','snapshot'].sort())
  assert.equal(plugin.name, 'dsh-piggy')
  assert.deepEqual(plugin.inject, [])
})

test('A 默认路径及命令名称、提示和动作列表保持兼容', () => {
  const directory = mkdtempSync(join(tmpdir(), 'piggy-compat-'))
  const previous = process.env.DSH_HOME
  process.env.DSH_HOME = directory
  const cleanup = []
  let command
  try {
    assert.equal(defaultStatePath(), join(directory, 'dsh-piggy', 'state.json'))
    plugin.apply({ on() {}, effect(fn) { cleanup.push(fn()) }, inject(deps, fn) {
      if (deps.includes('commands')) fn({ commands: { register(entry) { command = entry } } })
    } })
    assert.equal(command.name, 'pig')
    assert.equal(command.input.hint, '[hatch|feed|bathe|play|pet|study <科目>|work <job>|trip <目的地>|shop|buy|use|weigh|about]')
    assert.match(command.handler({ rawInput: 'unknown' }).text, /hatch · adopt · feed · bathe · play · pet · study · interest · work · trip · calloff · shop · buy · use · sell · wear · crown · weigh · name · reply · about/)
  } finally {
    cleanup.forEach(dispose => dispose())
    if (previous === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previous
    rmSync(directory, { recursive: true, force: true })
  }
})

test('A 运行时不暴露原始 Store；旧游戏包仍走原加载路径', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'piggy-legacy-'))
  const runtime = createGameRuntime({ statePath: join(directory, 'runtime.json') })
  let host
  try {
    assert.equal('store' in runtime, false)
    packGame(ROOT, join(directory, 'game'))
    rmSync(join(directory, 'game', 'runtime'), { recursive: true })
    host = await startHost(join(directory, 'game'), join(directory, 'legacy.json'))
    assert.deepEqual(Object.keys(host.store), ['journal'])
    assert.deepEqual(Object.keys(host.store.journal), ['record'])
    assert.equal(typeof host.store.journal.record, 'function')
    assert.equal(typeof host.record, 'function')
    host.store.journal.record('info', 'compat', '旧包日志代理检查')
    assert.equal(JSON.parse((await host.handle('POST', '/dsh-piggy/act', '{"action":"hatch"}')).body).hatched, true)
  } finally { runtime.dispose(); await host?.dispose(); rmSync(directory, { recursive: true, force: true }) }
})
