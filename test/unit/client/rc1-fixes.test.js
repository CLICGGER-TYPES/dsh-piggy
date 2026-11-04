// v0.30.0-rc.1 用户反馈的几条（2026-10-05）。
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SNAPSHOT, contentOf, findByAttr, findByClass, hostOf, mount, openPanel, settle } from '../../helpers/bundle.js'
import { press } from '../../helpers/pointer.js'

test('the sign-in bubble owns the whole gesture, so tapping it never pats the pig instead', async () => {
  const daily = { ...SNAPSHOT.daily, canSignIn: true, signInDay: 2 }
  const { dom, calls } = await mount({
    status: { ...SNAPSHOT, daily },
    actResult: { ...SNAPSHOT, daily: { ...daily, canSignIn: false, signInTotal: 2 } },
  })
  const hint = findByClass(hostOf(dom), 'dp-daily')
  for (const type of ['pointerdown', 'pointerup', 'click']) press(hint, type, { clientX: 35, clientY: 31 })
  await settle(); await settle()
  const posted = calls.filter(call => call.method === 'POST').map(call => JSON.parse(call.body).action)
  assert.deepEqual(posted, ['signIn'], '签到只发签到，没有 touch/pet')
})

test('while the pig is out, starting work asks first, then calls it back and goes', async () => {
  const job = { key: 'bricks', label: '搬砖', emoji: '🧱', trait: 'strong', minutes: 30, coins: 40, available: true, qualified: true, requirements: [], traitEmoji: '💪', traitLabel: '武力', traitPoints: 0, payPercent: 0, satiety: -6, cleanliness: -4 }
  const away = { ...SNAPSHOT, jobs: [job], canGoOut: false, awayBlocked: 'away',
    activity: { kind: 'trip', key: 'park', label: '公园', emoji: '🌳', cost: 30, secondsLeft: 600, progress: 0.2 } }
  const { dom, calls } = await mount({ status: away, actResult: { ...away, activity: null, canGoOut: true, awayBlocked: null } })
  openPanel(dom, 'work')
  findByAttr(contentOf(dom), 'data-skill', 'strong').fire('click')
  findByAttr(contentOf(dom), 'data-job-tile', 'bricks').fire('click')
  const go = findByAttr(hostOf(dom), 'data-job', 'bricks')
  assert.equal(go.disabled, false, 'clickable while out')
  go.fire('click')
  assert.match(contentOf(dom).allText(), /猪正在公园.*改去打工（搬砖）吗？.*花的钱会退回来/)
  assert.equal(calls.filter(call => call.method === 'POST').length, 0, 'nothing sent before confirming')
  findByAttr(contentOf(dom), 'data-switch-go', 'work').fire('click')
  await settle(); await settle()
  const posted = calls.filter(call => call.method === 'POST').map(call => JSON.parse(call.body).action)
  assert.deepEqual(posted, ['calloff', 'work'])
})

test('extension cards keep the switch and the delete button together at the bottom left', async () => {
  const { dom } = await mount({ status: SNAPSHOT })
  openPanel(dom, 'settings')
  findByAttr(contentOf(dom), 'data-open-extensions', 'true').fire('click')
  const card = findByAttr(contentOf(dom), 'data-extension', 'fishing')
  const actions = findByClass(card, 'dp-ext-actions')
  assert.notEqual(findByAttr(actions, 'data-extension-toggle', 'fishing'), undefined)
  assert.notEqual(findByAttr(actions, 'data-ext-remove', 'fishing'), undefined)
})
