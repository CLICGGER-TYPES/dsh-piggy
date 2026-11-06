// @ts-check
/** 联机房间的 2.5D 地面范围：按场景收成梯形，并画一条淡边界。 */
;(function () {
  var walkZone = document.getElementById('walk-zone')
  var walkShape = document.getElementById('walk-zone-shape')
  var walkTimer = null
  // y=0 最前、y=1 最后；左右边界随 y 收窄，避开小屋/家具。
  var WALK = {
    pen: { yMin: 0.02, yMax: 0.68, frontLeft: 0.10, frontRight: 0.90, backLeft: 0.27, backRight: 0.73 },
    room: { yMin: 0.02, yMax: 0.68, frontLeft: 0.12, frontRight: 0.88, backLeft: 0.24, backRight: 0.76 },
  }

  function bounds(scene) { return WALK[scene] || WALK.pen }

  function clampWalk(scene, x, y) {
    var b = bounds(scene)
    var nx = Number(x)
    var ny = Number(y)
    if (!Number.isFinite(nx)) nx = 0.5
    if (!Number.isFinite(ny)) ny = 0.2
    ny = Math.min(b.yMax, Math.max(b.yMin, ny))
    var t = (ny - b.yMin) / (b.yMax - b.yMin)
    var left = b.frontLeft + (b.backLeft - b.frontLeft) * t
    var right = b.frontRight + (b.backRight - b.frontRight) * t
    return { x: Math.min(right, Math.max(left, nx)), y: ny }
  }

  function updateWalkZone(scene) {
    if (walkZone === null || walkShape === null) return
    var b = bounds(scene)
    var frontY = 100 - (8 + b.yMin * 32)
    var backY = 100 - (8 + b.yMax * 32)
    walkShape.setAttribute('points', [
      (b.frontLeft * 100).toFixed(1) + ',' + frontY.toFixed(1),
      (b.frontRight * 100).toFixed(1) + ',' + frontY.toFixed(1),
      (b.backRight * 100).toFixed(1) + ',' + backY.toFixed(1),
      (b.backLeft * 100).toFixed(1) + ',' + backY.toFixed(1),
    ].join(' '))
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

  ;/** @type {any} */ (window).PiggyRoomScene = { clampWalk: clampWalk, updateWalkZone: updateWalkZone, showWalkZone: showWalkZone }
})()
