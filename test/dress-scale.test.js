// @ts-check
/**
 * 装扮 overlay 的显示比例与镜像（外观审计 D3 / D4）。
 *
 * 两件事：
 *   1. 「小猪大小」是这台设备的显示比例（`dsh-piggy:pig-size`），装扮点位的大小要跟着它一起放大，
 *      但不跟生命阶段的体型走 —— 100% 时每个年龄身体仍是 15px / 19px，各年龄规则原样。
 *   2. 朝右时整只猪镜像，装扮必须和 `.dp-pig-img` 用同一条开关（`data-walk="right"`）；
 *      物理翻面期间由 `.dp-pig-body` 做镜像，这里和立绘一样把 `data-feel-flip` 时的镜像关掉，
 *      否则背部件会双重镜像、翻完最后一帧再跳回另一侧（审计实测约 0.72×猪盒宽）。
 *
 * 这里直接 import src（不经过构建产物），CSS 规则从源码里读：
 * 断言的是「CSS 真的这么算」，不是抄一遍数字。
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { CSS_BASE } from '../src/client/css-base.js'
import { LIFE_STAGES } from '../packages/pet-core/src/data/life.js'
import { findByAttr, hostOf, mount, openPanel, PIG } from './helpers/bundle.js'
// 命名空间导入：本轮新增的接线函数缺失时，失败落在那条行为断言上，而不是整个文件 import 报错。
import * as sizeWiring from '../src/client/pig-size.js'

const { PIG_SIZE_KEY, attachSizePreference, pigSize, setPigSize } = sizeWiring

/** 整套拼接后的样式（装扮规则在 css-base.js，别漏了后面的表）。 */
const CSS = CSS_BASE

/** 粗扫所有 `selector{body}`；@keyframes 里的嵌套块也会被扫到，调用方按 selector 过滤。 */
function findRules(needles) {
  const found = []
  const scan = /([^{}]+)\{([^{}]*)\}/g
  let match
  while ((match = scan.exec(CSS)) !== null) {
    const selector = match[1].trim()
    if (needles.every(needle => selector.includes(needle))) found.push({ selector, body: match[2] })
  }
  return found
}

/** 某条选择器的声明体；不存在就直接失败（改选择器要连测试一起改）。 */
function bodyOf(selector) {
  const exact = findRules([selector]).filter(rule => rule.selector === selector)
  assert.equal(exact.length, 1, '规则不存在或被拆开: ' + selector)
  return exact[0].body
}

/** 声明体里的某条属性值。 */
function declOf(body, prop) {
  const match = new RegExp('(?:^|;)' + prop + ':([^;]+)').exec(body)
  return match === null ? null : match[1].trim()
}

/**
 * font-size 声明 → 基准像素 + 是否按 `--pig-scale` 缩放。
 * 认不出来的写法直接失败，避免「改了但测试只比字符串」。
 */
function fontSizeOf(selector) {
  const value = declOf(bodyOf(selector), 'font-size')
  assert.notEqual(value, null, selector + ' 没有 font-size')
  const calc = /^calc\(([\d.]+)px \* var\(--pig-scale,1\)\)$/.exec(String(value))
  if (calc !== null) return { base: Number(calc[1]), scales: true }
  const plain = /^([\d.]+)px$/.exec(String(value))
  if (plain !== null) return { base: Number(plain[1]), scales: false }
  assert.fail(selector + ' 的 font-size 不是 px 或 calc(Npx * var(--pig-scale,1)): ' + value)
}

/** CSS 在某个显示比例下的实际字号。 */
const effective = (part, scale) => part.base * (part.scales ? scale : 1)

const HEAD = '.dp-slot'
const BODY = '.dp-slot[data-slot="body"]'
const BACK = '.dp-slot[data-slot="back"]'

// ---------------------------------------------------------------------------
// 1. 比例：装扮只看本机显示比例，不看生命阶段
// ---------------------------------------------------------------------------

