// @ts-check
import { artSource } from '../../../src/client/art-path.js'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { achievementsView, hatchEgg, installExtension, recordExtensionEvent, removeExtension, settleAchievements } from '../../../src/host/core.js'
import { SNAPSHOT, contentOf, findByAttr, findByClass, mount, openPanel, settle } from '../../helpers/bundle.js'
const NOW=1_800_000_000_000

test('catalogue shows pig badges, named locked goals, progress, detail and return', async () => {
  const state=hatchEgg(NOW)
  state.stats.baths=6;state.stats.feeds=1
  settleAchievements(state,NOW,{silent:true})
  const {dom}=await mount({status:{...SNAPSHOT,dex:{achievements:achievementsView(state)}}})
  openPanel(dom,'dex')
  findByAttr(contentOf(dom),'data-dex-section','achievements').fire('click')
  const locked=findByAttr(contentOf(dom),'data-achievement','clean-ten')
  assert.match(locked.allText(),/香喷喷小猪|6\/10/)
  assert.equal(locked.getAttribute('data-earned'),'false')
  assert.equal(findByClass(locked,'dp-ach-badge').src,artSource('badge-pig-clean-ten'))
  const meal=findByAttr(contentOf(dom),'data-achievement','first-meal')
  assert.equal(meal.getAttribute('data-earned'),'true')
  meal.fire('click')
  assert.match(findByAttr(contentOf(dom),'data-achievement-detail','first-meal').allText(),/旧存档补录|日期未知/)
  findByAttr(contentOf(dom),'data-achievement-back','true').fire('click')
  assert.notEqual(findByAttr(contentOf(dom),'data-achievement','clean-ten'),undefined)
})

/** 从构建后的客户端读取真实渲染顺序。 */
function cardKeys(dom) {
  const keys = []
  contentOf(dom).walk(node => {
    const key = node.getAttribute('data-achievement')
    if (key !== null) keys.push(key)
  })
  return keys
}

async function browse(entries) {
  const mounted = await mount({ status: { ...SNAPSHOT, dex: { achievements: entries } } })
  openPanel(mounted.dom, 'dex')
  findByAttr(contentOf(mounted.dom), 'data-dex-section', 'achievements').fire('click')
  return mounted
}

function example(key, progress, target, acquired = false, group = '日常') {
  return { key, label: key, art: 'badge-pig-first-meal', progress, target, acquired, group, unit: '次', firstAt: null }
}

test('筛选准确区分已获得与未获得，空列表保留切换入口', async () => {
  const { dom } = await browse([example('done', 1, 1, true), example('todo', 1, 10)])
  findByAttr(contentOf(dom), 'data-achievement-filter', 'earned').fire('click')
  assert.deepEqual(cardKeys(dom), ['done'])
  assert.equal(findByAttr(contentOf(dom), 'data-achievement-filter', 'earned').getAttribute('aria-pressed'), 'true')
  findByAttr(contentOf(dom), 'data-achievement-filter', 'locked').fire('click')
  assert.deepEqual(cardKeys(dom), ['todo'])
  findByAttr(contentOf(dom), 'data-achievement-filter', 'all').fire('click')
  assert.deepEqual(cardKeys(dom), ['done', 'todo'])
  const fresh = await browse([example('todo', 0, 10)])
  findByAttr(contentOf(fresh.dom), 'data-achievement-filter', 'earned').fire('click')
  assert.deepEqual(cardKeys(fresh.dom), [])
  assert.match(contentOf(fresh.dom).allText(), /还没有获得成就/)
  findByAttr(contentOf(fresh.dom), 'data-achievement-filter', 'all').fire('click')
  assert.deepEqual(cardKeys(fresh.dom), ['todo'])
  const complete = await browse([example('done', 1, 1, true)])
  findByAttr(contentOf(complete.dom), 'data-achievement-filter', 'locked').fire('click')
  assert.match(contentOf(complete.dom).allText(), /当前成就都已获得/)
  const empty = await browse([])
  assert.match(contentOf(empty.dom).allText(), /暂无成就/)
})

