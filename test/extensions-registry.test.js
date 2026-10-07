// @ts-check
/**
 * 仓库里的扩展（extensions/<key>/）和两份在线目录（registry.json / registry-gitee.json）对得上。
 *
 * 规则见 docs/guides/writing-extensions.md：改了扩展的任何一个文件就要升版本、重新生成目录条目、
 * 发 ext-<key>-<版本> 发行版。这里守住「改了代码忘了升版本 / 忘了更新目录」——
 * 以前这种错要等玩家装出「校验值不对」才发现。
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { test } from 'node:test'

import { EXTENSIONS } from '../packages/pet-core/src/data/extensions.js'
import { EXTENSION_EVENTS } from '../packages/pet-core/src/data/extension-events.js'
import { versionAtLeast } from '../store/ext-runtime.js'

const ROOT = new URL('../extensions/', import.meta.url)
const FILES = ['manifest.json', 'server.js', 'client.js']
const KEY = /^[a-z0-9-]{2,24}$/
const SEMVER = /^\d+\.\d+\.\d+$/
const MAX_FILE_BYTES = 512 * 1024
const gameVersion = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version

const folders = readdirSync(ROOT, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name)
const registry = JSON.parse(readFileSync(new URL('registry.json', ROOT), 'utf8'))
const manifestOf = key => JSON.parse(readFileSync(new URL(key + '/manifest.json', ROOT), 'utf8'))
const sha256 = url => createHash('sha256').update(readFileSync(url)).digest('hex')

test('每个扩展目录三件套齐全，manifest 合规', () => {
  assert.ok(folders.length > 0)
  for (const key of folders) {
    for (const name of FILES) {
      const file = new URL(key + '/' + name, ROOT)
      assert.ok(existsSync(file), key + ' 缺 ' + name)
      assert.ok(statSync(file).size <= MAX_FILE_BYTES, key + '/' + name + ' 超过 512KB（宿主拒绝下载）')
    }
    const manifest = manifestOf(key)
    assert.equal(manifest.key, key, 'manifest.key 必须等于文件夹名')
    assert.match(key, KEY)
    assert.match(manifest.version, SEMVER, key + ' version')
    assert.match(manifest.minGame, SEMVER, key + ' minGame')
    assert.ok(versionAtLeast(gameVersion, manifest.minGame), key + ' 的 minGame 比当前游戏版本还新')
    for (const field of ['label', 'emoji', 'description']) assert.equal(typeof manifest[field], 'string', key + ' ' + field)
  }
})

test('在线目录里每个下载扩展的版本、文案、校验值和仓库里的文件一致（改了代码就要升版本、重生成条目）', () => {
  for (const key of folders) {
    const entry = registry.extensions.find(candidate => candidate.key === key)
    assert.ok(entry, 'registry.json 里没有 ' + key + '：node scripts/extension-entry.mjs ' + key)
    const { app, ...manifest } = manifestOf(key)
    void app
    for (const [field, value] of Object.entries(manifest)) assert.deepEqual(entry[field], value, key + ' 的 ' + field + ' 和 manifest 不一致')
    for (const name of FILES) {
      assert.equal(entry.files?.[name]?.sha256, sha256(new URL(key + '/' + name, ROOT)),
        key + '/' + name + ' 和目录里的校验值不一致：改了文件要升 manifest.version 并重新生成条目')
      assert.ok(entry.files[name].url.endsWith('/ext-' + key + '-' + manifest.version + '/' + name), key + ' 下载地址的版本不对')
    }
  }
  const downloads = registry.extensions.filter(entry => entry.builtin !== true).map(entry => entry.key).sort()
  assert.deepEqual(downloads, [...folders].sort(), '目录里的下载扩展和 extensions/ 下的文件夹要一一对应')
})

test('目录里的内置扩展就是游戏数据表里的内置扩展', () => {
  const builtin = registry.extensions.filter(entry => entry.builtin === true).map(entry => entry.key).sort()
  assert.deepEqual(builtin, EXTENSIONS.filter(entry => entry.builtin === true).map(entry => entry.key).sort())
})

test('扩展的 server.js 导出合规：动作是函数；声明了公共事件的，事件目录里有它', async () => {
  for (const key of folders) {
    const imported = await import(new URL(key + '/server.js', ROOT).href)
    const module = imported.default ?? imported
    assert.equal(typeof module.actions, 'object', key + ' 没有 actions')
    for (const [op, handler] of Object.entries(module.actions)) assert.equal(typeof handler, 'function', key + '.' + op)
    if (module.init !== undefined) assert.equal(typeof module.init, 'function', key + '.init')
    if (module.view !== undefined) assert.equal(typeof module.view, 'function', key + '.view')
    if (module.eventVersion === 1) assert.ok(EXTENSION_EVENTS[key], key + ' 声明了 eventVersion 1，但 extension-events.js 里没登记它的事件')
  }
})
