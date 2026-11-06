// @ts-check
/** 联机房间的键盘移动和纸片人走路状态。 */
;(function () {
  function create(options) {
    var walking = false
    var timer = null

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

    document.addEventListener('keydown', function (event) {
      if (options.isEditing()) return
      if (event.ctrlKey || event.metaKey || event.altKey) return
      var target = /** @type {any} */ (event.target)
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      var key = event.key
      var lower = key.toLowerCase()
      var left = key === 'ArrowLeft' || lower === 'a'
      var right = key === 'ArrowRight' || lower === 'd'
      var up = key === 'ArrowUp' || lower === 'w'
      var down = key === 'ArrowDown' || lower === 's'
      if (!left && !right && !up && !down) return
      event.preventDefault()
      options.hideHint()
      var step = event.shiftKey ? 0.08 : 0.035
      var local = options.getLocal()
      if (left || right) {
        options.setLocal(local.x + (right ? step : -step), local.y, right ? 1 : -1)
      } else {
        options.setLocal(local.x, local.y + (up ? step : -step), local.facing)
      }
    })

    return { markWalking: markWalking, walking: function () { return walking } }
  }

  ;/** @type {any} */ (window).PiggyRoomWalkControls = { create: create }
})()
