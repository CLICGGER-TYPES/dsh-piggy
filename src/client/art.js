// @ts-check
/**
 * 选立绘：有动作立绘的形态（加冕后的猪猪王等，见 data/evolution.js）在喂食、
 * 打工、上学、旅行时换成对应那张，照顾的反应盖过外出的样子，反应结束换回来。
 * 立绘来自 PR #2（作者 1nuoiscute）。
 *
 * F03: the selection state (`forcedFeedback`, `effectArt`, the swap hook and the
 * latest selection token) belongs to one explicitly created presentation
 * context. The exported `syncPigArt` remains as a compatibility entry point for
 * existing per-pig callers; it resolves the context from the pig element rather
 * than from "the last mounted pig". Device-wide measurement caches stay shared
 * because they are keyed by immutable image src and contain no pig state.
 * F04R: per-image selection lifetime (queued apply invalidation and same-URL
 * frame replacement) lives in art-selection.js.
 * @module dsh-piggy/client/art
 */
import { pigActionResource } from './pig-actions.js'
import { artSource, bindArtResources, defaultArtResources, hasArtResource, resolveArtSource, unbindArtResources } from './art-path.js'
import { feedbackArtFor } from './feedback-art.js'
import { applyFrame, builtinFrame } from './art-framing.js'
import { applyResourceSelection, clearSelectedResource, clearSelection, invalidateChangedResource, isSelection, setSelection } from './art-selection.js'
import { customArtInk, measureCustomArt, frameFromInk, forgetCustomArtCache, onCustomArtChange } from './custom-art.js'

var REACTION_ART = { feed: 'eat', bathe: 'bathe', play: 'play', pet: 'pet', cure: 'relaxed', levelup: 'relaxed' }
var ACTIVITY_ART = { work: 'work', study: 'study', interest: 'study', trip: 'trip', fishing: 'fish' }

var SLEEP_ART = new Set([
  'piglet', 'pig-round', 'pig-fat', 'pig-king', 'pig-devil',
  'skin-mint', 'career-chef', 'career-astronaut', 'skin-detective',
  'skin-angel', 'skin-pirate', 'skin-wizard',
])

const CUSTOM_FRAME_CACHE = new Map()
const CUSTOM_FRAME_PENDING = new WeakMap()
/** One live presentation context per pig element. */
const ART_CONTEXTS = new WeakMap()
/** A disposed pig element never falls back to a live/global context. */
const DISPOSED_PIGS = new WeakSet()
// 同一个 key 重新导入（custom-art 的版本 +1）后，旧地址的取景作废，下一帧按新图重新量。
// F04: 通知现在带上被改动的根 key，只清这一套皮肤（及其场景后缀）的取景，不再整表清空。
onCustomArtChange(changed => {
  if (!Array.isArray(changed)) { CUSTOM_FRAME_CACHE.clear(); return }
  for (const art of changed) forgetFramesForArt(String(art))
})

/** A registered resource cache key may be `namespace/pack/key@revision` or a versioned URL. */
function cacheKeyBelongsToArt(cacheKey, art) {
  if (typeof cacheKey !== 'string' || art === '') return false
  const withoutVersion = cacheKey.split('?')[0]
  // Explicit resource ids (namespace/pack/key@revision) are invalidated by
  // their own registry revision notification, never by a legacy custom-* local
  // re-import. Otherwise two owners' identical short keys would evict each other.
  if (withoutVersion.includes('@') && !withoutVersion.includes('/art/')) return false
  const marker = '/' + art
  return withoutVersion === art || withoutVersion.endsWith(marker) || withoutVersion.includes(marker + '-')
}

function forgetFramesForArt(art) {
  for (const key of [...CUSTOM_FRAME_CACHE.keys()]) {
    if (cacheKeyBelongsToArt(key, art)) CUSTOM_FRAME_CACHE.delete(key)
  }
}

/** Targeted revision invalidation: only the announced resource cache key is dropped. */
function forgetFrameForCacheKey(cacheKey) {
  if (typeof cacheKey !== 'string' || cacheKey === '') return
  CUSTOM_FRAME_CACHE.delete(cacheKey)
  forgetCustomArtCache(cacheKey)
}

