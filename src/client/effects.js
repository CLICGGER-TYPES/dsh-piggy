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

/**
 * @param {{ scene: object, pig: object, pigArt: object, pigEmoji: object, card: object, bubble: object, pomoHint?: object, isStopped: () => boolean }} deps
 * @returns {{ react: Function, burst: Function, transform: Function, flash: Function, showBubble: Function, showLine: Function, toast: Function, dispose: Function }}
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
  var bubbleTimer = null
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
function react(kind, ms) {
  if (reactTimer !== null) window.clearTimeout(reactTimer)
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
  react(spec.kind, spec.ms)
  var part = action === 'pet' && extra ? PART_FX[extra.part] : undefined
  burst(part ?? spec.fx, part ? part.length : spec.count)
  if (!SPOKEN_BY_HOST[action]) showBubble(spec.say, 1600)
}

var bubbleTimer = null
function showBubble(text, ms) {
  if (bubbleTimer !== null) window.clearTimeout(bubbleTimer)
  bubble.setAttribute('data-bubble-shown', 'true')
  bubble.textContent = ''
  bubble.appendChild(el('span', 'dp-bubble-text', text))
  bubble.hidden = false
  // 角标让位：气泡和它挨着，宁可角标先消失也不能压住猪说的话。
  if (pomoHint !== null) pomoHint.hidden = true
  bubbleTimer = window.setTimeout(function () {
    bubble.hidden = true
    bubbleTimer = null
    // 气泡走了，专注还在就把角标放回来（面板每 4 秒也会按 data-pomo 重设一次）。
    if (pomoHint !== null) pomoHint.hidden = pomoHint.getAttribute('data-pomo') !== 'on'
  }, ms || 2600)
}

/**
 * A line the pig says, with optional reply buttons. Replying closes the bubble;
 * a line with buttons stays up longer so there is time to answer it.
 * @param {string} text
 * @param {string[]} replies
 * @param {(index: number) => void} onReply
 */
function showLine(text, replies, onReply) {
  if (replies.length === 0) {
    showBubble(text, 2600)
    return
  }
  if (bubbleTimer !== null) window.clearTimeout(bubbleTimer)
  bubble.textContent = ''
  bubble.appendChild(el('span', 'dp-bubble-text', text))
  var row = el('div', 'dp-bubble-replies', '')
  replies.forEach(function (label, index) {
    var answer = el('button', 'dp-reply', label)
    answer.type = 'button'
    answer.addEventListener('click', function (event) {
      // The bubble sits over the pig; a reply must not also count as a pat.
      event.stopPropagation()
      bubble.hidden = true
      if (bubbleTimer !== null) window.clearTimeout(bubbleTimer)
      bubbleTimer = null
      onReply(index)
    })
    row.appendChild(answer)
  })
  bubble.appendChild(row)
  bubble.hidden = false
  bubbleTimer = window.setTimeout(function () {
    bubble.hidden = true
    bubbleTimer = null
  }, 6000)
}

function toast(text) {
  var node = el('div', 'dp-toast', text)
  card.insertBefore(node, card.firstChild)
  window.setTimeout(function () { node.remove() }, 4800)
}
  /** Drop the pending timers — the panel is going away, nothing should fire. */
  function dispose() {
    if (reactTimer !== null) window.clearTimeout(reactTimer)
    if (bubbleTimer !== null) window.clearTimeout(bubbleTimer)
    if (transformTimer !== null) window.clearTimeout(transformTimer)
    if (transformLayer !== null) transformLayer.remove()
    reactTimer = null
    bubbleTimer = null
    transformTimer = null
    transformLayer = null
  }

  return { react: react, burst: burst, transform: transform, flash: flash, showBubble: showBubble, showLine: showLine, toast: toast, dispose: dispose }
}
