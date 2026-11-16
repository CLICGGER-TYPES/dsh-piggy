// 左轮轮盘 0.1.0：manifest/素材/宿主加载/面板流程和本地规则状态机的定向测试。
import assert from 'node:assert/strict'
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import roulette from '../../../extensions/roulette/server.js'
import { aiCap, createGame, matchStake, money, STAKE_MAX, STAKE_MIN } from '../../../src/extensions/roulette/client/game.js'
import { buildRouletteClient } from '../../../scripts/build-roulette-client.mjs'
import { createExtRuntime, versionAtLeast } from '../../../store/ext-runtime.js'
import { mountRoulette } from '../../helpers/roulette.js'

const ROOT = new URL('../../../extensions/roulette/', import.meta.url)
const ROOT_PATH = fileURLToPath(ROOT)
const REPO_PATH = fileURLToPath(new URL('../../../', import.meta.url))
const MANIFEST = JSON.parse(readFileSync(new URL('manifest.json', ROOT), 'utf8'))
const GAME_VERSION = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')).version

function clockwork() {
  const tasks = []
  let next = 0
  return {
    tasks,
    schedule(fn, ms) {
      next += 1
      tasks.push({ id: next, fn, ms, canceled: false })
      return next
    },
    cancel(id) {
      const task = tasks.find(entry => entry.id === id)
      if (task) task.canceled = true
    },
    runNext(ms) {
      const task = tasks.find(entry => !entry.canceled && (ms === undefined || entry.ms === ms))
      assert.ok(task, '应该有一个待执行的计时器')
      task.canceled = true
      task.fn()
    },
    stop() {
      for (const task of tasks) task.canceled = true
    },
  }
}

