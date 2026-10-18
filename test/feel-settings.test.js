// @ts-check
// 手感/音效设置：默认值、档位、系统减少动态、音效默认关与免打扰。
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  effectiveFeelMode, feelMode, onFeelModeChange, prefersReducedMotion,
  setFeelMode, setSoundSettings, soundSettings,
} from '../src/client/feel/settings.js'
import { configureSound, playSound, resetSound } from '../src/client/sound.js'

function fakeWindow(matches) {
  const store = new Map()
  globalThis.window = {
    localStorage: {
      getItem: key => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => { store.set(key, String(value)) },
    },
    matchMedia: () => ({ matches: matches === true, addEventListener() {}, removeEventListener() {} }),
  }
  return store
}

test('手感默认标准，可切轻柔/关闭，非法值回落标准', () => {
  fakeWindow(false)
  assert.equal(feelMode(), 'full')
  assert.equal(effectiveFeelMode(), 'full')
  setFeelMode('soft')
  assert.equal(feelMode(), 'soft')
  setFeelMode('off')
  assert.equal(feelMode(), 'off')
  setFeelMode('nonsense')
  assert.equal(feelMode(), 'full')
})

test('系统减少动态时强制关闭，但不改写用户档位', () => {
  fakeWindow(true)
  setFeelMode('soft')
  assert.equal(prefersReducedMotion(), true)
  assert.equal(effectiveFeelMode(), 'off')
  assert.equal(feelMode(), 'soft', '用户的选择要留着')
})

test('设置页改档位会立刻通知正在跑的手感层', () => {
  fakeWindow(false)
  const seen = []
  const stop = onFeelModeChange(mode => seen.push(mode))
  setFeelMode('soft')
  setFeelMode('off')
  stop()
  setFeelMode('full')
  assert.deepEqual(seen, ['soft', 'off'])
})

test('音效默认关，音量限制在轻/中/响三档', () => {
  fakeWindow(false)
  assert.deepEqual(soundSettings(), { on: false, volume: 2 })
  assert.deepEqual(setSoundSettings({ on: true }), { on: true, volume: 2 })
  assert.deepEqual(setSoundSettings({ volume: 0 }), { on: true, volume: 0 })
  assert.deepEqual(setSoundSettings({ volume: 9 }), { on: true, volume: 0 }, '非法音量保持原值')
})

test('音效关闭或免打扰时不创建音频、不返回播放成功', () => {
  fakeWindow(false)
  resetSound()
  configureSound({ isQuiet: () => false })
  setSoundSettings({ on: false })
  assert.equal(playSound('tap'), false)
  setSoundSettings({ on: true })
  configureSound({ isQuiet: () => true })
  assert.equal(playSound('tap'), false)
  resetSound()
})