/**
 * Imported PNG or legacy SVG skins are measured once after loading.
 *
 * `onFrame`（可选）在图取景确定后调用一次：已经量过的图同步回调，延迟加载的图等
 * load 量完再回调。皮肤页的校准方框复用它，才能和真实立绘用同一份量法和缓存，
 * 并在图解码后刷新 zoom/offset、红点和指针反解。
 *
 * `isCurrent`（可选）由实例控制器提供：图片解码/测量回来时必须仍属于当前
 * 实例与当前选图，否则不写 DOM。它不改变共享的取景缓存，只阻止过期回调落地。
 * `cacheKey`（可选）是资源身份；缺省时沿用当前带版本串的 URL，旧调用与旧缓存不变。
 * @param {string | null} [cacheKey]
 */
export function frameCustomImage(image, src, sleep = false, onFrame = null, isCurrent = null, cacheKey = null) {
  const done = typeof onFrame === 'function' ? onFrame : null
  const current = typeof isCurrent === 'function' ? isCurrent : null
  const explicitKey = typeof cacheKey === 'string' && cacheKey !== '' ? cacheKey : null
  const key = explicitKey ?? src
  if (current !== null && !current()) return
  if (!src.includes('/custom-')) {
    const frame = builtinFrame(src)
    applyFrame(image, frame)
    if (done !== null) done(frame)
    return
  }
  const cached = CUSTOM_FRAME_CACHE.get(key)
  if (cached !== undefined) {
    if (current !== null && !current()) return
    applyFrame(image, cached)
    if (done !== null) done(cached)
    return
  }
  if (CUSTOM_FRAME_PENDING.get(image) === key) return
  applyFrame(image, null)
  CUSTOM_FRAME_PENDING.set(image, key)
  function measure() {
    CUSTOM_FRAME_PENDING.delete(image)
    if (current !== null && !current()) return
    if (image.getAttribute('src') !== src) return
    // 和 object-fit:contain 显示同一算则；读不到像素的浏览器保留标准取景。
    // 量到的 ink 由 custom-art 统一缓存，桌面 shape / 舞台可见范围 / 摸摸手读同一份。
    const ink = customArtInk(src, explicitKey) ?? measureCustomArt(image, src, sleep, explicitKey)
    const frame = ink === null ? null : frameFromInk(ink)
    if (frame === null) return
    CUSTOM_FRAME_CACHE.set(key, frame)
    if (current !== null && !current()) return
    applyFrame(image, frame)
    if (done !== null) done(frame)
  }
  if (image.complete && image.naturalWidth > 0) measure()
  else image.addEventListener?.('load', measure, { once: true })
}

/**
 * 某张立绘当前用的取景（zoom, x%, y%），取不到就是 null。
 *
 * 皮肤页的接触点拨准要跟真实立绘一样地缩放/偏移，所以借用这里量好的自定义图取景；
 * 内置图直接查 art-framing 的表。不修改任何图或存档。
 * @param {string} src
 * @returns {[number, number, number] | null}
 */
export function artFrameFor(src) {
  if (typeof src !== 'string' || src === '') return null
  return CUSTOM_FRAME_CACHE.get(src) ?? builtinFrame(src) ?? null
}

/** Use a custom sleep pose when supplied; otherwise fall back to built-in sleep art. */
export function syncSleepArt(art, scenes, image, artResources) {
  const key = typeof art === 'string' ? art : ''
  const base = resolveArtSource(key, artResources)
  const custom = base.scheme === 'custom' && scenes.includes('sleep')
  const own = SLEEP_ART.has(key) || (scenes.includes('sleep') && (custom || hasArtResource(key + '-sleep', artResources)))
  const name = own ? key : 'piglet'
  const resolved = resolveArtSource(name + '-sleep', artResources)
  if (image.getAttribute('src') !== resolved.url) image.src = resolved.url
  frameCustomImage(image, resolved.url, true, null, null, resolved.legacy ? null : resolved.cacheKey)
  if (resolved.descriptor.frame !== null && resolved.scheme !== 'custom') applyFrame(image, resolved.descriptor.frame)
}

function cleanFeedbackName(name) {
  return typeof name === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(name) ? name : null
}

