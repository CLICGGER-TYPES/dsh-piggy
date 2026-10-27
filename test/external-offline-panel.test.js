// @ts-check
/**
 * 外部模式断线（含 DSH 重启后桌面没开）的面板回归：
 *
 * 1. `/dsh-piggy/state` 只回 `{ok:false, reason:'disconnected', link}` 时，面板不能再把
 *    内嵌纸盒/「拆开纸盒」假装出来——外部模式根本不会打开内嵌存档。
 * 2. 设置入口必须仍然可达，并且沿用现有设置卡片/管理弹层，能一路走到「切回内嵌猪」。
 *
 * 用构建后的 client.js 在假 DOM 里跑，网络按路由给真实形状的回应。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { SNAPSHOT, contentOf, findByAttr, findByClass, hostOf, mount, openPanel, settle } from './helpers/bundle.js'

const LINK = { state: 'disconnected', lastAt: 1_760_000_000_000, queued: 3, merged: false, dead: false }

/** 桌面没开且 DSH 刚重启：/state 没有 pig，只带 link。 */
const STATE = { ok: false, reason: 'disconnected', link: LINK }

/** 真实 /external/status：桌面发现失败，但 external-pet.json 里的目标摘要还在。 */
const STATUS = {
  ok: true, mode: 'external', pigState: 'paused', connection: 'disconnected', merged: false,
  desktop: { found: false, running: true, enabled: false, reason: 'missing-marker', appVersion: '', gameVersion: '', stateVersion: 0, mergeRulesVersion: 0, pid: 0 },
  target: { pid: 4242, summary: { name: '团团', level: 12, days: 30, coins: 494, items: 1, badges: 3, hatched: true, dead: false, box: false, kind: 'alive' } },
  source: { summary: null, hasPig: false },
  queued: 3, lastAt: LINK.lastAt,
  can: { connect: false, merge: true, rollback: false, restoreEmbedded: false, act: false },
}

const json = body => ({ ok: true, status: 200, async json() { return body } })

test('外部模式断线：不摆内嵌纸盒，设置/管理/切回入口仍可达', async () => {
  const calls = []
  const { dom } = await mount({
    fetch: async (url, options) => {
      const path = String(url).split('?')[0]
      if (path.endsWith('/dsh-piggy/state')) return json(STATE)
      if (path.endsWith('/dsh-piggy/external/status')) return json(STATUS)
      if (path.endsWith('/dsh-piggy/external/disconnect')) {
        calls.push({ path, body: JSON.parse(String(options?.body ?? '{}')) })
        return json({ ok: true })
      }
      return null
    },
  })
  await settle()
  openPanel(dom)
  await settle()

  const host = hostOf(dom)
  const content = contentOf(dom)
  const text = content.allText()
  // 没有内嵌纸盒/拆盒：那是另一只猪的新手流程，外部模式不打开内嵌存档。
  assert.doesNotMatch(text, /纸盒/)
  assert.doesNotMatch(text, /拆开纸盒/)
  assert.equal(findByAttr(content, 'data-action', 'hatch'), undefined)
  assert.equal(host.getAttribute('data-unhatched'), 'false')
  assert.equal(host.getAttribute('data-external-offline'), 'true')
  assert.match(findByClass(host, 'dp-hud').allText(), /桌面猪 · 没连上/)
  assert.match(text, /桌面猪没连上/)
  assert.match(text, /工作事件在排队（3 条）/)

  // 设置入口：打开设置后走现有卡片（断线卡片有管理）。
  const settings = findByAttr(content, 'data-external-open-settings', 'true')
  assert.notEqual(settings, undefined, '断线面板必须能打开设置')
  settings.fire('click')
  for (let index = 0; index < 6; index += 1) await settle()
  const settingsText = content.allText()
  assert.match(settingsText, /外部桌宠/)
  assert.match(settingsText, /○ 没连上桌面版/)
  const manage = findByAttr(content, 'data-external-action', 'manage')
  assert.notEqual(manage, undefined, '断线卡片的「管理」不能消失')

  // 管理 → 切回内嵌猪（暂存中的内嵌猪），一路走到真实 disconnect 请求。
  manage.fire('click')
  await settle()
  const dialog = findByAttr(host, 'data-external-dialog', 'manage')
  assert.notEqual(dialog, undefined)
  assert.equal(content.contains(dialog), false, '管理弹层位于稳定面板层，不随内容轮询销毁')
  assert.match(dialog.allText(), /管理桌面连接/)
  assert.match(dialog.allText(), /暂存中，不饿不病/)
  const withdraw = findByAttr(dialog, 'data-external-action', 'manage-withdraw')
  assert.notEqual(withdraw, undefined, '断线时仍要能切回内嵌猪')
  withdraw.fire('click')
  await settle()
  assert.match(dialog.allText(), /切回内嵌猪？/)
  const go = findByAttr(dialog, 'data-external-action', 'withdraw-go')
  assert.notEqual(go, undefined)
  go.fire('click')
  await settle()
  // 队列非空：先确认丢弃，再发 disconnect({discardQueue:true})。
  assert.match(dialog.allText(), /还有 3 条工作没送到/)
  const discard = findByAttr(dialog, 'data-external-action', 'discard-go')
  assert.notEqual(discard, undefined)
  discard.fire('click')
  for (let index = 0; index < 4; index += 1) await settle()
  const sent = calls.find(entry => entry.path.endsWith('/external/disconnect'))
  assert.notEqual(sent, undefined, '切回必须真的请求 /external/disconnect')
  assert.equal(sent.body.discardQueue, true)
})


test('外部断线保留最后快照时仍标离线，恢复连接后移除离线标记', async () => {
  const { dom, intervals } = await mount({ status: { ...SNAPSHOT, ok: false, reason: 'disconnected', link: LINK } })
  await settle()
  assert.equal(hostOf(dom).getAttribute('data-link'), 'disconnected')
  assert.equal(hostOf(dom).getAttribute('data-external-offline'), 'true')
  const poll = intervals.find(entry => entry.delay === 4000)
  globalThis.fetch = async () => json({ ...SNAPSHOT, link: { ...LINK, state: 'connected' } })
  await poll.fn()
  await settle()
  assert.equal(hostOf(dom).getAttribute('data-link'), 'connected')
  assert.equal(hostOf(dom).getAttribute('data-external-offline'), 'false')
})
