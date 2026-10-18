// 大窗口让出置顶层的生命周期回归；隐藏状态不被恢复置顶操作改成显示。
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createExtensionLayer } from '../lib/extension-layer.js'

test('大扩展焦点、失焦、最小化、关闭及守卫重入统一置顶状态', () => {
  const pet = { top: true, visible: false, isDestroyed: () => false,
    isAlwaysOnTop() { return this.top }, setAlwaysOnTop(value) { this.top = value } }
  const panel = { ...pet, visible: true }
  let raised = 0
  let extension = { moveTop() { raised++ }, focused: true, minimized: false, visible: true, destroyed: false,
    isDestroyed() { return this.destroyed }, isVisible() { return this.visible },
    isMinimized() { return this.minimized }, isFocused() { return this.focused } }
  const layer = createExtensionLayer({ extension: () => extension, overlays: () => [pet, panel] })
  layer.sync()
  assert.equal(pet.top, false)
  assert.equal(panel.top, false)
  assert.equal(raised, 1)
  layer.sync()
  assert.equal(layer.isFocused(), true)
  assert.equal(pet.visible, false)
  for (const key of ['focused', 'minimized', 'visible', 'destroyed']) {
    const before = extension[key]
    extension[key] = !before
    layer.sync()
    assert.equal(pet.top, true, key)
    extension[key] = before
    layer.sync()
    assert.equal(pet.top, false)
  }
  extension = null
  layer.sync()
  assert.equal(pet.top, true)
  assert.equal(pet.visible, false)
})

test('反应消息、全屏恢复和3秒守卫都不能抬回获得焦点的大扩展之上', async () => {
  const { readFileSync } = await import('node:fs')
  const { runInNewContext } = await import('node:vm')
  const source = readFileSync(new URL('../main.js', import.meta.url), 'utf8')
  const extract = name => source.slice(source.indexOf('function ' + name + '('), source.indexOf('\n}', source.indexOf('function ' + name + '(')) + 2)
  let moves = 0, tops = 0
  const win = { isDestroyed: () => false, isVisible: () => true, moveTop: () => moves++, setAlwaysOnTop: () => tops++ }
  let syncs = 0
  const context = { win, panelWin: win, extensionLayer: { isFocused: () => true, sync() { syncs++ } }, Date, log() {}, reassertingUntil: 0, quitting: false }
  runInNewContext(extract('raisePetAbovePanel') + '\n' + extract('reassertTop') + '\nraisePetAbovePanel(); reassertTop("check"); reassertTop("lost"); reassertTop("fullscreen-ended")', context)
  assert.equal(moves, 0)
  assert.equal(tops, 0)
  assert.equal(syncs, 3)
})