/**
 * The old module-level API is kept for direct/standalone consumers. Product
 * instances use `createArtContext()` instead, so two mounted pigs never share
 * these slots.
 */
var legacy = null

function legacyContext() {
  if (legacy === null) legacy = createArtContext({})
  return legacy
}

/** @param {string|null} name */
export function showEffectArt(name) {
  legacyContext().showEffectArt(cleanFeedbackName(name))
}

export function clearEffectArt() {
  legacyContext().clearEffectArt()
}

/** @param {null | ((apply: () => void) => void)} hook */
export function setArtSwapHook(hook) {
  legacyContext().setArtSwapHook(hook)
}

/** @param {string|null} name 反馈图文件名（不带 .png），null 恢复自动 */
export function forceFeedbackArt(name) {
  legacyContext().forceFeedbackArt(name)
}

/**
 * 真正换图；有遮挡钩子时交给它排队。Hook 与 selection 都属于 context。
 */
function swapSource(context, apply) {
  if (context.disposed) return
  if (context.artSwapHook === null) apply()
  else context.artSwapHook(apply)
}

/**
 * Point the pig's <img> at the sprite its attributes call for. Only touches
 * `src` when it changes, so polling never refetches the image.
 * @param {object} pig   the .dp-pig node (data-art / data-art-actions / data-react / data-activity)
 * @param {object} image the <img> inside it
 */
function syncPigArtWith(context, pig, image, emoji) {
  if (context.disposed) return false
  // During a rub, retain the current skin/pose rather than swapping to its pet picture.
  if (pig.getAttribute('data-pet-snap') === 'true') return !image.hidden
  // A feel transition may apply later. Even selecting the already visible
  // sprite must invalidate it, otherwise an old frame can replace a reaction.
  const selection = {}
  setSelection(image, selection)
  const applySelected = (apply, isCurrent) => swapSource(context, () => {
    if (context.disposed) return
    if (!isSelection(image, selection) || pig.getAttribute('data-pet-snap') === 'true') return
    if (typeof isCurrent === 'function' && !isCurrent()) return
    apply()
  })
  var base = pig.getAttribute('data-art') || ''
  var microResource = pigActionResource(pig)
  var feedback = context.forcedFeedback || context.effectArt || feedbackArtFor({
    stage: pig.getAttribute('data-stage') || '', base: base,
    mood: pig.getAttribute('data-mood') || '', reaction: pig.getAttribute('data-react') || '',
    idle: pig.getAttribute('data-idle') || '', activityKind: pig.getAttribute('data-activity') || '',
    activityKey: pig.getAttribute('data-activity-key') || '', illness: pig.getAttribute('data-illness') || '',
    party: pig.getAttribute('data-party') === 'true', hour: Math.floor(Date.now() / 3_600_000),
  })
  if (feedback) {
    var feedbackResource = resolveArtSource('feedback/' + feedback, context.artResources)
    applyResourceSelection({
      image: image, selection: selection, resource: feedbackResource,
      fallback: builtinFrame(feedbackResource.url),
      artResources: context.artResources, applySelected: applySelected,
    })
    image.hidden = false
    pig.setAttribute('data-feedback', 'true')
    if (emoji) emoji.hidden = true
    return true
  }
  if (!base) {
    clearSelectedResource(image)
    applyFrame(image, null)
    image.hidden = true
    if (image.getAttribute('src')) image.removeAttribute('src')
    pig.setAttribute('data-feedback', 'false')
    if (emoji) emoji.hidden = false
    return false
  }
  if (microResource && !context.forcedFeedback) {
    applyResourceSelection({
      image: image, selection: selection, resource: microResource,
      fallback: builtinFrame(artSource('piglet')),
      artResources: context.artResources, applySelected: applySelected,
    })
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
      && (base.startsWith('custom-') || hasArtResource(base + '-' + action, context.artResources))) art += '-' + action
  }
  var resolved = resolveArtSource(art, context.artResources)
  var src = resolved.url
  applyResourceSelection({
    image: image, selection: selection, resource: resolved,
    fallback: builtinFrame(src),
    artResources: context.artResources, applySelected: applySelected,
    renderDescriptorFrame: resolved.scheme !== 'custom',
    onLoaded: function () {
      frameCustomImage(image, src, false, null, function () {
        return !context.disposed && isSelection(image, selection) && image.getAttribute('src') === src
      }, resolved.legacy ? null : resolved.cacheKey)
    },
  })
  image.hidden = false
  pig.setAttribute('data-feedback', 'false')
  if (emoji) emoji.hidden = true
  return true
}

