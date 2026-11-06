// @ts-check
/** 联机房间的地图边界编辑器：直接在地面上画外边界和家具障碍。 */
;(function () {
  var api = /** @type {any} */ (window).PiggyRoomScene
  if (!api) return
  var stage = document.getElementById('stage')
  var editor = document.getElementById('map-editor')
  var outer = document.getElementById('editor-outer')
  var blockers = document.getElementById('editor-blockers')
  var handles = document.getElementById('map-editor-handles')
  var previewRect = /** @type {any} */ (document.getElementById('editor-preview-rect'))
  var previewCircle = /** @type {any} */ (document.getElementById('editor-preview-circle'))
  var editButton = document.getElementById('edit-map')
  var bar = document.querySelector('.map-editor-bar')
  var hint = document.querySelector('.map-editor-hint')
  var SVG = 'http://www.w3.org/2000/svg'
  var open = false
  var scene = 'pen'
  var tool = 'outer'
  var area = null
  var history = []
  var drag = null
  var drawing = null

  function clone(value) { return JSON.parse(JSON.stringify(value)) }
  function currentScene() { return stage.getAttribute('data-scene') === 'room' ? 'room' : 'pen' }
  function pointAt(event) {
    var rect = stage.getBoundingClientRect()
    return {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / Math.max(1, rect.width))),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / Math.max(1, rect.height))),
    }
  }
  function pushHistory() {
    history.push(clone(area))
    if (history.length > 40) history.shift()
  }
  function commit() {
    api.setArea(scene, area)
    window.dispatchEvent(new Event('piggy-room-area-changed'))
  }
  function renderBlockers() {
    blockers.textContent = ''
    area.blockers.forEach(function (blocker) {
      var node
      if (blocker.type === 'rect') {
        node = document.createElementNS(SVG, 'rect')
        node.setAttribute('x', String(blocker.x0 * 100))
        node.setAttribute('y', String(blocker.y0 * 100))
        node.setAttribute('width', String((blocker.x1 - blocker.x0) * 100))
        node.setAttribute('height', String((blocker.y1 - blocker.y0) * 100))
      } else {
        node = document.createElementNS(SVG, 'circle')
        node.setAttribute('cx', String(blocker.cx * 100))
        node.setAttribute('cy', String(blocker.cy * 100))
        node.setAttribute('r', String(blocker.r * 100))
      }
      node.setAttribute('class', 'editor-blocker')
      blockers.appendChild(node)
    })
  }
  function renderHandles() {
    handles.textContent = ''
    area.outer.forEach(function (point, index) {
      var handle = document.createElement('button')
      handle.type = 'button'
      handle.className = 'map-handle'
      handle.style.left = (point[0] * 100) + '%'
      handle.style.top = (point[1] * 100) + '%'
      handle.setAttribute('data-index', String(index))
      handle.setAttribute('aria-label', '边界点 ' + (index + 1))
      handle.addEventListener('pointerdown', function (event) {
        event.preventDefault()
        event.stopPropagation()
        startVertex(event, index)
      })
      handles.appendChild(handle)
    })
  }
  function render() {
    outer.setAttribute('points', area.outer.map(function (point) {
      return (point[0] * 100).toFixed(2) + ',' + (point[1] * 100).toFixed(2)
    }).join(' '))
    renderBlockers()
    renderHandles()
  }
  function setTool(next) {
    tool = next
    var buttons = bar.querySelectorAll('[data-edit-tool]')
    for (var i = 0; i < buttons.length; i += 1) {
      buttons[i].setAttribute('aria-pressed', String(buttons[i].getAttribute('data-edit-tool') === tool))
    }
    hint.textContent = tool === 'outer'
      ? '点地面加边界点，拖动圆点调整；完成后关闭。'
      : tool === 'delete' ? '点一个障碍把它删掉。'
        : tool === 'rect' ? '在地面上拖出一个矩形障碍。' : '在地面上拖出一个圆形障碍。'
  }
  function hitBlocker(x, y) {
    for (var i = area.blockers.length - 1; i >= 0; i -= 1) {
      var b = area.blockers[i]
      if (b.type === 'rect') {
        if (x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1) return i
      } else {
        var dx = x - b.cx
        var dy = y - b.cy
        if (dx * dx + dy * dy <= b.r * b.r) return i
      }
    }
    return -1
  }
  function clearPreview() {
    previewRect.setAttribute('hidden', '')
    previewCircle.setAttribute('hidden', '')
  }
  function updatePreview(point) {
    if (drawing === null) return
    if (drawing.type === 'rect') {
      var x0 = Math.min(drawing.x0, point.x)
      var y0 = Math.min(drawing.y0, point.y)
      var x1 = Math.max(drawing.x0, point.x)
      var y1 = Math.max(drawing.y0, point.y)
      previewRect.setAttribute('x', String(x0 * 100))
      previewRect.setAttribute('y', String(y0 * 100))
      previewRect.setAttribute('width', String((x1 - x0) * 100))
      previewRect.setAttribute('height', String((y1 - y0) * 100))
      previewRect.removeAttribute('hidden')
      previewCircle.setAttribute('hidden', '')
    } else {
      var dx = point.x - drawing.cx
      var dy = point.y - drawing.cy
      previewCircle.setAttribute('cx', String(drawing.cx * 100))
      previewCircle.setAttribute('cy', String(drawing.cy * 100))
      previewCircle.setAttribute('r', String(Math.sqrt(dx * dx + dy * dy) * 100))
      previewCircle.removeAttribute('hidden')
      previewRect.setAttribute('hidden', '')
    }
  }
  function startVertex(event, index) {
    if (!open) return
    pushHistory()
    drag = { index: index }
    function move(moveEvent) {
      if (drag === null) return
      var point = pointAt(moveEvent)
      area.outer[drag.index] = [point.x, point.y]
      render()
    }
    function end() {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      if (drag !== null) { drag = null; commit() }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
  }
  function surfaceDown(event) {
    if (!open) return
    var target = /** @type {any} */ (event.target)
    if (target.closest && target.closest('.map-editor-bar, .map-handle')) return
    var point = pointAt(event)
    if (tool === 'outer') {
      pushHistory()
      area.outer.push([point.x, point.y])
      commit()
      render()
      return
    }
    if (tool === 'delete') {
      var index = hitBlocker(point.x, point.y)
      if (index >= 0) {
        pushHistory()
        area.blockers.splice(index, 1)
        commit()
        render()
      }
      return
    }
    drawing = tool === 'rect'
      ? { type: 'rect', x0: point.x, y0: point.y }
      : { type: 'circle', cx: point.x, cy: point.y }
    updatePreview(point)
    try { editor.setPointerCapture(event.pointerId) } catch { /* 旧内核 */ }
  }
  function surfaceMove(event) {
    if (!open || drawing === null) return
    updatePreview(pointAt(event))
  }
  function surfaceUp(event) {
    if (!open || drawing === null) return
    var point = pointAt(event)
    var current = drawing
    drawing = null
    clearPreview()
    if (current.type === 'rect') {
      var x0 = Math.min(current.x0, point.x)
      var x1 = Math.max(current.x0, point.x)
      var y0 = Math.min(current.y0, point.y)
      var y1 = Math.max(current.y0, point.y)
      if (x1 - x0 < 0.015 || y1 - y0 < 0.015) return
      pushHistory()
      area.blockers.push({ type: 'rect', x0: x0, x1: x1, y0: y0, y1: y1 })
    } else {
      var dx = point.x - current.cx
      var dy = point.y - current.cy
      var r = Math.sqrt(dx * dx + dy * dy)
      if (r < 0.015) return
      pushHistory()
      area.blockers.push({ type: 'circle', cx: current.cx, cy: current.cy, r: r })
    }
    commit()
    render()
  }
  function openEditor() {
    if (open) return
    scene = currentScene()
    area = api.getArea(scene)
    history = []
    open = true
    editor.hidden = false
    document.body.setAttribute('data-editing', 'true')
    editButton?.setAttribute('aria-pressed', 'true')
    if (editButton) editButton.textContent = '完成'
    setTool('outer')
    render()
  }
  function closeEditor() {
    if (!open) return
    open = false
    drag = null
    drawing = null
    clearPreview()
    editor.hidden = true
    document.body.removeAttribute('data-editing')
    editButton?.setAttribute('aria-pressed', 'false')
    if (editButton) editButton.textContent = '边界'
    api.updateWalkZone(scene)
    window.dispatchEvent(new Event('piggy-room-area-changed'))
    api.showWalkZone(2200)
  }
  editButton?.addEventListener('click', function () { if (open) closeEditor(); else openEditor() })
  editor?.addEventListener('pointerdown', surfaceDown)
  editor?.addEventListener('pointermove', surfaceMove)
  editor?.addEventListener('pointerup', surfaceUp)
  editor?.addEventListener('pointercancel', function () { drawing = null; clearPreview() })
  bar?.querySelectorAll('[data-edit-tool]').forEach(function (button) {
    button.addEventListener('click', function () { setTool(button.getAttribute('data-edit-tool')) })
  })
  bar?.querySelector('[data-edit-action="undo"]')?.addEventListener('click', function () {
    if (history.length === 0) return
    area = history.pop()
    commit()
    render()
  })
  bar?.querySelector('[data-edit-action="reset"]')?.addEventListener('click', function () {
    area = api.resetArea(scene)
    history = []
    render()
    window.dispatchEvent(new Event('piggy-room-area-changed'))
  })
  bar?.querySelector('[data-edit-action="done"]')?.addEventListener('click', closeEditor)
})()
