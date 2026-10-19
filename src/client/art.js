// @ts-check
/**
 * 选立绘：有动作立绘的形态（加冕后的猪猪王等，见 data/evolution.js）在喂食、
 * 打工、上学、旅行时换成对应那张，照顾的反应盖过外出的样子，反应结束换回来。
 * 立绘来自 PR #2（作者 1nuoiscute）。
 * @module dsh-piggy/client/art
 */
import { pigActionArt } from './pig-actions.js'
import { artSource, hasBuiltinArt } from './art-path.js'
import { feedbackArtFor } from './feedback-art.js'
import { applyFrame, builtinFrame, FRAME_HEIGHT } from './art-framing.js'

var REACTION_ART = { feed: 'eat', bathe: 'bathe', play: 'play', pet: 'pet', cure: 'relaxed', levelup: 'relaxed' }
var ACTIVITY_ART = { work: 'work', study: 'study', interest: 'study', trip: 'trip', fishing: 'fish' }

var SLEEP_ART = new Set([
  'piglet', 'pig-round', 'pig-fat', 'pig-king', 'pig-devil',
  'skin-mint', 'career-chef', 'career-astronaut', 'skin-detective',
  'skin-angel', 'skin-pirate', 'skin-wizard',
])

const CUSTOM_FRAME_CACHE = new Map()
const CUSTOM_FRAME_PENDING = new WeakMap()
const ART_SELECTION = new WeakMap()

/** Imported PNG or legacy SVG skins are measured once after loading. */
function frameCustomImage(image, src, sleep = false) {
  if (!src.includes('/custom-')) { applyFrame(image, builtinFrame(src)); return }
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
  var src = artSource((custom ? art : name) + '-sleep')
  if (image.getAttribute('src') !== src) image.src = src
  frameCustomImage(image, src, true)
}

/** 调试页「立绘」指定的反馈图；null 表示照常按状态自动选。只在这个页面里，不进存档。 */
var forcedFeedback = null

/** 临时表现图（摔晕的 faint.png）：优先级低于调试页，高于普通选图；不进存档。 */
var effectArt = null

/** @param {string|null} name */
export function showEffectArt(name) {
  effectArt = typeof name === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(name) ? name : null
}

export function clearEffectArt() {
  effectArt = null
}

/**
 * 动作图切换遮挡：物理层装上后由它决定「先压一下再换图」。
 * @type {null | ((apply: () => void) => void)}
 */
var artSwapHook = null

/** @param {null | ((apply: () => void) => void)} hook */
export function setArtSwapHook(hook) {
  artSwapHook = typeof hook === 'function' ? hook : null
}

/** 真正换图；有遮挡钩子时交给它排队。 */
function swapSource(apply) {
  if (artSwapHook === null) apply()
  else artSwapHook(apply)
}

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
  // A feel transition may apply later. Even selecting the already visible
  // sprite must invalidate it, otherwise an old frame can replace a reaction.
  const selection = {}
  ART_SELECTION.set(image, selection)
  const applySelected = apply => swapSource(() => {
    if (ART_SELECTION.get(image) === selection) apply()
  })
  var base = pig.getAttribute('data-art') || ''
  pigActionArt(pig)
  var feedback = forcedFeedback || effectArt || feedbackArtFor({
    stage: pig.getAttribute('data-stage') || '', base: base,
    mood: pig.getAttribute('data-mood') || '', reaction: pig.getAttribute('data-react') || '',
    idle: pig.getAttribute('data-idle') || '', activityKind: pig.getAttribute('data-activity') || '',
    activityKey: pig.getAttribute('data-activity-key') || '', illness: pig.getAttribute('data-illness') || '',
    party: pig.getAttribute('data-party') === 'true', hour: Math.floor(Date.now() / 3_600_000),
  })
  if (feedback) {
    var feedbackSrc = artSource('feedback/' + feedback)
    if (image.getAttribute('src') !== feedbackSrc) {
      applySelected(function () {
        image.src = feedbackSrc
        applyFrame(image, builtinFrame(feedbackSrc))
      })
    }
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
  var microArt = pigActionArt(pig)
  if (microArt && !forcedFeedback) {
    var microSrc = artSource(microArt)
    if (image.getAttribute('src') !== microSrc) {
      applySelected(function () {
        image.src = microSrc
        applyFrame(image, builtinFrame(artSource('piglet')))
      })
    }
    image.hidden = false
    pig.setAttribute('data-feedback', 'false')
    if (emoji) emoji.hidden = true
    return true
  }
  var art = base
  if (pig.getAttribute('data-art-actions') === 'true' || base === 'piglet') {
    var action = REACTION_ART[pig.getAttribute('data-react')] || ACTIVITY_ART[pig.getAttribute('data-activity')]
    var scenes = String(pig.getAttribute('data-art-scenes') || '').split(',')
    if (action && (base === 'piglet' || scenes[0] === '' || scenes.indexOf(action) >= 0)
      && (base.startsWith('custom-') || hasBuiltinArt(base + '-' + action))) art += '-' + action
  }
  var src = artSource(art)
  if (image.getAttribute('src') !== src) {
    applySelected(function () {
      image.src = src
      frameCustomImage(image, src)
    })
  }
  image.hidden = false
  pig.setAttribute('data-feedback', 'false')
  if (emoji) emoji.hidden = true
  return true
}
