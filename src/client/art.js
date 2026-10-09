// @ts-check
/**
 * 选立绘：有动作立绘的形态（加冕后的猪猪王等，见 data/evolution.js）在喂食、
 * 打工、上学、旅行时换成对应那张，照顾的反应盖过外出的样子，反应结束换回来。
 * 立绘来自 PR #2（作者 1nuoiscute）。
 * @module dsh-piggy/client/art
 */
import { ART_URL } from './constants.js'
import { feedbackArtFor } from './feedback-art.js'
import { FEEDBACK_FRAMING, BUILTIN_FRAMING, FRAME_HEIGHT } from './feedback-framing.js'

var REACTION_ART = { feed: 'eat', bathe: 'bathe', play: 'play', pet: 'pet', cure: 'relaxed', levelup: 'relaxed' }
var ACTIVITY_ART = { work: 'work', study: 'study', interest: 'study', trip: 'trip', fishing: 'fish' }

var SLEEP_ART = new Set([
  'piglet', 'pig-round', 'pig-fat', 'pig-king', 'pig-devil',
  'skin-mint', 'career-chef', 'career-astronaut', 'skin-detective',
  'skin-angel', 'skin-pirate', 'skin-wizard',
])

const CUSTOM_FRAME_CACHE = new Map()
const CUSTOM_FRAME_PENDING = new WeakMap()

function applyFrame(image, frame) {
  if (typeof image.style?.setProperty !== 'function') return
  image.style.setProperty('--art-zoom', frame ? String(frame[0]) : '1')
  image.style.setProperty('--art-x', frame ? frame[1] + '%' : '0%')
  image.style.setProperty('--art-y', frame ? frame[2] + '%' : '0%')
}

/** Imported skins are not known at build time; measure their sanitized SVG once after loading. */
function frameCustomImage(image, src, sleep = false) {
  if (!src.includes('/custom-')) { applyFrame(image, BUILTIN_FRAMING[src.slice(ART_URL.length)] ?? null); return }
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
      canvas.height = 128
      canvas.width = sleep ? Math.round(128 * 1.2) : 128
      const context = canvas.getContext?.('2d', { willReadFrequently: true })
      if (!context) return
      const fit = Math.min(canvas.width / image.naturalWidth, canvas.height / (image.naturalHeight || image.naturalWidth))
      const width = image.naturalWidth * fit, height = (image.naturalHeight || image.naturalWidth) * fit
      context.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height)
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
      let left = canvas.width, top = canvas.height, right = 0, bottom = 0
      for (let y = 0; y < canvas.height; y += 1) for (let x = 0; x < canvas.width; x += 1) {
        if (pixels[(y * canvas.width + x) * 4 + 3] <= 16) continue
        left = Math.min(left, x); top = Math.min(top, y)
        right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1)
      }
      if (right <= left || bottom <= top) return
      const zoom = FRAME_HEIGHT / ((bottom - top) / canvas.height)
      const frame = [zoom,
        (0.5 - (left + right) / (2 * canvas.width)) * zoom * 100,
        (0.5 - (top + bottom) / (2 * canvas.height)) * zoom * 100]
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
  frameCustomImage(image, src, true)
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
