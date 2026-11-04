// @ts-check
/**
 * 扩展音效条目的播放逻辑（M3 第四刀）。
 *
 * 从 audio-context 拆出来，只负责「文件 buffer → synth fallback → 静音」；
 * 设备、解码缓存、声部登记仍由调用方注入，避免第二套混音器。
 * @module dsh-piggy/client/ext-sound-play
 */

/**
 * @param {{
 *   getDevice: () => any,
 *   cache: (device: any) => Map<string, any>,
 *   load: (device: any, key: string, entry: any) => void,
 *   buffer: (state: any, buffer: any, volume: number) => boolean,
 *   recipe: (state: any, recipe: any, volume: number) => boolean,
 *   fallback: (entry: any) => any,
 * }} deps
 */
export function createExtensionSoundPlayer(deps) {
  /**
   * @param {any} state
   * @param {string} key
   * @param {any} entry
   * @param {number} level
   * @param {number} soft
   * @param {number} now
   */
  return function playExtensionSound(state, key, entry, level, soft, now) {
    const device = deps.getDevice()
    const gain = typeof entry.gain === 'number' ? entry.gain : 1
    if (typeof entry.url === 'string' && entry.url !== '') {
      const cacheKey = typeof entry.cacheKey === 'string' && entry.cacheKey !== ''
        ? entry.cacheKey : key + '|' + entry.url
      const cached = device === null ? undefined : deps.cache(device).get(cacheKey)
      if (cached !== undefined && cached !== null && typeof cached.then !== 'function') {
        if (deps.buffer(state, cached, level * gain * soft)) {
          state.lastAt[key] = now
          return true
        }
      } else if (cached === undefined && device !== null) {
        deps.load(device, cacheKey, entry)
      }
      // 首次播放、解码中或坏文件：用 fallback 的 synth，再失败就静音。
      const fallback = deps.fallback(entry)
      if (fallback !== undefined && deps.recipe(state, fallback, level * soft)) {
        state.lastAt[key] = now
        return true
      }
      return false
    }
    if (entry.synth === undefined) return false
    if (!deps.recipe(state, entry.synth, level * gain * soft)) return false
    state.lastAt[key] = now
    return true
  }
}
