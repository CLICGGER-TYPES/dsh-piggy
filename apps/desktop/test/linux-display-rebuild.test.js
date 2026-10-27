import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createLinuxDisplayRebuild } from '../lib/linux-display-rebuild.js'

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
