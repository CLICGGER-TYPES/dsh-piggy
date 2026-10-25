// @ts-check
/** 托盘恢复的外壳侧纯逻辑与两个入口的静态连线（不启 Electron/原生菜单）。 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { recoverBounds, recoveryPayload } from '../lib/pig-recovery.js'
import { WINDOW_PADDING } from '../lib/window-geometry.js'

const AREA = { x: -1024, y: 0, width: 1280, height: 800 }

test('recovery payload accepts only a finite positive primary work area', () => {
  assert.deepEqual(recoveryPayload({ workArea: AREA }), { workArea: AREA })
  assert.equal(recoveryPayload({ workArea: { ...AREA, width: 0 } }), null)
  assert.equal(recoveryPayload({ workArea: { ...AREA, x: NaN } }), null)
  assert.equal(recoveryPayload(null), null)
})

test('the shell fallback puts the current window inside the primary work area before the page replies', () => {
  const bounds = { x: 5000, y: 4000, width: 320, height: 240 }
  assert.deepEqual(recoverBounds(bounds, AREA), {
    x: AREA.x + AREA.width - bounds.width - WINDOW_PADDING,
    y: AREA.y + AREA.height - bounds.height - WINDOW_PADDING,
    width: bounds.width,
    height: bounds.height,
  })
  const huge = { x: 5000, y: 4000, width: 5000, height: 4000 }
  const clamped = recoverBounds(huge, AREA)
  assert.equal(clamped.x, AREA.x)
  assert.equal(clamped.y, AREA.y)
  assert.equal(clamped.width, huge.width, 'the page callback shrinks a 500% window; the native fallback only moves it into view')
})

test('both tray implementations expose the same plain recovery label and scoped renderer callback', () => {
  const main = readFileSync(new URL('../main.js', import.meta.url), 'utf8')
  const stageSystem = readFileSync(new URL('../stage/system.js', import.meta.url), 'utf8')
  const preload = readFileSync(new URL('../preload.cjs', import.meta.url), 'utf8')
  const stagePreload = readFileSync(new URL('../stage/preload.cjs', import.meta.url), 'utf8')
  assert.match(main, /\{ label: '恢复小猪', click: \(\) => \{ recoverPig\(\);/)
  assert.match(stageSystem, /\{ label: '恢复小猪', click: \(\) => \{ options\.onRecover\(\) \} \}/)
  assert.match(main, /piggy:recover/)
  assert.match(stageSystem, /stage:recover/)
  assert.match(preload, /onRecover: callback =>/)
  assert.match(preload, /removeListener\('piggy:recover', handler\)/)
  assert.match(stagePreload, /onRecover: callback =>/)
  assert.match(stagePreload, /removeListener\('stage:recover', handler\)/)
  assert.match(preload, /if \(workArea !== null\) callback\(\{ workArea \}\)/)
  assert.match(stagePreload, /if \(workArea !== null\) callback\(\{ workArea \}\)/)
})
