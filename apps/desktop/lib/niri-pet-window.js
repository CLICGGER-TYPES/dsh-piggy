// @ts-check
/**
 * niri 下猪窗口的桥：真实位置对账、首帧透明等待、合并移动。
 *
 * Electron 的窗口对象仍归 lib/window-surface.js；这里只维护每只猪的 niri 句柄
 * 和「虚拟位置」状态，避免 window-surface 继续膨胀。
 */

const NIRI_ATTACH_RETRIES = 12
const NIRI_ATTACH_RETRY_MS = 50

/**
 * @param {{
 *   niri: ReturnType<typeof import('./niri-client.js').createNiriWindow> | null,
 *   log: (...parts: any[]) => any,
 *   pushGeometry: (pet: any) => void,
 *   setTimeout?: typeof globalThis.setTimeout,
 *   clearTimeout?: typeof globalThis.clearTimeout,
 * }} deps
 */
export function createNiriPetWindow(deps) {
  const niri = deps.niri
  const enabled = niri?.enabled === true
  const scheduleTimeout = deps.setTimeout ?? setTimeout
  const clearTimer = deps.clearTimeout ?? clearTimeout

  /** 应用眼里的窗口位置：niri 下用 petAsked（虚拟/真实屏幕坐标），尺寸仍用回读值。 */
  function read(pet) {
    const window = pet?.window
    if (window === null || window === undefined || window.isDestroyed()) return { x: 0, y: 0, width: 0, height: 0 }
    const bounds = window.getBounds()
    if (!enabled) return bounds
    const asked = pet.petAsked
    if (asked !== null && asked !== undefined && Number.isFinite(asked.x) && Number.isFinite(asked.y)) {
      return { x: asked.x, y: asked.y, width: bounds.width, height: bounds.height }
    }
    return bounds
  }

  /** niri 下这扇猪窗口的句柄（按 title 认；还没建窗就是 null）。 */
  function handleFor(pet) {
    if (!enabled) return null
    const window = pet?.window
    if (window === null || window === undefined || window.isDestroyed()) return null
    if (pet.niriHandle !== null && pet.niriHandle !== undefined) return pet.niriHandle
    const bounds = window.getBounds()
    pet.niriHandle = niri.watch({
      title: typeof pet.niriTitle === 'string' ? pet.niriTitle : 'dsh-piggy-pet',
      appId: 'dsh-piggy-desktop',
      width: bounds.width,
      height: bounds.height,
    })
    return pet.niriHandle
  }

  function restoreOpacity(pet) {
    if (pet.niriOpacityHeld !== true) return
    pet.niriOpacityHeld = false
    try { pet.window?.setOpacity?.(1) } catch { /* 窗口已经关了 */ }
  }

  /** 跨输出后 niri 会保留旧输出的逻辑尺寸；按目标屏重新提交一次物理尺寸。 */
  function resizeTo(pet, next) {
    const window = pet?.window
    if (window === null || window === undefined || window.isDestroyed() || !Number.isFinite(next?.width) || !Number.isFinite(next?.height)) return
    const read = window.getBounds()
    window.setBounds({ x: read.x, y: read.y, width: next.width, height: next.height })
  }

  /** 首帧藏在 opacity 0 后面，等 niri 真把窗口搬到保存位置再显示。 */
  function hold(pet) {
    if (!enabled || pet?.window === null || pet?.window === undefined || pet.niriSynced === true) return false
    try {
      pet.window.setOpacity(0)
      pet.niriOpacityHeld = true
      return true
    } catch { return false }
  }

  function retryAttach(pet) {
    const attempt = Number(pet.niriAttachAttempt) || 0
    pet.niriAttachAttempt = attempt + 1
    if (attempt >= NIRI_ATTACH_RETRIES) {
      restoreOpacity(pet)
      deps.log('niri window not found', JSON.stringify({ pigId: pet.pigId, title: pet.niriTitle, attempts: attempt + 1 }))
      return
    }
    if (pet.niriAttachTimer !== null && pet.niriAttachTimer !== undefined) return
    pet.niriAttachTimer = scheduleTimeout(() => {
      pet.niriAttachTimer = null
      attach(pet)
    }, NIRI_ATTACH_RETRY_MS)
    pet.niriAttachTimer?.unref?.()
  }

  /**
   * 窗口已经显示：查 niri 里的真实窗口，把它从默认浮动位置搬到 petAsked。
   * 还没被合成器映射时按 50ms 重试。
   */
  function attach(pet) {
    if (!enabled) { restoreOpacity(pet); return null }
    const handle = handleFor(pet)
    if (handle === null) { restoreOpacity(pet); return null }
    const found = niri.refresh(handle)
    if (found === null) { retryAttach(pet); return null }
    const desired = pet.niriPending ?? pet.petAsked
    const beforeOutput = handle.output
    if (desired !== null && desired !== undefined && Number.isFinite(desired.x) && Number.isFinite(desired.y)) {
      niri.moveTo(handle, desired)
    }
    const crossed = handle.output !== beforeOutput
    pet.niriPending = null
    pet.niriAttachAttempt = 0
    pet.niriSynced = true
    void niri.flush().then(() => {
      if (crossed) resizeTo(pet, desired)
      restoreOpacity(pet)
    }, () => restoreOpacity(pet))
    deps.log('niri window attached', JSON.stringify({ pigId: pet.pigId, id: handle.id, rect: handle.rect, desired }))
    return handle
  }

  /** 拖动开始/结束、开面板前对账：把 niri 真实位置写回 petAsked，并同步给页面。 */
  function sync(pet) {
    if (!enabled) return null
    const handle = handleFor(pet)
    if (handle === null) return null
    const found = niri.refresh(handle)
    if (found === null) return null
    const bounds = pet.window.getBounds()
    pet.petAsked = { x: found.rect.x, y: found.rect.y, width: bounds.width, height: bounds.height }
    pet.niriPending = null
    pet.niriSynced = true
    // 页面手里的 screenX/geometry 也必须跟着更新，否则下一轮 place 会按旧位置把窗口搬回去。
    deps.pushGeometry(pet)
    return pet.petAsked
  }

  /** 换窗口/重建后旧句柄的 id 不能再用。 */
  function reset(pet) {
    if (pet.niriAttachTimer !== null && pet.niriAttachTimer !== undefined) clearTimer(pet.niriAttachTimer)
    pet.niriAttachTimer = null
    pet.niriAttachAttempt = 0
    pet.niriHandle = null
    pet.niriPending = null
    pet.niriSynced = false
    pet.niriOpacityHeld = false
  }

  function moveTo(pet, next) {
    if (!enabled) return false
    const handle = handleFor(pet)
    if (handle === null || handle.id === null) {
      pet.niriPending = { ...next }
      return false
    }
    const beforeOutput = handle.output
    const moved = niri.moveTo(handle, next)
    if (moved && handle.output !== beforeOutput) {
      void niri.flush().then(() => resizeTo(pet, next), () => resizeTo(pet, next))
    }
    return moved
  }

  return {
    enabled,
    read,
    attach,
    hold,
    sync,
    reset,
    moveTo,
    flush: () => enabled ? niri.flush() : Promise.resolve(),
    flushSync: () => { if (enabled) niri.flushSync() },
  }
}
