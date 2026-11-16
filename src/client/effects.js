// @ts-check
/**
 * 猪的即时反馈：动作动画、粒子、气泡台词与 toast。
 *
 * 只碰交给它的几个元素，不读全局状态 —— 「猪还在不在」通过 isStopped()
 * 回调问外壳（见 docs/CONVENTIONS.md）。
 * @module dsh-piggy/client/effects
 */
import { artFrameFor, syncPigArt } from './art.js'
import { artPointToLayout } from './character-geometry.js'
import { PART_FX } from './pet-parts.js'
import { el } from './dom.js'
import { createSpeech } from './speech.js'
import { SHOP } from '../../packages/pet-core/src/data/shop.js'

/**
 * @param {{ scene: object, pig: object, pigArt: object, pigEmoji: object, card: object, bubble: object, pomoHint?: object, root?: object, art?: { sync: () => boolean }, audio?: { play: (key: string, options?: { soft?: boolean }) => boolean }, isStopped: () => boolean, isAway?: () => boolean }} deps
 * @returns {{ react: Function, burst: (emojis: string[], count: number) => void, transform: Function, flash: Function, showBubble: Function, showLine: Function, hideBubble: Function, toast: Function, dispose: Function, setFeel: Function }}
 */
export function createEffects(deps) {
  var scene = deps.scene
  var pig = deps.pig
  var card = deps.card
  var bubble = deps.bubble
  // 番茄钟角标（C2）：气泡说话时给它让位，两者位置本来就挨着。
  var pomoHint = deps.pomoHint ?? null
  var isStopped = deps.isStopped
  var layerRoot = deps.root ?? null

  var EAT_BITES = [
    { at: 0.35, kind: 'left' },
    { at: 0.95, kind: 'bottom' },
    { at: 1.55, kind: 'all' },
  ]
  var EAT_FOOD = { x: 0.14, y: 0.56, size: 0.20 }
  var FOOD_BY_KEY = new Map(SHOP.filter(item => item.kind === 'food').map(item => [item.key, item]))
  var eatFx = null
  var eatToken = 0

  var disposed = false
  var timers = new Set()
  var reactTimer = null
  var feelHooks = null
  const speech = createSpeech({ bubble, pomoHint })
  const { showBubble, showLine } = speech
  var transformTimer = null
  var transformLayer = null

  function later(fn, ms) {
    var id = window.setTimeout(function () {
      timers.delete(id)
      if (disposed) return
      fn()
    }, ms)
    timers.add(id)
    return id
  }

  function cancelTimer(id) {
    if (id === null) return
    window.clearTimeout(id)
    timers.delete(id)
  }

  function syncArt() {
    if (disposed) return false
    if (deps.art !== null && deps.art !== undefined && typeof deps.art.sync === 'function') return deps.art.sync()
    return syncPigArt(pig, deps.pigArt, deps.pigEmoji)
  }

/** Full-screen promotion effect, replaced on a second transformation. */
function transform(kind) {
  if (disposed) return
  if (transformTimer !== null) cancelTimer(transformTimer)
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
  ;(layerRoot ?? document.body).appendChild(layer)
  transformLayer = layer
  transformTimer = later(function () {
    layer.remove()
    if (transformLayer === layer) transformLayer = null
    transformTimer = null
  }, 1450)
}

// ---- animation ----
/** 跳跃类动作先蹲 120ms 再起跳；手感关闭时完全走原路。 */
var JUMP_KINDS = { levelup: true, away: true, play: true }

function applyReact(kind, ms) {
  if (disposed) return
  // Re-assigning the same value does NOT restart a CSS animation, so
  // clicking three times quickly only played it once. Dropping the
  // attribute and forcing a reflow makes every click start from zero.
  pig.removeAttribute('data-react')
  void pig.offsetWidth
  pig.setAttribute('data-react', kind)
  syncArt()
  reactTimer = later(function () {
    reactTimer = null
    pig.removeAttribute('data-react')
    syncArt()
  }, ms || 900)
}

function react(kind, ms) {
  if (disposed) return
  if (kind !== 'feed') stopEatFx()
  if (reactTimer !== null) cancelTimer(reactTimer)
  // 手感在时，跳跃类先蹲一下：物理层压 8%，120ms 后再设 data-react。
  // 移除定时器从真正设属性那一刻算起，动作尾巴不会被截掉。
  if (feelHooks !== null && JUMP_KINDS[kind] === true) {
    feelHooks.crouch(120)
    reactTimer = later(function () { applyReact(kind, ms) }, 120)
    return
  }
  applyReact(kind, ms)
}

function burst(emojis, count) {
  if (disposed) return
  for (var i = 0; i < (count || 1); i += 1) {
    (function (index) {
      later(function () {
        if (isStopped()) return
        var node = el('span', 'dp-fx', emojis[index % emojis.length])
        node.style.setProperty('--dx', Math.round((Math.random() - 0.5) * 46) + 'px')
        // Anchor to the pig, not the scene. The scene is panel-wide when
        // open, so fixed coordinates put every particle off to one side.
        var spot = headSpot()
        node.style.left = (spot.x + Math.round((Math.random() - 0.5) * 22)) + 'px'
        node.style.top = spot.y + 'px'
        scene.appendChild(node)
        later(function () { node.remove() }, 1200)
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

function stopEatFx() {
  eatToken += 1
  if (eatFx === null) return
  if (eatFx.raf !== null && typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
    window.cancelAnimationFrame(eatFx.raf)
  }
  eatFx.node.remove()
  eatFx = null
}

function foodFor(extra) {
  var key = extra !== null && extra !== undefined && typeof extra.item === 'string' ? extra.item : ''
  var item = FOOD_BY_KEY.get(key)
  return item === undefined
    ? { emoji: '🍎', label: '苹果' }
    : { emoji: item.emoji || '🍎', label: item.label || '' }
}

function eatSound(key, delay, options) {
  if (deps.audio === null || deps.audio === undefined || typeof deps.audio.play !== 'function') return
  later(function () {
    if (disposed || isStopped()) return
    deps.audio.play(key, options)
  }, delay)
}

/** Draw one independent food layer above the static eat.png; the pig is never moved. */
function playEatFx(extra) {
  if (typeof document === 'undefined' || typeof scene.appendChild !== 'function') return
  if (typeof pig.getBoundingClientRect !== 'function' || typeof scene.getBoundingClientRect !== 'function') return
  stopEatFx()
  var token = eatToken
  var food = foodFor(extra)
  var node = document.createElement('canvas')
  node.className = 'dp-eat-bite'
  node.setAttribute('aria-hidden', 'true')
  var side = 160
  node.width = side
  node.height = side
  if (typeof node.getContext !== 'function') return
  var ctx = node.getContext('2d')
  if (ctx === null || ctx === undefined) return

  var box = pig.getBoundingClientRect()
  var sbox = scene.getBoundingClientRect()
  if (box.width <= 0 || box.height <= 0) return
  var local = { x: box.left - sbox.left, y: box.top - sbox.top, width: box.width, height: box.height }
  var src = deps.pigArt && typeof deps.pigArt.getAttribute === 'function' ? deps.pigArt.getAttribute('src') || '' : ''
  var frame = artFrameFor(src)
  var zoom = frame === null ? 1 : Number(frame[0]) || 1
  var shiftX = frame === null ? 0 : Number(frame[1]) || 0
  var shiftY = frame === null ? 0 : Number(frame[2]) || 0
  var mirrored = typeof pig.getAttribute === 'function' && pig.getAttribute('data-walk') === 'right'
  var point = artPointToLayout(local, { x: EAT_FOOD.x, y: EAT_FOOD.y }, {
    zoom: zoom, shiftX: shiftX, shiftY: shiftY, mirrored: mirrored,
  })
  var fit = Math.min(local.width, local.height) * zoom
  var foodSize = Math.max(10, fit * EAT_FOOD.size)
  node.style.position = 'absolute'
  node.style.pointerEvents = 'none'
  node.style.left = (point.x - foodSize / 2) + 'px'
  node.style.top = (point.y - foodSize / 2) + 'px'
  node.style.width = foodSize + 'px'
  node.style.height = foodSize + 'px'
  scene.appendChild(node)

  var glyph = side * 0.8
  var start = null
  var raf = null
  var itemKeys = [
    { t: 0.00, s: 0.82, r: -2, y: 2 },
    { t: 0.12, s: 1.04, r: 1, y: -1 },
    { t: 0.25, s: 1.06, r: -3, y: 0 },
    { t: 0.35, s: 0.94, r: 0, y: 1 },
    { t: 0.48, s: 1.04, r: 1.5, y: -2 },
    { t: 0.62, s: 0.99, r: -1, y: 0 },
    { t: 0.76, s: 1.03, r: 1, y: -1 },
    { t: 0.88, s: 1.05, r: 2, y: -1 },
    { t: 0.95, s: 0.93, r: 0, y: 1 },
    { t: 1.08, s: 1.03, r: -1.5, y: -1 },
    { t: 1.22, s: 0.99, r: 1, y: 0 },
    { t: 1.36, s: 1.03, r: -1, y: -1 },
    { t: 1.47, s: 1.08, r: 2, y: -2 },
    { t: 1.55, s: 1.16, r: -2, y: -3 },
    { t: 1.66, s: 0.00, r: 0, y: 3 },
    { t: 2.00, s: 0.00, r: 0, y: 3 },
  ]
  eatFx = { node: node, raf: null }

  function itemState(t) {
    if (t <= itemKeys[0].t) return itemKeys[0]
    for (var i = 1; i < itemKeys.length; i += 1) {
      var a = itemKeys[i - 1]
      var b = itemKeys[i]
      if (t <= b.t) {
        var p = (t - a.t) / (b.t - a.t)
        p = p * p * (3 - 2 * p)
        return {
          s: a.s + (b.s - a.s) * p,
          r: a.r + (b.r - a.r) * p,
          y: a.y + (b.y - a.y) * p,
        }
      }
    }
    return itemKeys[itemKeys.length - 1]
  }

  function comicEdge() {
    ctx.globalCompositeOperation = 'source-atop'
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.lineWidth = 9
    ctx.strokeStyle = 'rgba(255, 249, 232, 1)'
    ctx.stroke()
    ctx.globalCompositeOperation = 'destination-out'
  }

  var leftBites = [
    { x: 0.40, y: 0.12, r: 0.09 },
    { x: 0.37, y: 0.32, r: 0.13 },
    { x: 0.41, y: 0.53, r: 0.10 },
    { x: 0.36, y: 0.74, r: 0.12 },
    { x: 0.40, y: 0.93, r: 0.08 },
  ]
  var bottomBites = [
    { x: 0.10, y: 0.64, r: 0.10 },
    { x: 0.30, y: 0.67, r: 0.13 },
    { x: 0.52, y: 0.65, r: 0.09 },
    { x: 0.72, y: 0.68, r: 0.12 },
    { x: 0.90, y: 0.64, r: 0.09 },
  ]

  function eraseCircle(cx, cy, radius) {
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalCompositeOperation = 'source-atop'
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.lineWidth = 9
    ctx.strokeStyle = 'rgba(255, 249, 232, 1)'
    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalCompositeOperation = 'destination-out'
  }

  function eraseLeftBite() {
    ctx.globalCompositeOperation = 'destination-out'
    ctx.fillRect(0, 0, side * 0.30, side)
    for (var i = 0; i < leftBites.length; i += 1) {
      var b = leftBites[i]
      eraseCircle(b.x * side, b.y * side, b.r * side)
    }
  }

  function eraseBottomBite() {
    ctx.globalCompositeOperation = 'destination-out'
    ctx.fillRect(0, side * 0.72, side, side * 0.28)
    for (var i = 0; i < bottomBites.length; i += 1) {
      var b = bottomBites[i]
      eraseCircle(b.x * side, b.y * side, b.r * side)
    }
  }

  function draw(now) {
    if (token !== eatToken || disposed || isStopped()) {
      if (token === eatToken) stopEatFx()
      return
    }
    if (start === null) start = now
    var t = (now - start) / 1000
    ctx.clearRect(0, 0, side, side)
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
    ctx.font = glyph + 'px "Noto Color Emoji", "Segoe UI Emoji", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(food.emoji, side / 2, side / 2 + 4)
    if (t >= EAT_BITES[0].at) eraseLeftBite()
    if (t >= EAT_BITES[1].at) eraseBottomBite()
    ctx.globalCompositeOperation = 'source-over'
    for (var b = 0; b < EAT_BITES.length; b += 1) {
      var crumbBite = EAT_BITES[b]
      var age = t - crumbBite.at
      if (age < 0 || age > 0.34) continue
      var q = age / 0.34
      var ox = side * 0.50
      var oy = side * 0.62
      if (crumbBite.kind === 'left') { ox = side * 0.31; oy = side * 0.62 }
      else if (crumbBite.kind === 'bottom') { ox = side * 0.54; oy = side * 0.67 }
      for (var k = 0; k < 4; k += 1) {
        var vx = (k - 1.5) * 9 + (b === 1 ? 4 : -2)
        var vy = -19 - k * 4 + (crumbBite.kind === 'bottom' ? 10 : 0)
        var radius = 3.4 - k * 0.45
        ctx.save()
        ctx.globalAlpha = Math.max(0, 1 - q)
        ctx.fillStyle = ['#e8a23c', '#f6d58c', '#a85d2a', '#fff0c2'][k]
        ctx.translate(ox + vx * q, oy + vy * q + 26 * q * q)
        ctx.rotate((k + 1) * 0.5)
        ctx.fillRect(-radius / 2, -radius / 2, radius, radius)
        ctx.restore()
      }
      ctx.globalAlpha = 1
    }
    var bounce = itemState(Math.floor(t * 12) / 12)
    var shake = 0
    for (var sbi = 0; sbi < EAT_BITES.length; sbi += 1) {
      var sa = t - EAT_BITES[sbi].at
      if (sa >= 0 && sa < 0.12) {
        var sq = sa / 0.12
        shake = Math.sin(sq * Math.PI * 6) * 5 * (1 - sq)
      }
    }
    var flash = 0
    for (var fbi = 0; fbi < EAT_BITES.length; fbi += 1) {
      var fa = t - EAT_BITES[fbi].at
      if (fa >= 0 && fa < 0.07) flash = Math.max(flash, 1 - fa / 0.07)
    }
    node.style.transformOrigin = '50% 68%'
    node.style.transform = 'translateX(' + shake + '%) translateY(' + bounce.y + '%) rotate(' + bounce.r + 'deg) scale(' + bounce.s + ')'
    node.style.filter = flash > 0 ? 'brightness(' + (1 + flash * 0.35) + ')' : ''
    if (t >= 1.68) {
      stopEatFx()
      return
    }
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      raf = window.requestAnimationFrame(draw)
      if (eatFx !== null) eatFx.raf = raf
    }
  }

  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    raf = window.requestAnimationFrame(draw)
    eatFx.raf = raf
  } else {
    draw(0)
  }
  eatSound('chomp', 350)
  eatSound('chomp', 550, { soft: true })
  eatSound('chomp', 700, { soft: true })
  eatSound('chomp', 950)
  eatSound('chomp', 1150, { soft: true })
  eatSound('chomp', 1300, { soft: true })
  eatSound('chomp', 1550)
  eatSound('gulp', 1700)
}

var REACTIONS = {
  hatch: { kind: 'levelup', ms: 980, fx: ['🥚', '✨', '🐖', '🎉'], count: 4, say: '孵出来啦！' },
  feed: { kind: 'feed', ms: 2000, fx: ['🍎', '😋', '✨'], count: 3, say: '吃掉了！' },
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
  if (disposed) return
  var spec = REACTIONS[action]
  if (spec === undefined) return
  if (action === 'feed') {
    if (deps.isAway?.() !== true) playEatFx(extra)
    return
  }
  // 在外面做照料只给粒子反馈，不能把活动立绘换成喂食/洗澡的反应图（用户 2026-10-24）。
  if (deps.isAway?.() !== true) react(spec.kind, spec.ms)
  var part = action === 'pet' && extra ? PART_FX[extra.part] : undefined
  burst(part ?? spec.fx, part ? part.length : spec.count)
  if (!SPOKEN_BY_HOST[action]) showBubble(spec.say, 1600)
}

function toast(text) {
  if (disposed) return
  var node = el('div', 'dp-toast', text)
  card.insertBefore(node, card.firstChild)
  later(function () { node.remove() }, 4800)
}
  /** Drop the pending timers — the panel is going away, nothing should fire. */
  function dispose() {
    if (disposed) return
    disposed = true
    stopEatFx()
    for (const id of timers) window.clearTimeout(id)
    timers.clear()
    speech.dispose()
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
