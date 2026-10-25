// @ts-check
/**
 * 舞台窗口构造选项与 main.js 装配顺序的回归。
 *
 * 重点：Windows 必须 resizable:true（否则 Electron 会按 DIP 种 min/max 夹窗），
 * Linux/macOS 必须 false；不是只看源码里同一个表达式，而是直接跑 options helper。
 * 另守 ui-scale 工厂在 registerStageIpc 之后创建、attach 在 loadURL 之前、dispose
 * 进 cleanup，以及 onChange 先 bump geometrySeq 再 pushGeometry。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { enableIsolatedZoom, stageWindowOptions } from '../stage/stage-window-options.js'

const BOUNDS = { x: -100, y: 20, width: 2560, height: 753 }
const PRELOAD = '/tmp/piggy/stage/preload.cjs'
const mainSource = readFileSync(new URL('../stage/main.js', import.meta.url), 'utf8')

test('runtime constructor options: Windows resizable, Linux/macOS not', () => {
  const cases = /** @type {[string, boolean][]} */ ([['win32', true], ['linux', false], ['darwin', false]])
  for (const [platform, expected] of cases) {
    const options = stageWindowOptions({ bounds: BOUNDS, platform, preload: PRELOAD })
    assert.equal(options.resizable, expected, platform + ' resizable')
    assert.deepEqual({ x: options.x, y: options.y, width: options.width, height: options.height }, BOUNDS)
    assert.equal(options.transparent, true)
    assert.equal(options.frame, false)
    assert.equal(options.show, false)
    assert.deepEqual(options.webPreferences, {
      preload: PRELOAD, contextIsolation: true, sandbox: true, backgroundThrottling: false,
    })
  }
})

test('isolated zoom is set on the exact webContents, and older hosts fail safely', () => {
  const calls = []
  const contents = {
    setZoomMode(mode) { calls.push({ mode, self: this === contents }) },
  }
  assert.equal(enableIsolatedZoom(contents), true)
  assert.deepEqual(calls, [{ mode: 'isolated', self: true }])
  assert.equal(enableIsolatedZoom({}), false, 'Electron 43 without setZoomMode is refused')
  assert.equal(enableIsolatedZoom(null), false)
  assert.equal(enableIsolatedZoom({ setZoomMode() { throw new Error('nope') } }), false)
})

test('main wiring: ui-scale is created after IPC, attached before navigation, disposed', () => {
  const register = mainSource.indexOf('registerStageIpc({')
  const factory = mainSource.indexOf('uiScale = createStageUiScale({')
  const stageCreate = mainSource.lastIndexOf('createStageWindow()')
  assert.ok(register >= 0 && register < factory && factory < stageCreate,
    'ui-scale listener must be registered after the presenter stage:report listener')
  assert.match(mainSource, /onChange: \(\) => \{ geometrySeq \+= 1; pushGeometry\(\) \}/,
    'onChange bumps the sequence after zoom, then sends geometry with the latest getZoomFactor')

  const construct = mainSource.indexOf('stageWin = new BrowserWindow(stageWindowOptions(')
  const attach = mainSource.indexOf('uiScale?.attach(stageWin)')
  const load = mainSource.indexOf("stageWin.loadURL('piggy://app/stage/index.html')")
  assert.ok(construct >= 0 && construct < attach && attach < load,
    'stage ui-scale must attach after construction and before loadURL')
  assert.match(mainSource, /cleanup\.add\(\(\) => uiScale\?\.dispose\(\)\)/)
  assert.doesNotMatch(mainSource, /resizable:\s*process\.platform/, 'platform branch lives in the tested helper')
  assert.ok(mainSource.trimEnd().split('\n').length <= 400, 'stage/main.js remains within 400 lines')
})
