// @ts-check
/** 执行生产层级函数：菜单已有置顶标记仍要恢复真实顺序，且不能抢焦点。 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'

const source = readFileSync(new URL('../main.js', import.meta.url), 'utf8')
const extract = name => {
  const start = source.indexOf(`function ${name}(`)
  return source.slice(start, source.indexOf('\n}', start) + 2)
}

function fixture({ isPanelVisible = true, isExtensionFocused = false } = {}) {
  const calls = []
  const win = {
    isDestroyed: () => false, isVisible: () => true, isAlwaysOnTop: () => true,
    moveTop: () => calls.push('pet'), focus: () => calls.push('focus'),
    webContents: { send: () => calls.push('notify') },
  }
  const panelWin = {
    visible: isPanelVisible,
    isDestroyed: () => false, isAlwaysOnTop: () => true,
    isVisible() { return this.visible },
    moveTop: () => calls.push('panel'), focus: () => calls.push('focus'),
    setBounds: () => calls.push('bounds'),
    showInactive() { this.visible = true; calls.push('show') },
  }
  const context = {
    win, panelWin, extensionLayer: { isFocused: () => isExtensionFocused },
    process: { platform: 'win32' }, panelOpen: true,
    panelFixedViewport: false, panelHasNativeShape: false,
    panelBounds: () => ({ x: 10, y: 20, width: 292, height: 520 }),
    panelAsked: null, panelSize: { width: 292, height: 370 },
    panelAnchor: { vertical: 'above' }, log() {},
  }
  return { calls, context }
}

test('菜单已有置顶标记时仍先抬菜单、再抬猪，不抢焦点', () => {
  const { calls, context } = fixture()
  runInNewContext(extract('raisePetAbovePanel') + '\nraisePetAbovePanel()', context)
  assert.deepEqual(calls, ['panel', 'pet'])
})

test('只抬猪时不显示或抬起隐藏的菜单', () => {
  const { calls, context } = fixture({ isPanelVisible: false })
  runInNewContext(extract('raisePetAbovePanel') + '\nraisePetAbovePanel()', context)
  assert.deepEqual(calls, ['pet'])
})

test('大扩展拥有焦点时不抬猪或菜单', () => {
  const { calls, context } = fixture({ isExtensionFocused: true })
  runInNewContext(extract('raisePetAbovePanel') + '\nraisePetAbovePanel()', context)
  assert.deepEqual(calls, [])
})

test('打开隐藏菜单后同步恢复整个窗口组的顺序', () => {
  const { calls, context } = fixture({ isPanelVisible: false })
  runInNewContext(extract('raisePetAbovePanel') + '\n' + extract('placePanel') + '\nplacePanel()', context)
  assert.deepEqual(calls, ['bounds', 'show', 'panel', 'pet', 'notify'])
})

test('大扩展拥有焦点时打开菜单不抢走层级', () => {
  const { calls, context } = fixture({ isPanelVisible: false, isExtensionFocused: true })
  runInNewContext(extract('raisePetAbovePanel') + '\n' + extract('placePanel') + '\nplacePanel()', context)
  assert.deepEqual(calls, ['bounds', 'show', 'notify'])
})
