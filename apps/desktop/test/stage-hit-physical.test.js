// @ts-check
/**
 * Windows 混合 DPI 命中基准的回归（F3）。
 *
 * 纯逻辑：物理光标/物理内容矩形/内容逻辑尺寸都是数字夹具，不启 Electron、不点真鼠标。
 * 夹具按 root 的原生观测：两块 1280x800 物理屏（100% + 125%），舞台内容
 * 2304x752 逻辑像素、rendererDPR 1；猪在页面 (2173,481) 宽 70.4。
 * 真实光标在物理 (2205,515)，Electron 的 getCursorScreenPoint 给 DIP (2020,412)。
 * 旧代码直接相减会漏点；新代码换到物理空间再折回页面逻辑坐标。
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { translatePhysicalCursor } from '../stage/hit-physical.js'
import { createPresenter } from '../stage/present.js'
import { pointerHitsShape } from '../stage/shape.js'

const STAGE = { x: 0, y: 0, width: 2304, height: 752 }
const CURSOR_DIP = { x: 2020, y: 412 }
const CURSOR_PHYSICAL = { x: 2205, y: 515 }
const PIG = { x: 2173, y: 481, width: 71, height: 106 }

/** 把物理光标折回内容逻辑坐标，再按内容原点 0 命中。 */
function hitPhysical(cursorPhysical, contentPhysical, content, shape = [PIG]) {
  const { cursor, problem } = translatePhysicalCursor(cursorPhysical, contentPhysical, content)
  assert.equal(problem, '')
  assert.notEqual(cursor, null)
  return pointerHitsShape(cursor, { x: 0, y: 0, width: content.width, height: content.height }, shape)
}

test('mixed 125 fixture: the old DIP subtraction misses, the physical basis hits the same pig', () => {
  assert.equal(pointerHitsShape(CURSOR_DIP, STAGE, [PIG]), false, '截图里的真实漏点')
  assert.equal(hitPhysical(CURSOR_PHYSICAL, STAGE, STAGE), true)
  assert.deepEqual(translatePhysicalCursor(CURSOR_PHYSICAL, STAGE, STAGE), {
    cursor: { x: 2205, y: 515 }, problem: '',
  })
})

test('mixed 150 with a negative physical origin: 1.5x content is folded back to logical pixels', () => {
  const contentPhysical = { x: -1920, y: -300, width: 3840, height: 1200 }
  const content = { x: -1280, y: -200, width: 2560, height: 800 }
  assert.deepEqual(translatePhysicalCursor({ x: 480, y: 450 }, contentPhysical, content), {
    cursor: { x: 1600, y: 500 }, problem: '',
  })
})

test('negative origin at 125%: a cursor left of and above zero uses the content physical origin', () => {
  const contentPhysical = { x: -1280, y: -270, width: 2560, height: 1000 }
  const content = { x: -1024, y: -216, width: 2048, height: 800 }
  assert.deepEqual(translatePhysicalCursor({ x: -800, y: -20 }, contentPhysical, content), {
    cursor: { x: 384, y: 200 }, problem: '',
  })
})

test('primary display at 100%: physical and logical content are identical', () => {
  const content = { x: 0, y: 0, width: 1280, height: 800 }
  assert.deepEqual(translatePhysicalCursor({ x: 640, y: 400 }, content, content), {
    cursor: { x: 640, y: 400 }, problem: '',
  })
})

test('invalid conversion returns null with a reason instead of a plausible-looking hit', () => {
  const content = { x: 0, y: 0, width: 2560, height: 800 }
  assert.deepEqual(translatePhysicalCursor({ x: NaN, y: 0 }, content, content), {
    cursor: null, problem: 'invalid cursor physical point',
  })
  assert.deepEqual(translatePhysicalCursor({ x: 0, y: 0 }, { ...content, width: 0 }, content), {
    cursor: null, problem: 'empty physical content rect',
  })
  assert.deepEqual(translatePhysicalCursor({ x: 0, y: 0 }, content, { ...content, height: 0 }), {
    cursor: null, problem: 'empty content size',
  })
  assert.deepEqual(translatePhysicalCursor({ x: Number.MAX_VALUE, y: 0 },
    { ...content, width: Number.MIN_VALUE }, content), {
    cursor: null, problem: 'non-finite logical cursor',
  })
})

