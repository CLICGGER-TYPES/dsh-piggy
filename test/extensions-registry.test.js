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
import { assetNames, fileList } from '../store/ext-files.js'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { test } from 'node:test'

import { EXTENSIONS } from '../packages/pet-core/src/data/extensions.js'
import { EXTENSION_EVENTS } from '../packages/pet-core/src/data/extension-events.js'
import { versionAtLeast } from '../store/ext-runtime.js'
import { makeBundle } from '../store/ext-import.js'
import { extensionFiles } from '../scripts/extension-files.mjs'

const ROOT = new URL('../extensions/', import.meta.url)
const FILES = ['manifest.json', 'server.js', 'client.js']
const KEY = /^[a-z0-9-]{2,24}$/
const SEMVER = /^\d+\.\d+\.\d+$/
const MAX_FILE_BYTES = 512 * 1024
const gameVersion = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version

const folders = readdirSync(ROOT, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name)
const published = JSON.parse(readFileSync(new URL('registry.json', ROOT), 'utf8'))
const publishedGitee = JSON.parse(readFileSync(new URL('registry-gitee.json', ROOT), 'utf8'))
const candidateUrl = new URL('../release-candidates/extensions/registry.json', import.meta.url)
const registry = existsSync(candidateUrl) ? JSON.parse(readFileSync(candidateUrl, 'utf8')) : published
const candidateGiteeUrl = new URL('../release-candidates/extensions/registry-gitee.json', import.meta.url)
const registryGitee = existsSync(candidateGiteeUrl) ? JSON.parse(readFileSync(candidateGiteeUrl, 'utf8')) : publishedGitee
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
    const images = assetNames(manifest)
    assert.ok(images !== null, key + ' 的 assets 名单不对')
    for (const name of images ?? []) {
      const file = new URL(key + '/assets/' + name, ROOT)
      assert.ok(existsSync(file), key + ' 缺图片 ' + name)
      assert.ok(statSync(file).size <= MAX_FILE_BYTES, key + '/assets/' + name + ' 超过 512KB')
    }
    assert.equal(manifest.key, key, 'manifest.key 必须等于文件夹名')
    assert.match(key, KEY)
    assert.match(manifest.version, SEMVER, key + ' version')
    assert.match(manifest.minGame, SEMVER, key + ' minGame')
    assert.ok(versionAtLeast(gameVersion, manifest.minGame), key + ' 的 minGame 比当前游戏版本还新')
    for (const field of ['label', 'emoji', 'description']) assert.equal(typeof manifest[field], 'string', key + ' ' + field)
  }
})

