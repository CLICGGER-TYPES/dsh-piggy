// @ts-check
/** 直接播放用户提供的原GIF帧；关闭小手时用原立绘轻微下沉。 */
import { ART_URL } from './constants.js'
import { builtinFrame } from './art-framing.js'
import { artSource } from './art-path.js'
import { effectiveFeelMode, onFeelModeChange } from './feel/settings.js'
import { petHandEnabled, onPetHandChange } from './pet-hand-settings.js'

const players = new WeakMap()
export const SNAP_FRAME_MS = 60
export const SNAP_FRAMES = 5
export const PET_SINK_PX = Object.freeze([0, 2, 4, 2, 0])
export const SNAP_CYCLE_MS = SNAP_FRAME_MS * SNAP_FRAMES
export function beginPetSnap(pig) { return players.get(pig)?.press() === true }
export function releasePetSnap(pig) { players.get(pig)?.release() }
export function cancelPetSnap(pig) { players.get(pig)?.cancel() }
export function confirmPetSnap(pig) { return players.get(pig)?.confirm() === true }

/** Original GIF frames share one fixed placement relative to the idle sprite. */
export function attachPetSnap(c) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext?.('2d')
  const parent = c.pig.querySelector?.('.dp-pig-body')
  if (!ctx || !parent) return { dispose() {} }
  canvas.className = 'dp-pet-snap'
  canvas.setAttribute('aria-hidden', 'true')
  canvas.hidden = true
  canvas.width = canvas.height = 512
  const framing = builtinFrame(artSource('piglet')) || [1, 0, 0]
  canvas.style.setProperty('--snap-zoom', String(framing[0]))
  canvas.style.setProperty('--snap-x', framing[1] / 2 + '%')
  canvas.style.setProperty('--snap-y', framing[2] / 2 + '%')
  parent.appendChild(canvas)
  let ready = false, disposed = false, active = false, held = false
  let frame = 0, raf = 0, start = 0, stopAt = Infinity
  let atlases = null
  let referenceFrames = []
  const now = () => performance.now()
  const allowed = () => !disposed && !document.hidden && !c.isStopped()
    && effectiveFeelMode() === 'full' && c.canPlay()
    && c.pig.getAttribute('data-feel-flip') !== 'true'
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (!atlases) return
    if (petHandEnabled()) {
      // 五格均与原 GIF 解码像素一致；固定统一比例，不额外重制动作。
      ctx.drawImage(referenceFrames[frame], 100, 76, 280, 280)
    } else {
      ctx.drawImage(atlases[0], 128, 128 + PET_SINK_PX[frame], 256, 256)
    }
  }
  function cancel() {
    cancelAnimationFrame(raf)
    raf = 0
    active = held = false
    // 仍在帧动画遮罩内时先恢复立绘，避免旧换图压缩再演一次。
    c.render()
    canvas.hidden = true
    c.pig.removeAttribute('data-pet-snap')
  }
  function tick(time) {
    raf = 0
    if (!allowed()) { cancel(); return }
    const elapsed = Math.max(0, time - start)
    if (!held && elapsed >= stopAt) {
      // 新片段替代旧 420 ms 摸摸反应，结束时不能再露出剩下的旧压扁姿势。
      if (c.pig.getAttribute('data-react') === 'pet') c.pig.removeAttribute('data-react')
      cancel()
      return
    }
    const next = Math.floor(elapsed / SNAP_FRAME_MS) % SNAP_FRAMES
    if (next !== frame) { frame = next; draw() }
    raf = requestAnimationFrame(tick)
  }
  function press() {
    if (!ready || !allowed()) return false
    c.pig.setAttribute('data-pet-snap', 'true')
    c.cancelMicro()
    held = active = true
    stopAt = Infinity
    canvas.hidden = false
    cancelAnimationFrame(raf)
    start = now()
    frame = 0
    draw()
    raf = requestAnimationFrame(tick)
    return true
  }
  function release() {
    if (!active || !held) return
    held = false
    // 最少一轮；长按松手后最多再播不到 300 ms，不硬切正在下沉的小猪。
    stopAt = Math.max(1, Math.ceil((now() - start) / SNAP_CYCLE_MS)) * SNAP_CYCLE_MS
  }
  function confirm() {
    // 直接点击的已播放标记随请求走；这里仅负责面板等未播放过的成功动作。
    if (held && active) return true
    if (c.isDragging() || !press()) return false
    release()
    return true
  }
  const player = { press, release, cancel, confirm }
  players.set(c.pig, player)
  const load = src => {
    const image = new Image()
    image.src = src
    return image.decode().then(() => image)
  }
  Promise.all([load(artSource('piglet')), load(ART_URL + 'animations/piglet-pet/reference.webp?v=original-v07')])
    .then(async images => {
      // 先在原分辨率拆格，再统一放大，防止图集邻格在边缘采样时混进来。
      const frames = await Promise.all(Array.from({ length: SNAP_FRAMES }, (_, i) => createImageBitmap(images[1], i * 112, 0, 112, 112)))
      if (disposed) { frames.forEach(image => image.close()); return }
      atlases = images
      referenceFrames = frames
      ready = true
    })
    .catch(error => console.warn('摸摸动画加载失败，保留静态摸摸', error))
  const onState = () => { if (active && !allowed()) cancel() }
  const observer = new MutationObserver(onState)
  observer.observe(c.pig, { attributes: true, childList: true, subtree: true, attributeFilter: ['data-art', 'data-stage', 'data-mood', 'data-idle', 'data-activity', 'data-illness', 'data-party', 'data-react', 'data-feel-flip'] })
  const offFeel = onFeelModeChange(onState)
  const offHand = onPetHandChange(() => { if (active) draw() })
  const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
  media?.addEventListener?.('change', onState)
  document.addEventListener('visibilitychange', onState)
  return { dispose() {
    disposed = true
    observer.disconnect(); offFeel(); offHand()
    media?.removeEventListener?.('change', onState)
    document.removeEventListener('visibilitychange', onState)
    cancel(); canvas.remove(); atlases = null
    referenceFrames.forEach(image => image.close()); referenceFrames = []
    players.delete(c.pig)
  } }
}
