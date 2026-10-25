// @ts-check
/**
 * 整屏舞台的面板排版：按「猪所在那块屏的工作区」排，不按整窗并集。
 *
 * 2026-10-25 原生复现（Windows，主屏 100% + 150% 4K 副屏）：500% 藏在副屏时托盘恢复，
 * 猪落回 100% 的副屏位置，菜单却按 1930px 的整窗高排在猪下方，随后 stageBridge.settle()
 * 把猪+菜单一起夹进另一块屏（UI 缩放停在 150%）。这里只验纯函数和排版算式：
 * 不启 Electron、不读存档、不写偏好。
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { PANEL_GAP, PANEL_MARGIN, PANEL_MAX_HEIGHT, PANEL_WIDTH } from '../src/client/constants.js'
import { createLayout } from '../src/client/layout.js'
import { createStageBridge } from '../src/client/stage-bridge.js'
import { registerStageShell, unregisterStageShell } from '../src/client/stage-shell.js'
import { stagePanelArea } from '../src/client/stage-position.js'

/** 原生证据里的两块屏 DIP 工作区（主屏 100% 在原点，副屏 150% 在左下）。 */
const PRIMARY_AREA = { x: 0, y: 0, width: 1280, height: 752 }
const SECONDARY_AREA = { x: -854, y: 800, width: 2561, height: 1393 }
const FAILED_GEOMETRY = {
  window: { x: -854.6666666666666, y: -0.6666666666666666, width: 2564.6666666666665, height: 1930 },
  workAreas: [PRIMARY_AREA, SECONDARY_AREA],
  displays: [
    { id: 1, scaleFactor: 1, dipWorkArea: PRIMARY_AREA, physicalWorkArea: { x: 0, y: 0, width: 1280, height: 752 } },
    { id: 2, scaleFactor: 1.5, dipWorkArea: SECONDARY_AREA, physicalWorkArea: { x: -1280, y: 800, width: 3842, height: 2090 } },
  ],
  space: { scale: 1.5, content: { x: -1282, y: -1, width: 3847, height: 2895 }, displays: [] },
}
/** 同一个现场量到的猪（页面坐标）：主屏上、下方 90px 就是并集底边。 */
const FAILED_PIG = { x: 1598.777587890625, y: 574.4492797851562, width: 69.06287384033203, height: 69.06291961669922 }

function sceneOf(box) {
  return { x: box.left, y: box.top, left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.right - box.left, height: box.bottom - box.top }
}

/** 屏幕 DIP 工作区 → 舞台页面矩形。 */
function pageOf(area, origin) {
  return { x: area.x - origin.x, y: area.y - origin.y, width: area.width, height: area.height }
}

function installWindow(width, height) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window')
  globalThis.window = { innerWidth: width, innerHeight: height }
  return function restore() {
    if (original) Object.defineProperty(globalThis, 'window', original)
    else delete /** @type {any} */ (globalThis).window
  }
}

/** 走一遍共享 layout 的真排版（只有 getBoundingClientRect 和 style）。 */
function fitPanelWith(scene, stage) {
  registerStageShell(stage)
  try {
    const card = { style: /** @type {any} */ ({}) }
    const hud = { style: /** @type {any} */ ({}) }
    const layout = createLayout(/** @type {any} */ ({ isOpen: true, scene: { getBoundingClientRect: () => scene }, card, hud }))
    layout.fitPanel()
    return { card: card.style, hud: hud.style }
  } finally { unregisterStageShell(stage) }
}

/** 页面矩形比较（toPageRect 只做减法，误差只来自浮点）。 */
function closeTo(actual, expected, label) {
  for (const key of ['x', 'y', 'width', 'height']) {
    assert.ok(Math.abs(actual[key] - expected[key]) < 1e-6, `${label} ${key}: ${actual[key]} vs ${expected[key]}`)
  }
}

