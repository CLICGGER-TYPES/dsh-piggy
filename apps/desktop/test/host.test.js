// @ts-check
/**
 * 桌面版宿主：用插件自己的存档和路由，走一遍「看状态 → 拆纸盒 → 拿立绘」，
 * 再确认打包脚本复制出来的游戏目录能单独跑。
 */
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import { startHost } from '../lib/host.js'
import { packGame } from '../scripts/pack-game.mjs'

const ROOT = fileURLToPath(new URL('../../..', import.meta.url))

test('the desktop host serves the plugin routes from a packed game folder, with no port', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'piggy-desktop-'))
  let host = null
  try {
    packGame(ROOT, join(dir, 'game'))
    host = await startHost(join(dir, 'game'), join(dir, 'save', 'state.json'))
    const first = await host.handle('GET', '/dsh-piggy/state')
    assert.equal(first.status, 200)
    assert.equal(JSON.parse(first.body).hatched, false)
    const hatched = await host.handle('POST', '/dsh-piggy/act', JSON.stringify({ action: 'hatch' }))
    assert.equal(JSON.parse(hatched.body).hatched, true)
    const art = await host.handle('GET', '/dsh-piggy/art/pig-king.svg')
    assert.equal(art.status, 200)
    assert.equal(art.headers['content-type'], 'image/png', 'legacy URL serves the reviewed PNG')
    assert.equal((await host.handle('GET', '/elsewhere')).status, 404)
  } finally {
    host?.dispose()
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a line consumed by the settings window is broadcast before the store queue drains', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'piggy-fanout-'))
  const broadcasts = []
  let host
  try {
    host = await startHost(ROOT, join(dir, 'state.json'), { onSnapshot: view => broadcasts.push(view) })
    await host.handle('POST', '/dsh-piggy/act', JSON.stringify({ action: 'hatch' }))
    broadcasts.length = 0
    const response = await host.handle('POST', '/dsh-piggy/act', JSON.stringify({ action: 'dev', patch: { say: 'eat' } }))
    const view = JSON.parse(response.body)
    assert.equal(view.pending.filter(event => event.kind === 'line').length, 1)
    assert.equal(broadcasts.length, 1)
    assert.deepEqual(broadcasts[0].pending, view.pending)
    assert.deepEqual(JSON.parse((await host.handle('GET', '/dsh-piggy/state')).body).pending, [])
    assert.equal(broadcasts.length, 1)
  } finally { host?.dispose(); rmSync(dir, { recursive: true, force: true }) }
})
