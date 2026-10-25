// @ts-check
/**
 * 猪的即时反馈：动作动画、粒子、气泡台词与 toast。
 *
 * 只碰交给它的几个元素，不读全局状态 —— 「猪还在不在」通过 isStopped()
 * 回调问外壳（见 docs/CONVENTIONS.md）。
 * @module dsh-piggy/client/effects
 */
import { syncPigArt } from './art.js'
import { PART_FX } from './pet-parts.js'
import { el } from './dom.js'
import { createSpeech } from './speech.js'

/**
 * @param {{ scene: object, pig: object, pigArt: object, pigEmoji: object, card: object, bubble: object, pomoHint?: object, isStopped: () => boolean, isAway?: () => boolean }} deps
 * @returns {{ react: Function, burst: Function, transform: Function, flash: Function, showBubble: Function, showLine: Function, hideBubble: Function, toast: Function, dispose: Function, setFeel: Function }}
 */
export function createEffects(deps) {
  var scene = deps.scene
  var pig = deps.pig
  var card = deps.card
  var bubble = deps.bubble
  // 番茄钟角标（C2）：气泡说话时给它让位，两者位置本来就挨着。
  var pomoHint = deps.pomoHint ?? null
  var isStopped = deps.isStopped

  var reactTimer = null
  var feelHooks = null
  const speech = createSpeech({ bubble, pomoHint })
  const { showBubble, showLine } = speech
  var transformTimer = null
  var transformLayer = null

/** Full-screen promotion effect, replaced on a second transformation. */
function transform(kind) {
  if (transformTimer !== null) window.clearTimeout(transformTimer)
  if (transformLayer !== null) transformLayer.remove()
  var emojis = kind === 'contract' ? ['😈', '🔥'] : ['👑', '✨']
  var layer = el('div', 'dp-transform')
  layer.setAttribute('aria-hidden', 'true')
  for (var i = 0; i < 16; i += 1) {
    var falling = el('span', 'dp-transform-fall', emojis[i % 2])
    falling.style.left = ((i * 47) % 101) + '%'
    falling.style.setProperty('--delay', ((i % 5) * 0.07) + 's')
    falling.style.setProperty('--drift', (((i % 3) - 1) * 34) + 'px')
    layer.appendChild(falling)
  }
  var center = pig.getBoundingClientRect()
  var pop = el('span', 'dp-transform-pop', emojis[0])
  pop.style.left = (center.left + center.width / 2) + 'px'
  pop.style.top = (center.top + center.height / 2) + 'px'
  layer.appendChild(pop)
  document.body.appendChild(layer)
  transformLayer = layer
  transformTimer = window.setTimeout(function () {
    layer.remove()
    if (transformLayer === layer) transformLayer = null
    transformTimer = null
  }, 1450)
}

// ---- animation ----
/** 跳跃类动作先蹲 120ms 再起跳；手感关闭时完全走原路。 */
var JUMP_KINDS = { levelup: true, away: true, feed: true, play: true }

function applyReact(kind, ms) {
  // Re-assigning the same value does NOT restart a CSS animation, so
  // clicking three times quickly only played it once. Dropping the
  // attribute and forcing a reflow makes every click start from zero.
  pig.removeAttribute('data-react')
  void pig.offsetWidth
  pig.setAttribute('data-react', kind)
  syncPigArt(pig, deps.pigArt, deps.pigEmoji)
  reactTimer = window.setTimeout(function () {
    pig.removeAttribute('data-react')
    syncPigArt(pig, deps.pigArt, deps.pigEmoji)
    reactTimer = null
  }, ms || 900)
}

function react(kind, ms) {
  if (reactTimer !== null) window.clearTimeout(reactTimer)
  // 手感在时，跳跃类先蹲一下：物理层压 8%，120ms 后再设 data-react。
  // 移除定时器从真正设属性那一刻算起，动作尾巴不会被截掉。
  if (feelHooks !== null && JUMP_KINDS[kind] === true) {
    feelHooks.crouch(120)
    reactTimer = window.setTimeout(function () { applyReact(kind, ms) }, 120)
    return
  }
  applyReact(kind, ms)
}

function burst(emojis, count) {
  for (var i = 0; i < (count || 1); i += 1) {
    (function (index) {
      window.setTimeout(function () {
        if (isStopped()) return
        var node = el('span', 'dp-fx', emojis[index % emojis.length])
        node.style.setProperty('--dx', Math.round((Math.random() - 0.5) * 46) + 'px')
        // Anchor to the pig, not the scene. The scene is panel-wide when
        // open, so fixed coordinates put every particle off to one side.
        var spot = headSpot()
        node.style.left = (spot.x + Math.round((Math.random() - 0.5) * 22)) + 'px'
        node.style.top = spot.y + 'px'
        scene.appendChild(node)
        window.setTimeout(function () { node.remove() }, 1200)
      }, index * 110)
    })(i)
  }
}

/** Just above the pig's head, in scene coordinates. */
function headSpot() {
  var fallback = { x: 24, y: 8 }
  if (typeof pig.getBoundingClientRect !== 'function' || typeof scene.getBoundingClientRect !== 'function') return fallback
  var p = pig.getBoundingClientRect()
  var s = scene.getBoundingClientRect()
  if (p.width === 0 && p.height === 0) return fallback
  return { x: p.left - s.left + p.width / 2, y: p.top - s.top - 20 }
}

var REACTIONS = {
  hatch: { kind: 'levelup', ms: 980, fx: ['🥚', '✨', '🐖', '🎉'], count: 4, say: '孵出来啦！' },
  feed: { kind: 'feed', ms: 900, fx: ['🍎', '😋', '✨'], count: 3, say: '吃掉了！' },
  bathe: { kind: 'bathe', ms: 1050, fx: ['🫧', '🫧', '💧', '✨'], count: 4, say: '洗干净啦～' },
  play: { kind: 'play', ms: 900, fx: ['🎾', '⭐', '💨'], count: 3, say: '好开心！' },
  pet: { kind: 'pet', ms: 420, fx: ['❤️'], count: 1, say: '好舒服…' },
  work: { kind: 'away', ms: 900, fx: ['💼', '🧱', '🪙'], count: 3, say: '出门打工！' },
  study: { kind: 'away', ms: 900, fx: ['📚', '✏️', '🧠'], count: 3, say: '上学去！' },
  trip: { kind: 'away', ms: 900, fx: ['🧳', '🗺', '✨'], count: 3, say: '出发旅行！' },
  calloff: { kind: 'refuse', ms: 520, fx: ['💨'], count: 1, say: '提前回来了…' },
  buy: { kind: 'pet', ms: 620, fx: ['🪙', '🛒'], count: 2, say: '买到了！' },
  use: { kind: 'pet', ms: 620, fx: ['✨'], count: 2, say: '用掉了。' },
}

/**
 * 点下去立刻给的反应：动作、冒的小东西。核心会说话的动作（照料、出门、买东西、用东西）
 * 这里不再冒一句固定的话，不然一次操作会连着冒两句（G 批次）。
 */
var SPOKEN_BY_HOST = { feed: true, bathe: true, play: true, pet: true, work: true, study: true, trip: true, buy: true, use: true }

function flash(action, extra) {
  var spec = REACTIONS[action]
  if (spec === undefined) return
  // 在外面做照料只给粒子反馈，不能把活动立绘换成喂食/洗澡的反应图（用户 2026-10-24）。
  if (deps.isAway?.() !== true) react(spec.kind, spec.ms)
  var part = action === 'pet' && extra ? PART_FX[extra.part] : undefined
  burst(part ?? spec.fx, part ? part.length : spec.count)
  if (!SPOKEN_BY_HOST[action]) showBubble(spec.say, 1600)
}

function toast(text) {
  var node = el('div', 'dp-toast', text)
  card.insertBefore(node, card.firstChild)
  window.setTimeout(function () { node.remove() }, 4800)
}
  /** Drop the pending timers — the panel is going away, nothing should fire. */
  function dispose() {
    if (reactTimer !== null) window.clearTimeout(reactTimer)
    speech.dispose()
    if (transformTimer !== null) window.clearTimeout(transformTimer)
    if (transformLayer !== null) transformLayer.remove()
    reactTimer = null
    transformTimer = null
    transformLayer = null
  }

  return {
    react: react, burst: burst, transform: transform, flash: flash, showBubble: showBubble, showLine: showLine, hideBubble: speech.hideBubble, toast: toast, dispose: dispose,
    /** 物理层装好后由 shell 接上；关闭手感时传 null。 */
    setFeel: function (feel) { feelHooks = feel },
  }
}
