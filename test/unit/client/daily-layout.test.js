/**
 * 日历/礼包的布局几何（TOUCH03）：200%/500% 体型、睡姿、装扮和面板打开时，
 * 猪的可见输入矩形都不能压进日历所在的那块。
 *
 * 这里按 CSS 的实际公式搭一个最小 DOM（而不是截图）：`.dp-slot` 的百分比
 * 锚点、`--pig-scale`、睡姿的 1.2 倍宽盒，以及 `.dp-daily` 的三种停靠位置。
 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { collectPigHitRects } from '../../../src/client/hit-regions.js'
import { fakeDom } from '../../helpers/bundle.js'

const GAP_BELOW = 12
const DAILY_WIDTH = 36
const DAILY_HEIGHT = 25 // font-size:15px + 3px*2 padding + 2px*2 border
const PANEL_WIDTH = 292
const MIN_CLEARANCE = 10

/** CSS 里的 `--pig-size` 取 56/112/280，`--pig-scale` 就是它的 1/2/5 倍。 */
const box = (x, y, width, height) => ({ x, y, width, height })
const intersects = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width
  && a.y < b.y + b.height && b.y < a.y + a.height
/** 两个矩形的分离距离：沿任一轴完全错开时取较大的那段空隙。 */
const clearance = (a, b) => Math.max(
  Math.max(b.x - (a.x + a.width), a.x - (b.x + b.width), 0),
  Math.max(b.y - (a.y + a.height), a.y - (b.y + b.height), 0))

/** CSS 里三种停靠：收起在猪头上方、展开在猪左边、拆窗口时贴着猪窗口左边。 */
function layout(size, { open, panelOpen }) {
  const sceneWidth = open && !panelOpen ? PANEL_WIDTH : size + 12
  const sceneHeight = open ? Math.max(132, size + GAP_BELOW) : size + GAP_BELOW
  const pig = open ? box(sceneWidth - 6 - size, 0, size, size) : box(6, 0, size, size)
  const sideY = sceneHeight - (GAP_BELOW + size / 2 - 18) - DAILY_HEIGHT
  let daily
  if (!open) daily = box((size + 12) / 2 - DAILY_WIDTH / 2, -16 - DAILY_HEIGHT, DAILY_WIDTH, DAILY_HEIGHT)
  else if (panelOpen) daily = box(-6 - DAILY_WIDTH, sideY, DAILY_WIDTH, DAILY_HEIGHT)
  else daily = box(pig.x - 10 - DAILY_WIDTH, sideY, DAILY_WIDTH, DAILY_HEIGHT)
  return { pig, daily, scale: size / 56 }
}

function fixture(run) {
  const saved = { document: globalThis.document, getComputedStyle: globalThis.getComputedStyle }
  const dom = fakeDom()
  globalThis.document = dom.document
  globalThis.getComputedStyle = () => ({
    display: 'block', visibility: 'visible', opacity: '1', transform: 'none', scale: 'none',
  })
  try { run(dom) } finally { Object.assign(globalThis, saved) }
}

function make(dom, parent, className, rect, text = '') {
  const node = dom.document.createElement('div')
  node.className = className
  node.rect = rect
  node.offsetWidth = rect.width
  node.offsetHeight = rect.height
  if (text !== '') node.textContent = text
  parent.appendChild(node)
  return node
}

/** 按 CSS 的 `left/top` 百分比和 `translate(-50%,-50%)` 还原一个装扮点位。 */
function dressRect(pig, slot, scale) {
  const font = (slot === 'body' || slot === 'back' ? 19 : 15) * scale
  const anchors = { head: [.5, .02], back: [.14, .42], body: [.5, .78] }
  const [left, top] = anchors[slot]
  return box(pig.x + pig.width * left - font / 2, pig.y + pig.height * top - font / 2, font, font)
}

test('daily never overlaps the pig hit shape at 56/112/280, asleep or dressed, panel closed or open', () => fixture(dom => {
  for (const size of [56, 112, 280]) {
    for (const open of [false, true]) {
      for (const panelOpen of open ? [false, true] : [false]) {
        for (const nap of [false, true]) {
          for (const slot of [null, 'head', 'back', 'body']) {
            if (nap && slot !== null) continue // 睡着时 `.dp-dress` 整层 visibility:hidden
            const host = make(dom, dom.body, '', box(0, 0, 1280, 800))
            const { pig, daily, scale } = layout(size, { open, panelOpen })
            const pigNode = make(dom, host, 'dp-pig', pig)
            let raw = null
            if (nap) {
              raw = make(dom, pigNode, 'dp-pig-sleep', box(pig.x - size * .1, pig.y, size * 1.2, size))
              raw.src = '/dsh-piggy/art/pigs/touch03-sleep.png'
              raw.complete = true
              raw.naturalWidth = raw.offsetWidth
              raw.naturalHeight = raw.offsetHeight
            } else {
              make(dom, pigNode, 'dp-pig-emoji', pig, '🐖')
              if (slot !== null) {
                raw = make(dom, pigNode, 'dp-slot', dressRect(pig, slot, scale), '🎩')
                raw.setAttribute('data-slot', slot)
              }
            }
            const rects = collectPigHitRects(host)
            assert.ok(rects.length > 0, `${size}/${open}/${panelOpen}/${nap}/${slot}：至少量到猪本身`)
            for (const rect of rects) {
              assert.equal(intersects(rect, daily), false,
                `${size}/${open}/${panelOpen}/${nap}/${slot}：${JSON.stringify(rect)} 压到日历 ${JSON.stringify(daily)}`)
              assert.ok(clearance(rect, daily) >= MIN_CLEARANCE,
                `${size}/${open}/${panelOpen}/${nap}/${slot}：与日历的间距只有 ${clearance(rect, daily)}px`)
            }
            // 至少有两种原始盒子确实会伸进日历：裁剪不是摆设。
            if (!open && slot === 'head' && size === 280) {
              assert.equal(intersects(raw.rect, daily), true, '5 倍帽子本来会顶进收起状态的日历')
            }
            if (open && nap && size === 280) {
              assert.equal(intersects(raw.rect, daily), true, '5 倍睡姿本来会横着压到展开状态的日历')
            }
          }
        }
      }
    }
  }
}))

test('the daily button stacks above the dress and pet-snap layers', async () => {
  const [tabs, base] = await Promise.all([
    readFile(new URL('../../../src/client/css-tabs.js', import.meta.url), 'utf8'),
    readFile(new URL('../../../src/client/css-base.js', import.meta.url), 'utf8'),
  ])
  const daily = /\.dp-daily\{([^}]*)\}/.exec(tabs)
  assert.notEqual(daily, null, '找不到 .dp-daily 规则')
  const zIndex = /z-index:(\d+)/.exec(daily[1])
  assert.notEqual(zIndex, null, '.dp-daily 必须自己给 z-index')
  const dress = Number(/\.dp-dress\{[^}]*z-index:(\d+)/.exec(base)?.[1])
  const snap = Number(/\.dp-pet-snap\{[^}]*z-index:(\d+)/.exec(base)?.[1])
  assert.ok(Number(zIndex[1]) > dress, `日历要压在装扮之上：${zIndex[1]} <= ${dress}`)
  assert.ok(Number(zIndex[1]) > snap, `日历要压在摸摸物理层之上：${zIndex[1]} <= ${snap}`)
})
