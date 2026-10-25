// @ts-check
/**
 * 舞台全屏偏好的启动顺序回归（不启动 Electron、不拉探测进程）。
 *
 * 组合 PR15 + rc.2 的回归：lib/fullscreen.js 的偏好改成异步 `init()` 之后，
 * stage/system.js 仍同步 `watch.start()`，探测用默认的 hide 跑起来——
 * 设置里选「照常显示」的用户每次重启都变回「隐藏」。
 *
 * 这里用真实的 createFullscreenWatch + 真实 fullscreen.json 证明：
 * 先 await init() 读完偏好，再 start()；同时守住混合 DPI/物理显示器注入的
 * getter 没被异步改写弄丢，以及 init 期间退出的关闭竞态。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createFullscreenWatch } from '../lib/fullscreen.js'
import { watchFullscreen } from '../stage/system.js'

const tempDir = () => mkdtempSync(join(tmpdir(), 'pig-stage-fullscreen-'))
const PHYSICAL = { x: 1280, y: 0, width: 1025, height: 769 }

/** 保存偏好，返回临时目录；调用方负责 rmSync。 */
function savedMode(mode) {
  const dir = tempDir()
  writeFileSync(join(dir, 'fullscreen.json'), JSON.stringify({ mode }) + '\n')
  return dir
}

/**
 * 包住真实的 createFullscreenWatch：init 走真实文件读取，
 * start/stop 只登记顺序和当时的 mode（测试里不真的拉起 PowerShell/xprop）。
 * @param {string[]} order @param {string[]} modes
 */
function recordingWatch(order, modes) {
  return options => {
    const real = createFullscreenWatch(options)
    // 真实 init 之前 mode 是默认值：旧代码同步 start 时看到的就是这个 hide。
    assert.equal(real.mode(), 'hide', 'before init the preference is still the default hide')
    const init = real.init.bind(real)
    const stop = real.stop.bind(real)
    real.init = async () => { const result = await init(); order.push('init'); return result }
    real.start = () => { order.push('start'); modes.push(real.mode()) }
    real.stop = async () => { order.push('stop'); return stop() }
    return real
  }
}

test('real init: the saved show mode is read before the probe starts', async () => {
  const dir = savedMode('show')
  try {
    const order = []
    const modes = []
    const watch = await watchFullscreen({
      getWindow: () => null, userData: dir, log: () => {}, onHide: () => {}, onShow: () => {},
      createWatch: recordingWatch(order, modes),
    })
    assert.deepEqual(order, ['init', 'start'], 'start waits for the preference read')
    assert.deepEqual(modes, ['show'], 'a synchronous start (the old bug) would report the default hide here')
    assert.equal(watch.mode(), 'show')
    await watch.stop()
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('real init: a missing preference file still starts with the default hide', async () => {
  const dir = tempDir()
  try {
    const order = []
    const modes = []
    const watch = await watchFullscreen({
      getWindow: () => null, userData: dir, log: () => {}, onHide: () => {}, onShow: () => {},
      createWatch: recordingWatch(order, modes),
    })
    assert.deepEqual(order, ['init', 'start'])
    assert.deepEqual(modes, ['hide'])
    await watch.stop()
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('mixed DPI: the async path keeps both pig display getters and does not move the pig', async () => {
  const dir = tempDir()
  try {
    let captured = null
    const win = { isDestroyed: () => false, getBounds: () => ({ x: 10, y: 20, width: 100, height: 200 }) }
    const watch = await watchFullscreen({
      getWindow: () => win, userData: dir, log: () => {}, onHide: () => {}, onShow: () => {},
      getPigDisplayBounds: () => PHYSICAL,
      createWatch: options => { captured = options; return { async init() {}, start() {}, stop() {} } },
    })
    assert.deepEqual(captured.pigDisplayBounds(), PHYSICAL)
    assert.equal(typeof captured.windowsPigDisplayBounds, 'function', 'Windows physical-monitor override stays wired')
    assert.deepEqual(captured.windowsPigDisplayBounds(), PHYSICAL)
    // 只读：探测配置里没有移动窗口的入口，猪的位置仍由舞台自己决定。
    assert.equal(captured.setBounds, undefined)
    await watch.stop()
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('closing during init: the probe is not started when the caller is already quitting', async () => {
  const dir = savedMode('show')
  try {
    const order = []
    const watch = await watchFullscreen({
      getWindow: () => null, userData: dir, log: () => {}, onHide: () => {}, onShow: () => {},
      isQuitting: () => true,
      createWatch: recordingWatch(order, []),
    })
    assert.deepEqual(order, ['init', 'stop'], 'init finishes, then stop; start never runs')
    assert.equal(watch.mode(), 'show', 'the preference is still read, only the probe is skipped')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('source wiring: watchFullscreen is async and awaits init before start', () => {
  const source = readFileSync(new URL('../stage/system.js', import.meta.url), 'utf8')
  const match = /export async function watchFullscreen\([\s\S]*?\n\}/.exec(source)
  assert.ok(match, 'watchFullscreen must stay exported and async')
  const body = match[0]
  const initAt = body.search(/await watch\.init\(\)/)
  const startAt = body.search(/\bwatch\.start\(\)/)
  assert.ok(initAt >= 0, 'watchFullscreen must await watch.init()')
  assert.ok(startAt > initAt, 'source order: preference read before probe start')
})