test('manifest、素材和生成产物符合扩展契约', async () => {
  assert.equal(MANIFEST.key, 'roulette')
  assert.equal(MANIFEST.label, '左轮轮盘')
  assert.equal(MANIFEST.version, '0.1.0')
  assert.match(MANIFEST.minGame, /^\d+\.\d+\.\d+$/)
  assert.ok(versionAtLeast(GAME_VERSION, MANIFEST.minGame), 'minGame 不能高于当前游戏版本')
  assert.equal(MANIFEST.app.label, '左轮轮盘')
  assert.equal(typeof MANIFEST.emoji, 'string')
  assert.equal(typeof MANIFEST.description, 'string')

  const assets = [...MANIFEST.assets].sort()
  assert.deepEqual(assets, [
    'bullet-v1.webp',
    'chip-v1.webp',
    'cylinder-v1.webp',
    'revolver-v2.webp',
    'table-v1.webp',
  ])
  assert.deepEqual(readdirSync(new URL('assets/', ROOT)).sort(), assets, 'assets 目录和 manifest 清单要一一对应')
  for (const name of assets) {
    const url = new URL('assets/' + name, ROOT)
    assert.ok(existsSync(url), '缺素材 ' + name)
    const file = readFileSync(url)
    assert.ok(file.length > 0 && file.length <= 512 * 1024, name + ' 大小不对')
    assert.equal(file.subarray(0, 4).toString(), 'RIFF')
    assert.equal(file.subarray(8, 12).toString(), 'WEBP')
  }

  assert.equal(typeof roulette.actions, 'object')
  assert.equal(typeof roulette.view, 'function')
  assert.deepEqual(roulette.view(), { localDemo: true })

  const clientUrl = new URL('client.js', ROOT)
  const client = readFileSync(clientUrl, 'utf8')
  assert.ok(statSync(clientUrl).size <= 512 * 1024, 'client.js 超过宿主上限')
  assert.match(client, /GENERATED FILE/)
  assert.match(client, /dshPiggyExtensions\.register/)
  assert.doesNotThrow(() => new Function(client))

  const sourceDir = join(REPO_PATH, 'src/extensions/roulette/client')
  for (const name of readdirSync(sourceDir).filter(name => name.endsWith('.js'))) {
    const text = readFileSync(join(sourceDir, name), 'utf8')
    assert.ok(text.replace(/\n$/, '').split('\n').length <= 400, name + ' 超过 400 行作者源码上限')
    assert.doesNotMatch(text, /https?:\/\//, name + ' 不能加载外部地址')
  }
  assert.doesNotMatch(client, /https?:\/\//)
  assert.doesNotMatch(readFileSync(new URL('manifest.json', ROOT), 'utf8'), /https?:\/\//)

  const generated = await buildRouletteClient()
  assert.equal(generated, client, 'client.js 与 src/extensions/roulette/client/ 不一致，请重新构建')
})

test('现有扩展宿主能加载 roulette，并读出 client.js 与素材', async () => {
  const dir = mkdtempSync(join(REPO_PATH, '.roulette-ext-test-'))
  try {
    cpSync(ROOT_PATH, join(dir, 'extensions', 'roulette'), { recursive: true })
    const state = { extData: { roulette: {} }, extensions: { roulette: true }, wallets: {} }
    const store = {
      filePath: join(dir, 'state.json'),
      state,
      mutate(fn) { return fn(state) },
    }
    const runtime = createExtRuntime(store, { gameVersion: GAME_VERSION })
    await runtime.ready

    const entry = runtime.list(state).find(item => item.key === 'roulette')
    assert.ok(entry, '宿主没有列出 roulette')
    assert.equal(entry.error, null)
    assert.equal(entry.version, '0.1.0')
    assert.equal(entry.app.label, '左轮轮盘')
    assert.deepEqual(runtime.views(state).roulette, { localDemo: true })

    const script = runtime.clientScript('roulette')
    assert.match(script, /dshPiggyExtensions\.register\(['"]roulette['"]/)
    const asset = runtime.assetFile('roulette', 'cylinder-v1.webp')
    assert.equal(asset.type, 'image/webp')
    assert.ok(asset.body.length > 0)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('面板：大堂入口、装弹页、六个可点弹孔和底火位置', () => {
  const m = mountRoulette()
  assert.match(m.text(), /AI 对战/)
  assert.match(m.text(), /好友联机/)
  assert.match(m.text(), /4v4 阵营/)
  assert.match(m.text(), /经典 6 巢/)
  assert.match(m.text(), /100,000/)
  assert.equal(m.images().length > 0, true)
  for (const image of m.images()) {
    assert.match(image.src, /^\/dsh-piggy\/ext\/roulette\/assets\/[a-z0-9-]+\.webp$/)
  }

  m.click('data-op', 'friend-mode')
  assert.match(m.text(), /好友联机需要宿主房间接口/)
  assert.doesNotMatch(m.text(), /开始对局/)

  m.click('data-op', 'enter-ai')
  assert.match(m.text(), /第 1 局/)
  assert.match(m.text(), /配注上限 1,000/)
  assert.match(m.text(), /金币 12,500/)
  assert.match(m.text(), /开始对局/)

  m.click('data-op', 'start')
  assert.match(m.text(), /装弹/)
  assert.match(m.text(), /底注/)
  assert.match(m.text(), /1,000/)
  assert.match(m.text(), /底池/)
  assert.match(m.text(), /2,000/)
  assert.match(m.text(), /随机装弹/)
  assert.match(m.text(), /返回大厅/)

  m.click('data-op', 'load-now')
  const board = m.byClass('rt-board')
  assert.ok(m.hasClass(board, 'rt-board-arming'))
  const holes = m.all('data-chamber')
  assert.equal(holes.length, 6)
  assert.equal(holes.every(hole => hole.disabled === false), true)

  m.click('data-chamber', '2')
  const primer = m.byClass('rt-primer-show')
  assert.ok(primer, '底火应该落在选中的孔')
  assert.equal(primer.style.getPropertyValue('--x'), '33px')
  assert.equal(primer.style.getPropertyValue('--y'), '17px')
  assert.match(m.text(), /第 3 巢已装弹/)
  assert.match(m.text(), /金币 11,500/)
  assert.equal(m.all('data-chamber').every(hole => hole.disabled === true), true)

  // 不转轮直接开枪，按玩家选的孔结算：第 3 巢是实弹，AI 赢下本局。
  m.click('data-op', 'shoot')
  assert.match(m.text(), /本局结束/)
  assert.match(m.text(), /0 : 1/)
  assert.match(m.text(), /下一局/)
  assert.equal(m.byClass('rt-primer-show'), null, '实弹打出去后底火不能留在弹巢里')
})

test('面板：转轮后隐藏底火，空枪换手，规则页返回保留牌桌', () => {
  const m = mountRoulette()
  m.click('data-op', 'enter-ai')
  m.click('data-op', 'start')
  m.click('data-op', 'load-now')
  m.click('data-chamber', '2')
  m.click('data-op', 'spin')
  assert.match(m.text(), /转轮中/)
  assert.equal(m.all('data-chamber').length, 6)
  assert.equal(m.byClass('rt-primer-show'), null)

  m.runTimers()
  assert.match(m.text(), /转轮完成/)
  assert.ok(m.find('data-op', 'shoot'))
  assert.equal(m.byClass('rt-primer-show'), null)

  m.click('data-op', 'shoot')
  assert.match(m.text(), /空枪/)
  m.runTimers()
  assert.match(m.text(), /AI 空枪/)
  assert.match(m.text(), /0 : 0/)

  m.click('data-op', 'rules')
  assert.match(m.text(), /经典俄罗斯轮盘/)
  assert.match(m.text(), /6 个弹巢/)
  assert.match(m.text(), /本地演示金币/)
  m.click('data-op', 'rules-back')
  assert.match(m.text(), /第 1 局/)
  assert.match(m.text(), /AI 空枪/)
  assert.match(m.text(), /0 : 0/)
  assert.match(m.text(), /底注/)
})

test('面板：装弹中返回大厅退回底注，再进牌桌金币恢复', () => {
  const m = mountRoulette()
  m.click('data-op', 'enter-ai')
  m.click('data-op', 'start')
  m.click('data-op', 'load-now')
  assert.match(m.text(), /金币 11,500/)
  m.click('aria-label', '返回大厅')
  assert.match(m.text(), /AI 对战/)
  assert.doesNotMatch(m.text(), /第 1 局/)

  m.click('data-op', 'enter-ai')
  assert.match(m.text(), /金币 12,500/)
  assert.match(m.text(), /第 1 局/)
})

test('规则：配注上限、底注夹取、直接开枪、转轮空枪、结算与退款', () => {
  assert.equal(aiCap(100000), 1000)
  assert.equal(aiCap(40000), 500)
  assert.equal(aiCap(200000), 2000)
  const sample = { stake: 10000, vault: 100000 }
  assert.equal(matchStake(sample), 1000)
  assert.equal(money(12345), '12,345')

  const stakeClock = clockwork()
  const stakeGame = createGame({ rerender() {}, schedule: stakeClock.schedule, cancel: stakeClock.cancel })
  stakeGame.enterTable()
  stakeGame.setStake(-500)
  assert.equal(stakeGame.state.stake, 500)
  stakeGame.setStake(-500)
  assert.equal(stakeGame.state.stake, STAKE_MIN)
  stakeGame.setStake(100000)
  assert.equal(stakeGame.state.stake, STAKE_MAX)
  stakeGame.stopTimers()
  stakeClock.stop()

  const directClock = clockwork()
  const direct = createGame({ rerender() {}, random: () => 0.5, schedule: directClock.schedule, cancel: directClock.cancel })
  direct.enterTable()
  direct.setStake(-500)
  direct.startMatch()
  direct.beginLoad(false)
  assert.equal(direct.state.page, 'table')
  assert.equal(direct.state.stage, 'arming')
  assert.equal(direct.state.matched, 500)
  assert.equal(direct.state.pot, 1000)
  assert.equal(direct.state.coins, 12000)
  direct.seat(4)
  assert.equal(direct.state.chamber, 4, '不转轮时准星就在玩家选的孔')
  direct.fire('you')
  assert.equal(direct.state.stage, 'roundOver')
  assert.equal(direct.state.ai, 1)
  assert.equal(direct.state.you, 0)
  direct.stopTimers()
  directClock.stop()

  const spinClock = clockwork()
  const spin = createGame({ rerender() {}, random: () => 0.5, schedule: spinClock.schedule, cancel: spinClock.cancel })
  spin.enterTable()
  spin.startMatch()
  spin.beginLoad(false)
  spin.seat(0)
  spin.spin()
  assert.equal(spin.state.stage, 'spinning')
  spinClock.runNext(950)
  assert.equal(spin.state.stage, 'choice')
  assert.equal(spin.state.bullet, 3)
  assert.equal(spin.state.chamber, 0)
  assert.equal(spin.state.primer, -1)
  spin.fire('you')
  assert.equal(spin.state.stage, 'ai')
  assert.equal(spin.state.chamber, 1)
  spinClock.runNext(650)
  assert.equal(spin.state.spinning, true)
  spinClock.runNext(900)
  assert.equal(spin.state.stage, 'choice')
  assert.equal(spin.state.ai, 0)
  assert.equal(spin.state.you, 0)
  spin.stopTimers()
  spinClock.stop()

  const winClock = clockwork()
  const win = createGame({ rerender() {}, schedule: winClock.schedule, cancel: winClock.cancel })
  win.state.you = 1
  win.state.matched = 1000
  win.state.pot = 2000
  win.state.vault = 100000
  win.state.coins = 11500
  win.state.stage = 'ai'
  win.state.bullet = 1
  win.state.chamber = 1
  win.fire('ai')
  assert.equal(win.state.stage, 'matchOver')
  assert.equal(win.state.you, 2)
  assert.equal(win.state.vault, 99000)
  assert.equal(win.state.coins, 13500)
  assert.equal(win.state.outcome, 'win')
  assert.equal(win.state.settled, true)
  win.stopTimers()
  winClock.stop()

  const loseClock = clockwork()
  const lose = createGame({ rerender() {}, schedule: loseClock.schedule, cancel: loseClock.cancel })
  lose.state.ai = 1
  lose.state.matched = 1000
  lose.state.pot = 2000
  lose.state.vault = 100000
  lose.state.coins = 11500
  lose.state.stage = 'ready'
  lose.state.bullet = 2
  lose.state.chamber = 2
  lose.fire('you')
  assert.equal(lose.state.stage, 'matchOver')
  assert.equal(lose.state.ai, 2)
  assert.equal(lose.state.vault, 101000)
  assert.equal(lose.state.coins, 11500)
  assert.equal(lose.state.outcome, 'lose')
  assert.equal(lose.state.settled, true)
  lose.stopTimers()
  loseClock.stop()

  const refundClock = clockwork()
  const refund = createGame({ rerender() {}, schedule: refundClock.schedule, cancel: refundClock.cancel })
  refund.enterTable()
  refund.startMatch()
  refund.beginLoad(false)
  assert.equal(refund.state.coins, 11500)
  assert.equal(refund.state.stage, 'arming')
  refund.leaveTable()
  assert.equal(refund.state.coins, 12500)
  assert.equal(refund.state.page, 'lobby')
  assert.equal(refund.state.pot, 0)
  assert.equal(refund.state.matched, 0)
  refund.stopTimers()
  refundClock.stop()

  // 第 2 局装弹页退出时不能把整场底注退回；本场作废，金币保持已扣状态。
  const midClock = clockwork()
  const mid = createGame({ rerender() {}, schedule: midClock.schedule, cancel: midClock.cancel })
  mid.enterTable()
  mid.state.round = 2
  mid.state.you = 1
  mid.state.ai = 0
  mid.state.coins = 11500
  mid.state.matched = 1000
  mid.state.pot = 2000
  mid.state.page = 'loading'
  mid.state.stage = 'loading'
  mid.state.pendingFresh = false
  mid.leaveTable()
  assert.equal(mid.state.coins, 11500, '中途退出不退整场底注')
  assert.equal(mid.state.page, 'lobby')
  assert.equal(mid.state.pot, 0)
  mid.stopTimers()
  midClock.stop()
})