test('the pig\'s display work area is returned in page coordinates, not the union window', () => {
  closeTo(stagePanelArea(FAILED_PIG, FAILED_GEOMETRY), {
    x: PRIMARY_AREA.x - FAILED_GEOMETRY.window.x,
    y: PRIMARY_AREA.y - FAILED_GEOMETRY.window.y,
    width: PRIMARY_AREA.width,
    height: PRIMARY_AREA.height,
  }, 'primary page area')
  // 主屏的页坐标原点不是 0：整窗并集从负坐标开始，按 0 排版就会把菜单算到屏外。
  assert.ok(stagePanelArea(FAILED_PIG, FAILED_GEOMETRY).x > 800)
})

test('right / negative-x / above / below 4K mixed displays each keep their own area and DPR', () => {
  const left = { x: -1920, y: 0, width: 1920, height: 1120 }        // 125% 主屏，物理负原点
  const above = { x: 0, y: -1080, width: 1920, height: 1040 }       // 100% 副屏在正上方
  const primary = { x: 0, y: 0, width: 1920, height: 1040 }
  const right = { x: 1920, y: 0, width: 2560, height: 1400 }        // 150% 4K 在右
  const geometry = {
    window: { x: -1920, y: -1080, width: 6400, height: 2480 },
    workAreas: [left, above, primary, right],
    space: { scale: 1.5, content: { x: -2400, y: -1080, width: 9600, height: 3720 }, displays: [] },
  }
  // 猪的页面盒（屏幕坐标减 window 原点）：舞台页里量的都是页面坐标。
  const cases = [
    ['left', { x: -1900 - geometry.window.x, y: 200 - geometry.window.y, width: 56, height: 56 }, left],
    ['above', { x: 400 - geometry.window.x, y: -1000 - geometry.window.y, width: 56, height: 56 }, above],
    ['primary', { x: 900 - geometry.window.x, y: 400 - geometry.window.y, width: 56, height: 56 }, primary],
    ['right', { x: 3000 - geometry.window.x, y: 900 - geometry.window.y, width: 84, height: 84 }, right],
  ]
  for (const [name, pig, area] of cases) {
    const page = stagePanelArea(pig, geometry)
    closeTo(page, { x: area.x - geometry.window.x, y: area.y - geometry.window.y, width: area.width, height: area.height }, name)
  }
  // 同一份几何换 DPR 只影响物理换算，页面排版矩形不变。
  const scaled = { ...geometry, space: { ...geometry.space, scale: 2 } }
  closeTo(stagePanelArea(cases[3][1], scaled), stagePanelArea(cases[3][1], geometry), 'dpr 2')
})

test('no geometry / no pig / empty work areas fall back without throwing', () => {
  assert.equal(stagePanelArea(FAILED_PIG, null), null)
  assert.equal(stagePanelArea(FAILED_PIG, { workAreas: [PRIMARY_AREA] }), null, 'no stage window origin')
  assert.equal(stagePanelArea(null, FAILED_GEOMETRY), null)
  closeTo(stagePanelArea(FAILED_PIG, { window: FAILED_GEOMETRY.window, workAreas: [] }), {
    x: 0, y: 0, width: FAILED_GEOMETRY.window.width, height: FAILED_GEOMETRY.window.height,
  }, 'whole window')
})

