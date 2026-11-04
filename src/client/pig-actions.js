// @ts-check
/** 普通猪的两帧微动作；结束后由唯一选图入口重读状态，避免旧计时覆盖新状态。 */
import { artFrameUrl, artResourcesForPig, defaultArtResources, resolveActionFrame, resolveArtResource } from './art-path.js'
import { confirmPetSnap } from './pet-snap.js'

const PLAYERS = new WeakMap()
export const BLINK_INTERVAL = { min: 8000, max: 16000 }
/** Kept for compatibility; derived from the default action pack so there is one source of truth. */
export const ACTION_DURATION = Object.freeze(Object.fromEntries(
  defaultArtResources.list({ kind: 'action' }).map(entry => [entry.descriptor.key, entry.descriptor.duration ?? 0]),
))

/**
 * Resolve one playable action descriptor. Accepts an action short key, a
 * namespaced handle/ref, or an already resolved resource from a private
 * registry. No per-action branch is needed for a newly registered pack.
 * @param {any} value
 * @param {import('./art-resources.js').ArtResourceRegistry} [artResources]
 * @returns {import('./art-resources.js').ResolvedArtResource | null}
 */
function resolveAction(value, artResources) {
  if (value !== null && typeof value === 'object' && 'descriptor' in value && 'cacheKey' in value) {
    const entry = /** @type {import('./art-resources.js').ResolvedArtResource} */ (value)
    return entry.descriptor.kind === 'action' ? entry : null
  }
  const entry = resolveArtResource(value, artResources ?? defaultArtResources)
  return entry !== null && entry.descriptor.kind === 'action' ? entry : null
}

/**
 * Declarative eligibility shared by the player. Reads only `data-*`
 * attributes, so a new pack can add an action without editing a per-action
 * branch.
 * @param {{ getAttribute: (name: string) => string | null }} pig
 * @param {import('./art-resources.js').ArtEligibility | null} eligibility
 */
export function matchesPigActionEligibility(pig, eligibility) {
  if (eligibility === null) return true
  if (pig === null || typeof pig !== 'object' || typeof pig.getAttribute !== 'function') return false
  const read = (/** @type {string} */ name) => pig.getAttribute('data-' + name) || ''
  if (eligibility.art !== undefined && read('art') !== eligibility.art) return false
  if (eligibility.stageNot !== undefined && eligibility.stageNot.includes(read('stage'))) return false
  if (eligibility.absent !== undefined) {
    for (const name of eligibility.absent) if (read(name) !== '') return false
  }
  if (eligibility.party !== undefined && (read('party') === 'true') !== eligibility.party) return false
  if (eligibility.moodNot !== undefined && eligibility.moodNot.includes(read('mood'))) return false
  if (eligibility.react !== undefined) {
    const react = read('react')
    if (eligibility.react.length === 0 ? react !== '' : !eligibility.react.includes(react)) return false
  }
  return true
}

/** 状态图优先；eligibility 由资源描述符声明，普通猪两条默认动作和以前完全一致。 */
export function canPlayPigAction(pig, action, artResources) {
  const entry = resolveAction(action, artResources)
  return entry !== null && matchesPigActionEligibility(pig, entry.descriptor.eligibility)
}

/** 选图入口调用；返回仍是旧的动作图 key（piglet-blink / piglet-shy-pet）。 */
export function pigActionArt(pig) { return PLAYERS.get(pig)?.currentArt() || null }
/** F03/registry-aware consumers read the whole resolved resource (url/cacheKey/frame). */
export function pigActionResource(pig) { return PLAYERS.get(pig)?.currentResource() || null }
/** 只在现有摸猪成功反应处触发，不排队。 */
export function playPigPet(pig) { if (!confirmPetSnap(pig)) PLAYERS.get(pig)?.play('shy-pet') }

/**
 * Play a registered action on one attached pig. Private packs pass the
 * resolved resource (or a namespaced handle) and need no selector branch.
 * @param {any} pig
 * @param {any} action
 */
