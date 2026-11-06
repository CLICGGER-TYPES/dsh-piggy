// @ts-check
/** 手绘障碍画笔：点节点成多边形，Shift 吸附 45° 直线，点首点/点末点/回车闭合。 */
;(function () {
  function create(options) {
    var previewPoly = /** @type {any} */ (document.getElementById('editor-preview-poly'))
    var penPoints = document.getElementById('editor-pen-points')
    var draft = null
    var cursor = null
    var closedAt = 0

    function clamp01(value) { return Math.min(1, Math.max(0, value)) }
    function active() { return draft !== null }
    function cancel() {
      draft = null
      cursor = null
      if (previewPoly) previewPoly.setAttribute('hidden', '')
      if (penPoints) penPoints.textContent = ''
    }
    function snap(point, shift) {
      if (!shift || draft === null || draft.length === 0) return [point.x, point.y]
      var last = draft[draft.length - 1]
      var dx = point.x - last[0]
      var dy = point.y - last[1]
      var distance = Math.sqrt(dx * dx + dy * dy)
      if (distance < 0.001) return [point.x, point.y]
      var step = Math.PI / 4
      var angle = Math.round(Math.atan2(dy, dx) / step) * step
      return [clamp01(last[0] + Math.cos(angle) * distance), clamp01(last[1] + Math.sin(angle) * distance)]
    }
    function renderPoints() {
      if (!penPoints) return
      penPoints.textContent = ''
      if (draft === null) return
      draft.forEach(function (point, index) {
        var dot = document.createElement('span')
        dot.className = 'pen-point' + (index === 0 ? ' is-first' : '')
        dot.style.left = (point[0] * 100) + '%'
        dot.style.top = (point[1] * 100) + '%'
        penPoints.appendChild(dot)
      })
    }
    function render() {
      renderPoints()
      if (draft === null || previewPoly === null) return
      if (draft.length < 2) {
        previewPoly.setAttribute('hidden', '')
        return
      }
      var last = draft[draft.length - 1]
      var points = draft
      if (cursor !== null && (cursor[0] !== last[0] || cursor[1] !== last[1])) points = draft.concat([cursor])
      previewPoly.setAttribute('points', points.map(function (point) {
        return (point[0] * 100).toFixed(2) + ',' + (point[1] * 100).toFixed(2)
      }).join(' '))
      previewPoly.removeAttribute('hidden')
    }
    function close() {
      if (draft === null) return
      if (draft.length < 3) { cancel(); return }
      var points = draft.map(function (point) { return [point[0], point[1]] })
      closedAt = Date.now()
      cancel()
      options.addPolygon(points)
    }
    function pointerDown(event, point) {
      if (draft === null) {
        if (Date.now() - closedAt < 350) return
        draft = [[point.x, point.y]]
        cursor = [point.x, point.y]
        render()
        return
      }
      var next = snap(point, event.shiftKey)
      var first = draft[0]
      if (draft.length >= 3 && Math.abs(next[0] - first[0]) + Math.abs(next[1] - first[1]) < 0.025) {
        close()
        return
      }
      var last = draft[draft.length - 1]
      if (Math.abs(next[0] - last[0]) + Math.abs(next[1] - last[1]) < 0.006) {
        if (draft.length >= 3) close()
        return
      }
      draft.push(next)
      cursor = next
      render()
    }
    function pointerMove(event, point) {
      if (draft === null) return
      cursor = snap(point, event.shiftKey)
      render()
    }

    document.addEventListener('keydown', function (event) {
      if (!active()) return
      if (event.key === 'Escape') {
        if (options.isMenuOpen()) return
        cancel()
      } else if (event.key === 'Enter') {
        close()
      }
    })

    return {
      active: active,
      cancel: cancel,
      close: close,
      pointerDown: pointerDown,
      pointerMove: pointerMove,
    }
  }

  ;/** @type {any} */ (window).PiggyRoomEditorPen = { create: create }
})()