test('快达成按跨分类比例排序，已获得置后，同进度稳定且不改变原分类顺序', async () => {
  const entries = [example('done', 1, 1, true), example('low', 3, 20), example('near', 99, 100, false, '钓鱼'), example('tie', 9.9, 10, false, '菜园'), example('zero', 0, 20)]
  const original = structuredClone(entries)
  const { dom } = await browse(entries)
  findByAttr(contentOf(dom), 'data-achievement-sort', 'progress').fire('click')
  assert.deepEqual(cardKeys(dom), ['near', 'tie', 'low', 'zero', 'done'])
  findByAttr(contentOf(dom), 'data-achievement-filter', 'locked').fire('click')
  assert.deepEqual(cardKeys(dom), ['near', 'tie', 'low', 'zero'])
  findByAttr(contentOf(dom), 'data-achievement-sort', 'group').fire('click')
  assert.deepEqual(cardKeys(dom), ['low', 'zero', 'near', 'tie'])
  assert.deepEqual(entries, original)
})

test('详情返回恢复筛选、排序和列表位置，轮询不覆盖该位置', async () => {
  const status = { ...SNAPSHOT, dex: { achievements: [example('low', 3, 20), example('near', 99, 100)] } }
  const { dom, intervals } = await mount({ status })
  openPanel(dom, 'dex')
  findByAttr(contentOf(dom), 'data-dex-section', 'achievements').fire('click')
  findByAttr(contentOf(dom), 'data-achievement-filter', 'locked').fire('click')
  findByAttr(contentOf(dom), 'data-achievement-sort', 'progress').fire('click')
  contentOf(dom).scrollTop = 380
  findByAttr(contentOf(dom), 'data-achievement', 'near').fire('click')
  assert.equal(contentOf(dom).scrollTop, 0)
  const poll = intervals.find(entry => entry.delay === 4000)
  assert.ok(poll, '测试必须触发真实的状态轮询')
  poll.fn()
  await settle()
  contentOf(dom).scrollTop = 25
  findByAttr(contentOf(dom), 'data-achievement-back', 'true').fire('click')
  assert.equal(contentOf(dom).scrollTop, 380)
  assert.deepEqual(cardKeys(dom), ['near', 'low'])
  assert.equal(findByAttr(contentOf(dom), 'data-achievement-filter', 'locked').getAttribute('aria-pressed'), 'true')
  assert.equal(findByAttr(contentOf(dom), 'data-achievement-sort', 'progress').getAttribute('aria-pressed'), 'true')
  findByAttr(contentOf(dom), 'data-achievement-filter', 'all').fire('click')
  assert.equal(contentOf(dom).scrollTop, 0)
})

test('浏览详情期间解锁后，返回未获得列表读取最新状态', async () => {
  const status = { ...SNAPSHOT, dex: { achievements: [example('near', 9, 10), example('low', 1, 10)] } }
  const { dom, intervals } = await mount({ status })
  openPanel(dom, 'dex')
  findByAttr(contentOf(dom), 'data-dex-section', 'achievements').fire('click')
  findByAttr(contentOf(dom), 'data-achievement-filter', 'locked').fire('click')
  findByAttr(contentOf(dom), 'data-achievement', 'near').fire('click')
  status.dex.achievements[0].progress = 10
  status.dex.achievements[0].acquired = true
  const poll = intervals.find(entry => entry.delay === 4000)
  assert.ok(poll)
  poll.fn()
  await settle()
  assert.match(findByAttr(contentOf(dom), 'data-achievement-detail', 'near').allText(), /已获得/)
  findByAttr(contentOf(dom), 'data-achievement-back', 'true').fire('click')
  assert.deepEqual(cardKeys(dom), ['low'])
})


test('extension badges render grouped progress and show how to resume after uninstall', async () => {
  const state = hatchEgg(NOW)
  installExtension(state, 'farm', {})
  recordExtensionEvent(state, 'farm', { name: 'harvest', total: 6, items: ['carrot'] })
  settleAchievements(state, NOW)
  removeExtension(state, 'farm', NOW)
  const { dom } = await mount({ status: { ...SNAPSHOT, dex: { achievements: achievementsView(state) } } })
  openPanel(dom, 'dex')
  findByAttr(contentOf(dom), 'data-dex-section', 'achievements').fire('click')
  const farm = findByAttr(contentOf(dom), 'data-achievement', 'farm-ten')
  assert.match(farm.allText(), /丰收小猪|6\/10/)
  assert.equal(findByClass(farm, 'dp-ach-badge').src, artSource('badge-pig-farm-ten'))
  farm.fire('click')
  assert.match(findByAttr(contentOf(dom), 'data-achievement-detail', 'farm-ten').allText(), /重新安装对应扩展/)
  findByAttr(contentOf(dom), 'data-achievement-back', 'true').fire('click')
  assert.equal(findByAttr(contentOf(dom), 'data-achievement', 'farm-first').getAttribute('data-earned'), 'true')
})
