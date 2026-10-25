// @ts-check
/**
 * Chromium（Electron 44.5.1 内置的 Chromium 145）Windows 坐标换算的测试替身。
 *
 * 只复刻 screen_win.cc 里和舞台有关的三条规则，不启动 Electron：
 *   - screenToDipRect(null, rect)：按物理矩形最近的一块屏换算（origin round、size ceil）；
 *   - setBounds(dip)：DesktopWindowTreeHostWin 传 nullptr，所以按 DIP 矩形最近的一块屏换算；
 *   - getBounds()/getContentBounds()：按窗口 HMONITOR（物理交集最大）那块屏的缩放报 DIP。
 * 矩形先按最大交集选择显示器，没有交集时才比较距离。空矩形不能作为归属探针。
 *
 * 物理矩形是测试里的真值（模拟 Windows 的 rcMonitor/rcWork），DIP 矩形是 Electron
 * 会报出来的布局；两者不互为 1/scale（Chromium 的 DIP 布局按父屏 DIP 尺寸摆放）。
 */

const round = value => Math.round(value) + 0
const ceil = value => Math.ceil(value)

const copy = rect => ({ x: rect.x, y: rect.y, width: rect.width, height: rect.height })

/**
 * @typedef {{x:number,y:number,width:number,height:number}} Rect
 * @typedef {{id:number, label?:string, scale:number, physical:Rect, physicalWork:Rect, dip:Rect, dipWork:Rect}} Entry
 */

/** 距离平方：相接/相交为 0（Chromium SquaredDistanceBetweenRects）。 */
export function rectDistance(a, b) {
  const dx = Math.max(a.x - (b.x + b.width), 0, b.x - (a.x + a.width))
  const dy = Math.max(a.y - (b.y + b.height), 0, b.y - (a.y + a.height))
  return dx * dx + dy * dy
}

/** @param {Rect} a @param {Rect} b */
export function overlapArea(a, b) {
  const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x))
  const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))
  return width * height
}

/** @param {Partial<Entry> & {id:number, scale:number, physical:Rect, dip:Rect}} def */
export function displayEntry(def) {
  return {
    id: def.id,
    label: def.label,
    scale: def.scale,
    physical: copy(def.physical),
    physicalWork: copy(def.physicalWork ?? def.physical),
    dip: copy(def.dip),
    dipWork: copy(def.dipWork ?? def.dip),
  }
}

/** @param {Rect} rect @param {Entry[]} entries @param {'physical'|'dip'} key */
function nearestEntry(rect, entries, key) {
  let best = entries[0]
  let distance = Infinity
  let intersection = 0
  if (rect.width <= 0 || rect.height <= 0) return best
  for (const entry of entries) {
    const overlap = overlapArea(rect, entry[key])
    const next = rectDistance(rect, entry[key])
    if (overlap > intersection || (intersection === 0 && overlap === 0 && next < distance)) {
      best = entry; intersection = overlap; distance = next
    }
  }
  return best
}

/** HMONITORFromWindow 的模型：物理交集最大，平手取清单靠前的一块。 */
export function hmonitorEntry(physical, entries) {
  let best = entries[0]
  let area = -1
  for (const entry of entries) {
    const next = overlapArea(physical, entry.physical)
    if (next > area) { best = entry; area = next }
  }
  return best
}

/** @param {Entry} entry @param {Rect} rect @returns {Rect} */
export function dipToPhysical(entry, rect) {
  return {
    x: round(entry.physical.x + (rect.x - entry.dip.x) * entry.scale),
    y: round(entry.physical.y + (rect.y - entry.dip.y) * entry.scale),
    width: ceil(rect.width * entry.scale),
    height: ceil(rect.height * entry.scale),
  }
}

/** @param {Entry} entry @param {Rect} rect @returns {Rect} */
export function physicalToDip(entry, rect) {
  return {
    x: round(entry.dip.x + (rect.x - entry.physical.x) / entry.scale),
    y: round(entry.dip.y + (rect.y - entry.physical.y) / entry.scale),
    width: ceil(rect.width / entry.scale),
    height: ceil(rect.height / entry.scale),
  }
}

/** getBounds()/getContentBounds()：窗口 HMONITOR 的缩放。 */
export function boundsDip(entries, physical) {
  return physicalToDip(hmonitorEntry(physical, entries), physical)
}

/**
 * @param {Entry[]} entries
 * @returns {{screen: {screenToDipRect: any, dipToScreenRect: any}}}
 */
export function mockScreen(entries) {
  return {
    screen: {
      screenToDipRect(hwnd, rect) {
        const entry = hwnd === null ? nearestEntry(rect, entries, 'physical') : hmonitorEntry(hwnd.physicalRect(), entries)
        return physicalToDip(entry, rect)
      },
      dipToScreenRect(hwnd, rect) {
        const entry = hwnd === null ? nearestEntry(rect, entries, 'dip') : hmonitorEntry(hwnd.physicalRect(), entries)
        return dipToPhysical(entry, rect)
      },
    },
  }
}

/** Electron screen.getAllDisplays() 会报的样子（DIP 真值，不带物理矩形）。 */
export function electronDisplays(entries) {
  return entries.map(entry => ({
    id: entry.id, label: entry.label, scaleFactor: entry.scale,
    bounds: copy(entry.dip), workArea: copy(entry.dipWork),
  }))
}

/**
 * 假窗口：setBounds 走 null 窗口换算，getBounds 按 HMONITOR 报 DIP。
 * @param {{entries:Entry[], screen:any, physical:Rect, zoom?:number, minimized?:boolean, applyWhileMinimized?:boolean, clip?:(applied:Rect, call:number) => Rect|null}} options
 */
export function fakeWindow(options) {
  let physical = copy(options.physical)
  let minimized = options.minimized === true
  let restoreCalls = 0
  let focused = false
  /** @type {Rect[]} */
  const setBoundsCalls = []
  const window = {
    webContents: { getZoomFactor: () => options.zoom ?? 1 },
    physicalRect: () => copy(physical),
    getBounds: () => boundsDip(options.entries, physical),
    getContentBounds() {
      // 原生捕获：最小化后内容矩形是 {-32000,-32000,0,0}，不是旧 bounds。
      return minimized ? { x: -32000, y: -32000, width: 0, height: 0 } : window.getBounds()
    },
    setBounds(next) {
      setBoundsCalls.push(copy(next))
      // 原生捕获：最小化时 setBounds 不改变窗口，必须先 restore。
      if (minimized && options.applyWhileMinimized !== true) return
      const applied = options.screen.dipToScreenRect(null, next)
      physical = options.clip?.(applied, setBoundsCalls.length) ?? applied
    },
    minimize() { minimized = true },
    isMinimized: () => minimized,
    restore() { minimized = false; restoreCalls += 1; focused = true },
    showInactive() { minimized = false; restoreCalls += 1; focused = false },
    isFocused: () => focused,
    get restoreCalls() { return restoreCalls },
    isDestroyed: () => false,
    setBoundsCalls,
  }
  return window
}

/** 同步调度器：80ms/60ms 校验立即执行，测试不用等真实计时器。 */
export function immediateSchedule() {
  /** @type {Array<() => void>} */
  const queue = []
  return {
    schedule(fn) { queue.push(fn) },
    step() {
      const fn = queue.shift()
      if (fn === undefined) return false
      fn()
      return true
    },
    run() {
      let guard = 0
      while (queue.length > 0 && guard < 20) {
        guard += 1
        const fn = queue.shift()
        fn?.()
      }
      return guard
    },
  }
}
