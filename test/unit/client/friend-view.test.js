// @ts-check
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { friendViewOf } from '../../../src/client/friend-view.js'

test('朋友视图携带房间里的行动就绪状态，照顾货架仍用本机背包', () => {
  const local = {
    maxHealth: 5,
    care: { feed: [{ key: 'apple' }], bathe: [], play: [] },
    actions: { feed: { ready: true, waitSeconds: 0, blocked: null } },
  }
  const friend = {
    name: '薄荷', level: 18, stage: 'middle', label: '中年猪', emoji: '🐖',
    care: { satiety: 74, cleanliness: 52, happiness: 86 },
    status: { level: { level: 18 }, health: 5, healthPercent: 100, traits: { intel: 1, charm: 2, strong: 3 }, mood: 'happy', moodLabel: '很开心', illness: null },
    actions: {
      feed: { ready: false, waitSeconds: 9, blocked: 'hungry' },
      play: { ready: false, waitSeconds: 2, blocked: null },
    },
  }
  const view = friendViewOf(local, friend)
  assert.equal(view.actions.feed.ready, false)
  assert.equal(view.actions.feed.waitSeconds, 9)
  assert.equal(view.actions.feed.blocked, 'hungry')
  assert.equal(view.actions.play.ready, false)
  assert.equal(view.actions.play.waitSeconds, 2)
  assert.equal(view.actions.bathe.ready, true)
  assert.equal(view.care, local.care)
})

test('朋友立绘路径反查成内置 art key，卡片仍保留原图地址', () => {
  const view = friendViewOf({ maxHealth: 5, care: {}, actions: {} }, {
    name: '薄荷', level: 18, stage: 'middle', label: '中年猪',
    art: 'pigs/base/piglet/idle.png?v=abc123',
    care: { satiety: 70, cleanliness: 60, happiness: 80 },
    status: { level: { level: 18 }, health: 5, healthPercent: 100, mood: 'happy', moodLabel: '开心', illness: null },
  })
  assert.equal(view.pig.stage.art, 'piglet')
  assert.equal(view.pig.stage.actionArt, true)
  assert.ok(view.pig.stage.artScenes.includes('eat'))
  assert.equal(view.pig.artUrl, '/dsh-piggy/art/pigs/base/piglet/idle.png?v=abc123')
  const custom = friendViewOf({ maxHealth: 5, care: {}, actions: {} }, { name: '自定义', level: 1, art: 'custom-mine', status: {}, care: {} })
  assert.equal(custom.pig.stage.art, null)
  assert.equal(custom.pig.stage.actionArt, false)
})