test('the captured 500% recovery reopen puts the menu above the pig on the pig\'s own display', () => {
  const restore = installWindow(FAILED_GEOMETRY.window.width, FAILED_GEOMETRY.window.height)
  try {
    const area = stagePanelArea(FAILED_PIG, FAILED_GEOMETRY)
    const scene = sceneOf({ left: 1598.7775, right: 1667.8404, top: 574.4492, bottom: 643.5122 })
    const { card, hud } = fitPanelWith(scene, { panelArea: () => area })

    const roomAbove = scene.top - area.y - PANEL_GAP - PANEL_MARGIN
    const roomBelow = area.y + area.height - scene.bottom - PANEL_GAP - PANEL_MARGIN
    assert.ok(roomAbove > roomBelow, 'precondition: the menu belongs above the pig on this display')
    assert.equal(card.top, 'auto')
    assert.equal(card.bottom, `calc(100% + ${PANEL_GAP}px)`, 'the menu opens above the pig')
    assert.equal(card.maxHeight, Math.min(PANEL_MAX_HEIGHT, Math.round(roomAbove)) + 'px')
    assert.equal(card.maxWidth, PANEL_WIDTH + 'px')
    assert.equal(card.right, '0px')
    assert.equal(hud.left, '9px')

    // 菜单矩形（右沿贴猪的右沿、高度取上限）不越出猪所在的工作区：settle 不会再把猪推走。
    const menu = { left: scene.right - PANEL_WIDTH, right: scene.right, top: scene.top - PANEL_GAP - PANEL_MAX_HEIGHT, bottom: scene.top - PANEL_GAP }
    assert.ok(menu.left >= area.x + PANEL_MARGIN && menu.right <= area.x + area.width, 'menu horizontally inside the display')
    assert.ok(menu.top >= area.y + PANEL_MARGIN && menu.bottom <= area.y + area.height, 'menu vertically inside the display')
    const union = { top: Math.min(scene.top, menu.top), bottom: Math.max(scene.bottom, menu.bottom), left: Math.min(scene.left, menu.left), right: Math.max(scene.right, menu.right) }
    assert.ok(union.top >= area.y && union.bottom <= area.y + area.height, 'pig + menu stay on the pig\'s display')

    // 修前（同一现场）：按 1930px 整窗，下方有 1268px，菜单排在猪下面到 ~1171px，
    // 猪+菜单并集的中心落进 150% 副屏的工作区，settle 把整组搬过去（UI 缩放停在 150%）。
    const oldMenu = { top: scene.bottom + PANEL_GAP, bottom: scene.bottom + PANEL_GAP + PANEL_MAX_HEIGHT }
    const oldUnion = { top: Math.min(scene.top, oldMenu.top), bottom: Math.max(scene.bottom, oldMenu.bottom) }
    assert.ok(oldUnion.bottom > area.y + area.height, 'the union-height fit put the menu past the pig\'s display')
    const secondaryPage = pageOf(SECONDARY_AREA, FAILED_GEOMETRY.window)
    const centre = { x: (scene.left + scene.right) / 2, y: (oldUnion.top + oldUnion.bottom) / 2 }
    assert.ok(centre.x >= secondaryPage.x && centre.x <= secondaryPage.x + secondaryPage.width
      && centre.y >= secondaryPage.y && centre.y <= secondaryPage.y + secondaryPage.height,
    'the old union centre sits in the next display, which is what carried the pig there')
  } finally { restore() }
})

test('a corner pig on a display with a non-zero page origin shifts the menu and the hud into that area', () => {
  const restore = installWindow(1600, 1600)
  try {
    const area = { x: 300, y: 20, width: 1000, height: 600 }
    const scene = sceneOf({ left: 250, right: 500, top: 480, bottom: 549 })
    const { card, hud } = fitPanelWith(scene, { panelArea: () => area })

    const roomAbove = scene.top - area.y - PANEL_GAP - PANEL_MARGIN
    assert.equal(card.bottom, `calc(100% + ${PANEL_GAP}px)`)
    assert.equal(card.maxHeight, Math.round(roomAbove) + 'px', 'uncapped: the area above, not the 1930px union')
    assert.ok(Number.parseFloat(card.maxHeight) < PANEL_MAX_HEIGHT)
    // 宽度按这块屏算，横向按 area.x 夹取：负 right 把菜单右沿往右挪，左沿落在 area.x + margin。
    const menuLeft = scene.right - PANEL_WIDTH + (area.x + PANEL_MARGIN - (scene.right - PANEL_WIDTH))
    assert.equal(menuLeft, area.x + PANEL_MARGIN)
    assert.equal(card.right, '-' + (area.x + PANEL_MARGIN - (scene.right - PANEL_WIDTH)) + 'px')
    assert.ok(menuLeft >= area.x && menuLeft + PANEL_WIDTH <= area.x + area.width)
    assert.ok(scene.right - PANEL_WIDTH < area.x + PANEL_MARGIN, 'precondition: without the area the menu hangs off the display')
    // 名牌跟菜单左沿对齐（相对猪），不会被推到 area.x 左边。
    assert.equal(hud.left, Math.max(9, Math.round(area.x + PANEL_MARGIN - scene.left)) + 'px')
  } finally { restore() }
})