function fakeStage() {
  /** @type {{ignore:boolean,forward:boolean|undefined}[]} */
  const mouse = []
  const win = {
    getContentBounds: () => STAGE,
    getBounds: () => STAGE,
    isVisible: () => true,
    isDestroyed: () => false,
    setShape() {},
    setIgnoreMouseEvents(ignore, options) { mouse.push({ ignore, forward: options?.forward }) },
  }
  return { win, mouse }
}

function presenterWith(screen, platform = 'win32') {
  const { win, mouse } = fakeStage()
  /** @type {string[]} */
  const logs = []
  const presenter = createPresenter({
    getWindow: () => win, platform, screen, log: (...parts) => logs.push(parts.join(' ')),
  })
  return { presenter, win, mouse, logs }
}

const REPORT = { shape: [PIG], visible: {}, interacting: false }

test('presenter: same pig, same cursor; legacy DIP passes through, physical conversion becomes clickable', () => {
  const before = presenterWith({ getCursorScreenPoint: () => CURSOR_DIP })
  before.presenter.applyReport(REPORT)
  assert.deepEqual(before.mouse.at(-1), { ignore: true, forward: true }, '修前：物理光标在猪上也点不到')

  let pointCalls = 0
  let rectCalls = 0
  let seenWin = null
  const screen = {
    getCursorScreenPoint: () => CURSOR_DIP,
    dipToScreenPoint(point) {
      pointCalls += 1
      assert.deepEqual(point, CURSOR_DIP, 'DIP 光标先按光标所在屏换成物理点')
      return CURSOR_PHYSICAL
    },
    dipToScreenRect(win, rect) {
      rectCalls += 1
      seenWin = win
      assert.deepEqual(rect, STAGE, '窗口内容矩形按窗口所在屏换成物理矩形')
      return STAGE
    },
  }
  const after = presenterWith(screen)
  after.presenter.applyReport(REPORT)
  assert.ok(pointCalls >= 1, '光标先由 Electron 按光标所在屏换成物理点')
  assert.equal(rectCalls, pointCalls, '每个光标点都配一次窗口内容矩形换算')
  assert.equal(seenWin, after.win)
  assert.deepEqual(after.mouse.at(-1), { ignore: false, forward: true }, '修后：点击落在猪身上')
})

test('presenter: a bad conversion is logged once and stays pass-through (never blocks the desktop)', () => {
  const screen = {
    getCursorScreenPoint: () => CURSOR_DIP,
    dipToScreenPoint: () => CURSOR_PHYSICAL,
    dipToScreenRect: () => ({ x: 0, y: 0, width: 0, height: 752 }),
  }
  const { presenter, mouse, logs } = presenterWith(screen)
  presenter.applyReport(REPORT)
  assert.deepEqual(mouse.at(-1), { ignore: true, forward: true })
  presenter.refreshHit()
  presenter.refreshHit()
  assert.equal(logs.filter(line => line.includes('hit conversion rejected')).length, 1)
})

test('presenter: interaction and the post-drag shape window still claim the whole window', () => {
  const screen = {
    getCursorScreenPoint: () => CURSOR_DIP,
    dipToScreenPoint: () => undefined,
    dipToScreenRect: () => undefined,
  }
  const { presenter, mouse } = presenterWith(screen)
  presenter.applyReport({ shape: [PIG], visible: {}, interacting: true })
  assert.deepEqual(mouse.at(-1), { ignore: false, forward: true })
  presenter.applyInteracting(false)
  assert.deepEqual(mouse.at(-1), { ignore: false, forward: true })
  presenter.dispose()
})

test('presenter: non-Windows keeps the original DIP subtraction and never calls the Windows methods', () => {
  let conversions = 0
  const screen = {
    getCursorScreenPoint: () => ({ x: 70, y: 70 }),
    dipToScreenPoint() { conversions += 1; return { x: 0, y: 0 } },
    dipToScreenRect() { conversions += 1; return STAGE },
  }
  const { presenter, mouse } = presenterWith(screen, 'darwin')
  presenter.applyReport({ shape: [{ x: 50, y: 50, width: 40, height: 40 }], visible: {}, interacting: false })
  assert.equal(conversions, 0)
  assert.deepEqual(mouse.at(-1), { ignore: false, forward: undefined })
})
