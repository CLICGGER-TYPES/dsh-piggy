// @ts-check
/** 旧外壳安装目录缺少兼容记录时迁移元数据，回退仍检查最终存档。 */
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { createVersions } from '../lib/versions.js'

const ROOT = fileURLToPath(new URL('../../..', import.meta.url))

async function legacyInstall(t, schema = 14) {
  const directory = await mkdtemp(join(tmpdir(), 'piggy-legacy-schema-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const root = join(directory, 'versions')
  const version = schema === 12 ? '0.36.1' : '0.37.0'
  for (const [installed, supported] of [[version, schema], ['0.38.0', 14]]) {
    const target = join(root, String(installed))
    await mkdir(join(target, 'packages/pet-core/src/core'), { recursive: true })
    await writeFile(join(target, 'package.json'), JSON.stringify({ version: installed }))
    // 如果兼容检查执行了旧模块，这个异常会直接使回归失败。
    await writeFile(join(target, 'packages/pet-core/src/core/constants.js'),
      `export const STATE_VERSION = ${supported}\nthrow new Error('must not execute old game')\n`)
  }
  const statePath = join(directory, 'state.json'), activeFile = join(root, 'active.json')
  await writeFile(statePath, JSON.stringify({ version: 14 }))
  await writeFile(activeFile, JSON.stringify({ active: '0.38.0', previous: version, shell: '0.6.6' }))
  const versions = createVersions({ userData: directory, bundledDir: ROOT, statePath, shellVersion: '0.6.6' })
  return { versions, root, version, activeFile, manifest: join(root, `${version}.manifest.json`),
    constants: join(root, version, 'packages/pet-core/src/core/constants.js') }
}

test('旧外壳安装的 0.37.0 缺少兼容记录时补齐并成功回退，不执行旧游戏', async t => {
  const fixture = await legacyInstall(t)
  await assert.rejects(readFile(fixture.manifest), { code: 'ENOENT' })
  const source = await readFile(fixture.constants)
  assert.deepEqual(fixture.versions.rollback(), { ok: true, version: '0.37.0' })
  assert.deepEqual(JSON.parse(await readFile(fixture.manifest, 'utf8')), { version: '0.37.0', stateVersion: 14 })
  assert.equal(fixture.versions.current().version, '0.37.0')
  assert.deepEqual(await readFile(fixture.constants), source, '补记录不改写已有游戏文件')
})

test('旧目录补出 schema 12 后仍拒绝 schema 14 存档，激活记录保持不变', async t => {
  const fixture = await legacyInstall(t, 12)
  const active = await readFile(fixture.activeFile)
  const result = fixture.versions.rollback()
  assert.equal(result.ok, false)
  assert.match(result.reason, /当前存档版本为 14.*只支持 12/)
  assert.deepEqual(JSON.parse(await readFile(fixture.manifest, 'utf8')), { version: '0.36.1', stateVersion: 12 })
  assert.deepEqual(await readFile(fixture.activeFile), active)
})

for (const [name, content] of [
  ['JSON 损坏', '{'],
  ['版本不一致', JSON.stringify({ version: '0.36.1', stateVersion: 14 })],
  ['缺少 schema', JSON.stringify({ version: '0.37.0' })],
]) {
  test(`已有兼容记录（${name}）时拒绝回退，不以源码迁移覆盖现场`, async t => {
    const fixture = await legacyInstall(t)
    await writeFile(fixture.manifest, content)
    const active = await readFile(fixture.activeFile)
    assert.equal(fixture.versions.rollback().ok, false)
    assert.equal(await readFile(fixture.manifest, 'utf8'), content)
    assert.deepEqual(await readFile(fixture.activeFile), active)
  })
}

test('旧目录源码没有明确 schema 时不生成兼容记录或改变激活版本', async t => {
  const fixture = await legacyInstall(t)
  await writeFile(fixture.constants, 'export const STATE_VERSION = unsupportedExpression()\n')
  const active = await readFile(fixture.activeFile)
  const result = fixture.versions.rollback()
  assert.equal(result.ok, false)
  assert.match(result.reason, /请从版本列表重新安装/)
  await assert.rejects(readFile(fixture.manifest), { code: 'ENOENT' })
  assert.deepEqual(await readFile(fixture.activeFile), active)
})

test('旧目录 package 版本不匹配时不迁移兼容记录', async t => {
  const fixture = await legacyInstall(t)
  await writeFile(join(fixture.root, fixture.version, 'package.json'), JSON.stringify({ version: '0.36.1' }))
  const active = await readFile(fixture.activeFile)
  assert.equal(fixture.versions.rollback().ok, false)
  await assert.rejects(readFile(fixture.manifest), { code: 'ENOENT' })
  assert.deepEqual(await readFile(fixture.activeFile), active)
})
