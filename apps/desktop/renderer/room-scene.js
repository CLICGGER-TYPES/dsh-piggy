// @ts-check
/** 联机房间的 2.5D 地面范围：按场景画可行走区、挡在家具/小屋/池塘上，并显示边界。 */
;(function () {
  var walkZone = document.getElementById('walk-zone')
  var walkShape = document.getElementById('walk-zone-shape')
  var walkTimer = null
  var FRONT = 0.98
  var BACK = 0.02
  var SPAN = FRONT - BACK
  /** 屏幕坐标（x 0..1 左到右，y 0..1 上到下）里圈出的整块地面；家具再单独挡。 */
  var AREAS = {
    room: {
      outer: [
        [0.035, 0.500], [0.385, 0.258], [0.642, 0.292], [0.889, 0.483],
        [0.944, 0.567], [0.820, 0.700], [0.751, 0.833], [0.593, 0.867],
        [0.395, 0.858], [0.198, 0.833], [0.059, 0.817], [0.020, 0.633],
      ],
      blockers: [
        { type: 'rect', x0: 0.040, x1: 0.290, y0: 0.440, y1: 0.700 }, // 书架
        { type: 'rect', x0: 0.470, x1: 0.760, y0: 0.420, y1: 0.630 }, // 书桌
        { type: 'rect', x0: 0.560, x1: 0.700, y0: 0.550, y1: 0.710 }, // 椅子
        { type: 'rect', x0: 0.820, x1: 0.990, y0: 0.470, y1: 0.710 }, // 沙发
        { type: 'circle', cx: 0.270, cy: 0.490, r: 0.055 }, // 盆栽
      ],
    },
    pen: {
      outer: [
        [0.109, 0.300], [0.385, 0.150], [0.692, 0.158], [0.889, 0.267],
        [0.919, 0.383], [0.889, 0.500], [0.751, 0.733], [0.593, 0.833],
        [0.395, 0.867], [0.217, 0.817], [0.119, 0.700], [0.084, 0.500],
        [0.089, 0.367],
      ],
      blockers: [
        { type: 'rect', x0: 0.020, x1: 0.400, y0: 0.100, y1: 0.500 }, // 小屋
        { type: 'circle', cx: 0.790, cy: 0.600, r: 0.140 }, // 池塘
        { type: 'circle', cx: 0.790, cy: 0.250, r: 0.130 }, // 树
        { type: 'circle', cx: 0.180, cy: 0.790, r: 0.070 }, // 左下灌木
        { type: 'circle', cx: 0.120, cy: 0.550, r: 0.060 }, // 左侧灌木
        { type: 'circle', cx: 0.880, cy: 0.780, r: 0.070 }, // 右下灌木
      ],
    },
  }

  var STORAGE_KEY = 'dsh-piggy:room-walk-areas'
  var DEFAULTS = JSON.parse(JSON.stringify(AREAS))

  function clone(value) { return JSON.parse(JSON.stringify(value)) }

  function normalizeArea(input) {
    if (input === null || typeof input !== 'object') return null
    var outer = Array.isArray(input.outer) ? input.outer : []
    if (outer.length < 3) return null
    var points = []
    for (var i = 0; i < outer.length; i += 1) {
      var p = outer[i]
      if (!Array.isArray(p) || p.length < 2) return null
      var x = Number(p[0])
      var y = Number(p[1])
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null
      points.push([Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y))])
    }
    var blockers = []
    var raw = Array.isArray(input.blockers) ? input.blockers : []
    for (var j = 0; j < raw.length; j += 1) {
      var b = raw[j]
      if (b === null || typeof b !== 'object') continue
      if (b.type === 'rect') {
        var x0 = Number(b.x0), x1 = Number(b.x1), y0 = Number(b.y0), y1 = Number(b.y1)
        if (![x0, x1, y0, y1].every(Number.isFinite)) continue
        var rect = { type: 'rect', x0: Math.min(x0, x1), x1: Math.max(x0, x1), y0: Math.min(y0, y1), y1: Math.max(y0, y1) }
        if (b.hidden === true) rect.hidden = true
        blockers.push(rect)
      } else if (b.type === 'circle') {
        var cx = Number(b.cx), cy = Number(b.cy), r = Number(b.r)
        if (![cx, cy, r].every(Number.isFinite) || r <= 0) continue
        var circle = { type: 'circle', cx: cx, cy: cy, r: r }
        if (b.hidden === true) circle.hidden = true
        blockers.push(circle)
      } else if (b.type === 'polygon') {
        var rawPoints = Array.isArray(b.points) ? b.points : []
        if (rawPoints.length < 3) continue
        var polygon = []
        for (var k = 0; k < rawPoints.length; k += 1) {
          var q = rawPoints[k]
          if (!Array.isArray(q) || q.length < 2) { polygon = []; break }
          var qx = Number(q[0]), qy = Number(q[1])
          if (!Number.isFinite(qx) || !Number.isFinite(qy)) { polygon = []; break }
          polygon.push([Math.min(1, Math.max(0, qx)), Math.min(1, Math.max(0, qy))])
        }
        if (polygon.length >= 3) {
          var poly = { type: 'polygon', points: polygon }
          if (b.hidden === true) poly.hidden = true
          blockers.push(poly)
        }
      }
    }
    return { outer: points, blockers: blockers }
  }

  function loadSaved() {
    try {
      var raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
      if (raw === null || typeof raw !== 'object') return
      ;['pen', 'room'].forEach(function (key) {
        var next = normalizeArea(raw[key])
        if (next !== null) AREAS[key] = next
      })
    } catch { /* 自定义数据坏了就用默认 */ }
  }

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ pen: AREAS.pen, room: AREAS.room })) } catch { /* 存不了就只改本次 */ }
  }

  function getArea(scene) { return clone(area(scene)) }

  function setArea(scene, input) {
    var next = normalizeArea(input)
    if (next === null) return false
    AREAS[scene] = next
    persist()
    updateWalkZone(scene)
    return true
  }

  function resetArea(scene) {
    AREAS[scene] = clone(DEFAULTS[scene])
    persist()
    updateWalkZone(scene)
    return getArea(scene)
  }

  function area(scene) { return AREAS[scene] || AREAS.pen }
  function clamp01(v) { return Math.min(1, Math.max(0, v)) }

  /** 2.5D 深度（0 前、1 后）→ 屏幕 y。 */
  function screenFromDepth(y) { return FRONT - clamp01(y) * SPAN }
  function depthFromScreen(screenY) { return clamp01((FRONT - screenY) / SPAN) }

  function inPolygon(points, x, y) {
    var inside = false
    for (var i = 0, j = points.length - 1; i < points.length; j = i++) {
      var xi = points[i][0], yi = points[i][1]
      var xj = points[j][0], yj = points[j][1]
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside
    }
    return inside
  }

  function hitBlocker(areaData, x, y) {
    for (var i = areaData.blockers.length - 1; i >= 0; i -= 1) {
      var b = areaData.blockers[i]
      if (b.type === 'rect') {
        if (x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1) return i
      } else if (b.type === 'circle') {
        var dx = x - b.cx
        var dy = y - b.cy
        if (dx * dx + dy * dy <= b.r * b.r) return i
      } else if (b.type === 'polygon') {
        if (inPolygon(b.points, x, y)) return i
      }
    }
    return -1
  }

  function shiftBlocker(source, dx, dy) {
    var next = clone(source)
    if (next.type === 'rect') {
      dx = Math.min(1 - next.x1, Math.max(-next.x0, dx))
      dy = Math.min(1 - next.y1, Math.max(-next.y0, dy))
      next.x0 += dx
      next.x1 += dx
      next.y0 += dy
      next.y1 += dy
    } else if (next.type === 'circle') {
      dx = Math.min(1 - next.cx, Math.max(-next.cx, dx))
      dy = Math.min(1 - next.cy, Math.max(-next.cy, dy))
      next.cx += dx
      next.cy += dy
    } else {
      var minX = 1, maxX = 0, minY = 1, maxY = 0
      next.points.forEach(function (point) {
        minX = Math.min(minX, point[0])
        maxX = Math.max(maxX, point[0])
        minY = Math.min(minY, point[1])
        maxY = Math.max(maxY, point[1])
      })
      dx = Math.min(1 - maxX, Math.max(-minX, dx))
      dy = Math.min(1 - maxY, Math.max(-minY, dy))
      next.points = next.points.map(function (point) { return [point[0] + dx, point[1] + dy] })
    }
    return next
  }

  function blocked(scene, x, y) {
    var list = area(scene).blockers
    for (var i = 0; i < list.length; i += 1) {
      var b = list[i]
      if (b.hidden === true) continue
      if (b.type === 'rect') {
        if (x > b.x0 - 0.08 && x < b.x1 + 0.08 && y > b.y0 - 0.06 && y < b.y1 + 0.06) return true
      } else if (b.type === 'circle') {
        var dx = x - b.cx, dy = y - b.cy
        if (dx * dx + dy * dy < (b.r + 0.08) * (b.r + 0.08)) return true
      } else if (b.type === 'polygon') {
        if (inPolygon(b.points, x, y)) return true
        // 用猪身宽度做一点外扩，避免脚站在障碍边上、身体压进去。
        if (inPolygon(b.points, x + 0.04, y) || inPolygon(b.points, x - 0.04, y) ||
          inPolygon(b.points, x, y + 0.03) || inPolygon(b.points, x, y - 0.03)) return true
      }
    }
    return false
  }

  function canStand(scene, x, y) {
    if (x < 0 || x > 1 || y < 0 || y > 1) return false
    if (!inPolygon(area(scene).outer, x, y)) return false
    return !blocked(scene, x, y)
  }

  /** 深度坐标下的最近可站点，用在服务端位置/换场景时的兜底。 */
  function resolveWalk(scene, x, y) {
    var nx = clamp01(Number(x) || 0.5)
    var ny = clamp01(Number(y) || 0.2)
    var sx = nx
    var sy = screenFromDepth(ny)
    if (canStand(scene, sx, sy)) return { x: sx, y: ny }
    for (var r = 0.02; r <= 0.34; r += 0.02) {
      for (var i = 0; i < 24; i += 1) {
        var a = (i / 24) * Math.PI * 2
        var px = clamp01(sx + Math.cos(a) * r)
        var py = clamp01(sy + Math.sin(a) * r)
        if (canStand(scene, px, py)) return { x: px, y: depthFromScreen(py) }
      }
    }
    return { x: 0.5, y: 0.15 }
  }

  /** 从 from 走到 to；撞边界/家具时沿 x 或 y 滑动。 */
  function moveInside(scene, fromX, fromY, toX, toY) {
    var fx = clamp01(Number(fromX))
    var fy = clamp01(Number(fromY))
    var tx = clamp01(Number(toX))
    var ty = clamp01(Number(toY))
    var fsy = screenFromDepth(fy)
    if (canStand(scene, tx, screenFromDepth(ty))) return { x: tx, y: ty }
    if (canStand(scene, tx, fsy)) return { x: tx, y: fy }
    if (canStand(scene, fx, screenFromDepth(ty))) return { x: fx, y: ty }
    return resolveWalk(scene, fx, fy)
  }

  function updateWalkZone(scene) {
    if (walkZone === null || walkShape === null) return
    walkShape.setAttribute('points', area(scene).outer.map(function (p) {
      return (p[0] * 100).toFixed(1) + ',' + (p[1] * 100).toFixed(1)
    }).join(' '))
  }

  function showWalkZone(ms) {
    if (walkZone === null) return
    walkZone.classList.add('visible')
    if (walkTimer !== null) clearTimeout(walkTimer)
    walkTimer = setTimeout(function () {
      walkTimer = null
      walkZone.classList.remove('visible')
    }, ms || 2600)
  }

  loadSaved()
  ;/** @type {any} */ (window).PiggyRoomScene = {
    depthFromScreen: depthFromScreen,
    screenFromDepth: screenFromDepth,
    canStand: canStand,
    inPolygon: inPolygon,
    hitBlocker: hitBlocker,
    shiftBlocker: shiftBlocker,
    resolveWalk: resolveWalk,
    moveInside: moveInside,
    updateWalkZone: updateWalkZone,
    showWalkZone: showWalkZone,
    getArea: getArea,
    setArea: setArea,
    resetArea: resetArea,
  }
})()