test('候选目录（没有候选时为公开目录）与源码版本、文案、全部文件校验值一致', () => {
  for (const key of folders) {
    const entry = registry.extensions.find(candidate => candidate.key === key)
    assert.ok(entry, 'registry.json 里没有 ' + key + '：node scripts/extension-entry.mjs ' + key)
    const { app, assets, ...manifest } = manifestOf(key)
    void app
    for (const [field, value] of Object.entries(manifest)) assert.deepEqual(entry[field], value, key + ' 的 ' + field + ' 和 manifest 不一致')
    const tag = 'ext-' + key + '-' + manifest.version
    assert.ok(entry.bundle?.url?.endsWith('/' + tag + '/' + tag + '.piggyext'), key + ' 缺整包地址：node scripts/extension-entry.mjs ' + key)
    assert.equal(entry.bundle.sha256, createHash('sha256').update(makeBundle(extensionFiles(key))).digest('hex'), key + ' 的整包校验值和仓库里的文件不一致')
    const names = fileList(assetNames({ assets }) ?? [])
    assert.deepEqual(Object.keys(entry.files ?? {}).sort(), [...names].sort(), key + ' 目录里的文件（含图片）和 manifest 对不上')
    for (const name of names) {
      assert.equal(entry.files?.[name]?.sha256, sha256(new URL(key + '/' + name, ROOT)),
        key + '/' + name + ' 和目录里的校验值不一致：改了文件要升 manifest.version 并重新生成条目')
      assert.ok(entry.files[name].url.endsWith('/ext-' + key + '-' + manifest.version + '/' + name.replace(/^assets\//, '')), key + ' 下载地址的版本不对')
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

// A new source version does not authorize advertising an unuploaded download.
test('公开目录与候选目录保留可信官方身份，不能回退或同版本改内容', () => {
  const official = JSON.parse(readFileSync(new URL('../store/official-extensions.json', import.meta.url), 'utf8'))
  for (const entry of published.extensions.filter(item => !item.builtin)) {
    const known = official[entry.key]?.[entry.version]
    assert.ok(known, entry.key + '@' + entry.version + ' missing official identity')
    for (const [name, spec] of Object.entries(entry.files)) assert.equal(spec.sha256, known[name], entry.key + '/' + name)
    const next = registry.extensions.find(item => item.key === entry.key)
    assert.ok(next && versionAtLeast(next.version, entry.version), entry.key + ' candidate regressed')
    if (next.version === entry.version) {
      assert.deepEqual(next.files, entry.files, entry.key + ' changed files without a version bump')
      assert.equal(next.bundle.sha256, entry.bundle.sha256)
    }
  }
})

test('各渠道目录校验官方文件身份、渠道下载地址和同版本元数据', () => {
  const official = JSON.parse(readFileSync(new URL('../store/official-extensions.json', import.meta.url), 'utf8'))
  const channelRegistries = [
    { label: 'GitHub public', host: 'github', registry: published },
    { label: 'Gitee public', host: 'gitee', registry: publishedGitee },
    { label: 'GitHub candidate', host: 'github', registry },
    { label: 'Gitee candidate', host: 'gitee', registry: registryGitee },
  ]

  function checkChannel({ label, host, registry: channelRegistry }) {
    const origin = host === 'github'
      ? 'https://github.com/CLICGGER-TYPES/dsh-piggy'
      : 'https://gitee.com/clicgger/dsh-piggy'
    for (const entry of channelRegistry.extensions.filter(item => item.builtin !== true)) {
      const known = official[entry.key]?.[entry.version]
      assert.ok(known, `${label} ${entry.key}@${entry.version} has no official file identity`)
      const names = Object.keys(known).sort()
      assert.deepEqual(Object.keys(entry.files ?? {}).sort(), names, `${label} ${entry.key}@${entry.version} file list`)
      const tagBase = `${origin}/releases/download/ext-${entry.key}-${entry.version}`
      assert.equal(entry.bundle?.url, `${tagBase}/ext-${entry.key}-${entry.version}.piggyext`, `${label} ${entry.key}@${entry.version} bundle URL`)
      assert.match(entry.bundle?.sha256 ?? '', /^[a-f0-9]{64}$/, `${label} ${entry.key}@${entry.version} bundle SHA256`)
      for (const name of names) {
        const spec = entry.files[name]
        assert.equal(spec.sha256, known[name], `${label} ${entry.key}@${entry.version} official hash: ${name}`)
        assert.equal(spec.url, `${tagBase}/${name.replace(/^assets\//, '')}`, `${label} ${entry.key}@${entry.version} channel URL: ${name}`)
      }
    }
  }

  function withoutUrls(value) {
    if (Array.isArray(value)) return value.map(withoutUrls)
    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value)
        .filter(([key]) => key !== 'url')
        .map(([key, nested]) => [key, withoutUrls(nested)]))
    }
    return value
  }

  function checkSameVersion(left, right, label) {
    const rightByIdentity = new Map(right.extensions.map(entry => [`${entry.key}@${entry.version ?? ''}`, entry]))
    for (const entry of left.extensions) {
      const twin = rightByIdentity.get(`${entry.key}@${entry.version ?? ''}`)
      if (twin) assert.deepEqual(withoutUrls(entry), withoutUrls(twin), `${label} ${entry.key}@${entry.version ?? 'builtin'} metadata`)
    }
  }

  for (const channel of channelRegistries) checkChannel(channel)
  checkSameVersion(published, publishedGitee, 'public channel parity')
  checkSameVersion(registry, registryGitee, 'candidate channel parity')
  checkSameVersion(published, registry, 'GitHub public/candidate same-version parity')
  checkSameVersion(publishedGitee, registryGitee, 'Gitee public/candidate same-version parity')

  const githubFarm = published.extensions.find(entry => entry.key === 'farm')
  const githubCandidateFarm = registry.extensions.find(entry => entry.key === 'farm')
  const giteeFarm = publishedGitee.extensions.find(entry => entry.key === 'farm')
  assert.equal(githubFarm?.version, '4.2.1')
  assert.equal(githubFarm?.minGame, '0.37.2')
  assert.equal(githubFarm?.bundle?.sha256, 'bde53852c08f3cb28d5a7155a6efa30988336df2f80be6f96c41fecea86d7fa0')
  assert.equal(Object.keys(githubFarm?.files ?? {}).length, 287)
  assert.equal(githubFarm?.files?.['client.js']?.sha256, '72b64888f96633773c2a83cff15e7ea3fe987d3c3baf3e2c19204b0d8f09d5f3', 'public farm 4.2.1 keeps its released client identity')
  assert.equal(githubCandidateFarm?.version, '4.4.0', 'the unuploaded source candidate uses a fresh version')
  assert.equal(githubCandidateFarm?.minGame, '0.37.2')
  assert.equal(githubCandidateFarm?.files?.['client.js']?.sha256, '093b14489a2144dc0c7acdb3ad42d06415b73453ee7a89b5daf648c304c5e278', 'farm 4.4.0 candidate carries the energy/rest UI client')
  assert.equal(Object.keys(githubCandidateFarm?.files ?? {}).length, 287)
  for (const name of Object.keys(githubFarm?.files ?? {}).filter(name => name.startsWith('assets/'))) {
    assert.equal(githubCandidateFarm?.files?.[name]?.sha256, githubFarm?.files?.[name]?.sha256, 'the 4.4.0 energy rules keep ' + name)
  }
  assert.notEqual(githubCandidateFarm?.bundle?.sha256, githubFarm?.bundle?.sha256, 'the candidate bundle identity follows its new manifest/client version')
  assert.equal(giteeFarm?.version, '4.2.0')
  assert.equal(giteeFarm?.minGame, '0.37.2')
  assert.equal(giteeFarm?.bundle?.sha256, '51c4f1ca631b18366db64fa254c63885bff3c07e19347651e4fd5096db2aad0d')
})
