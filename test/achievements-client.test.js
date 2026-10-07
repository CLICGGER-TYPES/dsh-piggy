// @ts-check
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { achievementsView, hatchEgg, installExtension, recordExtensionEvent, removeExtension, settleAchievements } from '../core.js'
import { SNAPSHOT, contentOf, findByAttr, findByClass, mount, openPanel } from './helpers/bundle.js'
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
  assert.equal(findByClass(locked,'dp-ach-badge').src,'/dsh-piggy/art/badge-pig-clean-ten.svg')
  const meal=findByAttr(contentOf(dom),'data-achievement','first-meal')
  assert.equal(meal.getAttribute('data-earned'),'true')
  meal.fire('click')
  assert.match(findByAttr(contentOf(dom),'data-achievement-detail','first-meal').allText(),/旧存档补录|日期未知/)
  findByAttr(contentOf(dom),'data-achievement-back','true').fire('click')
  assert.notEqual(findByAttr(contentOf(dom),'data-achievement','clean-ten'),undefined)
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
  assert.equal(findByClass(farm, 'dp-ach-badge').src, '/dsh-piggy/art/badge-pig-farm-ten.svg')
  farm.fire('click')
  assert.match(findByAttr(contentOf(dom), 'data-achievement-detail', 'farm-ten').allText(), /重新安装对应扩展/)
  findByAttr(contentOf(dom), 'data-achievement-back', 'true').fire('click')
  assert.equal(findByAttr(contentOf(dom), 'data-achievement', 'farm-first').getAttribute('data-earned'), 'true')
})
