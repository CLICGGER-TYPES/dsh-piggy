// @ts-check
/**
 * 桌面旧外壳的量框模块：把猪、面板、气泡的布局盒合成窗口内容框和可点区域。
 *
 * 只回答「内容占多大、在哪里」，不写 CSS、也不上报。量框只用布局盒
 * （offsetLeft/offsetTop/offsetWidth/offsetHeight 累加到 body），不能用
 * getBoundingClientRect：呼吸/浮动动画只改 transform，rect 每帧都在抖，Windows 上
 * 那会变成每秒一次 SetWindowRgn。
 */
;(function () {
  /** @type {any} */
  var w = window
  var parts = w.__dshPiggyShellParts || (w.__dshPiggyShellParts = {})

  /** 四周留白：和 lib/window-geometry.js 的 WINDOW_PADDING 一致。 */
  var PAD = 16

  /** 取整步长：和 lib/window-geometry.js 的 QUANTIZE_STEP 一致。 */
  var STEP = 4

  /**
   * 收起时在猪头上方预留的气泡区（宽 = 气泡最大宽度，高 = 两行气泡 + 礼包/番茄钟角标）。
   * Windows 上透明窗口每改一次大小，会有一帧按旧位置画内容 —— 摸猪冒气泡、气泡消失
   * 各改一次窗口，看起来就是「猪在闪」。把这块区域一直算进窗口，冒气泡只改可点区域。
   * macOS 没有 setShape，透明区域会挡住桌面点击，所以不预留。
   */
  var BUBBLE_ZONE = { width: 272, height: 104 }

  /** 可点/可见区域四周放宽几像素：礼包上下浮动、猪摇摆会越出布局盒一点，别被切平。 */
  var SHAPE_SLACK = 6

  /**
   * 面板打开时整块内容（面板 + 名牌 + 猪）相对猪的外框，按面板朝向和猪的大小记在本机。
   * 收起时窗口仍按这个外框留位置：开、关面板只改可点区域，窗口一像素不动 ——
   * Windows 上透明窗口每改一次大小都可能闪一下白底（用户 2026-10-04「右键猪出现白底」）。
   * 只有第一次打开、或者面板换了朝向/猪换了大小时，才会改一次窗口。
   */
  var OPEN_BOX_KEY = 'dsh-piggy:desktop-open-box'

  /**
   * @param {{ geometry: () => any, platform: string | undefined }} deps
   * @returns {{
   *   PAD: number,
   *   STEP: number,
   *   visible: (node: any) => boolean,
   *   layoutBox: (node: any) => { x: number, y: number, width: number, height: number },
   *   boxes: (anchor: { vertical: string, horizontal: string }) => any,
   * }}
   */
  parts.createMeasure = function (deps) {
    var openBoxes = {}
    try { openBoxes = JSON.parse(w.localStorage.getItem(OPEN_BOX_KEY) || '{}') || {} } catch (e) { openBoxes = {} }

    /**
     * @param {string} vertical
     * @param {string} horizontal
     * @param {{ width: number }} pigBox
     * @returns {string}
     */
    function openBoxKey(vertical, horizontal, pigBox) { return vertical + '|' + horizontal + '|' + Math.round(pigBox.width) }

    /**
     * @param {any} node
     * @returns {boolean}
     */
    function visible(node) {
      var style = getComputedStyle(node)
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0.01
    }

    /**
     * 累加 offsetLeft/offsetTop 得到相对 body 的布局框 —— transform 动画不影响它。
     * @param {any} node
     * @returns {{ x: number, y: number, width: number, height: number }}
     */
    function layoutBox(node) {
      var x = 0
      var y = 0
      var walk = node
      while (walk !== null && walk !== undefined && walk !== document.body) {
        x += walk.offsetLeft || 0
        y += walk.offsetTop || 0
        walk = walk.offsetParent
      }
      return { x: x, y: y, width: node.offsetWidth || 0, height: node.offsetHeight || 0 }
    }

    /**
     * 每个可见节点取布局框，再合并成一串互不重叠的矩形。猪的位置也一起报上去。
     * @param {{ vertical: string, horizontal: string }} anchor 上一帧算出的锚边
     * @returns {any}
     */
    function boxes(anchor) {
      var host = document.querySelector('[data-dsh-pig]')
      if (host === null) return { content: null, rects: [] }
      // 面板（.dp-card）自己裁掉溢出的内容，所以只量面板本身，不进去量几百个子节点 ——
      // 以前每 120ms、每次鼠标移动都把面板里每个节点 getComputedStyle 一遍，面板一长就卡。
      var nodes = [host]
      var all = host.querySelectorAll('*')
      for (var a = 0; a < all.length; a += 1) {
        var candidate = all[a]
        var inCard = candidate.closest('.dp-card')
        if ((inCard !== null && inCard !== candidate) || candidate.closest('.dp-fx') !== null) continue
        nodes.push(candidate)
      }
      var geometry = deps.geometry()

      var rects = []
      for (var i = 0; i < nodes.length; i += 1) {
        var node = nodes[i]
        // Short-lived sparkle particles can fly outside the pig. Letting them
        // define the native window width makes the compositor push the pig away
        // from a screen edge when a panel closes.
        if (node.closest('[hidden]') !== null || !visible(node)) continue
        var bubble = node.closest('.dp-bubble')
        // At the top edge there is physically no room to show a bubble above the
        // pig. Do not enlarge/reposition the native window to rescue that bubble;
        // it would move the pig even though the panel itself fits below.
        if (bubble !== null && geometry !== null
          && geometry.window.y + layoutBox(bubble).y < geometry.workArea.y) continue
        var box = layoutBox(node)
        if (box.width < 1 || box.height < 1) continue
        rects.push({ x: box.x, y: box.y, r: box.x + box.width, b: box.y + box.height })
      }
      if (rects.length === 0) return { content: null, rects: [] }

      var hostBox = layoutBox(host)
      var pigNode = host.querySelector === undefined ? null : host.querySelector('.dp-pig')
      var pigBox = pigNode === null ? { x: 0, y: 0, width: 0, height: 0 } : layoutBox(pigNode)
      // 收起时的气泡预留区：只进窗口外框，不进可点区域。
      var zone = null
      if (deps.platform !== 'darwin' && host.getAttribute('data-open') === 'false' && pigNode !== null) {
        var zoneLeft = host.getAttribute('data-panel-side') === 'right'
          ? hostBox.x : hostBox.x + hostBox.width - BUBBLE_ZONE.width
        zone = { x: zoneLeft, y: pigBox.y - BUBBLE_ZONE.height, r: zoneLeft + BUBBLE_ZONE.width, b: pigBox.y }
      }
      var merged = true
      while (merged) {
        merged = false
        for (var p = 0; p < rects.length && !merged; p += 1) {
          for (var q = p + 1; q < rects.length; q += 1) {
            var one = rects[p]
            var two = rects[q]
            if (one.x <= two.r && two.x <= one.r && one.y <= two.b && two.y <= one.b) {
              rects[p] = { x: Math.min(one.x, two.x), y: Math.min(one.y, two.y), r: Math.max(one.r, two.r), b: Math.max(one.b, two.b) }
              rects.splice(q, 1)
              merged = true
              break
            }
          }
        }
      }

      var left = Infinity
      var top = Infinity
      var right = -Infinity
      var bottom = -Infinity
      // 面板打开时按它的最高高度（max-height）留位置：切到内容少的 App 面板会变矮，
      // 但窗口不跟着缩，下次切回来也不用再长 —— 只改可点区域。
      var card = host.querySelector === undefined ? null : /** @type {any} */ (host.querySelector('.dp-card'))
      if (deps.platform !== 'darwin' && card !== null && card.hidden !== true && host.getAttribute('data-open') === 'true') {
        var cardBox = layoutBox(card)
        // 封顶 520：老游戏包的面板没有高度上限（max-height 按屏幕算），不封顶窗口会越留越高。
        var maxHeight = Math.min(520, parseFloat(card.style.maxHeight) || 0)
        if (maxHeight > cardBox.height && cardBox.width > 0) {
          var opensBelow = cardBox.y > pigBox.y
          zone = opensBelow
            ? { x: cardBox.x, y: cardBox.y, r: cardBox.x + cardBox.width, b: cardBox.y + maxHeight }
            : { x: cardBox.x, y: cardBox.y + cardBox.height - maxHeight, r: cardBox.x + cardBox.width, b: cardBox.y + cardBox.height }
        }
      }
      var outline = zone === null ? rects : rects.concat([zone])
      if (deps.platform !== 'darwin' && pigNode !== null) {
        var keyNow = openBoxKey(anchor.vertical, anchor.horizontal, pigBox)
        if (host.getAttribute('data-open') === 'true' && card !== null && card.hidden !== true) {
          // 记下打开时的外框（相对猪）。
          var l = Infinity, t = Infinity, r = -Infinity, b = -Infinity
          for (var o = 0; o < outline.length; o += 1) {
            l = Math.min(l, outline[o].x); t = Math.min(t, outline[o].y)
            r = Math.max(r, outline[o].r); b = Math.max(b, outline[o].b)
          }
          var rel = { l: Math.round(l - pigBox.x), t: Math.round(t - pigBox.y), r: Math.round(r - pigBox.x), b: Math.round(b - pigBox.y) }
          var old = openBoxes[keyNow]
          if (old === undefined || old.l !== rel.l || old.t !== rel.t || old.r !== rel.r || old.b !== rel.b) {
            openBoxes[keyNow] = rel
            try { w.localStorage.setItem(OPEN_BOX_KEY, JSON.stringify(openBoxes)) } catch (e) { /* 存不下就每次启动重新量 */ }
          }
        } else if (openBoxes[keyNow] !== undefined) {
          // 收起：按打开时的外框留位置。
          var saved = openBoxes[keyNow]
          outline = outline.concat([{ x: pigBox.x + saved.l, y: pigBox.y + saved.t, r: pigBox.x + saved.r, b: pigBox.y + saved.b }])
        }
      }
      for (var m = 0; m < outline.length; m += 1) {
        left = Math.min(left, outline[m].x)
        top = Math.min(top, outline[m].y)
        right = Math.max(right, outline[m].r)
        bottom = Math.max(bottom, outline[m].b)
      }
      // 尺寸按 4px 向上取整：面板高度带小数时，换个 App 会差 1px，Windows 上那也是一次改窗口。
      var content = { x: left - PAD, y: top - PAD,
        width: Math.ceil((right - left + PAD * 2) / STEP) * STEP, height: Math.ceil((bottom - top + PAD * 2) / STEP) * STEP }
      // 猪在内容框里的位置（含尺寸）：主进程靠它把窗口挪成「猪在屏幕上一像素都不动」，
      // 钉边也靠它判断面板开在哪一侧。用 host.querySelector，不用后代选择器。
      var pig = { x: pigBox.x - content.x, y: pigBox.y - content.y, width: pigBox.width, height: pigBox.height }
      // 可点区域直接用页面坐标（页面原点就是窗口原点）。左上向下取整、右下向上取整，
      // 再各放宽 1px：以前按内容框原点换算再四舍五入到 4px，相邻两块之间会漏出一道缝，
      // 透出窗口后面的东西（用户看到的「黑条」），面板右边也会被切掉几像素。
      var shape = rects.map(function (r) {
        var x = Math.max(0, Math.floor(r.x) - SHAPE_SLACK)
        var y = Math.max(0, Math.floor(r.y) - SHAPE_SLACK)
        return { x: x, y: y, width: Math.ceil(r.r) + SHAPE_SLACK - x, height: Math.ceil(r.b) + SHAPE_SLACK - y }
      })
      // 摸猪、喂食冒出的爱心等粒子会从猪头往上飘约 56px：飘的时候把这块也加进可见区域，
      // 不然粒子飞出可点区域就被切掉一半，看起来一闪一闪的。只改可点区域，不改窗口大小。
      if (pigNode !== null && host.querySelector !== undefined && host.querySelector('.dp-fx') !== null) {
        var fx = { x: Math.max(0, Math.floor(pigBox.x - 36)), y: Math.max(0, Math.floor(pigBox.y - 84)) }
        shape.push({ x: fx.x, y: fx.y, width: Math.ceil(pigBox.x + pigBox.width + 36) - fx.x, height: Math.ceil(pigBox.y + 12) - fx.y })
      }
      var contentBox = { left: left, top: top, right: right, bottom: bottom }
      return { content: content, shape: shape, pig: pig, hostBox: hostBox, pigBox: pigBox, contentBox: contentBox }
    }

    return { PAD: PAD, STEP: STEP, visible: visible, layoutBox: layoutBox, boxes: boxes }
  }
})()
