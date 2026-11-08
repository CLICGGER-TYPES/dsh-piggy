// @ts-check
/** 边界编辑器里的障碍编辑：选中高亮、拖动整块、拖节点改形状。 */
;(function () {
  function create(options) {
    var handles = options.handles
    var selected = -1

    function points(blocker) {
      if (blocker.type === 'rect') {
        return [[blocker.x0, blocker.y0], [blocker.x1, blocker.y0], [blocker.x1, blocker.y1], [blocker.x0, blocker.y1]]
      }
      if (blocker.type === 'circle') {
        var list = []
        for (var i = 0; i < 12; i += 1) {
          var angle = -Math.PI / 2 + i * Math.PI / 6
          list.push([blocker.cx + Math.cos(angle) * blocker.r, blocker.cy + Math.sin(angle) * blocker.r])
        }
        return list
      }
      return blocker.points.map(function (point) { return [point[0], point[1]] })
    }
    function valid() {
      var area = options.getArea()
      return selected >= 0 && selected < area.blockers.length
    }
    function select(index) { selected = index }
    function clear() { selected = -1 }
    function selectedIndex() { return selected }

    function bounds(blocker) {
      if (blocker.type === 'rect') {
        return { x0: blocker.x0, y0: blocker.y0, x1: blocker.x1, y1: blocker.y1 }
      }
      if (blocker.type === 'circle') {
        return { x0: blocker.cx - blocker.r, y0: blocker.cy - blocker.r, x1: blocker.cx + blocker.r, y1: blocker.cy + blocker.r }
      }
      var x0 = 1, y0 = 1, x1 = 0, y1 = 0
      blocker.points.forEach(function (point) {
        x0 = Math.min(x0, point[0])
        y0 = Math.min(y0, point[1])
        x1 = Math.max(x1, point[0])
        y1 = Math.max(y1, point[1])
      })
      return { x0: x0, y0: y0, x1: x1, y1: y1 }
    }
    function scaleBlocker(source, anchorX, anchorY, scale) {
      var next = JSON.parse(JSON.stringify(source))
      if (next.type === 'rect') {
        next.x0 = anchorX + (next.x0 - anchorX) * scale
        next.x1 = anchorX + (next.x1 - anchorX) * scale
        next.y0 = anchorY + (next.y0 - anchorY) * scale
        next.y1 = anchorY + (next.y1 - anchorY) * scale
      } else if (next.type === 'circle') {
        next.cx = anchorX + (next.cx - anchorX) * scale
        next.cy = anchorY + (next.cy - anchorY) * scale
        next.r *= scale
      } else {
        next.points = next.points.map(function (point) {
          return [anchorX + (point[0] - anchorX) * scale, anchorY + (point[1] - anchorY) * scale]
        })
      }
      return next
    }

    function startScale(corner) {
      if (!options.isActive() || !valid()) return
      var area = options.getArea()
      var source = JSON.parse(JSON.stringify(area.blockers[selected]))
      var box = bounds(source)
      var anchorX = corner.indexOf('w') >= 0 ? box.x1 : box.x0
      var anchorY = corner.indexOf('n') >= 0 ? box.y1 : box.y0
      var spanX = Math.max(0.001, box.x1 - box.x0)
      var spanY = Math.max(0.001, box.y1 - box.y0)
      var maxScale = Math.min(
        corner.indexOf('w') >= 0 ? box.x1 / spanX : (1 - box.x0) / spanX,
        corner.indexOf('n') >= 0 ? box.y1 / spanY : (1 - box.y0) / spanY,
      )
      var changed = false
      function move(event) {
        var point = options.pointAt(event)
        var scaleX = corner.indexOf('w') >= 0 ? (anchorX - point.x) / spanX : (point.x - anchorX) / spanX
        var scaleY = corner.indexOf('n') >= 0 ? (anchorY - point.y) / spanY : (point.y - anchorY) / spanY
        var scale = Math.max(0.06, Math.min(maxScale, Math.max(scaleX, scaleY)))
        if (!changed) {
          options.pushHistory()
          changed = true
        }
        area.blockers[selected] = scaleBlocker(source, anchorX, anchorY, scale)
        options.render()
      }
      function end() {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', end)
        if (changed) options.commit()
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', end)
    }

    function startVertex(index, pointIndex) {
      if (!options.isActive()) return
      var area = options.getArea()
      if (!area.blockers[index]) return
      selected = index
      var changed = false
      var list = null
      function prepare() {
        if (changed) return
        options.pushHistory()
        var blocker = area.blockers[index]
        if (blocker.type !== 'polygon') {
          var next = { type: 'polygon', points: points(blocker) }
          if (blocker.hidden === true) next.hidden = true
          area.blockers[index] = next
          blocker = next
        }
        list = blocker.points
        changed = true
      }
      function move(event) {
        prepare()
        if (!changed) return
        var point = options.pointAt(event)
        list[pointIndex] = [point.x, point.y]
        options.render()
      }
      function end() {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', end)
        if (changed) options.commit()
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', end)
      options.render()
    }

    function startDrag(index, startPoint) {
      if (!options.isActive()) return
      var area = options.getArea()
      var source = JSON.parse(JSON.stringify(area.blockers[index]))
      var changed = false
      function move(event) {
        if (!changed) {
          options.pushHistory()
          changed = true
        }
        var point = options.pointAt(event)
        area.blockers[index] = options.shiftBlocker(source, point.x - startPoint.x, point.y - startPoint.y)
        options.render()
      }
      function end() {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', end)
        if (changed) options.commit()
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', end)
    }

    function remove(index) {
      var area = options.getArea()
      if (!area.blockers[index]) return
      options.pushHistory()
      clear()
      area.blockers.splice(index, 1)
      options.commit()
      options.render()
    }

    function render() {
      if (!handles || !options.isActive() || !valid()) return
      var blocker = options.getArea().blockers[selected]
      var box = bounds(blocker)
      var outline = document.createElement('div')
      outline.className = 'selection-box'
      outline.style.left = (box.x0 * 100) + '%'
      outline.style.top = (box.y0 * 100) + '%'
      outline.style.width = ((box.x1 - box.x0) * 100) + '%'
      outline.style.height = ((box.y1 - box.y0) * 100) + '%'
      handles.appendChild(outline)
      points(blocker).forEach(function (point, index) {
        var handle = document.createElement('button')
        handle.type = 'button'
        handle.className = 'blocker-handle'
        handle.style.left = (point[0] * 100) + '%'
        handle.style.top = (point[1] * 100) + '%'
        handle.setAttribute('aria-label', '障碍节点 ' + (index + 1))
        handle.addEventListener('pointerdown', function (event) {
          event.preventDefault()
          event.stopPropagation()
          startVertex(selected, index)
        })
        handles.appendChild(handle)
      })
      ;['nw', 'ne', 'sw', 'se'].forEach(function (corner) {
        var handle = document.createElement('button')
        handle.type = 'button'
        handle.className = 'scale-handle ' + corner
        handle.style.left = ((corner.indexOf('w') >= 0 ? box.x0 : box.x1) * 100) + '%'
        handle.style.top = ((corner.indexOf('n') >= 0 ? box.y0 : box.y1) * 100) + '%'
        handle.setAttribute('aria-label', '等比例缩放 ' + corner)
        handle.addEventListener('pointerdown', function (event) {
          event.preventDefault()
          event.stopPropagation()
          startScale(corner)
        })
        handles.appendChild(handle)
      })
    }

    return {
      clear: clear,
      remove: remove,
      render: render,
      select: select,
      selectedIndex: selectedIndex,
      startDrag: startDrag,
    }
  }

  ;/** @type {any} */ (window).PiggyRoomEditorBlockers = { create: create }
})()