test('dress overlays scale with the device display scale', () => {
  const head = fontSizeOf(HEAD)
  const body = fontSizeOf(BODY)
  const back = fontSizeOf(BACK)
  assert.equal(head.base, 15, '头/脸/脖子/脚点位的基准字号仍是 15px')
  assert.equal(body.base, 19, '身子点位基准字号仍是 19px')
  assert.equal(back.base, 19, '背点位基准字号仍是 19px')
  for (const [name, part] of [['head', head], ['body', body], ['back', back]]) {
    assert.ok(part.scales, name + ' 点位的字号必须乘 var(--pig-scale,1)，否则 200%/500% 会缩成小贴纸')
  }
  assert.equal(effective(head, 1), 15)
  assert.equal(effective(body, 1), 19)
  assert.equal(effective(back, 1), 19)
  assert.equal(effective(head, 2), 30)
  assert.equal(effective(body, 2), 38)
  assert.equal(effective(back, 2), 38)
  assert.equal(effective(head, 5), 75)
  assert.equal(effective(body, 5), 95)
  assert.equal(effective(back, 5), 95)
})

test('every growth stage keeps the shipped 15px/19px at 100%', () => {
  // 显示比例只乘在 --pig-scale 上：同一显示比例下，各年龄身体的装扮字号完全一样。
  const parts = [fontSizeOf(HEAD), fontSizeOf(BODY), fontSizeOf(BACK)]
  for (const stage of LIFE_STAGES) {
    for (const scale of [1, 2, 5]) {
      const head = effective(parts[0], scale)
      assert.equal(head, 15 * scale, stage.key + ' @' + scale + 'x 头点位字号')
      assert.equal(effective(parts[1], scale), 19 * scale, stage.key + ' @' + scale + 'x 身子点位字号')
      assert.equal(effective(parts[2], scale), 19 * scale, stage.key + ' @' + scale + 'x 背点位字号')
    }
  }
})

