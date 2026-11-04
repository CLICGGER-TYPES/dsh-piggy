// @ts-check
/**
 * 面板专用的「最近投递」只读 IPC。
 *
 * 只把来源、条数、最近时间和类型计数交给设置页；worker 不可用、旧游戏包
 * 没有 workEventSources、或读取失败时统一返回空，让页面整块隐藏而不是弹错。
 */

function empty() {
  return { ok: false, sources: [] }
}

/** 只保留渲染需要的字段，挡住损坏的 worker 返回值。 */
function normalize(value) {
  if (value === null || typeof value !== 'object' || value.ok !== true || !Array.isArray(value.sources)) return empty()
  const sources = []
  for (const entry of value.sources) {
    if (entry === null || typeof entry !== 'object') continue
    if (typeof entry.source !== 'string' || entry.source === '') continue
    if (!Number.isFinite(entry.lastAt)) continue
    if (!Number.isInteger(entry.count) || entry.count <= 0) continue
    /** @type {Record<string, number>} */
    const types = {}
    if (entry.types !== null && typeof entry.types === 'object') {
      for (const [name, count] of Object.entries(entry.types)) {
        if (name === '' || !Number.isInteger(count) || count <= 0) continue
        types[name] = count
      }
    }
    sources.push({ source: entry.source, count: entry.count, lastAt: entry.lastAt, types })
  }
  return { ok: true, sources }
}

/**
 * @param {{
 *   ipcMain: { handle: (channel: string, listener: (event: any, ...args: any[]) => any) => void },
 *   fromPanelOnly: (event: any) => boolean,
 *   getHost: () => any,
 * }} options
 */
export function registerWorkSourcesIpc({ ipcMain, fromPanelOnly, getHost }) {
  ipcMain.handle('piggy:work-event-sources', async event => {
    if (!fromPanelOnly(event)) return empty()
    try {
      const host = getHost()
      if (host === null || host === undefined || typeof host.workEventSources !== 'function') return empty()
      return normalize(await host.workEventSources())
    } catch {
      return empty()
    }
  })
}
