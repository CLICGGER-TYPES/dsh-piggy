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

    function toggleHidden(index) {
      var area = options.getArea()
      var blocker = area.blockers[index]
      if (!blocker) return
      options.pushHistory()
      blocker.hidden = blocker.hidden !== true
      options.commit()
      options.render()
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
    }

    return {
      clear: clear,
      remove: remove,
      render: render,
      select: select,
      selectedIndex: selectedIndex,
      startDrag: startDrag,
      toggleHidden: toggleHidden,
    }
  }

  ;/** @type {any} */ (window).PiggyRoomEditorBlockers = { create: create }
})()
