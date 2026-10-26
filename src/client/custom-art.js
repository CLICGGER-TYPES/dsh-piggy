// @ts-check
/**
 * 自定义立绘（导入的 PNG / 旧 SVG）：量图和显示用同一条「等比放进方形画布」的合同。
 *
 * 显示侧 `.dp-pig-img` 是 `object-fit:contain`（宽图/竖图不拉伸、按短边留透明），
 * 量图侧也按 contain 把图放进 128×128（睡姿 192×160，同样 1.2:1）画布再读透明墨迹；pet-snap 的兜底探针
 * 和桌面/舞台几何都复用这一份已量结果，所以摸摸手/窗口 shape/可见范围和屏幕上看到的一致。
 *
 * 同一个 key 重新导入会覆盖服务器上的图片，但 `artSource` 的地址本来不变；这里给每套自定义
 * 皮肤记一个本机版本号：重新导入后版本 +1、地址带上 `?v=`，主猪的 `<img>` 才会重新取图，
 * `art.js` 的取景缓存也才会失效。版本写在 localStorage 并监听 storage 事件，桌面版拆窗口时
 * 猪窗口也会立刻换图。
 *
 * 只有自定义皮肤有版本：内置图/反馈图地址保持不变，轮询不会重复取图。
 * @module dsh-piggy/client/custom-art
 */
import { FRAME_HEIGHT } from './art-framing.js'
import { readStore, writeStore } from './storage.js'

/** 自定义立绘的方形画布边长（和旧版量图一致，已有皮肤的取景数字不变）。 */
export const CUSTOM_CANVAS = 128
/** 睡姿画布：和 `.dp-pig-sleep` 的 1.2:1 完全同比例（192/160 = 1.2），归一化坐标才能直接用于元素盒。 */
export const CUSTOM_SLEEP_WIDTH = 192
export const CUSTOM_SLEEP_HEIGHT = 160
/** 本机版本表：{ "custom-key": 1 }；重导入只动这一套皮肤。 */
export const CUSTOM_ART_KEY = 'dsh-piggy:custom-art-versions'
/** 和 store/skin-pack 的皮肤 art 名同一形状（custom- 加 key，可带场景后缀）。 */
const ART_KEY = /^custom-[a-z0-9-]{1,41}$/

const listeners = new Set()
/** 已量墨迹：src（含 ?v= 版本）→ [left, top, right, bottom]，归一化到显示元素盒。 */
const INK_CACHE = new Map()
let versions = null
let bridgedWindow = null

/** 量图画布：站立是正方形，睡姿是 1.2:1（与显示盒完全同比例）。 */
export function customArtCanvas(sleep = false) {
  return sleep
    ? { width: CUSTOM_SLEEP_WIDTH, height: CUSTOM_SLEEP_HEIGHT }
    : { width: CUSTOM_CANVAS, height: CUSTOM_CANVAS }
}

/** 缓存键：去掉 host/piggy 前缀，只留 /art/ 后面的路径和版本串。 */
function srcKey(src) {
  const text = typeof src === 'string' ? src : ''
  const index = text.indexOf('/art/')
  return index < 0 ? text : text.slice(index + 5)
}

/** 已量过的自定义墨迹（归一化到显示元素盒）；未知/未加载/非自定义返回 null。 */
export function customArtInk(src) {
  const key = srcKey(src)
  return key === '' ? null : INK_CACHE.get(key) ?? null
}

/**
 * 量一次并记住：display 的取景（art.js）、摸摸手（pet-snap）、桌面 shape、舞台可见范围
 * 都读这一份数据，不再各自读 canvas 或另建缓存。
 * @param {any} image 已解码的 <img>
 * @param {string} src 带版本串的显示地址（和 image 的 src 属性同一串）
 * @param {boolean} [sleep]
 * @returns {[number, number, number, number] | null}
 */
export function measureCustomArt(image, src, sleep = false) {
  const key = srcKey(src)
  if (key === '') return null
  const cached = INK_CACHE.get(key)
  if (cached !== undefined) return cached
  const canvas = customArtCanvas(sleep)
  const ink = containedInk(image, canvas.width, canvas.height)
  if (ink === null) return null
  INK_CACHE.set(key, ink)
  return ink
}

