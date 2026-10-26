// @ts-check
/** 独立高清手覆盖当前立绘；脚底固定，播放已审核的9%受压回弹。 */
import { ART_URL } from './constants.js'
import { ART_BOUNDS } from './art-framing.js'
import { framedPetBounds, petPose } from './pet-snap-geometry.js'
import { effectiveFeelMode, onFeelModeChange } from './feel/settings.js'
import { petHandEnabled, onPetHandChange } from './pet-hand-settings.js'
import { PET_PREVIEW_LEASE_MS, effectiveSkinContact, framedSkinPoint, handScaleRatio, onPetSnapPreview, onSkinContactChange, skinContactShift } from './skin-contact.js'
import { customArtInk, measureCustomArt } from './custom-art.js'

const players = new WeakMap()
export const SNAP_FRAME_MS = 60
export const SNAP_FRAMES = 5
export const SNAP_CYCLE_MS = SNAP_FRAME_MS * SNAP_FRAMES
export function beginPetSnap(pig) { return players.get(pig)?.press() === true }
export function releasePetSnap(pig) { players.get(pig)?.release() }
export function cancelPetSnap(pig) { players.get(pig)?.cancel() }
export function confirmPetSnap(pig) { return players.get(pig)?.confirm() === true }

/** Keep art and dress DOM intact; only the hand is drawn on the foreground canvas. */
export function attachPetSnap(c) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext?.('2d')
  const body = c.pig.querySelector?.('.dp-pig-body')
  const parent = c.pig.querySelector?.('.dp-pig-hold')
  if (!ctx || !parent) return { dispose() {} }
  canvas.className = 'dp-pet-snap'
  canvas.setAttribute('aria-hidden', 'true')
  canvas.hidden = true
  canvas.width = canvas.height = 512
  parent.appendChild(canvas)
  let ready = false, disposed = false, active = false, held = false
  let frame = 0, raf = 0, start = 0, stopAt = Infinity
  let capturedArt = null
  let bounds = null
  // 皮肤声明的/本机校准的接触点，已经换算成取景后的布局坐标；null = 沿用自动估计。
  let contact = null
  // 换肤页的纯视觉预览：这一次「按着」是预览租约（不在本窗口真实摸猪），到期没续就自己松手。
  let previewHeld = false, previewUntil = 0
  let referenceFrames = []
  const now = () => performance.now()
  const allowed = () => !disposed && !document.hidden && !c.isStopped()
    && effectiveFeelMode() === 'full' && c.canPlay()
    && (!active || capturedArt === c.pig.getAttribute('data-art'))
    && c.pig.getAttribute('data-feel-flip') !== 'true'
  function measure() {
    const image = c.pigArt
    const src = image?.getAttribute('src') || ''
    const path = src.slice(ART_URL.length).split('?')[0].replace(/^pigs\/no-outline\//, 'pigs/')
    let ink = ART_BOUNDS[path] || customArtInk(src)
    // 自定义立绘没有内置边界表：读 custom-art 已量好的同一份 ink（不另建缓存），
    // 未量过时按和显示（object-fit:contain）同一算则量一次。
    if (!ink && image?.complete && image.naturalWidth > 0) ink = measureCustomArt(image, src)
    const style = image?.style
    return framedPetBounds(ink || [.08, .08, .92, .92],
      Number(style?.getPropertyValue('--art-zoom')) || 1,
      parseFloat(style?.getPropertyValue('--art-x')) || 0,
      parseFloat(style?.getPropertyValue('--art-y')) || 0)
  }
  /** 当前皮肤的接触点：皮肤包声明或本机校准，按同一套取景换算到布局坐标。 */
  function measureContact() {
    const declared = effectiveSkinContact(c.pig.getAttribute('data-art') || '')
    if (declared === null) return null
    const style = c.pigArt?.style
    return framedSkinPoint(declared,
      Number(style?.getPropertyValue('--art-zoom')) || 1,
      parseFloat(style?.getPropertyValue('--art-x')) || 0,
      parseFloat(style?.getPropertyValue('--art-y')) || 0)
  }
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (!bounds) return
    const pose = petPose(frame)
    body.style.setProperty('--pet-sx', String(pose.sx))
    body.style.setProperty('--pet-sy', String(pose.sy))
    body.style.setProperty('--pet-origin-x', (c.pig.getAttribute('data-walk') === 'right' ? 100 - (bounds.left + bounds.right) * 50 : (bounds.left + bounds.right) * 50) + '%')
    body.style.setProperty('--pet-origin-y', bounds.bottom * 100 + '%')
    if (!petHandEnabled() || !referenceFrames[frame]) return
    const ratio = handScaleRatio(bounds)
    // 有接触点时整只手平移到声明的落点；没有时 shift 是 0，和接入前完全一致。
    const shift = skinContactShift(bounds, contact)
    const ox = (bounds.left + bounds.right) / 2 - 59 * ratio + shift.dx
    const oy = bounds.bottom - 109.453125 * ratio + shift.dy
    ctx.save()
    ctx.setTransform(256, 0, 0, 256, 128, 128)
    ctx.translate(ox, oy + pose.handY * ratio)
    ctx.rotate(pose.angle * Math.PI / 180)
    ctx.scale(105 / 500 * ratio, 105 / 500 * ratio)
    ctx.drawImage(referenceFrames[frame], -18, -pose.wrist, 514, 514)
    ctx.restore()
  }
  function cancel() {
    cancelAnimationFrame(raf)
    raf = 0
    active = held = false
    previewHeld = false
    previewUntil = 0
    canvas.hidden = true
    c.pig.removeAttribute('data-pet-snap')
    for (const key of ['--pet-sx', '--pet-sy', '--pet-origin-x', '--pet-origin-y']) body.style.removeProperty(key)
    capturedArt = bounds = contact = null
    c.render()
  }
  function tick(time) {
    raf = 0
    if (!allowed()) { cancel(); return }
    // 预览租约到期（pointermove 没续约、面板失焦/页面卡住）：自己松手，手不会一直按着。
    if (previewHeld && time >= previewUntil) { previewHeld = false; previewUntil = 0; release() }
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
    // 真的按住猪（或点了预览）都从这一轮重新开始；预览的调用方在 press() 之后自己标 previewHeld。
    previewHeld = false
    previewUntil = 0
    c.cancelMicro()
    bounds = measure()
    contact = measureContact()
    capturedArt = c.pig.getAttribute('data-art')
    c.pig.setAttribute('data-pet-snap', 'true')
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
  const player = { press, release, cancel, confirm,
    /** 皮肤页调校准滑点/拖动时：正在播的手立刻按新接触点重画，不用松手重按。 */
    refreshContact() {
      if (!active) return
      contact = measureContact()
      draw()
    } }
  players.set(c.pig, player)
  const load = src => {
    const image = new Image()
    image.src = src
    return image.decode().then(() => image)
  }
  load(ART_URL + 'animations/pet-hand/hand.webp?v=hd-spring-9')
    .then(async image => {
      const frames = await Promise.all(Array.from({ length: SNAP_FRAMES }, (_, i) => createImageBitmap(image, i * 256, 0, 256, 256)))
      if (disposed) { frames.forEach(frame => frame.close()); return }
      referenceFrames = frames
      ready = true
    })
    .catch(error => console.warn('摸摸小手加载失败，保留现有立绘', error))
  const onState = () => { if (active && !allowed()) cancel() }
  const observer = new MutationObserver(onState)
  observer.observe(c.pig, { attributes: true, childList: true, subtree: true, attributeFilter: ['data-art', 'data-stage', 'data-mood', 'data-idle', 'data-activity', 'data-illness', 'data-party', 'data-react', 'data-feel-flip'] })
  const offFeel = onFeelModeChange(onState)
  const offHand = onPetHandChange(() => { if (active) draw() })
  // 皮肤页改接触点（含桌面版两个窗口之间的 localStorage 事件）时，手立即落到新位置。
  const offContact = onSkinContactChange(() => { if (active) { contact = measureContact(); draw() } })
  // 换肤页的「试试手/按住拖动」：桌面版面板窗口没有猪，靠 storage 事件让猪窗口按一下；
  // DSH 单窗口由 skin-contact 本地补发。只播手，不走游戏 action、不触发 pet/touch/奖励。
  // art 必须匹配当前皮肤：换肤页预览旧皮肤时不能按到小猪身上。
  const offPreview = onPetSnapPreview(event => {
    if (disposed || event.art !== (c.pig.getAttribute('data-art') || '')) return
    if (event.action === 'press') {
      if (!previewHeld) {
        // 真的按住猪时预览不能抢走这一轮；只是上一轮松手后的收尾（active && !held）时重新开一轮。
        if (active && held) return
        if (!press()) return
        previewHeld = true
      }
      previewUntil = now() + PET_PREVIEW_LEASE_MS
      return
    }
    if (!previewHeld) return
    previewHeld = false
    previewUntil = 0
    if (event.action === 'release') release()
    else cancel()
  })
  const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
  media?.addEventListener?.('change', onState)
  document.addEventListener('visibilitychange', onState)
  return { dispose() {
    disposed = true
    observer.disconnect(); offFeel(); offHand(); offContact(); offPreview()
    media?.removeEventListener?.('change', onState)
    document.removeEventListener('visibilitychange', onState)
    cancel(); canvas.remove()
    referenceFrames.forEach(image => image.close()); referenceFrames = []
    players.delete(c.pig)
  } }
}
