import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createLinuxDisplayRebuild } from '../lib/linux-display-rebuild.js'
import { readFileSync } from 'node:fs'
import { createContext, runInContext } from 'node:vm'

test('only Linux topology changes rebuild views; dock work-area changes do not', async () => {
  for (const platform of ['linux', 'win32', 'darwin']) {
    let display = { id: 1, bounds: { x: 0, y: 0, width: 1920, height: 1200 }, scaleFactor: 1 }
    let count = 0
    const watch = createLinuxDisplayRebuild({ platform, displays: () => [display], rebuild: async () => { count++ }, onError: assert.fail })
    display = { ...display, workArea: { x: 0, y: 29, width: 1920, height: 1171 } }
    assert.equal(watch.changed(), false)
    display = { ...display, scaleFactor: 2 }
    assert.equal(watch.changed(), platform === 'linux')
    await Promise.resolve()
    assert.equal(count, platform === 'linux' ? 1 : 0)
    assert.equal(watch.changed(), false)
  }
})

test('multiple monitor events during a rebuild serialize and coalesce to the latest topology', async () => {
  let scaleFactor = 1
  const done = []
  const seen = []
  const watch = createLinuxDisplayRebuild({ platform: 'linux', displays: () => [{ id: 1, scaleFactor }],
    rebuild: () => { seen.push(scaleFactor); return new Promise(resolve => done.push(resolve)) }, onError: assert.fail })
  scaleFactor = 1.25
  watch.changed()
  scaleFactor = 2
  watch.changed()
  scaleFactor = 1
  watch.changed()
  assert.deepEqual(seen, [1.25])
  assert.equal(watch.busy(), true)
  done.shift()()
  await Promise.resolve()
  assert.deepEqual(seen, [1.25, 1])
  done.shift()()
  await Promise.resolve()
  assert.equal(watch.busy(), false)
})

test('a failed native rebuild releases its gate and reports the error', async () => {
  let scaleFactor = 1
  const errors = []
  const watch = createLinuxDisplayRebuild({ platform: 'linux', displays: () => [{ scaleFactor }],
    rebuild: async () => { throw new Error('native window failed') }, onError: error => errors.push(error.message) })
  scaleFactor = 2
  watch.changed()
  await Promise.resolve()
  assert.deepEqual(errors, ['native window failed'])
  assert.equal(watch.busy(), false)
})

test('重建 Linux 窗口时丢弃旧页面的独立输入区域', async () => {
  const source = readFileSync(new URL('../main.js', import.meta.url), 'utf8')
  const start = source.indexOf('async function rebuildLinuxViews()')
  const end = source.indexOf('\nlet lastShape =', start)
  const previous = { isDestroyed: () => false, hide() {}, removeAllListeners() {}, webContents: { removeAllListeners() {} }, destroy() {} }
  let resetInput = false
  const context = createContext({
    quitting: false, win: previous, panelWin: null, petAsked: { x: 0, y: 0, width: 132, height: 152 },
    lastPigWindow: { x: 10, y: 10 }, WINDOW_PADDING: 10, lastContent: {}, restingPigScreen: {},
    lastShape: [{}], placedShape: [{}], placedHitShape: [{ x: 20, y: 20, width: 60, height: 60 }], hasPlacedShape: true,
    stopDrag() {}, resizeShape: { cancel() {} }, closePanel() {}, ensurePanelWindow() {}, pushGeometry() {}, log() {},
    createWindow: async () => { resetInput = runInContext('placedHitShape === null && !hasPlacedShape', context); context.win = { getBounds: () => ({}) } },
  })
  assert.ok(start > 0 && end > start)
  runInContext(source.slice(start, end), context)
  await runInContext('rebuildLinuxViews()', context)
  assert.equal(resetInput, true, '新页面测量前不能沿用旧窗口 CSS 坐标的输入区域')
})
