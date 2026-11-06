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
  var previewPoly = /** @type {any} */ (document.getElementById('editor-preview-poly'))
  var editButton = document.getElementById('edit-map')
  var bar = document.querySelector('.map-editor-bar')
  var ui = /** @type {any} */ (null)
  var blockerEdit = /** @type {any} */ (null)
  var pen = /** @type {any} */ (null)
  var SVG = 'http://www.w3.org/2000/svg'
  var open = false
  var scene = 'pen'
  var shape = 'node'
  var mode = 'create'
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
    if (ui) ui.setUndoEnabled(true)
  }
  function commit() {
    api.setArea(scene, area)
    window.dispatchEvent(new Event('piggy-room-area-changed'))
  }
  function renderBlockers() {
    blockers.textContent = ''
    area.blockers.forEach(function (blocker, index) {
      var node
      if (blocker.type === 'rect') {
        node = document.createElementNS(SVG, 'rect')
        node.setAttribute('x', String(blocker.x0 * 100))
        node.setAttribute('y', String(blocker.y0 * 100))
        node.setAttribute('width', String((blocker.x1 - blocker.x0) * 100))
        node.setAttribute('height', String((blocker.y1 - blocker.y0) * 100))
      } else if (blocker.type === 'circle') {
        node = document.createElementNS(SVG, 'circle')
        node.setAttribute('cx', String(blocker.cx * 100))
        node.setAttribute('cy', String(blocker.cy * 100))
        node.setAttribute('r', String(blocker.r * 100))
      } else {
        node = document.createElementNS(SVG, 'polygon')
        node.setAttribute('points', blocker.points.map(function (point) {
          return (point[0] * 100).toFixed(2) + ',' + (point[1] * 100).toFixed(2)
        }).join(' '))
      }
      var selected = blockerEdit !== null && blockerEdit.selectedIndex() === index
      node.setAttribute('class', 'editor-blocker' + (blocker.hidden === true ? ' is-hidden' : '') + (selected ? ' is-selected' : ''))
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
      handle.addEventListener('contextmenu', function (event) {
        event.preventDefault()
        event.stopPropagation()
        removeVertex(index)
      })
      handles.appendChild(handle)
    })
    if (blockerEdit) blockerEdit.render()
  }
  function render() {
    outer.setAttribute('points', area.outer.map(function (point) {
      return (point[0] * 100).toFixed(2) + ',' + (point[1] * 100).toFixed(2)
    }).join(' '))
    renderBlockers()
    renderHandles()
  }
  function setStatus(text) { ui.setStatus(text) }
  function switchScene(next) {
    if (next !== 'pen' && next !== 'room') return
    var target = /** @type {any} */ (document.querySelector('#scene-switch [data-scene="' + next + '"]'))
    if (target) target.click()
    scene = next
    area = api.getArea(scene)
    history = []
    if (pen) pen.cancel()
    if (blockerEdit) blockerEdit.clear()
    ui.setUndoEnabled(false)
    ui.updateMapMenu(scene)
    ui.setState(shape, mode)
    render()
  }
  function setShape(next) {
    if (['node', 'rect', 'circle', 'lasso'].indexOf(next) < 0) return
    shape = next
    drawing = null
    if (pen) pen.cancel()
    if (blockerEdit) blockerEdit.clear()
    clearPreview()
    ui.setState(shape, mode)
    render()
  }
  function setMode(next) {
    if (['create', 'edit', 'delete'].indexOf(next) < 0) return
    mode = next
    drawing = null
    if (pen) pen.cancel()
    if (blockerEdit) blockerEdit.clear()
    clearPreview()
    ui.setState(shape, mode)
    render()
  }
  function clearPreview() {
    previewRect.setAttribute('hidden', '')
    previewCircle.setAttribute('hidden', '')
    previewPoly.setAttribute('hidden', '')
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
    } else if (drawing.type === 'circle') {
      var dx = point.x - drawing.cx
      var dy = point.y - drawing.cy
      previewCircle.setAttribute('cx', String(drawing.cx * 100))
      previewCircle.setAttribute('cy', String(drawing.cy * 100))
      previewCircle.setAttribute('r', String(Math.sqrt(dx * dx + dy * dy) * 100))
      previewCircle.removeAttribute('hidden')
      previewRect.setAttribute('hidden', '')
      previewPoly.setAttribute('hidden', '')
    }
  }
  function removeVertex(index) {
    if (area.outer.length <= 3) {
      setStatus('至少保留 3 个边界点。')
      setTimeout(function () { ui.setState(shape, mode) }, 1600)
      return
    }
    pushHistory()
    area.outer.splice(index, 1)
    commit()
    render()
  }

  function startVertex(event, index) {
    if (!open) return
    if (mode === 'delete') { removeVertex(index); return }
    if (mode !== 'edit' || shape !== 'node') return
    var moved = false
    drag = { index: index }
    function move(moveEvent) {
      if (drag === null) return
      if (!moved) { pushHistory(); moved = true }
      var point = pointAt(moveEvent)
      area.outer[drag.index] = [point.x, point.y]
      render()
    }
    function end() {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      if (drag !== null) {
        drag = null
        if (moved) commit()
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
  }
  function surfaceDown(event) {
    if (!open) return
    if (ui.anyMenuOpen()) { ui.closeMenus(); return }
    var target = /** @type {any} */ (event.target)
    if (target.closest && target.closest('.map-editor-bar, .map-handle, .blocker-handle')) return
    var point = pointAt(event)
    if (mode === 'create') {
      if (shape === 'node') {
        pushHistory()
        area.outer.push([point.x, point.y])
        commit()
        render()
        return
      }
      if (shape === 'lasso') {
        pen.pointerDown(event, point)
        return
      }
      drawing = shape === 'rect'
        ? { type: 'rect', x0: point.x, y0: point.y }
        : { type: 'circle', cx: point.x, cy: point.y }
      updatePreview(point)
      try { editor.setPointerCapture(event.pointerId) } catch { /* 旧内核 */ }
      return
    }
    if (mode === 'delete') {
      var index = api.hitBlocker(area, point.x, point.y)
      if (index >= 0) blockerEdit.remove(index)
      return
    }
    if (mode === 'edit' && shape !== 'node') {
      var editIndex = api.hitBlocker(area, point.x, point.y)
      if (editIndex >= 0) {
        blockerEdit.select(editIndex)
        render()
        blockerEdit.startDrag(editIndex, point)
      } else {
        blockerEdit.clear()
        render()
      }
    }
  }
  function surfaceMove(event) {
    if (!open) return
    var point = pointAt(event)
    if (pen.active()) {
      pen.pointerMove(event, point)
      return
    }
    if (drawing === null) return
    updatePreview(point)
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
    } else if (current.type === 'circle') {
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
    if (bar) bar.removeAttribute('hidden')
    ui.closeMenus()
    ui.updateMapMenu(scene)
    document.body.setAttribute('data-editing', 'true')
    editButton?.setAttribute('aria-pressed', 'true')
    if (editButton) editButton.textContent = '完成'
    shape = 'node'
    mode = 'create'
    pen.cancel()
    blockerEdit.clear()
    ui.setUndoEnabled(false)
    ui.setState(shape, mode)
    render()
  }
  function closeEditor() {
    if (!open) return
    open = false
    drag = null
    drawing = null
    pen.cancel()
    blockerEdit.clear()
    clearPreview()
    editor.hidden = true
    if (bar) bar.setAttribute('hidden', '')
    ui.closeMenus()
    ui.setStatus('')
    document.body.removeAttribute('data-editing')
    editButton?.setAttribute('aria-pressed', 'false')
    if (editButton) editButton.textContent = '边界'
    api.updateWalkZone(scene)
    window.dispatchEvent(new Event('piggy-room-area-changed'))
    api.showWalkZone(2200)
  }
  function runAction(action) {
    if (action === 'done') { closeEditor(); return }
    if (action === 'undo') {
      if (history.length === 0) return
      area = history.pop()
      pen.cancel()
      blockerEdit.clear()
      ui.setUndoEnabled(history.length > 0)
      commit()
      render()
      return
    }
    if (action === 'reset') {
      area = api.resetArea(scene)
      history = []
      pen.cancel()
      blockerEdit.clear()
      ui.setUndoEnabled(false)
      render()
      window.dispatchEvent(new Event('piggy-room-area-changed'))
    }
  }

  function addPenPolygon(points) {
    if (!Array.isArray(points) || points.length < 3) return
    pushHistory()
    area.blockers.push({ type: 'polygon', points: points })
    commit()
    render()
  }

  var penFactory = /** @type {any} */ (window).PiggyRoomEditorPen
  var blockerFactory = /** @type {any} */ (window).PiggyRoomEditorBlockers
  var editorUi = /** @type {any} */ (window).PiggyRoomEditorUI
  if (!penFactory || !blockerFactory || !editorUi) return
  pen = penFactory.create({
    addPolygon: addPenPolygon,
    isMenuOpen: function () { return ui !== null && ui.anyMenuOpen() },
  })
  blockerEdit = blockerFactory.create({
    handles: handles,
    getArea: function () { return area },
    isActive: function () { return open && mode === 'edit' && shape !== 'node' },
    pushHistory: pushHistory,
    commit: commit,
    render: render,
    pointAt: pointAt,
    shiftBlocker: api.shiftBlocker,
  })
  ui = editorUi.create({
    bar: bar,
    status: document.getElementById('editor-status'),
    onShape: setShape,
    onMode: setMode,
    onScene: switchScene,
    onAction: runAction,
  })
  ui.setUndoEnabled(false)
  editButton?.addEventListener('click', function () { if (open) closeEditor(); else openEditor() })
  editor?.addEventListener('pointerdown', surfaceDown)
  editor?.addEventListener('pointermove', surfaceMove)
  editor?.addEventListener('pointerup', surfaceUp)
  editor?.addEventListener('pointercancel', function () { drawing = null; clearPreview() })
})()
