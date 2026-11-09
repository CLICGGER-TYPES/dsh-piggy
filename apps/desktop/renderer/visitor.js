// @ts-check
/** 桌面上的朋友猪：只负责画猪、摸摸、拖动和打开正式面板；状态/居民卡都在面板里。 */
;(function () {
  var shell = /** @type {any} */ (window).piggyShell
  var api = shell && shell.visitor ? shell.visitor : null
  var root = document.getElementById('visitor')
  var art = /** @type {HTMLImageElement} */ (document.getElementById('art'))
  var emoji = document.getElementById('emoji')
  var nameEl = document.getElementById('name')
  var levelEl = document.getElementById('level')
  var pig = document.getElementById('pig')
  var pat = document.getElementById('pat')
  var toastEl = document.getElementById('toast')

  /** 和本机猪保持一样大：宠物页把实际猪盒边长写进同一个 origin 的 localStorage。 */
  var SIZE_KEY = 'dsh-piggy:pig-display-size'
  function reportPigRect() {
    if (!api || typeof api.size !== 'function') return
    var rect = pig.getBoundingClientRect()
    api.size({ x: rect.x, y: rect.y, width: rect.width, height: rect.height })
  }
  function syncPigSize() {
    try {
      var size = Number(localStorage.getItem(SIZE_KEY))
      if (!Number.isFinite(size) || size < 40) return
      size = Math.max(40, Math.min(128, size))
      document.documentElement.style.setProperty('--vp-size', size + 'px')
    } catch (error) { /* private mode */ }
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(reportPigRect)
    else setTimeout(reportPigRect, 0)
  }
  syncPigSize()
  window.addEventListener('resize', reportPigRect)
  window.addEventListener('storage', function (event) {
    if (event.key === SIZE_KEY) syncPigSize()
  })

  /** @type {any} */
  var player = null
  var toastTimer = null
  var drag = null
  var suppressClick = false

  function text(value, fallback) {
    return typeof value === 'string' && value !== '' ? value : fallback
  }

  function render() {
    if (player === null) return
    var name = text(player.name, '小猪')
    var level = Number(player.level) || 1
    nameEl.textContent = name
    levelEl.textContent = 'Lv.' + level
    var url = text(player.art, '')
    if (url !== '') {
      art.src = '/dsh-piggy/art/' + url
      art.hidden = false
      emoji.hidden = true
    } else {
      art.hidden = true
      emoji.hidden = false
      emoji.textContent = text(player.emoji, '🐖')
    }
    document.title = name + ' · 朋友的小猪'
  }

  function showToast(message) {
    if (typeof message !== 'string' || message === '') return
    toastEl.textContent = message
    toastEl.hidden = false
    if (toastTimer !== null) clearTimeout(toastTimer)
    toastTimer = setTimeout(function () {
      toastTimer = null
      toastEl.hidden = true
    }, 2200)
  }

  function patPig() {
    if (player === null) return
    pat.hidden = false
    pig.setAttribute('data-pat', 'true')
    if (api && typeof api.pat === 'function') {
      Promise.resolve(api.pat()).then(function (result) {
        if (result && result.ok === false && typeof result.reason === 'string') showToast(result.reason)
      }).catch(function () { /* 表情没发出去不影响本地摸摸 */ })
    }
    setTimeout(function () {
      pig.setAttribute('data-pat', 'false')
      pat.hidden = true
    }, 900)
  }

  function openPanel() {
    if (!api || typeof api.view !== 'function') {
      showToast('面板暂不可用')
      return
    }
    var box = pig.getBoundingClientRect()
    Promise.resolve(api.view({ x: box.x, y: box.y, width: box.width, height: box.height })).then(function (result) {
      if (result && result.ok === false) showToast(result.reason || '打不开面板')
    }).catch(function () { showToast('打不开面板') })
  }

  function endPointerDrag(commit) {
    if (drag === null) return
    var wasMoved = drag.moved
    drag = null
    pig.removeAttribute('data-dragging')
    if (wasMoved && api && typeof api.dragEnd === 'function') api.dragEnd()
    if (commit && !wasMoved) patPig()
  }

  pig.addEventListener('pointerdown', function (event) {
    if (event.button !== 0) return
    drag = { id: event.pointerId, x: event.screenX, y: event.screenY, moved: false }
    try { pig.setPointerCapture(event.pointerId) } catch { /* 旧浏览器没有指针捕获 */ }
  })

  pig.addEventListener('pointermove', function (event) {
    if (drag === null || event.pointerId !== drag.id || drag.moved) return
    var dx = event.screenX - drag.x
    var dy = event.screenY - drag.y
    if (dx * dx + dy * dy < 16) return
    drag.moved = true
    suppressClick = true
    pig.setAttribute('data-dragging', 'true')
    if (api && typeof api.dragStart === 'function') api.dragStart()
  })

  pig.addEventListener('pointerup', function (event) {
    if (drag === null || event.pointerId !== drag.id) return
    try { pig.releasePointerCapture(event.pointerId) } catch { /* 已经释放 */ }
    endPointerDrag(!suppressClick)
    suppressClick = false
  })

  pig.addEventListener('pointercancel', function () {
    try { if (drag !== null) pig.releasePointerCapture(drag.id) } catch { /* 已经释放 */ }
    endPointerDrag(false)
  })

  document.addEventListener('contextmenu', function (event) {
    event.preventDefault()
    openPanel()
  })

  art.addEventListener('error', function () {
    art.hidden = true
    emoji.hidden = false
    emoji.textContent = text(player && player.emoji, '🐖')
  })

  if (api && typeof api.onUpdate === 'function') {
    api.onUpdate(function (next) {
      if (next === null || typeof next !== 'object') return
      player = next
      render()
    })
  }
  if (api && typeof api.get === 'function') {
    Promise.resolve(api.get()).then(function (next) {
      if (next === null || typeof next !== 'object') return
      player = next
      render()
    }).catch(function () { /* 主进程还没准备好 */ })
  }

  window.addEventListener('blur', function () {
    if (drag !== null) endPointerDrag(false)
  })
  root.addEventListener('selectstart', function (event) { event.preventDefault() })
})()