/**
 * 已量 ink + 当前取景 → 可见矩形（布局空间）。按元素盒逐轴缩放：站立是方形盒，
 * 睡姿是 1.2:1 盒；和 CSS 的 `scale` / `translate` 百分比同一算法。
 * @param {{x:number,y:number,width:number,height:number}} box
 * @param {number[]} ink
 * @param {{zoom?:number, shiftX?:number, shiftY?:number, mirrored?:boolean}} [framing]
 */
export function framedInkBox(box, ink, framing = {}) {
  const zoom = Number(framing.zoom) > 0 ? Number(framing.zoom) : 1
  const shiftX = Number(framing.shiftX) || 0
  const shiftY = Number(framing.shiftY) || 0
  const mirrored = framing.mirrored === true
  const left = mirrored ? 1 - ink[2] : ink[0]
  const right = mirrored ? 1 - ink[0] : ink[2]
  const shift = mirrored ? -shiftX : shiftX
  return {
    x: box.x + box.width * (0.5 + (left - 0.5) * zoom + shift / 100),
    y: box.y + box.height * (0.5 + (ink[1] - 0.5) * zoom + shiftY / 100),
    width: box.width * (right - left) * zoom,
    height: box.height * (ink[3] - ink[1]) * zoom,
  }
}

/**
 * 一个自定义立绘节点的可见矩形；不是自定义、还没量到或读不到样式时返回 null。
 * `.dp-pig-sleep` 不参与 `scaleX(-1)`（CSS 只翻 `.dp-pig-img`），所以睡姿不镜像。
 * @param {any} node
 * @param {{x:number,y:number,width:number,height:number}} box 节点的布局盒
 */
export function customArtVisibleBox(node, box) {
  if (node === null || node === undefined || typeof node.getAttribute !== 'function') return null
  const ink = customArtInk(node.getAttribute('src') || '')
  if (ink === null) return null
  const style = node.style
  const sleep = node.matches?.('.dp-pig-sleep') === true
  return framedInkBox(box, ink, {
    zoom: Number(style?.getPropertyValue?.('--art-zoom')) || 1,
    shiftX: parseFloat(style?.getPropertyValue?.('--art-x')) || 0,
    shiftY: parseFloat(style?.getPropertyValue?.('--art-y')) || 0,
    mirrored: !sleep && node.closest?.('.dp-pig')?.getAttribute('data-walk') === 'right',
  })
}

/** 某个 art 根 key 的旧量图作废（只动这一套皮肤的场景/睡姿后缀）。 */
function forgetInk(art) {
  for (const key of [...INK_CACHE.keys()]) {
    const path = key.split('?')[0]
    if (path === art || path.startsWith(art + '-')) INK_CACHE.delete(key)
  }
}

/**
 * 按 `object-fit:contain` 的同一算则把图画进画布，再读可见墨迹的归一化边界。
 *
 * 返回 `[left, top, right, bottom]`，坐标归一化到量图画布，也就是显示元素盒：
 * 站立是方形盒，睡姿是 1.2:1 盒。全透明或读不到像素时返回 null，调用方保留原来的中性取景。
 * @param {any} image 已解码的 <img>（Node 测试里是同样形状的假图）
 * @param {number} [canvasWidth]
 * @param {number} [canvasHeight]
 * @returns {[number, number, number, number] | null}
 */
export function containedInk(image, canvasWidth = CUSTOM_CANVAS, canvasHeight = CUSTOM_CANVAS) {
  const naturalWidth = Number(image?.naturalWidth) || 0
  const naturalHeight = Number(image?.naturalHeight) || naturalWidth
  if (!(naturalWidth > 0) || !(naturalHeight > 0)) return null
  const fit = Math.min(canvasWidth / naturalWidth, canvasHeight / naturalHeight)
  if (!(fit > 0)) return null
  const width = naturalWidth * fit
  const height = naturalHeight * fit
  try {
    const canvas = document.createElement('canvas')
    canvas.width = canvasWidth
    canvas.height = canvasHeight
    const context = canvas.getContext?.('2d', { willReadFrequently: true })
    if (!context) return null
    context.drawImage(image, (canvasWidth - width) / 2, (canvasHeight - height) / 2, width, height)
    const pixels = context.getImageData(0, 0, canvasWidth, canvasHeight).data
    let left = canvasWidth, top = canvasHeight, right = 0, bottom = 0
    for (let y = 0; y < canvasHeight; y += 1) for (let x = 0; x < canvasWidth; x += 1) {
      if (pixels[(y * canvasWidth + x) * 4 + 3] <= 16) continue
      left = Math.min(left, x); top = Math.min(top, y)
      right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1)
    }
    if (right <= left || bottom <= top) return null
    return [left / canvasWidth, top / canvasHeight, right / canvasWidth, bottom / canvasHeight]
  } catch { return null }
}

