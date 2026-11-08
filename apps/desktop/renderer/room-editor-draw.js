// @ts-check
/** 边界编辑器里的矩形/圆形拖画：从左上往右下拖出包围盒。 */
;(function () {
  function create() {
    var rectEl = /** @type {any} */ (document.getElementById('editor-preview-rect'))
    var circleEl = /** @type {any} */ (document.getElementById('editor-preview-circle'))
    var drawing = null

    function hide() {
      if (rectEl) rectEl.setAttribute('hidden', '')
      if (circleEl) circleEl.setAttribute('hidden', '')
    }
    function update(point) {
      if (drawing === null) return
      var x0 = Math.min(drawing.x0, point.x)
      var y0 = Math.min(drawing.y0, point.y)
      var x1 = Math.max(drawing.x0, point.x)
      var y1 = Math.max(drawing.y0, point.y)
      if (drawing.type === 'rect') {
        rectEl.setAttribute('x', String(x0 * 100))
        rectEl.setAttribute('y', String(y0 * 100))
        rectEl.setAttribute('width', String((x1 - x0) * 100))
        rectEl.setAttribute('height', String((y1 - y0) * 100))
        rectEl.removeAttribute('hidden')
        circleEl.setAttribute('hidden', '')
      } else {
        circleEl.setAttribute('cx', String((x0 + x1) / 2 * 100))
        circleEl.setAttribute('cy', String((y0 + y1) / 2 * 100))
        circleEl.setAttribute('r', String(Math.min(x1 - x0, y1 - y0) / 2 * 100))
        circleEl.removeAttribute('hidden')
        rectEl.setAttribute('hidden', '')
      }
    }
    function begin(type, point) {
      if (type !== 'rect' && type !== 'circle') return false
      drawing = { type: type, x0: point.x, y0: point.y }
      update(point)
      return true
    }
    function move(point) {
      if (drawing !== null) update(point)
    }
    function finish(point) {
      if (drawing === null) return null
      var current = drawing
      drawing = null
      hide()
      var x0 = Math.min(current.x0, point.x)
      var x1 = Math.max(current.x0, point.x)
      var y0 = Math.min(current.y0, point.y)
      var y1 = Math.max(current.y0, point.y)
      if (current.type === 'rect') {
        if (x1 - x0 < 0.015 || y1 - y0 < 0.015) return null
        return { type: 'rect', x0: x0, x1: x1, y0: y0, y1: y1 }
      }
      var r = Math.min(x1 - x0, y1 - y0) / 2
      if (r < 0.008) return null
      return { type: 'circle', cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, r: r }
    }
    function cancel() {
      drawing = null
      hide()
    }
    function active() { return drawing !== null }

    return { active: active, begin: begin, cancel: cancel, finish: finish, move: move }
  }

  ;/** @type {any} */ (window).PiggyRoomEditorDraw = { create: create }
})()
