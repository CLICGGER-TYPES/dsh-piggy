// @ts-check
/**
 * Xwayland can retain a window's old pixel bounds after a live scale change.
 * Recreating the native views uses Chromium's cold-creation DIP conversion;
 * the game runtime and save remain outside those views. Work-area-only changes
 * (for example an auto-hiding dock) must not recreate a view.
 */
export function createLinuxDisplayRebuild({ platform, displays, rebuild, onError }) {
  const key = () => JSON.stringify(displays().map(d => [d.id, d.bounds, d.scaleFactor]))
  let previous = key()
  let running = false
  let pending = false
  async function drain() {
    running = true
    try {
      do { pending = false; await rebuild() } while (pending)
    } catch (error) { onError(error) }
    finally { running = false }
  }
  return {
    busy: () => running,
    changed() {
      if (platform !== 'linux') return false
      const next = key()
      if (next === previous) return false
      previous = next
      if (running) pending = true
      else void drain()
      return true
    },
  }
}