export function playPigAction(pig, action) {
  const player = PLAYERS.get(pig)
  return player === undefined ? false : player.play(action) === true
}

/** 可注入时钟和解码器，测试取消与抢占不依赖真实时间。 */
export function attachPigActions(c) {
  const clock = c.clock || window
  const random = c.random || Math.random
  const artResources = c.artResources || artResourcesForPig(c.pig) || defaultArtResources
  const ready = new Set()
  /** @type {import('./art-resources.js').ResolvedArtResource | null} */
  let active = null, frameTimer = null, blinkTimer = null
  let frameIndex = -1
  let disposed = false
  const isBlocked = () => disposed || c.isStopped() || c.isDragging() || document.hidden === true || c.pig.closest?.('[data-dragging="true"]') != null
  const clearFrame = () => {
    clock.clearTimeout(frameTimer)
    frameTimer = null
    active = null
    frameIndex = -1
    c.pig.removeAttribute?.('data-micro-action')
  }
  function currentResource() {
    if (active !== null && (isBlocked() || !matchesPigActionEligibility(c.pig, active.descriptor.eligibility))) clearFrame()
    if (active === null) return null
    if (active.descriptor.frames === null) return active
    return resolveActionFrame(active, frameIndex)
  }
  function currentArt() {
    const entry = currentResource()
    return entry === null ? null : entry.artKey
  }
  /**
   * The requested action's descriptor may declare a generic fallback. Resolve
   * at most four hops and stop on a cycle, so a bad private pack cannot loop.
   */
  function playable(action) {
    let entry = resolveAction(action, artResources)
    const seen = new Set()
    let depth = 0
    while (entry !== null && !matchesPigActionEligibility(c.pig, entry.descriptor.eligibility) && depth < 4) {
      if (seen.has(entry.cacheKey)) return null
      seen.add(entry.cacheKey)
      const fallback = entry.descriptor.fallback
      entry = fallback === null ? null : resolveAction(fallback, artResources)
      depth += 1
    }
    return entry
  }
  function play(action) {
    if (isBlocked()) return false
    const target = playable(action)
    if (target === null) return false
    if (!ready.has(target.cacheKey)) return false
    if (c.pig.getAttribute('data-pet-snap') === 'true') return false
    if (target.descriptor.key === 'blink' && active !== null) return false
    clearFrame()
    active = target
    const frames = target.descriptor.frames
    frameIndex = frames === null ? -1 : 0
    // 2026-10-13 只暂停当前动效（CSS 里限定 :not([data-react])）；animation:none 会把呼吸中途的位置重置，实测跳 6.8px。
    c.pig.setAttribute?.('data-micro-action', target.descriptor.key)
    c.render()
    // 动作自带音效：只走当前展示实例的通道，不跨窗口。
    const sound = target.descriptor.sound
    if (typeof sound === 'string' && sound !== '' && c.audio !== undefined && typeof c.audio.play === 'function') {
      // 第一方历史 sound 可以写 `sfx/tap`，播放时去掉包名；第三方已转成完整的
      // `ext-<key>/<pack>/<sound>`，必须原样交给扩展音效表。
      const cue = sound.startsWith('ext-')
        ? sound
        : sound.includes('/') ? sound.slice(sound.lastIndexOf('/') + 1) : sound
      c.audio.play(cue)
    }
    if (frames === null) {
      frameTimer = clock.setTimeout(() => { clearFrame(); c.render() }, target.descriptor.duration ?? 0)
    } else {
      const schedule = (/** @type {number} */ index) => {
        frameTimer = clock.setTimeout(() => {
          frameTimer = null
          // 防御被抢占后仍执行旧回调；正常路径 clearFrame 已经清掉计时器。
          if (active !== target) return
          if (index + 1 >= frames.length) { clearFrame(); c.render(); return }
          frameIndex = index + 1
          c.render()
          // render 可能因隐藏/拖动/eligibility 变化调用 clearFrame；此时不能再排下一帧。
          if (active === target) schedule(index + 1)
        }, frames[index].durationMs)
      }
      schedule(0)
    }
    return true
  }
  function scheduleBlink() {
    // 排期独立于「这一拍能不能播」：受阻（拖动/隐藏/状态被换掉）时跳过这一帧，但仍然排下一次，
    // 不靠 observer 每 4 秒轮询来兜底（F5）。
    clock.clearTimeout(blinkTimer)
    blinkTimer = clock.setTimeout(() => {
      blinkTimer = null
      if (!isBlocked()) play('blink')
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
  const player = { currentArt, currentResource, play }
  PLAYERS.set(c.pig, player)
  const preload = c.preload || (src => {
    if (typeof Image !== 'function') return Promise.resolve(false)
    const image = new Image()
    image.src = src
    return image.decode().then(() => true)
  })
  /** Preload one action (single image or all frames) and mark it playable. */
  function loadAction(entry) {
    if (ready.has(entry.cacheKey)) return
    const cacheKey = entry.cacheKey
    const frames = entry.descriptor.frames
    // 单图动作保持原来的 preload 调用与完成时机；帧动作等整段都解码成功才算 ready。
    if (frames === null) {
      preload(entry.url).then(loaded => {
        if (!disposed && loaded !== false) ready.add(cacheKey)
      }).catch(error => console.error('小猪动作图片解码失败', entry.descriptor.key, error))
    } else {
      Promise.all(frames.map(frame => preload(artFrameUrl(frame)))).then(results => {
        if (!disposed && results.every(loaded => loaded !== false)) ready.add(cacheKey)
      }).catch(error => console.error('小猪动作图片解码失败', entry.descriptor.key, error))
    }
  }
  for (const entry of artResources.list({ kind: 'action' })) loadAction(entry)
  // Third-party packs arrive after the first snapshot (or are replaced when an
  // extension updates). Preload them as they appear and drop removed ones.
  const stopResourceChanges = typeof artResources.subscribe === 'function'
    ? artResources.subscribe(change => {
      for (const item of change.changes) {
        if (item.removed === true) {
          ready.delete(item.previousCacheKey)
          if (active !== null && active.descriptor.namespace === change.namespace
            && active.descriptor.pack === change.pack && active.descriptor.key === item.key) {
            clearFrame()
            c.render()
          }
          continue
        }
        const entry = artResources.resolveRef({ namespace: change.namespace, pack: change.pack, key: item.key })
        if (entry !== null && entry.descriptor.kind === 'action') loadAction(entry)
      }
    })
    : function () {}
  document.addEventListener?.('visibilitychange', visibility)
  // 指针捕获设在 .dp-scene 上（index.js），pointercancel / lostpointercapture 的 target 是它而不是
  // 猪本身；挂在 .dp-pig 上永远不会触发（F4）。没有父节点（测试环境）时退回猪本身。
  const gestureTarget = c.pig.parentNode || c.pig
  gestureTarget.addEventListener?.('pointercancel', visibility)
  gestureTarget.addEventListener?.('lostpointercapture', visibility)
  const observer = typeof MutationObserver === 'function' ? new MutationObserver(() => {
    if (active !== null && !currentArt()) c.render()
    else if (blinkTimer === null && !isBlocked()) scheduleBlink()
  }) : null
  observer?.observe(c.pig.parentNode, { attributes: true, subtree: true, attributeFilter: ['data-dragging', 'data-art', 'data-mood', 'data-idle', 'data-activity', 'data-illness', 'data-party', 'data-react'] })
  scheduleBlink()
  return {
    cancel,
    play,
    dispose() {
      observer?.disconnect()
      stopResourceChanges()
      disposed = true
      cancel()
      PLAYERS.delete(c.pig)
      document.removeEventListener?.('visibilitychange', visibility)
      gestureTarget.removeEventListener?.('pointercancel', visibility)
      gestureTarget.removeEventListener?.('lostpointercapture', visibility)
    },
  }
}
