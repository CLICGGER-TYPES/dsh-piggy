// @ts-check
/** #14 扩展合并钩子：只从目标端已安装扩展加载、纯数据校验、异常降级。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createGameRuntime } from '../runtime/index.js'
import { startPairServer } from '../runtime/pair-server.js'
import { createSaveArchive } from '../runtime/save-archive.js'
import { hatchEgg, migrate } from '../core.js'

const NOW = 1_800_000_000_000
const temp = () => mkdtempSync(join(tmpdir(), 'piggy-hook-'))
const fresh = patch => Object.assign(migrate(hatchEgg(NOW), NOW), patch)
const read = file => JSON.parse(readFileSync(file, 'utf8'))

function install(dir, server, mergeHook = 1) {
  const folder = join(dir, 'extensions', 'garden')
  mkdirSync(folder, { recursive: true })
  writeFileSync(join(folder, 'manifest.json'), JSON.stringify({ key: 'garden', label: '小花园', version: '1.0.0', mergeHook }))
  writeFileSync(join(folder, 'server.js'), server)
  writeFileSync(join(folder, 'client.js'), 'export const ok = true\n')
}

async function run(dir, target, source, confirm = () => true) {
  const statePath = join(dir, 'state.json')
  writeFileSync(statePath, JSON.stringify(target))
  const runtime = createGameRuntime({ statePath, now: () => NOW })
  await runtime.ext?.ready
  const pair = await startPairServer({ runtime, directory: join(dir, 'endpoint'), appVersion: '0.6.7', gameVersion: '0.37.2', confirm, now: () => NOW })
  const disco = read(join(dir, 'endpoint', 'pair.json'))
  const base = `http://127.0.0.1:${disco.port}`
  const headers = { authorization: `Bearer ${disco.token}` }
  try {
    const archive = createSaveArchive({ statePath: join(dir, 'source.json'), state: source, nowMs: NOW })
    let response = await fetch(base + '/pair/merge/preview', { method: 'POST', headers: { ...headers, 'content-type': 'application/zip' }, body: archive.buffer })
    const preview = await response.json()
    assert.equal(response.status, 200, JSON.stringify(preview))
    response = await fetch(base + '/pair/merge/commit', { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ mergeId: preview.mergeId, previewToken: preview.previewToken, choices: { duplicate: 'merge' } }) })
    const commit = await response.json()
    return { preview, commit, state: read(statePath) }
  } finally { await pair.close(); runtime.dispose() }
}

test('官方/已安装扩展的 mergeStates 自动合并，纯数据返回；不用二选一', async () => {
  const dir = temp()
  try {
    install(dir, `export default {
      eventVersion: 1,
      mergeStates(target, source) {
        target.level += source.level
        return { data: { level: target.level }, warnings: ['已合并'], conflicts: [] }
      },
    }\n`)
    const result = await run(dir, fresh({ extData: { garden: { level: 2 } } }), fresh({ extData: { garden: { level: 9 } } }))
    assert.deepEqual(result.state.extData.garden, { level: 11 })
    assert.equal(result.preview.conflicts.some(item => item.key === 'ext:garden'), false)
    assert.match(result.commit.warnings.join(' '), /已合并/)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('钩子抛错/返回函数/没有 mergeHook 时降级为二选一，不写半个结果', async () => {
  for (const server of [
    `export default { eventVersion: 1, mergeStates() { throw new Error('boom') } }\n`,
    `export default { eventVersion: 1, mergeStates() { return { data: { fn: () => 1 } } } }\n`,
  ]) {
    const dir = temp()
    try {
      install(dir, server)
      const result = await run(dir, fresh({ extData: { garden: { level: 2 } } }), fresh({ extData: { garden: { level: 9 } } }))
      assert.equal(result.commit.ok, true, JSON.stringify(result.commit))
      assert.deepEqual(result.state.extData.garden, { level: 2 }, '默认保留桌宠')
      assert.ok(result.preview.conflicts.some(item => item.key === 'ext:garden'))
    } finally { rmSync(dir, { recursive: true, force: true }) }
  }
  const dir = temp()
  try {
    install(dir, 'export default { eventVersion: 1 }\n', 0)
    const result = await run(dir, fresh({ extData: { garden: { level: 2 } } }), fresh({ extData: { garden: { level: 9 } } }))
    assert.deepEqual(result.state.extData.garden, { level: 2 })
    assert.ok(result.preview.conflicts.some(item => item.key === 'ext:garden'))
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
