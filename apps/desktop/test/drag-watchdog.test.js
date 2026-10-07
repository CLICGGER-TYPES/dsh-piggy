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
  const main = readFileSync(new URL('../main.js', import.meta.url), 'utf8')
  assert.doesNotMatch(main, /win\.on\('blur',\s*stopDrag\)/)
  assert.match(main, /win\.webContents\.on\('render-process-gone',\s*\([^)]*\)\s*=>\s*\{\s*stopDrag\(\)/)
})

test('拖动开始和结束都清掉面板打开时记下的原位，内容再变不会把猪拽回去', () => {
  const main = readFileSync(new URL('../main.js', import.meta.url), 'utf8')
  const start = main.slice(main.indexOf("ipcMain.on('piggy:drag:start'"), main.indexOf("ipcMain.on('piggy:drag:heartbeat'"))
  const end = main.slice(main.indexOf("ipcMain.on('piggy:drag:end'"), main.indexOf("ipcMain.on('piggy:move'"))
  assert.match(start, /restingPigScreen = null/)
  assert.match(end, /restingPigScreen = null/)
})

test('心跳顺带挪窗口；拖动不写逐帧日志；旧游戏包的 moveBy 仍有主进程接口', () => {
  const main = readFileSync(new URL('../main.js', import.meta.url), 'utf8')
  const beat = main.slice(main.indexOf("ipcMain.on('piggy:drag:heartbeat'"), main.indexOf("ipcMain.on('piggy:drag:end'"))
  assert.match(beat, /dragTick\(\)/)
  assert.match(main, /why !== 'drag'/)
  assert.doesNotMatch(main, /appendFileSync/)
  assert.match(main, /ipcMain\.on\('piggy:move'/)
})

test('窗口销毁后到达的页面消息不处理（Windows 上切换版本时弹过「Object has been destroyed」）', () => {
  const main = readFileSync(new URL('../main.js', import.meta.url), 'utf8')
  // 外壳 0.6.0 起有两个窗口：猪窗口（fromPet，只有它能挪猪）和面板窗口，两边都先查 isDestroyed。
  assert.match(main, /function fromPet\(event\) \{\s*return !quitting && win !== null && !win\.isDestroyed\(\) && event\.sender === win\.webContents/)
  assert.match(main, /function fromPage\(event\) \{\s*return fromPet\(event\) \|\| \(!quitting && panelWin !== null && !panelWin\.isDestroyed\(\) && event\.sender === panelWin\.webContents\)/)
  assert.doesNotMatch(main, /event\.sender !== win\.webContents/)
  // 只查 null 不查 isDestroyed 的地方都不该再有
  assert.doesNotMatch(main, /if \(win === null\) return/)
  assert.match(main, /function restartGame\(\) \{\s*quitting = true/)
  assert.match(main, /process\.on\('uncaughtException'/)
})

test('Windows 用鼠标穿透代替 setShape（开关面板时窗口区域不变，不闪白）', () => {
  const main = readFileSync(new URL('../main.js', import.meta.url), 'utf8')
  const shell = readFileSync(new URL('../renderer/shell.js', import.meta.url), 'utf8')
  assert.match(main, /const PASSTHROUGH = process\.platform === 'win32'/)
  assert.match(main, /setIgnoreMouseEvents\(!hit, \{ forward: true \}\)/)
  assert.match(main, /function applyShape\(rects\) \{\s*if \(PASSTHROUGH/)
  assert.match(shell, /shell\.setHit\(inside\)/)
})

test('开关面板不算「内容变了」；非拖动时窗口差 2px 以内不重设（Windows 缩放下差 1px 会闪）', () => {
  const main = readFileSync(new URL('../main.js', import.meta.url), 'utf8')
  const changed = main.slice(main.indexOf('const changed = '), main.indexOf('if (savedPigScreen !== null) {', main.indexOf('const changed = ')))
  assert.doesNotMatch(changed, /panelOpen/)
  assert.match(main, /const BOUNDS_TOLERANCE = 2/)
  assert.match(main, /const tolerance = why === 'drag' \|\| why === 'move' \? 0 : BOUNDS_TOLERANCE/)
})

test('外壳 0.3.0 起：加载器优先用游戏包自带的桌面逻辑，老游戏包退回冻结的 shell.js', () => {
  const loader = readFileSync(new URL('../renderer/loader.js', import.meta.url), 'utf8')
  assert.match(loader, /plugin\.desktop && typeof plugin\.desktop\.install === 'function'/)
  assert.match(loader, /old\.src = 'shell\.js'/)
  const main = readFileSync(new URL('../main.js', import.meta.url), 'utf8')
  assert.match(main, /ipcMain\.on\('piggy:place'/)
  assert.match(main, /workAreas: displays\.map\(display => display\.workArea\)/)
  // 几何里还要带上每块屏的缩放：Windows 分数缩放的问题靠它才看得见。
  assert.match(main, /scaleFactor: display\.scaleFactor/)
})