/**
 * 可见墨迹边界 → 取景 `[zoom, x%, y%]`：可见高度统一到 `FRAME_HEIGHT`（和内置图同一合同）。
 * @param {[number, number, number, number]} ink
 * @returns {[number, number, number] | null}
 */
export function frameFromInk(ink) {
  const height = ink[3] - ink[1]
  if (!(height > 0)) return null
  const zoom = FRAME_HEIGHT / height
  return [zoom,
    (0.5 - (ink[0] + ink[2]) / 2) * zoom * 100,
    (0.5 - (ink[1] + ink[3]) / 2) * zoom * 100]
}

function readVersions() {
  const raw = readStore(CUSTOM_ART_KEY)
  let parsed = null
  try { parsed = JSON.parse(raw ?? '') } catch { parsed = null }
  /** @type {Map<string, number>} */
  const map = new Map()
  if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
    for (const [key, value] of Object.entries(parsed)) {
      const version = Number(value)
      if (ART_KEY.test(key) && Number.isInteger(version) && version > 0) map.set(key, version)
    }
  }
  return map
}

function ensureVersions() {
  if (versions === null) versions = readVersions()
  return versions
}

/** 这张图属于哪套自定义皮肤：版本表里最长的、作为它前缀的根 key（场景/睡姿后缀跟着走）。 */
function rootArt(art) {
  const map = ensureVersions()
  let best = ''
  for (const key of map.keys()) {
    if (art === key || art.startsWith(key + '-')) { if (key.length > best.length) best = key }
  }
  return best === '' ? null : best
}

/** 某个立绘地址当前的版本；0 表示没有重新导入过（地址不加查询串）。 */
export function customArtVersion(art) {
  if (typeof art !== 'string' || !ART_KEY.test(art)) return 0
  const root = rootArt(art)
  return root === null ? 0 : ensureVersions().get(root) ?? 0
}

/**
 * 同一个 key 重新导入成功：版本 +1，通知本窗口和别的窗口重新取图/量图。
 * 返回新版本号；art 不合法时返回 0（调用方不用处理）。
 */
export function refreshCustomArt(art) {
  if (typeof art !== 'string' || !ART_KEY.test(art)) return 0
  const map = ensureVersions()
  const version = (map.get(art) ?? 0) + 1
  map.set(art, version)
  // 同 key 重导入：旧地址的 ink 和取景一起同步作废，不等下一次渲染。
  forgetInk(art)
  writeStore(CUSTOM_ART_KEY, JSON.stringify(Object.fromEntries(map)))
  notify()
  return version
}

/** 自定义立绘版本变了（重新导入、或别的窗口写入了新版本）；返回取消订阅。 */
export function onCustomArtChange(fn) {
  ensureStorageBridge()
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function notify() {
  for (const fn of [...listeners]) {
    try { fn() } catch (error) { console.warn('自定义立绘刷新失败', error) }
  }
}

function onStorage(event) {
  const key = /** @type {StorageEvent | null} */ (event)?.key
  if (key !== CUSTOM_ART_KEY && key !== null && key !== undefined) return
  const previous = versions === null ? new Map() : new Map(versions)
  versions = readVersions()
  for (const root of new Set([...previous.keys(), ...versions.keys()])) {
    if ((previous.get(root) ?? 0) !== (versions.get(root) ?? 0)) forgetInk(root)
  }
  notify()
}

/** 和 skin-contact 一样：每个 window 只挂一次 storage 监听，Node 测试里换假 window 也能走同一条路。 */
function ensureStorageBridge() {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return
  if (bridgedWindow === window) return
  bridgedWindow = window
  window.addEventListener('storage', onStorage)
}

ensureStorageBridge()
