// @ts-check
/** 联机房间的键盘移动和纸片人走路状态。 */
;(function () {
  function create(options) {
    var walking = false
    var timer = null
    var pressed = { left: false, right: false, up: false, down: false }
    var shift = false
    var raf = null
    var last = 0

    function markWalking() {
      walking = true
      var node = options.getSelfNode()
      if (node) node.classList.add('walking')
      if (timer !== null) clearTimeout(timer)
      timer = setTimeout(function () {
        timer = null
        walking = false
        var current = options.getSelfNode()
        if (current) current.classList.remove('walking')
      }, 170)
    }

    function anyDirection() {
      return pressed.left || pressed.right || pressed.up || pressed.down
    }
    function stop() {
      raf = null
      last = 0
      pressed.left = pressed.right = pressed.up = pressed.down = false
      shift = false
    }
    function frame(now) {
      if (options.isEditing()) { stop(); return }
      if (!anyDirection()) { raf = null; last = 0; return }
      var dt = last === 0 ? 1 / 60 : Math.min(0.05, (now - last) / 1000)
      last = now
      var dx = (pressed.right ? 1 : 0) - (pressed.left ? 1 : 0)
      var dy = (pressed.up ? 1 : 0) - (pressed.down ? 1 : 0)
      if (dx !== 0 || dy !== 0) {
        var length = Math.sqrt(dx * dx + dy * dy)
        var boost = shift ? 1.35 : 1
        var local = options.getLocal()
        options.setLocal(
          local.x + dx / length * 0.55 * boost * dt,
          local.y + dy / length * 0.45 * boost * dt,
          dx === 0 ? local.facing : dx > 0 ? 1 : -1,
        )
      }
      raf = window.requestAnimationFrame(frame)
    }
    function wake() {
      if (raf === null) {
        last = 0
        raf = window.requestAnimationFrame(frame)
      }
    }

    document.addEventListener('keydown', function (event) {
      if (options.isEditing()) return
      if (event.ctrlKey || event.metaKey || event.altKey) return
      var target = /** @type {any} */ (event.target)
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      var key = event.key
      var lower = key.toLowerCase()
      var direction = key === 'ArrowLeft' || lower === 'a' ? 'left'
        : key === 'ArrowRight' || lower === 'd' ? 'right'
          : key === 'ArrowUp' || lower === 'w' ? 'up'
            : key === 'ArrowDown' || lower === 's' ? 'down' : ''
      if (direction === '') return
      event.preventDefault()
      options.hideHint()
      shift = event.shiftKey
      pressed[direction] = true
      wake()
    })

    document.addEventListener('keyup', function (event) {
      var key = event.key
      var lower = key.toLowerCase()
      if (key === 'ArrowLeft' || lower === 'a') pressed.left = false
      else if (key === 'ArrowRight' || lower === 'd') pressed.right = false
      else if (key === 'ArrowUp' || lower === 'w') pressed.up = false
      else if (key === 'ArrowDown' || lower === 's') pressed.down = false
      shift = event.shiftKey
    })

    window.addEventListener('blur', stop)

    return { markWalking: markWalking, walking: function () { return walking } }
  }

  ;/** @type {any} */ (window).PiggyRoomWalkControls = { create: create }
})()
