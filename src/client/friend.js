// @ts-check
/**
 * 桌面朋友猪：加载正式游戏客户端，只把数据源换成房间资料。
 *
 * 场景、立绘、待机/小动作、摸摸、说话和动作都复用本机猪的同一套
 * scene/art/life/pig-actions；这里不读写本地存档，也不开本地面板。
 * 右键只打开这只朋友的独立面板。
 */
import { attachLife } from './life.js'
import { normalize } from './normalize.js'
import { friendViewOf } from './friend-view.js'
import { playPigPet } from './pig-actions.js'
import { createPresentationContext } from './presentation-context.js'
import { syncPigArt } from './art.js'
import { readStore } from './storage.js'

/** 朋友窗口的固定样式：只留猪和名牌，面板/金币/健康都藏起来。 */
var FRIEND_CSS = [
  'html[data-piggy-role="friend"],html[data-piggy-role="friend"] body{background:transparent!important}',
  'html[data-piggy-role="friend"] [data-dsh-pig]{position:absolute!important;right:6px!important;bottom:6px!important;left:auto!important;top:auto!important;width:max-content!important;height:auto!important;pointer-events:auto!important}',
  'html[data-piggy-role="friend"] .dp-card,html[data-piggy-role="friend"] .dp-bar,html[data-piggy-role="friend"] .dp-hud-coins,html[data-piggy-role="friend"] .dp-hud-health{display:none!important}',
  'html[data-piggy-role="friend"] .dp-hud{position:relative!important;inset:auto!important;margin-top:4px!important;justify-content:center!important}',
  'html[data-piggy-role="friend"] .dp-scene{height:calc(var(--pig-size) + 10px)!important;min-height:0!important}',
].join('\n')

function mountStyle() {
  if (document.querySelector('[data-piggy-friend-style]') !== null) return
  var style = document.createElement('style')
  style.setAttribute('data-piggy-friend-style', '')
  style.textContent = FRIEND_CSS
  document.head.appendChild(style)
}

/** 和本机猪一样大：宠物页把实际猪盒边长写进同一个 origin 的 localStorage。 */
function localPigSize() {
  var size = Number(readStore('dsh-piggy:pig-display-size'))
  return Number.isFinite(size) && size >= 40 ? Math.min(128, size) : 64
}

function applyPigSize(host) {
  var size = localPigSize()
  host.style.setProperty('--pig-size', size + 'px')
  host.style.setProperty('--pig-scale', '1')
}

/**
 * @param {{ root?: any }=} options
 * @returns {() => void}
 */