test('web / split layout keeps the whole viewport: no stage adapter, no getter, or a null answer', () => {
  const restore = installWindow(1600, 1600)
  try {
    const scene = sceneOf({ left: 250, right: 500, top: 480, bottom: 549 })
    const expected = {
      top: `calc(100% + ${PANEL_GAP}px)`, bottom: 'auto',
      maxHeight: PANEL_MAX_HEIGHT + 'px', maxWidth: PANEL_WIDTH + 'px', right: '0px',
    }
    const variants = {
      'no stage adapter': null,
      'stage adapter without the optional getter': { role: 'stage' },
      'stage adapter reporting null': { panelArea: () => null },
    }
    for (const [name, stage] of Object.entries(variants)) {
      const { card, hud } = fitPanelWith(scene, stage)
      assert.equal(card.top, expected.top, `${name}: top`)
      assert.equal(card.bottom, expected.bottom, `${name}: bottom`)
      assert.equal(card.maxHeight, expected.maxHeight, `${name}: maxHeight`)
      assert.equal(card.maxWidth, expected.maxWidth, `${name}: maxWidth`)
      assert.equal(card.right, expected.right, `${name}: right`)
      assert.equal(hud.left, '9px', `${name}: hud`)
    }
  } finally { restore() }
})

test('the stage bridge hands the shared layout the pig\'s page work area', () => {
  const dimensions = FAILED_GEOMETRY.window
  const originals = {}
  for (const key of ['window', 'document', 'getComputedStyle', 'MutationObserver', 'requestAnimationFrame', 'cancelAnimationFrame']) {
    originals[key] = Object.getOwnPropertyDescriptor(globalThis, key)
  }
  let bridge = null
  try {
    globalThis.window = /** @type {any} */ ({
      innerWidth: dimensions.width, innerHeight: dimensions.height, devicePixelRatio: 1.4996100664138794,
      localStorage: { getItem: () => null, setItem() {} },
      addEventListener() {}, removeEventListener() {},
    })
    globalThis.document = /** @type {any} */ ({ body: {}, activeElement: null })
    globalThis.getComputedStyle = /** @type {any} */ (node => node.style)
    globalThis.MutationObserver = /** @type {any} */ (class { observe() {} disconnect() {} })
    globalThis.requestAnimationFrame = /** @type {any} */ (() => 1)
    globalThis.cancelAnimationFrame = /** @type {any} */ (() => {})

    const host = {
      offsetParent: null, offsetWidth: 81, offsetHeight: 81,
      style: { right: '1390px', bottom: '1275px' },
      get offsetLeft() { return dimensions.width - Number.parseFloat(this.style.right) - this.offsetWidth },
      get offsetTop() { return dimensions.height - Number.parseFloat(this.style.bottom) - this.offsetHeight },
      getAttribute: () => 'false',
    }
    const pig = { offsetParent: host, offsetWidth: 69, offsetHeight: 69, style: { getPropertyValue: () => '' },
      get offsetLeft() { return host.offsetWidth - 6 - this.offsetWidth },
      get offsetTop() { return host.offsetHeight - 12 - this.offsetHeight } }
    const make = (geometry) => createStageBridge(/** @type {any} */ ({
      options: { role: 'stage', geometry: () => geometry },
      ctx: { userRight: 1390, userBottom: 1275 }, host, pig,
      bubble: { hidden: true }, card: { hidden: true },
      setOpen() {}, clampPig() {}, fitPanel() {},
    }))

    bridge = make(FAILED_GEOMETRY)
    const area = bridge.panelArea()
    assert.ok(area !== null, 'a live geometry answers with a page rectangle')
    closeTo(area, stagePanelArea({ x: 1102, y: 574, width: 69, height: 69 }, FAILED_GEOMETRY), 'bridge area')
    assert.equal(area.width, PRIMARY_AREA.width, 'the pig\'s own display, not the union window')
    assert.ok(area.x > 0 && area.y > 0, 'page coordinates keep the union origin')
    bridge.dispose()

    bridge = make({ workAreas: [PRIMARY_AREA, SECONDARY_AREA] })
    assert.equal(bridge.panelArea(), null, 'until the first geometry arrives the layout keeps the old viewport fit')
  } finally {
    bridge?.dispose()
    for (const [key, descriptor] of Object.entries(originals)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete /** @type {any} */ (globalThis)[key]
    }
  }
})
