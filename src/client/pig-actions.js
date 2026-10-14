// @ts-check
/** 普通猪的两帧微动作；结束后由唯一选图入口重读状态，避免旧计时覆盖新状态。 */
import { artSource } from './art-path.js'

const PLAYERS = new WeakMap()
export const BLINK_INTERVAL = { min: 8000, max: 16000 }
export const ACTION_DURATION = { blink: 100, 'shy-pet': 420 }
const ACTION_ART = { blink: 'piglet-blink', 'shy-pet': 'piglet-shy-pet' }

/** 状态图优先；只允许普通猪在家、醒着、没有其他反应时播放。 */
export function canPlayPigAction(pig, action) {
  const read = name => pig.getAttribute('data-' + name) || ''
  return read('art') === 'piglet' && !['box', 'grave', 'dead-day'].includes(read('stage'))
    && !read('activity') && !read('idle') && !read('illness') && read('party') !== 'true'
    && !['sick', 'dirty', 'sleepy', 'dead', 'hungry', 'lonely'].includes(read('mood'))
    && (!read('react') || (action === 'shy-pet' && read('react') === 'pet'))
}

/** 选图入口调用；不在这里写图片或取景，避免两个渲染负责人。 */
export function pigActionArt(pig) { return PLAYERS.get(pig)?.currentArt() || null }
/** 只在现有摸猪成功反应处触发，不排队。 */
export function playPigPet(pig) { PLAYERS.get(pig)?.play('shy-pet') }

/** 可注入时钟和解码器，测试取消与抢占不依赖真实时间。 */
export function attachPigActions(c) {
  const clock = c.clock || window
  const random = c.random || Math.random
  const ready = new Set()
  let active = null, frameTimer = null, blinkTimer = null, disposed = false
  const isBlocked = () => disposed || c.isStopped() || c.isDragging() || document.hidden === true || c.pig.closest?.('[data-dragging="true"]') != null
  const clearFrame = () => { clock.clearTimeout(frameTimer); frameTimer = null; active = null; c.pig.removeAttribute?.('data-micro-action') }
  function currentArt() {
    if (active && (isBlocked() || !canPlayPigAction(c.pig, active))) clearFrame()
    return active ? ACTION_ART[active] : null
  }
  function play(action) {
    if (isBlocked() || !ready.has(action) || !canPlayPigAction(c.pig, action)) return
    if (action === 'blink' && active) return
    clearFrame()
    active = action
    // 2026-10-13 仅暂停当前动效；animation:none 会把呼吸中途的位置重置，实测跳 6.8px。
    c.pig.setAttribute?.('data-micro-action', action)
    c.render()
    frameTimer = clock.setTimeout(() => { clearFrame(); c.render() }, ACTION_DURATION[action])
  }
  function scheduleBlink() {
    if (isBlocked()) return
    blinkTimer = clock.setTimeout(() => {
      blinkTimer = null
      play('blink')
      scheduleBlink()
    }, BLINK_INTERVAL.min + random() * (BLINK_INTERVAL.max - BLINK_INTERVAL.min))
  }
  function cancel() {
    clearFrame()
    clock.clearTimeout(blinkTimer)
    blinkTimer = null
    c.render()
  }
  function visibility() { cancel(); if (!isBlocked()) scheduleBlink() }
  const player = { currentArt, play }
  PLAYERS.set(c.pig, player)
  const preload = c.preload || (src => {
    if (typeof Image !== 'function') return Promise.resolve(false)
    const image = new Image()
    image.src = src
    return image.decode().then(() => true)
  })
  for (const action of Object.keys(ACTION_ART)) {
    preload(artSource(ACTION_ART[action])).then(loaded => {
      if (!disposed && loaded !== false) ready.add(action)
    }).catch(error => console.error('小猪动作图片解码失败', action, error))
  }
  document.addEventListener?.('visibilitychange', visibility)
  c.pig.addEventListener?.('pointercancel', visibility)
  c.pig.addEventListener?.('lostpointercapture', visibility)
  const observer = typeof MutationObserver === 'function' ? new MutationObserver(() => {
    if (active && !currentArt()) c.render()
    if (isBlocked()) cancel()
    else if (blinkTimer === null) scheduleBlink()
  }) : null
  observer?.observe(c.pig.parentNode, { attributes: true, subtree: true, attributeFilter: ['data-dragging', 'data-art', 'data-mood', 'data-idle', 'data-activity', 'data-illness', 'data-party', 'data-react'] })
  scheduleBlink()
  return {
    cancel,
    dispose() {
      observer?.disconnect()
      disposed = true
      cancel()
      PLAYERS.delete(c.pig)
      document.removeEventListener?.('visibilitychange', visibility)
      c.pig.removeEventListener?.('pointercancel', visibility)
      c.pig.removeEventListener?.('lostpointercapture', visibility)
    },
  }
}
