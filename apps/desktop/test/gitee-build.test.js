// @ts-check
/**
 * Gitee 渠道打包配置（2026-10-09）：Windows 安装包离 100MiB 太近，不带游戏、只带 game-pin.json，
 * 第一次启动下载；Linux、macOS 照旧自带游戏。下载窗口的文件都要真的打进安装包。
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'

const require = createRequire(import.meta.url)
const here = new URL('..', import.meta.url)

test('Gitee Windows installer ships the pin instead of the game; Linux and macOS keep the game', () => {
  const gitee = require('../electron-builder.gitee.cjs')
  const names = list => (list ?? []).map(entry => entry.to)
  assert.deepEqual(names(gitee.extraResources), [], 'top level is merged into every platform, so it must stay empty')
  assert.deepEqual(names(gitee.win.extraResources), ['game-pin.json'])
  assert.deepEqual(names(gitee.linux.extraResources), ['game'])
  assert.deepEqual(names(gitee.mac.extraResources), ['game'])
  const github = JSON.parse(readFileSync(new URL('package.json', here), 'utf8')).build
  assert.deepEqual(names(github.extraResources), ['game'], 'GitHub installers are unchanged')
})

test('the first-run window files are packaged', () => {
  const files = JSON.parse(readFileSync(new URL('package.json', here), 'utf8')).build.files
  assert.ok(files.includes('first-run-preload.cjs'))
  assert.ok(files.includes('renderer/**') && files.includes('lib/**'))
  for (const file of ['first-run-preload.cjs', 'renderer/first-run.html', 'renderer/first-run.js', 'lib/first-run.js']) {
    assert.ok(existsSync(new URL(file, here)), file)
  }
})

test('the Gitee workflow writes the pin before packaging Windows', () => {
  const flow = readFileSync(new URL('../../.github/workflows/release-gitee.yml', here), 'utf8')
  const pin = flow.indexOf('write-game-pin.mjs dist-game apps/desktop/game-pin.json')
  assert.ok(pin > 0 && pin < flow.indexOf('electron-builder ${{ matrix.target }}'))
})

test('first-run download errors read as plain words, keeping the original for logs', async () => {
  const { friendlyError } = await import('../lib/first-run-errors.js')
  assert.equal(friendlyError('net::ERR_CONNECTION_REFUSED'), '连不上下载地址，检查一下网络或代理（net::ERR_CONNECTION_REFUSED）')
  assert.equal(friendlyError('下载失败（404）'), '下载页上还没有这个版本，过一会儿再试，或者去下载页看看（404）')
  assert.equal(friendlyError('下载的文件校验不对，没换'), '下载的文件校验不对，没换')
})