test('the shipped slot offsets and hide rules are untouched', () => {
  const offsets = [
    ['head', '50%', '2%'], ['face', '50%', '32%'], ['neck', '50%', '60%'],
    ['body', '50%', '78%'], ['back', '14%', '42%'], ['feet', '50%', '99%'],
  ]
  for (const [slot, left, top] of offsets) {
    const body = bodyOf('.dp-slot[data-slot="' + slot + '"]')
    assert.equal(declOf(body, 'left'), left, slot + ' 点位 left')
    assert.equal(declOf(body, 'top'), top, slot + ' 点位 top')
  }
  const dress = bodyOf('.dp-dress')
  assert.equal(declOf(dress, 'position'), 'absolute')
  assert.equal(declOf(dress, 'inset'), '0')
  assert.equal(declOf(dress, 'pointer-events'), 'none')
  // 反馈图 / 打盹 / 困了仍然整件隐藏，这一轮不改。
  assert.match(CSS, /\[data-feedback="true"\] \.dp-dress\{display:none\}/)
  assert.match(CSS, /\[data-idle="nap"\][^{]*\.dp-dress\{visibility:hidden\}/)
  assert.match(CSS, /\[data-mood="sleepy"\][^{]*\.dp-dress\{visibility:hidden\}/)
})

// ---------------------------------------------------------------------------
// 2. 尺寸接线：--pig-size 和 --pig-scale 一起写
// ---------------------------------------------------------------------------

function fakeHost() {
  const properties = new Map()
  return {
    properties,
    style: {
      setProperty(name, value) { properties.set(name, String(value)) },
      getPropertyValue(name) { return properties.get(name) ?? '' },
    },
  }
}

function installStorage() {
  const storage = new Map()
  globalThis.window = {
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
    addEventListener() {},
    removeEventListener() {},
  }
  return storage
}

test('the shared helper writes the box size and the overlay scale together', () => {
  installStorage()
  for (const stage of LIFE_STAGES) {
    setPigSize(1)
    const host = fakeHost()
    sizeWiring.syncPigSize(host, stage.size)
    assert.equal(host.properties.get('--pig-size'), stage.size + 'px', stage.key + ' @100% 盒子尺寸不变')
    assert.equal(host.properties.get('--pig-scale'), '1', stage.key + ' @100% 装扮比例是 1')
  }
  setPigSize(5)
  for (const stage of LIFE_STAGES) {
    const host = fakeHost()
    sizeWiring.syncPigSize(host, stage.size)
    assert.equal(host.properties.get('--pig-size'), stage.size * 5 + 'px')
    assert.equal(host.properties.get('--pig-scale'), '5')
  }
  // 恢复入口（托盘「恢复小猪」）按量到的 100% 盒子写，比例必须一起回到 1。
  setPigSize(1)
  const host = fakeHost()
  sizeWiring.applyPigBox(host, 56)
  assert.equal(host.properties.get('--pig-size'), '56px')
  assert.equal(host.properties.get('--pig-scale'), '1')
  sizeWiring.applyPigBox(undefined, 56)
})

test('a size change in another window moves the box and the overlays', () => {
  installStorage()
  const listeners = []
  globalThis.window.addEventListener = (name, fn) => { if (name === 'storage') listeners.push(fn) }
  globalThis.window.removeEventListener = () => {}
  const host = fakeHost()
  const detach = attachSizePreference(host, () => ({ size: 62 }), () => {})
  globalThis.window.localStorage.setItem(PIG_SIZE_KEY, 'scale:3')
  for (const listener of listeners) listener({ key: PIG_SIZE_KEY })
  assert.equal(host.properties.get('--pig-size'), '186px')
  assert.equal(host.properties.get('--pig-scale'), '3')
  detach()
})

test('no call site writes --pig-size or --pig-scale on its own', () => {
  // 两半必须同一个函数写：漏一处就会「猪变大了、帽子还是 15px」。
  const files = [
    'src/client/panel.js', 'src/client/tabs/settings.js', 'src/client/recover.js',
    'src/client/index.js', 'render.js',
  ]
  const write = /setProperty\??\.?\(\s*'--pig-(size|scale)'/g
  for (const file of files) {
    const source = readFileSync(new URL('../' + file, import.meta.url), 'utf8')
    assert.equal(source.match(write), null, file + ' 里直接写了 --pig-size/--pig-scale，改用 syncPigSize/applyPigBox')
  }
})

// ---------------------------------------------------------------------------
// 3. 镜像：和 .dp-pig-img 同一条开关，翻面期间不双重镜像
// ---------------------------------------------------------------------------

/** 某个被镜像的节点在 CSS 里用了哪些开关。 */
function mirrorSwitch(target) {
  return {
    walk: findRules(['data-walk="right"', target]).some(rule => /transform:scaleX\(-1\)/.test(rule.body)),
    flipOff: findRules(['data-feel-flip="true"', target]).some(rule => /transform:\s*none/.test(rule.body)),
  }
}

const IMAGE = mirrorSwitch('.dp-pig-img')
const DRESS = mirrorSwitch('.dp-dress')

/** 背点位相对猪盒中心的横向偏移（left:14% 减去中心 50%）。 */
const BACK_OFFSET = 0.14 - 0.5

/**
 * 装扮/立绘自身的镜像系数：翻面期间物理层（.dp-pig-body 的 scaleX）接管，
 * 自己的镜像要关掉；稳定朝右时才由 data-walk 那把开关打开。
 * @param {{walk:boolean, flipOff:boolean}} node
 * @param {{walk:string, flip:boolean}} state
 */
function mirrorOf(node, state) {
  if (state.flip && node.flipOff) return 1
  return node.walk && state.flip !== true && state.walk === 'right' ? -1 : 1
}

/** 翻面进度 → body 的横向缩放（feel/motor.js 的 cos(π·进度)）。 */
const bodySquash = state => (state.flip ? Math.cos(Math.PI * state.progress) : 1)

/** 背点位在屏幕上的横向位置（猪盒坐标，S = 猪盒边长，500% 成年 = 340）。 */
const backX = (state, scale) => BACK_OFFSET * scale * bodySquash(state) * mirrorOf(DRESS, state)

test('the dress mirrors on the same switch as the artwork', () => {
  assert.deepEqual(IMAGE, { walk: true, flipOff: true }, '立绘现有的镜像开关（比较基准）')
  assert.equal(DRESS.walk, true, '朝右时 .dp-dress 也要 scaleX(-1)，否则披风/翅膀留在左边')
  assert.equal(DRESS.flipOff, true, '翻面期间要像立绘一样关掉自己的镜像，否则背部件双重镜像')
})

test('the dress and the artwork never disagree, frame by frame', () => {
  for (const [from, to] of [['left', 'right'], ['right', 'left']]) {
    // data-walk 在整段翻面里保持翻面前的朝向，最后一帧才和 data-feel-flip 一起切换。
    for (let frame = 0; frame <= 20; frame += 1) {
      const state = { walk: from, flip: true, progress: frame / 20 }
      assert.equal(
        mirrorOf(DRESS, state), mirrorOf(IMAGE, state),
        from + '→' + to + ' 第 ' + frame + ' 帧：装扮与立绘的镜像系数不一致（双重镜像或跳边）',
      )
    }
    for (const settled of [to, from]) {
      const state = { walk: settled, flip: false }
      assert.equal(mirrorOf(DRESS, state), mirrorOf(IMAGE, state), settled + ' 稳定态镜像不一致')
    }
  }
})

test('a right-facing pig puts the back piece on the mirrored side', () => {
  for (const scale of [68, 136, 340, 510]) {
    assert.equal(backX({ walk: 'left', flip: false }, scale), -0.36 * scale, '朝左：背点位在猪盒左侧')
    assert.equal(backX({ walk: 'right', flip: false }, scale), 0.36 * scale, '朝右：背点位跟整猪一起镜像到右侧')
  }
})

test('the last frame of a left→right turn has no back-piece jump', () => {
  for (const scale of [68, 136, 340, 510]) {
    const lastFrame = { walk: 'left', flip: true, progress: 1 }
    const settled = { walk: 'right', flip: false }
    const jump = backX(settled, scale) - backX(lastFrame, scale)
    assert.ok(
      Math.abs(jump) < 0.001,
      'S=' + scale + ' 背点位最后一帧跳 ' + jump.toFixed(1) + 'px（审计记录修前约 0.72×S = '
        + (0.72 * scale).toFixed(0) + 'px）',
    )
  }
})

test('the size preference still reads/writes the existing store key', () => {
  const storage = installStorage()
  setPigSize(2)
  assert.equal(storage.get(PIG_SIZE_KEY), 'scale:2')
  assert.equal(pigSize(), 2)
})

// ---------------------------------------------------------------------------
// 4. 真界面路径：设置页改成 200% / 500%，猪盒和装扮比例同一次写完
// ---------------------------------------------------------------------------

test('the settings control writes 100/200/500% to the box and the dress together', async () => {
  const { dom, store } = await mount()
  openPanel(dom, 'settings')
  const host = hostOf(dom)
  const input = findByAttr(host, 'data-pig-scale', 'true')
  for (const [percent, scale] of [[100, 1], [200, 2], [500, 5]]) {
    input.value = String(percent)
    input.fire('change')
    assert.equal(store.get(PIG_SIZE_KEY), 'scale:' + scale, percent + '% 存的就是本机偏好')
    assert.equal(host.style.getPropertyValue('--pig-size'), PIG.stage.size * scale + 'px', percent + '% 猪盒')
    assert.equal(host.style.getPropertyValue('--pig-scale'), String(scale), percent + '% 装扮比例')
  }
})
