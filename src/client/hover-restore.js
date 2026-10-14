// @ts-check
/**
 * 重绘后把悬停态还回去。
 *
 * 快照真有变化时（生长期跨分钟、饱食度掉一点……）`panel.js` 会把内容整棵重建（`paintContent`）。
 * 重建之后指针还压在原处，可挂在扩展自己节点上的悬停是 JS 状态，跟着旧节点一起没了——
 * 浏览器只在布局变化后补一次 movementX/Y 为 0 的 mousemove，而扩展（菜园的地块卡，
 * `extensions/farm/client.js` 的 attachHover）的守卫写得明明白白「只认真的动了」，
 * 于是悬停卡要等玩家再挪一下鼠标才回来。
 *
 * 这里记住指针最后一次压在内容上的位置，重绘后在同一个点上补发一次带 movement 的
 * mousemove，让扩展自己的监听器把悬停卡建回来。补偿全在宿主做：扩展一行都不用改，
 * 玩家也不用等扩展包更新。
 *
 * 补发排在**这一帧渲染之前**（requestAnimationFrame）：重绘刚把 DOM 换掉时立刻做命中测试，
 * 会为整棵树逼出一次同步布局（大农场实测 6–10ms，等于把「重绘末尾的强制布局」又放回来了）；
 * 排到渲染前，布局本来这一帧就要做，命中测试几乎不要钱，卡片也会在画出来之前就位（不闪）。
 *
 * 只管指针**还在面板内容里**的：补发前用 elementFromPoint 重新命中一次，命中的必须是内容的
 * 后代；离开过（mouseleave）就不补；这期间指针又动过（序号变了）也不补——那个事件自己会把
 * 悬停带对。合成事件不再触发补发（防重入）。滚动位置、焦点一个字都不动。
 *
 * @module dsh-piggy/client/hover-restore
 */

/** 面板内容元素 → 它的补发器（同一个元素只挂一次监听）。 */
var restorers = new WeakMap()

/**
 * 重绘之后补一次悬停；第一次调用时顺手在内容上挂记录指针位置的监听。
 * @param {any} content 面板内容元素（`ctx.content`）
 * @returns {boolean} 真的排了一次补发才为 true
 */
export function restoreHover(content) {
  var restore = restorers.get(content)
  if (restore === undefined) {
    restore = attach(content)
    restorers.set(content, restore)
  }
  return restore()
}

/**
 * @param {any} content
 * @returns {() => boolean}
 */
function attach(content) {
  var doc = content.ownerDocument ?? globalThis.document ?? null
  var win = doc === null ? globalThis.window ?? null : doc.defaultView ?? globalThis.window ?? null
  var x = null
  var y = null
  /** 指针事件序号：排下补发到真的补之间又动过，就不补了。 */
  var seq = 0
  var restoring = false
  var pending = false

  /** 只记真指针；补发的那一次不进记录（它是结果，不是「指针动过」）。 */
  function remember(event) {
    if (restoring) return
    x = event.clientX
    y = event.clientY
    // 只有「真的动了」才作废排着的补发。浏览器在布局变化后自己会补一次 movement 为 0 的
    // mousemove，扩展（菜园）正是按这个把它挡掉的——那次不会把悬停建回来，不算数。
    if (event.movementX !== 0 || event.movementY !== 0) seq += 1
  }

  function forget() { x = null; y = null }

  /** 指针（还）压在内容上的那个节点；不在内容里就是 null。 */
  function targetUnderPointer() {
    if (x === null || typeof doc?.elementFromPoint !== 'function') return null
    var node = doc.elementFromPoint(x, y)
    if (node === null || node === undefined) return null
    for (var walk = node; walk !== null && walk !== undefined; walk = walk.parentNode) {
      if (walk === content) return node
    }
    return null
  }

  /** 补发一次「真的动了」的 mousemove，走的是扩展自己的监听器。 */
  function dispatch(target) {
    var MouseClass = win === null ? null : win.MouseEvent
    if (typeof MouseClass !== 'function') return
    restoring = true
    try {
      target.dispatchEvent(new MouseClass('mousemove', {
        bubbles: true, clientX: x, clientY: y, movementX: 1, movementY: 1,
      }))
    } finally {
      restoring = false
    }
  }

  function flush(seen) {
    pending = false
    // 这中间指针又动过：那个事件自己会把悬停带对，别拿旧坐标去盖。
    if (restoring || seq !== seen) return
    var target = targetUnderPointer()
    if (target === null) return
    dispatch(target)
  }

  /** 排到这一帧渲染之前；宿主没有调度器（测试桩）就当场做。 */
  function schedule(seen) {
    if (win !== null && typeof win.requestAnimationFrame === 'function') {
      win.requestAnimationFrame(function () { flush(seen) })
      return
    }
    if (win !== null && typeof win.setTimeout === 'function') {
      win.setTimeout(function () { flush(seen) }, 0)
      return
    }
    flush(seen)
  }

  content.addEventListener('mousemove', remember)
  content.addEventListener('mouseleave', forget)

  return function restore() {
    if (restoring || pending || x === null) return false
    pending = true
    schedule(seq)
    return true
  }
}
