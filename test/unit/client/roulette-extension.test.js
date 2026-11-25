// 左轮轮盘 0.2.0：manifest/素材/宿主加载/面板流程和真实金币动作。
import assert from 'node:assert/strict'
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import roulette from '../../../extensions/roulette/server.js'
import { buildRouletteClient } from '../../../scripts/build-roulette-client.mjs'
import { createExtRuntime, versionAtLeast } from '../../../store/ext-runtime.js'
import { mountRoulette } from '../../helpers/roulette.js'

const ROOT = new URL('../../../extensions/roulette/', import.meta.url)
const ROOT_PATH = fileURLToPath(ROOT)
const REPO_PATH = fileURLToPath(new URL('../../../', import.meta.url))
const MANIFEST = JSON.parse(readFileSync(new URL('manifest.json', ROOT), 'utf8'))
const GAME_VERSION = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')).version

/** 进牌桌只切页；先在大堂按钮上配好设置，再点开始。 */
function enterTable(m) {
  m.click('data-op', 'enter-ai')
  assert.equal(m.data.match, null, '进牌桌不自动开局')
}
function startMatch(m) {
  enterTable(m)
  m.click('data-op', 'start')
  assert.notEqual(m.data.match, null)
}

test('manifest、素材和生成产物符合扩展契约', async () => {
  assert.equal(MANIFEST.key, 'roulette')
  assert.equal(MANIFEST.label, '左轮轮盘')
  assert.equal(MANIFEST.version, '0.2.1')
  assert.equal(MANIFEST.minGame, '0.37.3')
  assert.ok(versionAtLeast(GAME_VERSION, MANIFEST.minGame), 'minGame 不能高于当前游戏版本')
  assert.equal(MANIFEST.app.label, '左轮轮盘')
  assert.equal(typeof MANIFEST.emoji, 'string')
  assert.match(MANIFEST.description, /真实金币/)

  const assets = [...MANIFEST.assets].sort()
  assert.deepEqual(assets, [
    'bullet-base-v4.webp',
    'bullet-side-v4.webp',
    'chip-v1.webp',
    'cylinder-v4.webp',
    'revolver-v6.webp',
    'table-v2.webp',
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
  const init = roulette.init()
  const view = roulette.view(init, { coins: () => 12500, now: 0 })
  assert.equal(view.coins, 12500)
  assert.equal(view.settings.stake, 1000)
  assert.equal(view.match, null)

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

test('现有扩展宿主能加载 roulette，并读出 client.js、素材和真实金币视图', async () => {
  const dir = mkdtempSync(join(REPO_PATH, '.roulette-ext-test-'))
  try {
    cpSync(ROOT_PATH, join(dir, 'extensions', 'roulette'), { recursive: true })
    const state = { coins: 12500, extData: { roulette: roulette.init() }, extensions: { roulette: true }, wallets: {} }
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
    assert.equal(entry.version, '0.2.1')
    assert.equal(entry.app.label, '左轮轮盘')
    const view = runtime.views(state).roulette
    assert.equal(view.coins, 12500)
    assert.equal(view.settings.lives, 1)
    assert.equal(view.match, null)

    const script = runtime.clientScript('roulette')
    assert.match(script, /dshPiggyExtensions\.register\(['"]roulette['"]/)
    const asset = runtime.assetFile('roulette', 'cylinder-v4.webp')
    assert.equal(asset.type, 'image/webp')
    assert.ok(asset.body.length > 0)

    const started = runtime.act('roulette', 'start', { seq: 0 })
    assert.equal(started.ok, true)
    assert.equal(state.coins, 11500, '真实宿主动作要扣玩家底注')
    assert.equal(state.extData.roulette.match.stage, 'arming')
    assert.equal(runtime.views(state).roulette.match.stage, 'arming')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('面板：大堂设置、真实金币和开始对局', () => {
  const m = mountRoulette()
  assert.match(m.text(), /AI 对战/)
  assert.match(m.text(), /好友联机/)
  assert.match(m.text(), /4 人桌/)
  assert.match(m.text(), /12,500/)
  assert.equal(m.images().length > 0, true)
  for (const image of m.images()) {
    assert.match(image.src, /^\/dsh-piggy\/ext\/roulette\/assets\/[a-z0-9-]+\.webp$/)
  }
  assert.doesNotMatch(m.text(), /命数/, '大堂只留入口，不摆牌桌设置')
  assert.doesNotMatch(m.text(), /底注/)

  enterTable(m)
  assert.match(m.text(), /命数/)
  assert.match(m.text(), /100,000/)
  assert.match(m.text(), /三局两胜/)
  m.click('data-op', 'lives-3')
  assert.equal(m.data.settings.lives, 3)
  m.click('data-op', 'format-bestOf3')
  assert.equal(m.data.settings.format, 'bestOf3')
  m.click('data-op', 'load-5')
  assert.equal(m.data.settings.loadCount, 5)
  m.click('data-op', 'stake-5000')
  assert.equal(m.data.settings.stake, 5000)
  assert.match(m.text(), /5,000/)

  m.click('data-op', 'start')
  assert.equal(m.data.match.stage, 'arming')
  assert.equal(m.wallet.coins, 7500)
  assert.equal(m.data.match.pot, 10000)
  assert.match(m.text(), /本局 5 发/)
  assert.match(m.text(), /底池/)
  assert.match(m.text(), /10,000/)
})

test('面板：装弹不转轮，按开始转才转并变成剩余子弹', () => {
  const m = mountRoulette()
  startMatch(m)
  m.click('data-op', 'load-random')
  assert.equal(m.data.match.stage, 'arming', '只装弹不提交，仍停在装弹阶段')
  assert.equal(m.data.match.lastEvent !== 'armed', true)
  assert.match(m.text(), /按「开始转」/)
  // 装载后不推进任何动画，也不应该发 arm
  m.runTimers(1)
  assert.equal(m.data.match.stage, 'arming')
  assert.equal(m.data.match.bullets.length, 0)

  m.click('data-op', 'spin')
  // 只推进转轮动画（700ms），不推进 AI
  m.runTimers(1)
  assert.equal(m.data.match.bullets.length, 1)
  assert.ok(['choice', 'ai'].includes(m.data.match.stage))
  assert.equal(m.all('data-chamber').length, 6)
  assert.equal(m.all('data-chamber').every(hole => hole.disabled === true), true, '装弹完成后弹孔不能再点')
})

test('面板：装 1-5 发要点不同弹孔，一个孔一发，不自动转', () => {
  for (const count of [1, 2, 3, 4, 5]) {
    const m = mountRoulette()
    enterTable(m)
    m.click('data-op', 'load-' + count)
    m.click('data-op', 'start')
    assert.equal(m.data.settings.loadCount, count)
    for (let index = 0; index < count; index += 1) m.find('data-chamber', String(index)).fire('click')
    assert.equal(m.data.match.stage, 'arming', count + ' 发：装弹后仍在装弹阶段')
    assert.equal(m.timers.filter(entry => !entry.canceled && entry.ms === 700).length, 0, count + ' 发：不能自己启动转轮定时器')
    assert.match(m.text(), new RegExp('已装 ' + count + '/' + count + ' 发'))
  }
})

test('面板：AI 回合自动开枪', () => {
  const m = mountRoulette()
  startMatch(m)
  m.click('data-op', 'load-random')
  m.click('data-op', 'spin')
  m.runTimers()
  assert.equal(m.data.match.lastShooter, 'ai')
  assert.ok(['blank', 'hit'].includes(m.data.match.lastEvent))
})

test('面板：AI 让枪后玩家回让，AI 被迫开枪', () => {
  const m = mountRoulette({ random: () => 0.9 })
  m.app.send('config', { ai: 'bluff', seq: m.data.seq })
  m.sync()
  startMatch(m)
  const match = m.data.match
  match.stage = 'ai'
  match.turn = 'ai'
  match.bulletCount = 1
  match.bullets = [0]
  match.chamber = 0
  match.livesYou = 1
  match.livesAi = 1
  m.sync()
  m.runTimers(1)
  assert.equal(m.data.match.lastEvent, 'ai-pass')
  assert.equal(m.data.match.stage, 'choice')

  m.click('data-op', 'pass')
  assert.equal(m.data.match.stage, 'ai')
  assert.equal(m.data.match.chamber, 0, '回让不消耗弹巢')
  assert.equal(m.data.match.mustShoot, 'ai', '先让枪的 AI 被回让后必须开枪')
  m.runTimers(1)
  assert.equal(m.data.match.lastShooter, 'ai')
  assert.equal(m.data.match.mustShoot, '')
  assert.equal(m.data.match.stage, 'matchOver')
  assert.equal(m.data.match.outcome, 'win')
})

test('面板：玩家被回让后让枪按钮禁用，只能开枪', () => {
  const m = mountRoulette({ random: () => 0.9 })
  m.app.send('config', { ai: 'bluff', seq: m.data.seq })
  m.sync()
  startMatch(m)
  const match = m.data.match
  match.stage = 'choice'
  match.turn = 'you'
  match.bulletCount = 1
  match.bullets = [0]
  match.chamber = 0
  match.livesYou = 1
  match.livesAi = 1
  m.sync()
  m.click('data-op', 'pass')
  assert.equal(m.data.match.passBy, 'you')
  m.runTimers(1)
  assert.equal(m.data.match.mustShoot, 'you')
  assert.equal(m.data.match.stage, 'choice')
  assert.match(m.text(), /对手回让，你必须开枪/)
  const passBtn = m.find('data-op', 'pass')
  assert.equal(passBtn.disabled, true, '回让后让枪按钮禁用')
  passBtn.fire('click')
  assert.match(m.text(), /回让后必须开枪/)
  m.click('data-op', 'shoot')
  assert.equal(m.data.match.mustShoot, '')
  assert.equal(m.data.match.stage, 'matchOver')
})

test('面板：可切换 AI 策略', () => {
  const m = mountRoulette()
  enterTable(m)
  const select = m.byClass('rt-select')
  assert.ok(select, '设置里要有 AI 策略选择')
  assert.match(m.text(), /蒙特卡洛/)
  select.value = 'bluff'
  select.fire('change')
  assert.equal(m.data.settings.ai, 'bluff')
})

test('面板：自定义底注校验范围，金币不足不开局', () => {
  const m = mountRoulette()
  enterTable(m)
  const input = m.byClass('rt-stake-input')
  assert.ok(input, '设置里要有自定义底注输入框')
  input.value = '2500'
  m.click('data-op', 'stake-custom')
  assert.equal(m.data.settings.stake, 2500)

  m.byClass('rt-stake-input').value = '50'
  m.click('data-op', 'stake-custom')
  assert.equal(m.data.settings.stake, 2500)
  assert.match(m.text(), /底注范围/)

  const poor = mountRoulette({ coins: 50 })
  enterTable(poor)
  poor.click('data-op', 'start')
  assert.equal(poor.data.match, null, '金币不够时服务端不建对局')
  assert.match(poor.text(), /金币不够本局底注/)
  assert.match(poor.text(), /AI 对战/)
})

test('面板：开枪中弹结算、金币和整场结果', () => {
  const m = mountRoulette()
  startMatch(m)
  const match = m.data.match
  match.stage = 'choice'
  match.turn = 'you'
  match.bulletCount = 1
  match.bullets = [match.chamber]
  match.livesYou = 1
  match.livesAi = 1
  m.sync()

  m.click('data-op', 'shoot')
  assert.equal(m.data.match.stage, 'matchOver')
  assert.equal(m.data.match.outcome, 'lose')
  assert.equal(m.data.match.livesYou, 0)
  assert.match(m.text(), /AI 赢了/)
  assert.match(m.text(), /-1,000/)
  assert.match(m.text(), /本场净付/)
  assert.equal(m.wallet.coins, 11500, '输掉底注后不退款')
})

test('面板：让枪付 50% 给对手并换手', () => {
  const m = mountRoulette()
  startMatch(m)
  const match = m.data.match
  match.stage = 'choice'
  match.turn = 'you'
  match.matchedYou = 1000
  match.matchedAi = 1000
  m.sync()
  const before = m.wallet.coins

  m.click('data-op', 'pass')
  assert.equal(m.wallet.coins, before - 500)
  assert.equal(m.data.vault, 99500)
  assert.equal(m.data.match.lastEvent, 'you-pass')
  assert.equal(m.data.match.turn, 'ai')
  assert.match(m.text(), /AI 回合/)
})

test('面板：装弹前返回大厅退底注；规则页返回保留牌桌', () => {
  const m = mountRoulette()
  startMatch(m)
  assert.equal(m.wallet.coins, 11500)
  m.click('aria-label', '返回大厅')
  assert.equal(m.wallet.coins, 12500)
  assert.equal(m.wallet.spent['roulette-bet'], 0, '底注按原去处退，不记成收入')
  assert.match(m.text(), /AI 对战/)

  startMatch(m)
  m.click('data-op', 'rules')
  assert.match(m.text(), /左轮轮盘规则/)
  assert.match(m.text(), /让枪/)
  m.click('data-op', 'rules-back')
  assert.match(m.text(), /第 1 局/)
})

test('规则：装弹、转轮、让枪和真钱结算都写进面板', () => {
  const m = mountRoulette()
  m.click('data-op', 'rules')
  const text = m.text()
  assert.match(text, /装 1-5 发/)
  assert.match(text, /开始转/)
  assert.match(text, /50%/)
  assert.match(text, /真实金币/)
  assert.match(text, /先赢 2 局/)
})

test('面板：装弹数按孔位实时显示，底火使用 bullet-base 素材', () => {
  const m = mountRoulette()
  startMatch(m)
  assert.match(m.text(), /0\/1 发/)

  m.find('data-chamber', '0').fire('click')
  assert.match(m.text(), /1\/1 发/)
  const primer = m.images().find(image => image.src.includes('bullet-base-v4.webp'))
  assert.ok(primer, '装弹要使用 bullet-base-v4.webp')
  assert.ok(m.hasClass(primer, 'rt-primer-on'))
  assert.equal(m.data.match.stage, 'arming', '放子弹本身不转轮')
  m.click('data-op', 'spin')
  m.runTimers()
  assert.notEqual(m.data.match.stage, 'arming')
})

test('面板：五发点五个不同孔，每个孔一发；同孔再点取出；开始转提交孔位', () => {
  const m = mountRoulette()
  enterTable(m)
  m.click('data-op', 'load-5')
  m.click('data-op', 'start')
  for (const index of [0, 1, 2, 3, 4]) m.find('data-chamber', String(index)).fire('click')
  assert.match(m.text(), /5\/5 发/)
  assert.equal(m.images().filter(image => image.src.includes('bullet-base-v4.webp')).length, 5)
  const spin = m.find('data-op', 'spin')
  assert.equal(spin.disabled, false)
  m.find('data-chamber', '2').fire('click')
  assert.equal(m.images().filter(image => image.src.includes('bullet-base-v4.webp')).length, 4, '同一个孔再点一次要取出')
  assert.equal(m.find('data-op', 'spin').disabled, true)
  m.find('data-chamber', '2').fire('click')
  m.click('data-op', 'spin')
  m.runTimers(1)
  assert.equal(m.data.match.bullets.join(","), "0,1,2,3,4")
})

test('面板：玩家赢下整场，结算卡显示净赢金额', () => {
  const m = mountRoulette()
  startMatch(m)
  const match = m.data.match
  match.stage = 'ai'
  match.turn = 'ai'
  match.bulletCount = 1
  match.bullets = [match.chamber]
  match.livesYou = 1
  match.livesAi = 1
  m.sync()
  m.runTimers()

  assert.equal(m.data.match.stage, 'matchOver')
  assert.equal(m.data.match.outcome, 'win')
  assert.match(m.text(), /你赢了/)
  assert.match(m.text(), /\+1,000/)
  assert.match(m.text(), /本场净收/)
  assert.match(m.text(), /底池 2,000/)
  assert.equal(m.wallet.coins, 13500, '12500 - 1000 底注 + 2000 底池')
})

test('面板：AI 让枪费进底池，结算净额和“入池”文案一致', () => {
  const m = mountRoulette({ random: () => 0.9 })
  m.app.send('config', { ai: 'bluff', seq: m.data.seq })
  m.sync()
  startMatch(m)
  const match = m.data.match
  match.stage = 'ai'
  match.turn = 'ai'
  match.bulletCount = 1
  match.bullets = [match.chamber]
  match.livesYou = 1
  match.livesAi = 1
  m.sync()
  m.runTimers(1)
  assert.equal(m.data.match.lastEvent, 'ai-pass')
  assert.equal(m.data.match.pot, 2500, 'AI 让枪费 500 进底池')
  assert.equal(m.wallet.coins, 11500, 'AI 让枪费不直接给玩家')

  m.data.settings.ai = 'always'
  match.stage = 'ai'
  match.turn = 'ai'
  m.sync()
  m.runTimers(1)
  assert.equal(m.data.match.stage, 'matchOver')
  assert.equal(m.data.match.outcome, 'win')
  assert.equal(m.wallet.coins, 14000, '12500 - 1000 底注 + 2500 底池')
  assert.match(m.text(), /\+1,500/)
  assert.match(m.text(), /本场净收/)
  assert.match(m.text(), /底池 2,500/)
  assert.match(m.text(), /AI 让枪入池 500/)
  assert.doesNotMatch(m.text(), /让枪收/)
})

test('面板：对局中返回先确认，继续打不退出，确认后按认输处理', () => {
  const m = mountRoulette()
  startMatch(m)
  const match = m.data.match
  match.stage = 'choice'
  match.turn = 'you'
  m.sync()

  m.click('aria-label', '返回大厅')
  assert.match(m.text(), /确认离开牌桌/)
  assert.equal(m.data.match !== null, true, '确认框出现时对局还在')

  m.click('data-op', 'cancel-leave')
  assert.equal(m.data.match !== null, true)
  assert.doesNotMatch(m.text(), /确认离开牌桌/)

  m.click('aria-label', '返回大厅')
  m.click('data-op', 'confirm-leave')
  assert.equal(m.data.match, null)
  assert.equal(m.wallet.coins, 11500, '已装弹退出不退底注')
  assert.match(m.text(), /已回到大厅/)
})

test('面板：三局两胜下一局可以重新选装弹数', () => {
  const m = mountRoulette({ coins: 20000 })
  m.app.send('config', { seq: m.data.seq, format: 'bestOf3', stake: 1000 })
  m.sync()
  startMatch(m)
  const match = m.data.match
  match.stage = 'roundOver'
  match.round = 1
  match.winsYou = 1
  m.sync()

  assert.ok(m.find('data-op', 'next-load-3'), '下一局要能重新选装弹数')
  m.click('data-op', 'next-load-3')
  assert.equal(m.find('data-op', 'next-load-3').getAttribute('aria-pressed'), 'true')
  m.click('data-op', 'next')
  assert.equal(m.data.match.bulletCount, 3)
  assert.equal(m.data.settings.loadCount, 3)
  assert.equal(m.data.match.stage, 'arming')
})

test('面板：AI 请求失败会重试，最终给重试按钮，恢复后能继续', async () => {
  const m = mountRoulette()
  startMatch(m)
  const match = m.data.match
  match.stage = 'ai'
  match.turn = 'ai'
  match.bulletCount = 1
  match.bullets = []
  match.chamber = 0
  const original = m.app.send
  m.app.send = function (op, payload) {
    if (op === 'ai') return Promise.resolve(null)
    return original.call(m.app, op, payload)
  }
  m.sync()

  async function fire(ms) {
    const task = m.timers.find(entry => !entry.canceled && entry.ms === ms)
    assert.ok(task, '找不到 ' + ms + 'ms 定时器')
    task.canceled = true
    task.fn()
    await Promise.resolve()
    await Promise.resolve()
  }
  await fire(900)
  await fire(1200)
  await fire(1800)
  await fire(2500)
  assert.match(m.text(), /AI 行动重试/)
  assert.equal(m.data.match.stage, 'ai')

  m.app.send = original
  m.click('data-op', 'ai-retry')
  await fire(900)
  assert.notEqual(m.data.match.stage, 'ai')
  assert.equal(m.data.match.lastShooter, 'ai')
})

test('面板：结算后点再来一场，会开新的一场', () => {
  const m = mountRoulette()
  startMatch(m)
  const first = m.data.match.handId
  const match = m.data.match
  match.stage = 'ai'
  match.turn = 'ai'
  match.bulletCount = 1
  match.bullets = [match.chamber]
  match.livesYou = 1
  match.livesAi = 1
  m.sync()
  m.runTimers()
  assert.equal(m.data.match.stage, 'matchOver')

  m.click('data-op', 'again')
  assert.equal(m.data.match.stage, 'arming')
  assert.equal(m.data.match.handId, first + 1, '再来一场要开新的一场，不能原地重绘')
  assert.equal(m.data.match.round, 1)
  assert.equal(m.wallet.coins, 12500, '赢下 2,000 底池后再扣 1,000 新底注')
})

test('面板：装了弹但还没按开始转就返回，取消并全额退款', () => {
  const m = mountRoulette()
  startMatch(m)
  assert.equal(m.wallet.coins, 11500)
  m.find('data-chamber', '0').fire('click')
  // 还没有按开始转，arm 没发出去
  m.click('aria-label', '返回大厅')
  assert.equal(m.data.match, null)
  assert.equal(m.wallet.coins, 12500, '装弹请求未发出前退出要全额退')
  assert.match(m.text(), /已回到大厅/)
})

test('面板：arm 已发出但回包未到，返回先挡住，不能静默判负', async () => {
  const m = mountRoulette()
  startMatch(m)
  const original = m.app.send
  let resolveArm = null
  m.app.send = function (op, payload) {
    if (op === 'arm') return new Promise(resolve => { resolveArm = resolve })
    return original.call(m.app, op, payload)
  }
  m.find('data-chamber', '0').fire('click')
  assert.equal(m.data.match.stage, 'arming', '只放子弹不转')
  m.click('data-op', 'spin')
  const armTimer = m.timers.find(entry => !entry.canceled && entry.ms === 700)
  assert.ok(armTimer, '装弹动画定时器应该在')
  armTimer.canceled = true
  armTimer.fn()
  assert.equal(m.wallet.coins, 11500)

  m.click('aria-label', '返回大厅')
  assert.match(m.text(), /装弹请求提交中/)
  assert.notEqual(m.data.match, null, '回包没到之前不能判负')
  assert.equal(m.wallet.coins, 11500)

  resolveArm({ ok: false, reason: 'stale' })
  await Promise.resolve()
  await Promise.resolve()
  assert.match(m.text(), /装弹没送到/)
  assert.notEqual(m.data.match, null)
})

test('面板：金币不够让枪费时禁用按钮并提示', () => {
  const m = mountRoulette({ coins: 1000 })
  startMatch(m)
  const match = m.data.match
  match.stage = 'choice'
  match.turn = 'you'
  match.matchedYou = 1000
  m.sync()
  assert.equal(m.wallet.coins, 0)
  const passBtn = m.find('data-op', 'pass')
  assert.equal(passBtn.disabled, true)
  passBtn.fire('click')
  assert.equal(m.data.match.stage, 'choice')
  assert.equal(m.wallet.coins, 0)
  assert.match(m.text(), /金币不够让枪费 500/)
})

test('面板：比分数值跟左右标签一致（左侦探猪、右你）', () => {
  const m = mountRoulette()
  startMatch(m)
  const match = m.data.match
  match.stage = 'matchOver'
  match.winsYou = 0
  match.winsAi = 1
  match.outcome = 'lose'
  m.sync()
  // 左边是 AI「侦探猪」，右边是玩家「你」；AI 赢一局时比分应为 1 : 0。
  assert.equal(m.byClass('rt-lives-score').textContent, '1 : 0')
})

test('面板：三局两胜的系列比分和本局结束文案也按左侦探猪、右你', () => {
  const m = mountRoulette()
  m.app.send('config', { seq: m.data.seq, format: 'bestOf3', stake: 1000 })
  m.sync()
  startMatch(m)
  const match = m.data.match
  match.stage = 'roundOver'
  match.round = 1
  match.winsYou = 1
  match.winsAi = 0
  m.sync()
  assert.equal(m.byClass('rt-meta-score').textContent, '0 : 1')
  assert.match(m.text(), /本局结束，比分 0 : 1/)
})

test('大窗：宿主重绘保留当前页面的滚动位置', () => {
  const m = mountRoulette({ mode: 'big' })
  assert.ok(m.byClass('rt-big'), '大窗根节点带 rt-big')
  const rt = m.byClass('rt')
  rt.scrollTop = 42
  rt.fire('scroll')
  m.sync()
  assert.equal(m.byClass('rt').scrollTop, 42, '同一页重绘不能跳回顶部')

  m.click('data-op', 'enter-ai')
  assert.equal(m.byClass('rt').scrollTop, 0, '换页从顶部开始')
})

test('扩展样式：子页有自己的返回时隐藏外壳 drill-back', () => {
  const client = readFileSync(new URL('client.js', ROOT), 'utf8')
  assert.ok(client.includes('body:has(.rt-back) .dp-drill-back{display:none!important}'))
})
