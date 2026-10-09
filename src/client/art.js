// @ts-check
/**
 * 选立绘：有动作立绘的形态（加冕后的猪猪王等，见 data/evolution.js）在喂食、
 * 打工、上学、旅行时换成对应那张，照顾的反应盖过外出的样子，反应结束换回来。
 * 立绘来自 PR #2（作者 1nuoiscute）。
 * @module dsh-piggy/client/art
 */
import { ART_URL } from './constants.js'
import { feedbackArtFor } from './feedback-art.js'
import { FEEDBACK_FRAMING } from './feedback-framing.js'

var REACTION_ART = { feed: 'eat', bathe: 'bathe', play: 'play', pet: 'pet', cure: 'relaxed', levelup: 'relaxed' }
var ACTIVITY_ART = { work: 'work', study: 'study', interest: 'study', trip: 'trip', fishing: 'fish' }

var SLEEP_ART = new Set([
  'piglet', 'pig-round', 'pig-fat', 'pig-king', 'pig-devil',
  'skin-mint', 'career-chef', 'career-astronaut', 'skin-detective',
  'skin-angel', 'skin-pirate', 'skin-wizard',
])

const CUSTOM_FRAME_CACHE = new Map()
const CUSTOM_FRAME_PENDING = new WeakMap()
const FRAME_TARGET = 239 / 256

function applyFrame(image, frame) {
  if (typeof image.style?.setProperty !== 'function') return
  image.style.setProperty('--art-zoom', frame ? String(frame[0]) : '1')
  image.style.setProperty('--art-x', frame ? frame[1] + '%' : '0%')
  image.style.setProperty('--art-y', frame ? frame[2] + '%' : '0%')
}

/** Imported skins are not known at build time; measure their sanitized SVG once after loading. */
function frameCustomImage(image, src) {
  if (!src.includes('/custom-')) { applyFrame(image, null); return }
  const cached = CUSTOM_FRAME_CACHE.get(src)
  if (cached !== undefined) { applyFrame(image, cached); return }
  if (CUSTOM_FRAME_PENDING.get(image) === src) return
  applyFrame(image, null)
  CUSTOM_FRAME_PENDING.set(image, src)
  function measure() {
    CUSTOM_FRAME_PENDING.delete(image)
    if (image.getAttribute('src') !== src) return
    try {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 128
      const context = canvas.getContext?.('2d', { willReadFrequently: true })
      if (!context) return
      context.drawImage(image, 0, 0, 128, 128)
      const pixels = context.getImageData(0, 0, 128, 128).data
      let left = 128, top = 128, right = 0, bottom = 0
      for (let y = 0; y < 128; y += 1) for (let x = 0; x < 128; x += 1) {
        if (pixels[(y * 128 + x) * 4 + 3] <= 16) continue
        left = Math.min(left, x); top = Math.min(top, y)
        right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1)
      }
      if (right <= left || bottom <= top) return
      const zoom = Math.max(1, FRAME_TARGET / (Math.max(right - left, bottom - top) / 128))
      const frame = zoom < 1.01 ? null : [zoom,
        (0.5 - (left + right) / 256) * zoom * 100,
        (0.5 - (top + bottom) / 256) * zoom * 100]
      CUSTOM_FRAME_CACHE.set(src, frame)
      applyFrame(image, frame)
    } catch { /* A browser that cannot read this image keeps the standard frame. */ }
  }
  if (image.complete && image.naturalWidth > 0) measure()
  else image.addEventListener?.('load', measure, { once: true })
}

/** Use a custom sleep pose when supplied; otherwise fall back to built-in sleep art. */
export function syncSleepArt(art, scenes, image) {
  var custom = typeof art === 'string' && art.startsWith('custom-') && scenes.includes('sleep')
  var name = SLEEP_ART.has(art) ? art : 'piglet'
  var src = ART_URL + (custom ? art + '-sleep.svg' : name + '-sleep.png')
  if (image.getAttribute('src') !== src) image.src = src
  frameCustomImage(image, src)
}

/** 调试页「立绘」指定的反馈图；null 表示照常按状态自动选。只在这个页面里，不进存档。 */
var forcedFeedback = null

/** @param {string|null} name 反馈图文件名（不带 .png），null 恢复自动 */
export function forceFeedbackArt(name) {
  forcedFeedback = typeof name === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(name) ? name : null
}

/**
 * Point the pig's <img> at the sprite its attributes call for. Only touches
 * `src` when it changes, so polling never refetches the image.
 * @param {object} pig   the .dp-pig node (data-art / data-art-actions / data-react / data-activity)
 * @param {object} image the <img> inside it
 */
export function syncPigArt(pig, image, emoji) {
  var base = pig.getAttribute('data-art') || ''
  var feedback = forcedFeedback || feedbackArtFor({
    stage: pig.getAttribute('data-stage') || '', base: base,
    mood: pig.getAttribute('data-mood') || '', reaction: pig.getAttribute('data-react') || '',
    idle: pig.getAttribute('data-idle') || '', activityKind: pig.getAttribute('data-activity') || '',
    activityKey: pig.getAttribute('data-activity-key') || '', illness: pig.getAttribute('data-illness') || '',
    party: pig.getAttribute('data-party') === 'true', hour: Math.floor(Date.now() / 3_600_000),
  })
  if (feedback) {
    var feedbackSrc = ART_URL + 'feedback/' + feedback + '.png'
    if (image.getAttribute('src') !== feedbackSrc) image.src = feedbackSrc
    applyFrame(image, FEEDBACK_FRAMING[feedback] ?? null)
    image.hidden = false
    pig.setAttribute('data-feedback', 'true')
    if (emoji) emoji.hidden = true
    return true
  }
  if (!base) {
    applyFrame(image, null)
    image.hidden = true
    if (image.getAttribute('src')) image.removeAttribute('src')
    pig.setAttribute('data-feedback', 'false')
    if (emoji) emoji.hidden = false
    return false
  }
  var art = base
  if (pig.getAttribute('data-art-actions') === 'true') {
    var action = REACTION_ART[pig.getAttribute('data-react')] || ACTIVITY_ART[pig.getAttribute('data-activity')]
    var scenes = String(pig.getAttribute('data-art-scenes') || '').split(',')
    if (action && (scenes[0] === '' || scenes.indexOf(action) >= 0)) art += '-' + action
  }
  var src = ART_URL + art + '.svg'
  if (image.getAttribute('src') !== src) image.src = src
  frameCustomImage(image, src)
  image.hidden = false
  pig.setAttribute('data-feedback', 'false')
  if (emoji) emoji.hidden = true
  return true
}