/**
 * One explicit art/feedback owner. `sync()` uses the bound elements; the
 * controller never reads a module-global active pig.
 *
 * @param {{ pig?: any, image?: any, emoji?: any, artResources?: import('./art-resources.js').ArtResourceRegistry | null }} [options]
 */
export function createArtContext(options) {
  const opts = options ?? {}
  const pig = opts.pig ?? null
  const image = opts.image ?? null
  const emoji = opts.emoji ?? null
  const artResources = opts.artResources !== undefined && opts.artResources !== null
    && typeof opts.artResources.resolveString === 'function' ? opts.artResources : defaultArtResources
  let stopResourceChanges = null
  if (pig !== null) {
    const existing = ART_CONTEXTS.get(pig)
    if (existing !== undefined && existing.disposed === false) {
      throw new Error('[dsh-piggy] this pig already has a live presentation art context')
    }
  }
  const context = {
    pig: pig,
    image: image,
    emoji: emoji,
    artResources: artResources,
    disposed: false,
    forcedFeedback: null,
    effectArt: null,
    artSwapHook: null,
    isAlive: function () { return context.disposed === false },
    sync: function () {
      if (context.disposed) return false
      if (context.pig === null || context.image === null) return false
      return syncPigArtWith(context, context.pig, context.image, context.emoji)
    },
    showEffectArt: function (name) {
      if (context.disposed) return
      context.effectArt = cleanFeedbackName(name)
    },
    clearEffectArt: function () {
      if (context.disposed) return
      context.effectArt = null
    },
    forceFeedbackArt: function (name) {
      if (context.disposed) return
      context.forcedFeedback = cleanFeedbackName(name)
    },
    setArtSwapHook: function (hook) {
      if (context.disposed) return
      context.artSwapHook = typeof hook === 'function' ? hook : null
    },
    dispose: function () {
      if (context.disposed) return
      context.disposed = true
      context.forcedFeedback = null
      context.effectArt = null
      context.artSwapHook = null
      if (stopResourceChanges !== null) { stopResourceChanges(); stopResourceChanges = null }
      if (context.pig === null) {
        clearSelection(context.image)
        return
      }
      const current = ART_CONTEXTS.get(context.pig)
      // A newer context on the same pig owns its own selection/disposed state.
      if (current !== undefined && current !== context) return
      unbindArtResources(context.pig, context.artResources)
      clearSelection(context.image)
      if (current === context) ART_CONTEXTS.delete(context.pig)
      DISPOSED_PIGS.add(context.pig)
    },
  }
  if (artResources !== null && typeof artResources.subscribe === 'function') {
    stopResourceChanges = artResources.subscribe(function (change) {
      const image = context.image
      for (const item of change.changes) {
        forgetFrameForCacheKey(item.previousCacheKey)
        if (image !== null) invalidateChangedResource(image, change, item, artResources)
      }
    })
  }
  if (pig !== null) {
    DISPOSED_PIGS.delete(pig)
    ART_CONTEXTS.set(pig, context)
    bindArtResources(pig, artResources)
  }
  return context
}

/**
 * Compatibility entry point for existing per-pig callers. A mounted pig is
 * resolved through its own explicit context; an unregistered pig keeps the old
 * standalone behavior. A disposed pig is never sent to another context.
 */
export function syncPigArt(pig, image, emoji) {
  const context = pig !== null && typeof pig === 'object' ? ART_CONTEXTS.get(pig) : undefined
  const target = context !== undefined && context.disposed === false ? context : legacyContext()
  if (pig !== null && typeof pig === 'object' && DISPOSED_PIGS.has(pig)) return false
  if (context !== undefined && context.disposed === false) return syncPigArtWith(context, pig, image, emoji)
  return syncPigArtWith(target, pig, image, emoji)
}
