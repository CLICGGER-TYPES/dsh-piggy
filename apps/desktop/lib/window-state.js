// @ts-check
/**
 * 窗口位置状态（userData/window.json）：内存里采样，异步串行写盘，退出时写完最新快照。
 *
 * 拖动时 setBounds 会连发，所以写盘按 800ms 去抖；坐标仍在窗口线程采样，
 * 异步写者只接收快照，不回读 Electron 对象。
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const DEBOUNCE_MS = 800

/**
 * @param {{
 *   getWindow: () => any,
 *   getPigOffset: () => ({ x: number, y: number } | null | undefined),
 *   userDataDir: string,
 *   debounceMs?: number,
 * }} options
 */
export function createWindowState({ getWindow, getPigOffset, userDataDir, debounceMs = DEBOUNCE_MS }) {
  const file = join(userDataDir, 'window.json')
  let timer = null
  let writing = Promise.resolve()
  let pending = null

  async function read() {
    try {
      const saved = JSON.parse(await readFile(file, 'utf8'))
      if (saved !== null && typeof saved === 'object' && Number.isFinite(saved.width) && Number.isFinite(saved.height)) return saved
    } catch { /* 第一次运行没有这个文件 */ }
    return null
  }

  function save() {
    const win = getWindow()
    if (win === null || win === undefined || win.isDestroyed()) return writing
    const bounds = win.getBounds()
    // 坐标仍在窗口线程采样，异步写者只接收快照，不回读 Electron 对象。
    const pigWindow = getPigOffset()
    const pigSnapshot = pigWindow === null || pigWindow === undefined
      ? undefined : { x: bounds.x + pigWindow.x, y: bounds.y + pigWindow.y }
    pending = JSON.stringify({ ...bounds, pig: pigSnapshot })
    writing = writing.then(async () => {
      if (pending === null) return
      const contents = pending
      pending = null
      await mkdir(dirname(file), { recursive: true })
      await writeFile(file + '.tmp', contents)
      await rename(file + '.tmp', file)
    }).catch(() => { /* 存不下就算了，下次用兜底位置 */ })
    return writing
  }

  function flush() {
    if (timer !== null) clearTimeout(timer)
    timer = null
    return save()
  }

  function schedule() {
    const win = getWindow()
    if (win === null || win === undefined || win.isDestroyed()) return
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      return save()
    }, debounceMs)
  }

  return { read, save, flush, schedule }
}
