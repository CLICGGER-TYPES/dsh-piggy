// @ts-check
/** 联机房间页面：只通过 window.piggyShell.room 与主进程通信，不碰存档。 */
;(function () {
  var shell = /** @type {any} */ (window).piggyShell
  var room = shell && shell.room ? shell.room : null
  var stage = document.getElementById('stage')
  var pigs = document.getElementById('pigs')
  var statusText = document.getElementById('status-text')
  var dot = document.getElementById('dot')
  var codeWrap = document.getElementById('code-wrap')
  var codeText = document.getElementById('code')
  var hint = document.getElementById('hint')
  var toastEl = document.getElementById('toast')
  var copyButton = document.getElementById('copy')
  var leaveButton = document.getElementById('leave')
  var sceneSwitch = document.getElementById('scene-switch')
  var sceneButtons = sceneSwitch ? Array.prototype.slice.call(sceneSwitch.querySelectorAll('button[data-scene]')) : []
  var SCENE_KEY = 'dsh-piggy:room-scene'
  var scene = 'pen'
  var roomScene = /** @type {any} */ (window).PiggyRoomScene

  /** @type {any} */
  var snapshot = null
  var selfId = null
  /** @type {Map<string, any>} */
  var nodes = new Map()
  /** @type {Map<string, any>} */
  var pigParts = new Map()
  /** @type {Map<string, number>} */
  var lastEmote = new Map()
  var local = { x: 0.5, y: 0.2, facing: 1 }
  var lastLocalAt = 0
  var dragging = null
  var sendTimer = null
  var pending = false
  var toastTimer = null

  if (room === null) {
    statusText.textContent = '联机不可用'
    hint.textContent = '这扇窗口需要桌面版外壳 0.6.8 以上'
    return
  }

  function toast(text) {
    toastEl.textContent = text
    toastEl.hidden = false
    if (toastTimer !== null) clearTimeout(toastTimer)
    toastTimer = setTimeout(function () { toastEl.hidden = true; toastTimer = null }, 1600)
  }

  function hideHint() { hint.classList.add('gone') }

  function applyScene(next) {
    scene = next === 'room' ? 'room' : 'pen'
    stage.setAttribute('data-scene', scene)
    document.body.setAttribute('data-scene', scene)
    var p = roomScene.resolveWalk(scene, local.x, local.y)
    local.x = p.x
    local.y = p.y
    sceneButtons.forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.getAttribute('data-scene') === scene))
    })
    roomScene.updateWalkZone(scene)
    roomScene.showWalkZone()
    if (snapshot !== null && selfId !== null) render(snapshot)
    try { localStorage.setItem(SCENE_KEY, scene) } catch { /* localStorage 不可用就只改本次 */ }
  }

  try {
    if (localStorage.getItem(SCENE_KEY) === 'room') scene = 'room'
  } catch { /* 用默认猪圈 */ }
  applyScene(scene)
  sceneButtons.forEach(function (button) {
    button.addEventListener('click', function () { applyScene(button.getAttribute('data-scene')) })
  })

  function currentSelf() {
    if (snapshot === null || !Array.isArray(snapshot.players)) return null
    for (var i = 0; i < snapshot.players.length; i += 1) {
      if (snapshot.players[i].id === selfId) return snapshot.players[i]
    }
    return null
  }

  function sendPosition() {
    if (pending) return
    pending = true
    Promise.resolve(room.move(local.x, local.y, local.facing)).catch(function () {}).then(function () {
      pending = false
      if (Date.now() - lastLocalAt < 80) scheduleSend()
    })
  }

  function scheduleSend() {
    if (sendTimer !== null) return
    sendTimer = setTimeout(function () {
      sendTimer = null
      if (Date.now() - lastLocalAt >= 45) sendPosition()
      else scheduleSend()
    }, 50)
  }

  function setLocal(x, y, facing) {
    var p = roomScene.moveInside(scene, local.x, local.y, x, y)
    local.x = p.x
    local.y = p.y
    local.facing = facing < 0 ? -1 : 1
    lastLocalAt = Date.now()
    roomScene.showWalkZone(1800)
    var self = currentSelf()
    if (self !== null) updatePig(self)
    scheduleSend()
  }

  function artUrl(art) {
    if (typeof art !== 'string' || art === '') return ''
    return '/dsh-piggy/art/' + art
  }

  function createPig(player) {
    var node = document.createElement('div')
    node.className = 'pig'
    node.setAttribute('data-player', player.id)

    var tag = document.createElement('span')
    tag.className = 'tag'
    var name = document.createElement('span')
    var level = document.createElement('span')
    var mark = document.createElement('span')
    tag.appendChild(name)
    tag.appendChild(level)
    tag.appendChild(mark)

    var body = document.createElement('div')
    body.className = 'body'
    var img = document.createElement('img')
    img.alt = ''
    img.draggable = false
    img.addEventListener('error', function () {
      img.src = '/dsh-piggy/art/pigs/base/piglet/idle.png'
    })
    body.appendChild(img)
    var emoji = document.createElement('span')
    emoji.className = 'emoji'
    emoji.hidden = true
    body.appendChild(emoji)

    node.appendChild(tag)
    node.appendChild(body)
    pigs.appendChild(node)
    nodes.set(player.id, node)
    var parts = { tag: tag, name: name, level: level, mark: mark, img: img, emoji: emoji }
    pigParts.set(player.id, parts)
    return node
  }

  function updatePig(player) {
    var node = nodes.get(player.id)
    if (node === undefined) node = createPig(player)
    var parts = pigParts.get(player.id)
    var isSelf = player.id === selfId
    var rawY = isSelf ? local.y : (Number.isFinite(Number(player.y)) ? Number(player.y) : 0.2)
    var p = isSelf ? { x: local.x, y: local.y } : roomScene.resolveWalk(scene, player.x, rawY)
    var y = p.y
    var depth = 1 - y
    var size = Math.max(0.75, Math.min(1.35, Number(player.size) || 1))
    var scale = 0.84 + depth * 0.18
    node.classList.toggle('self', isSelf)
    node.style.left = (p.x * 100) + '%'
    node.setAttribute('data-y', y.toFixed(2))
    node.style.bottom = (12 + y * 58) + '%'
    node.style.zIndex = String(100 - Math.round(y * 100))
    node.style.setProperty('--s', String(size * scale))
    node.style.setProperty('--sh', String(0.8 + depth * 0.2))
    node.style.setProperty('--shadow-op', String(0.6 + depth * 0.3))
    parts.name.textContent = player.name
    parts.level.textContent = ' Lv.' + player.level
    parts.mark.textContent = player.host ? ' 👑' : (isSelf ? ' · 你' : '')
    parts.mark.className = player.host ? 'host' : (isSelf ? 'you' : '')
    var source = artUrl(player.art)
    if (source === '') {
      parts.img.hidden = true
      parts.emoji.hidden = false
      parts.emoji.textContent = typeof player.emoji === 'string' && player.emoji !== '' ? player.emoji : '🐖'
    } else {
      parts.emoji.hidden = true
      parts.img.hidden = false
      if (parts.img.getAttribute('data-art') !== source) {
        parts.img.setAttribute('data-art', source)
        parts.img.src = source
      }
    }
    parts.img.style.transform = (isSelf ? local.facing : player.facing) < 0 ? 'scaleX(-1)' : ''
  }

  function playEmote(player) {
    var at = Number(player.emoteAt) || 0
    if (at === 0 || Date.now() - at > 2600) return
    var previous = lastEmote.get(player.id) || 0
    if (at <= previous) return
    lastEmote.set(player.id, at)
    var targetId = typeof player.emoteTarget === 'string' && player.emoteTarget !== '' ? player.emoteTarget : player.id
    var node = nodes.get(player.emote === 'pat' ? targetId : player.id)
    if (node === undefined) return
    if (player.emote === 'pat') {
      var hearts = document.createElement('span')
      hearts.className = 'hearts'
      hearts.textContent = '💗'
      node.appendChild(hearts)
      setTimeout(function () { hearts.remove() }, 1250)
    }
    var className = 'emote-' + player.emote
    node.classList.remove('emote-wave', 'emote-pat', 'emote-jump')
    void node.offsetWidth
    node.classList.add(className)
    setTimeout(function () { node.classList.remove(className) }, 1700)
  }

  function render(next) {
    if (next === null || typeof next !== 'object') return
    var wasInRoom = snapshot !== null && snapshot.inRoom === true
    snapshot = next
    if (typeof next.selfId === 'string') selfId = next.selfId
    if (next.inRoom !== true) {
      statusText.textContent = '不在房间里'
      dot.classList.remove('on')
      codeWrap.hidden = true
      pigs.textContent = ''
      nodes.clear()
      return
    }
    statusText.textContent = next.players.length + ' 只猪联机中'
    dot.classList.add('on')
    codeWrap.hidden = false
    codeText.textContent = 'PIG-' + next.code
    if (!wasInRoom) hideHint()

    var players = Array.isArray(next.players) ? next.players : []
    var alive = new Set()
    var self = null
    for (var i = 0; i < players.length; i += 1) {
      var player = players[i]
      if (player === null || typeof player !== 'object' || typeof player.id !== 'string') continue
      alive.add(player.id)
      if (player.id === selfId) {
        self = player
        if (dragging === null && Date.now() - lastLocalAt > 400) {
          local.x = player.x
          local.facing = player.facing
        }
      }
      updatePig(player)
      playEmote(player)
    }
    for (var id of Array.from(nodes.keys())) {
      if (alive.has(id)) continue
      var dead = nodes.get(id)
      dead.remove()
      nodes.delete(id)
      lastEmote.delete(id)
    }
    if (self !== null) {
      var node = nodes.get(self.id)
      if (node !== undefined) node.style.left = (local.x * 100) + '%'
    }
  }

  function statusTextFor(reason) {
    if (reason === 'room-closed' || reason === 'host-left') return '房主关闭了房间'
    if (reason === 'connection-lost') return '和房间断开了'
    return '已离开房间'
  }

  function pat(id) {
    hideHint()
    var self = currentSelf()
    if (self === null) return
    Promise.resolve(room.emote('pat', id, local.x, local.y, local.facing)).catch(function () {})
  }

  function wave() {
    hideHint()
    Promise.resolve(room.emote('wave', '', local.x, local.y, local.facing)).catch(function () {})
  }

  stage.addEventListener('pointerdown', function (event) {
    var target = /** @type {any} */ (event.target)
    var node = target && target.closest ? target.closest('.pig') : null
    if (node === null) return
    var id = node.getAttribute('data-player')
    if (id === null) return
    dragging = { id: id, startX: event.clientX, startY: event.clientY, moved: false, pointer: event.pointerId }
    node.setPointerCapture?.(event.pointerId)
    if (id === selfId) {
      event.preventDefault()
      hideHint()
      roomScene.showWalkZone(2200)
    }
  })

  stage.addEventListener('pointermove', function (event) {
    if (dragging === null || event.pointerId !== dragging.pointer) return
    if (Math.abs(event.clientX - dragging.startX) > 4 || Math.abs(event.clientY - dragging.startY) > 4) dragging.moved = true
    if (dragging.id !== selfId) return
    var rect = stage.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    var x = (event.clientX - rect.left) / rect.width
    var screenY = (event.clientY - rect.top) / rect.height
    var y = roomScene.depthFromScreen(screenY)
    setLocal(x, y, event.clientX < dragging.startX ? -1 : 1)
  })

  function endDrag(event) {
    if (dragging === null || (event !== undefined && event.pointerId !== dragging.pointer)) return
    var finished = dragging
    dragging = null
    if (finished.id === selfId && finished.moved) {
      var self = currentSelf()
      if (self !== null) setLocal(local.x, local.y, local.facing)
    } else if (!finished.moved) {
      pat(finished.id)
    }
  }

  stage.addEventListener('pointerup', endDrag)
  stage.addEventListener('pointercancel', endDrag)

  document.addEventListener('keydown', function (event) {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].indexOf(event.key) < 0) return
    var target = /** @type {any} */ (event.target)
    if (target && target.tagName === 'INPUT') return
    event.preventDefault()
    hideHint()
    roomScene.showWalkZone(1800)
    var step = event.shiftKey ? 0.08 : 0.035
    var x = local.x
    var y = local.y
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') x += event.key === 'ArrowRight' ? step : -step
    else y += event.key === 'ArrowUp' ? step : -step
    setLocal(x, y, event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : local.facing)
  })

  var buttons = document.querySelectorAll('[data-emote]')
  for (var i = 0; i < buttons.length; i += 1) {
    buttons[i].addEventListener('click', function (event) {
      var name = /** @type {any} */ (event.currentTarget).getAttribute('data-emote')
      if (name === 'wave') wave()
      else if (name === 'pat') {
        var self = currentSelf()
        if (self !== null) pat(self.id)
      }
    })
  }

  copyButton.addEventListener('click', function () {
    if (snapshot === null || snapshot.inRoom !== true) return
    Promise.resolve(room.copy()).then(function (result) {
      toast(result && result.ok === true ? '房间码已复制' : '复制失败')
    }).catch(function () { toast('复制失败') })
  })

  var leaveBtn = /** @type {HTMLButtonElement} */ (leaveButton)
  leaveBtn.addEventListener('click', function () {
    leaveBtn.disabled = true
    Promise.resolve(room.leave()).catch(function () {}).then(function () {
      leaveBtn.disabled = false
    })
  })

  if (typeof room.onUpdate === 'function') room.onUpdate(render)
  if (typeof room.onClosed === 'function') {
    room.onClosed(function (detail) {
      statusText.textContent = statusTextFor(detail && detail.reason)
      dot.classList.remove('on')
      leaveBtn.disabled = true
    })
  }

  Promise.resolve(room.status()).then(function (status) {
    if (status && status.inRoom === true) render(status)
    else {
      statusText.textContent = '不在房间里'
      hint.textContent = '从面板的「联机」重新加入'
    }
  }).catch(function () {
    statusText.textContent = '联机不可用'
  })
})()
