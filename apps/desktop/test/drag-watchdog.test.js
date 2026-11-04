import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { DRAG_HEARTBEAT_TIMEOUT, dragHeartbeatExpired } from '../lib/drag-watchdog.js'

test('拖动心跳超过两秒才过期：页面忙一下不掐断拖动', () => {
  assert.equal(DRAG_HEARTBEAT_TIMEOUT, 2000)
  assert.equal(dragHeartbeatExpired(100, 2100), false)
  assert.equal(dragHeartbeatExpired(100, 2101), true)
})

test('渲染进程退出会停拖动；窗口失焦不停（Windows 上按住拖动时也可能失焦，停了猪就卡在原地）', () => {
  const manager = readFileSync(new URL('../lib/window-manager.js', import.meta.url), 'utf8')
  assert.doesNotMatch(manager, /onBlur:\s*\(window\)\s*=>\s*stopDrag\(\)/)
  assert.match(manager, /onRendererGone:\s*\(window, event, details\)\s*=>\s*\{\s*deps\.stopDrag\(pet\)/)
})

test('拖动开始和结束都清掉面板打开时记下的原位，内容再变不会把猪拽回去', () => {
  const engine = readFileSync(new URL('../lib/drag-engine.js', import.meta.url), 'utf8')
  const start = engine.slice(engine.indexOf('function startDrag(event, given) {'), engine.indexOf('/** 页面每次 pointermove 都会发心跳'))
  const end = engine.slice(engine.indexOf('function endDrag(event) {'), engine.indexOf('return { refreshRateAt'))
  assert.match(engine, /ipcMain\.on\('piggy:drag:start'/)
  assert.match(engine, /ipcMain\.on\('piggy:drag:heartbeat'/)
  assert.match(engine, /ipcMain\.on\('piggy:drag:end'/)
  assert.match(start, /restingPigScreen = null/)
  assert.match(end, /restingPigScreen = null/)
})

test('心跳顺带挪窗口；拖动不写逐帧日志；旧游戏包的 moveBy 仍有主进程接口', () => {
  const main = readFileSync(new URL('../main.js', import.meta.url), 'utf8')
  const engine = readFileSync(new URL('../lib/drag-engine.js', import.meta.url), 'utf8')
  const geometry = readFileSync(new URL('../lib/geometry-ipc.js', import.meta.url), 'utf8')
  const surface = readFileSync(new URL('../lib/window-surface.js', import.meta.url), 'utf8')
  const beat = engine.slice(engine.indexOf('function heartbeatDrag'), engine.indexOf('function endDrag'))
  assert.match(beat, /dragTick\(pet\)/)
  assert.match(surface, /why !== 'drag'/)
  assert.doesNotMatch(main, /appendFileSync/)
  assert.match(geometry, /ipcMain\.on\('piggy:move'/)
})

test('窗口销毁后到达的页面消息不处理（Windows 上切换版本时弹过「Object has been destroyed」）', () => {
  const main = readFileSync(new URL('../main.js', import.meta.url), 'utf8')
  // 外壳 0.6.8 起每只猪的窗口都由 registry 按 sender 查找；窗口销毁时先摘映射，迟到的消息被拒绝。
  assert.match(main, /function fromPet\(event\) \{\s*return petForEvent\(event\) !== null/)
  assert.match(main, /function petForEvent\(event\) \{\s*if \(desktopLifecycle\.quitting\) return null\s*const pet = pets\.bySender\(event\?\.sender\)[\s\S]{0,220}pet\.window\.isDestroyed\(\)/)
  assert.match(main, /function fromPage\(event\) \{\s*return fromPet\(event\) \|\| \(!desktopLifecycle\.quitting && getPanelWindow\(\) !== null/)
  assert.doesNotMatch(main, /event\.sender !== getPetWindow\(\)\.webContents/)
  // 只查 null 不查 isDestroyed 的地方都不该再有
  assert.doesNotMatch(main, /if \(getPetWindow\(\) === null\) return/)
  assert.match(main, /process\.on\('uncaughtException'/)
})


test('开关面板不算「内容变了」；非拖动时窗口差 2px 以内不重设（Windows 缩放下差 1px 会闪）', () => {
  const main = readFileSync(new URL('../main.js', import.meta.url), 'utf8')
  const surface = readFileSync(new URL('../lib/window-surface.js', import.meta.url), 'utf8')
  const changed = main.slice(main.indexOf('const changed = '), main.indexOf('if (pet.savedPigScreen !== null) {', main.indexOf('const changed = ')))
  assert.doesNotMatch(changed, /panelOpen/)
  assert.match(surface, /const BOUNDS_TOLERANCE = 2/)
  assert.match(surface, /const tolerance = \(why === 'drag' \|\| why === 'move'\) && !sameRequest \? 0 : BOUNDS_TOLERANCE/)
})

test('外壳 0.3.0 起：加载器优先用游戏包自带的桌面逻辑，老游戏包退回冻结的 shell.js', () => {
  const loader = readFileSync(new URL('../renderer/loader.js', import.meta.url), 'utf8')
  assert.match(loader, /plugin\.desktop && typeof plugin\.desktop\.install === 'function'/)
  assert.match(loader, /old\.src = 'shell\.js'/)
  const geometry = readFileSync(new URL('../lib/geometry-ipc.js', import.meta.url), 'utf8')
  const surface = readFileSync(new URL('../lib/window-surface.js', import.meta.url), 'utf8')
  assert.match(geometry, /ipcMain\.on\('piggy:place'/)
  assert.match(surface, /workAreas: displays\.map\(display => display\.workArea\)/)
  // 几何里还要带上每块屏的缩放：Windows 分数缩放的问题靠它才看得见。
  assert.match(surface, /scaleFactor: display\.scaleFactor/)
})