export function mountFriend(options = {}) {
  var shell = /** @type {any} */ (window).piggyShell
  var api = shell?.visitor ?? null
  if (api === null) return function () {}
  if (document.querySelector('[data-dsh-pig][data-friend-actor="true"]') !== null) return function () {}

  mountStyle()
  document.documentElement.setAttribute('data-piggy-role', 'friend')
  var base = normalize(null)
  var view = friendViewOf(base, {})
  view.hatched = true
  view.dead = false
  view.activity = null
  view.dialogue = { ...(view.dialogue ?? {}), quiet: false }
  view.pending = []

  var stopped = false
  var dragging = false
  var drag = null
  var suppressClick = false

  var presentation = createPresentationContext({
    root: options.root ?? null,
    state: {
      getView: function () { return view },
      isStopped: function () { return stopped },
      isAway: function () { return false },
      isQuiet: function () { return view.dialogue?.quiet === true },
    },
    transport: { send: function (action, extra) { send(action, extra) } },
    getShell: function () { return null },
    onGeometry: function () {},
    artResources: null,
  })
  var parts = presentation.parts
  var { host, pig, pigArt, pigEmoji, hudName, hudCoins, hudHealth, bubble } = parts
  if (hudCoins !== null) hudCoins.style.display = 'none'
  if (hudHealth !== null) hudHealth.style.display = 'none'
  host.setAttribute('data-friend-actor', 'true')
  applyPigSize(host)
  var showBubble = /** @type {(text:string, ms?:number)=>void} */ (presentation.effects.showBubble)
  var burst = /** @type {(fx:string[], count:number)=>void} */ (presentation.effects.burst)
  var feel = presentation.feel

  function friendLine(reason) {
    var card = view.profile ?? {}
    var pig = view.pig
    if (reason === 'enter') {
      if (typeof card.catchphrase === 'string' && card.catchphrase !== '') return card.catchphrase
      return '我是' + (pig?.name ?? '小猪')
    }
    if (typeof card.catchphrase === 'string' && card.catchphrase !== '' && Math.random() < 0.5) return card.catchphrase
    if (typeof card.motto === 'string' && card.motto !== '') return card.motto
    return pig?.moodLabel ? ('今天' + pig.moodLabel) : '一起玩吧'
  }

  /** 朋友猪的动作入口：摸摸走联机表情；说话先用同一套气泡/台词引擎按他的资料生成。 */
  function send(action, extra) {
    if (stopped) return
    if (action === 'pet') {
      if (typeof api.pat === 'function') Promise.resolve(api.pat()).catch(function () {})
      playPigPet(pig)
      if (Math.random() < 0.35) showBubble('摸摸～', 1800)
      return
    }
    if (action === 'chat') showBubble(friendLine(extra?.reason), 2800)
  }

  function apply(player) {
    if (stopped || player === null || typeof player !== 'object') return
    view = friendViewOf(base, player)
    view.hatched = true
    view.dead = false
    view.activity = null
    view.dialogue = { ...(view.dialogue ?? {}), quiet: false }
    view.pending = []
    applyPigSize(host)
    if (hudName !== null) hudName.textContent = player.name ?? '小猪'
    syncPigArt(pig, pigArt, pigEmoji)
    document.title = (player.name ?? '小猪') + ' · 朋友的猪'
    reportPigRect()
  }

  /** 面板贴着猪本体：把真实猪框报给主进程，而不是整扇透明窗口。 */
  function reportPigRect() {
    if (typeof api.size !== 'function') return
    var rect = pig.getBoundingClientRect()
    api.size({ x: rect.x, y: rect.y, width: rect.width, height: rect.height })
  }

  function endDrag(commit) {
    if (drag === null) return
    var moved = drag.moved
    drag = null
    dragging = false
    pig.removeAttribute('data-dragging')
    if (moved && typeof api.dragEnd === 'function') api.dragEnd()
    if (commit && !moved && !suppressClick) send('pet')
    suppressClick = false
  }

  pig.addEventListener('pointerdown', function (event) {
    if (event.button !== 0 || stopped) return
    drag = { id: event.pointerId, x: event.screenX, y: event.screenY, moved: false }
    try { pig.setPointerCapture(event.pointerId) } catch { /* 旧浏览器 */ }
  })
  pig.addEventListener('pointermove', function (event) {
    if (drag === null || event.pointerId !== drag.id || drag.moved) return
    var dx = event.screenX - drag.x
    var dy = event.screenY - drag.y
    if (dx * dx + dy * dy < 16) return
    drag.moved = true
    dragging = true
    suppressClick = true
    pig.setAttribute('data-dragging', 'true')
    if (typeof api.dragStart === 'function') api.dragStart()
  })
  pig.addEventListener('pointerup', function (event) {
    if (drag === null || event.pointerId !== drag.id) return
    try { pig.releasePointerCapture(event.pointerId) } catch { /* 已释放 */ }
    endDrag(!suppressClick)
  })
  pig.addEventListener('pointercancel', function () {
    try { if (drag !== null) pig.releasePointerCapture(drag.id) } catch { /* 已释放 */ }
    endDrag(false)
  })

  function openPanel(event) {
    if (event !== undefined && typeof event.preventDefault === 'function') event.preventDefault()
    if (typeof api.view !== 'function') return
    // 面板要贴猪本体：右键时顺带把猪框带过去，不依赖异步的 size 通道。
    var rect = pig.getBoundingClientRect()
    Promise.resolve(api.view({ x: rect.x, y: rect.y, width: rect.width, height: rect.height })).catch(function () {})
  }
  parts.scene.addEventListener('contextmenu', openPanel)

  var life = attachLife({
    send: send,
    isStopped: function () { return stopped },
    isBusy: function () { return false },
    isOpen: function () { return false },
    getView: function () { return view },
    isDragging: function () { return dragging },
    pig: pig,
    pigArt: pigArt,
    pigEmoji: pigEmoji,
    burst: burst,
    showBubble: showBubble,
    desktopShell: function () { return null },
    feel: feel,
  })

  if (typeof api.onUpdate === 'function') api.onUpdate(apply)
  if (typeof api.get === 'function') Promise.resolve(api.get()).then(apply).catch(function () {})
  window.addEventListener('resize', reportPigRect)
  setTimeout(reportPigRect, 0)

  return function () {
    stopped = true
    life.dispose()
    window.removeEventListener('resize', reportPigRect)
    presentation.dispose()
  }
}
