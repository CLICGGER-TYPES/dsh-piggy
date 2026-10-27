import assert from 'node:assert/strict'
import { test } from 'node:test'
import { auxiliaryWindowOptions } from '../lib/auxiliary-window.js'
import { createStageNativeWindow, stageWindowOptions } from '../stage/stage-window-options.js'

test('Linux auxiliary windows use a focusable toolbar; other platforms keep their window types', () => {
  for (const platform of ['linux', 'win32', 'darwin']) {
    const options = auxiliaryWindowOptions(platform)
    assert.equal(options.type, platform === 'linux' ? 'toolbar' : undefined)
    const stage = stageWindowOptions({ platform, bounds: { x: 0, y: 0, width: 1920, height: 1080 }, preload: 'preload.cjs' })
    assert.equal(stage.type, options.type)
    assert.equal(stage.focusable, true, 'inputs and Escape still need native focus')
    assert.equal(stage.show, false, 'constructing the auxiliary window must not activate it')
  }
})

test('Linux stage restores the complete monitor union before geometry is measured', () => {
  const bounds = { x: 67, y: 0, width: 3773, height: 1200 }
  for (const platform of ['linux', 'win32', 'darwin']) {
    const requested = []
    class Window {
      constructor(options) { this.options = options }
      setBounds(next) { requested.push(next) }
    }
    const win = createStageNativeWindow(Window, { platform, bounds, preload: 'preload.cjs' })
    assert.deepEqual(requested, platform === 'linux' ? [bounds] : [])
    assert.equal(win.options.width, bounds.width)
    assert.equal(win.options.focusable, true)
  }
})
