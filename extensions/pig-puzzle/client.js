// 藏猪方块面板（0.2.6）：无描边色块 + 留白缝区分区域，区号只留在读屏标签里，292px 内可操作。
// 开局没有任何猪或排除标记。鼠标左键放猪/清除，右键排除/清除；触屏和键盘先选标记模式。
// 每局 3 次机会：放错只亮一下红叉，不落错猪；撤销不返还机会，用完锁盘并提供重试/换题。
// 规则是面板内独立子页，返回时保留原盘面；按住按当前模式拖动批量落子，一组一次撤销。
// 图片只用扩展自带的已批准猪 PNG（assets/pig.png），没有另画图标或 SVG 猪。
;(function () {
  'use strict'
  var STYLE_ID = 'dsh-piggy-pig-puzzle-style'
  var PALETTE = ['#F7CD45', '#ADD745', '#D97E38', '#94A3A8', '#D9A1B5', '#B4A5D6']
  var FEEDBACK_MS = 650
  var LOCKED_FEEDBACK_MS = 900
  var rulesOpen = false
  var pendingFocus = null
  var markMode = 'pig'
  var scrollState = { seed: null, done: false, locked: false, top: 0 }
  var feedbackSeen = -1
  var feedbackActive = null
  var feedbackTimer = null
  var feedbackNodes = []
  var rulesButtonNode = null
  var dragging = false
  var dragCells = []
  var dragNodes = []
  var dragMode = 'pig'
  var dragButton = 0
  var dragMoved = false
  var dragApp = null
  var dragOrigin = null
  var dragOriginNode = null
  var dragBound = false
  var clickMode = 'pig'
  var CSS = [
    '.pz{container-type:size;height:var(--pz-avail,var(--ext-panel-height,440px));box-sizing:border-box;padding:6px 6px 10px;overflow:hidden;display:flex;flex-direction:column;gap:8px;color:var(--ac-text,#794f27);font-size:12px;line-height:1.35}',
    '.pz> :not(.pz-scroll){flex-shrink:0}.pz-scroll{container-type:size;flex:1 1 auto;min-height:0;overflow:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-width:thin}.pz-controls{display:flex;align-items:center;justify-content:space-between;gap:10px}.pz-footer{display:grid;gap:8px}',
    // 棋盘在独立滚动区里取宽高较小值成正方形并水平居中：格隙 4px，n 阶最小外宽 = 36*n-4px（格子 32px）。
    // 高度不够时棋盘保持最小格宽，只纵向滚动，不出现横向滚动。
    '.pz-scroll .pz-board{box-sizing:border-box;width:min(100cqw,100cqh);min-width:calc(var(--pz-size) * 36px - 4px);aspect-ratio:1;margin-inline:auto}',
    '.pz-head{display:flex;align-items:baseline;gap:6px}',
    '.pz-title{font-size:12px;font-weight:700;color:var(--ac-text,#794f27)}',
    '.pz-solved{margin-left:auto;font-size:12px;color:var(--ac-text-muted,#a08a6a);font-variant-numeric:tabular-nums}',
    '.pz-modebar,.pz-sizes{display:flex;align-items:center;gap:2px;padding:2px;border-radius:12px;background:var(--ac-bg-input,#fffdf3)}',
    '.pz-kicker{color:var(--ac-text-muted,#a08a6a)}',
    '.pz-mode,.pz-size{min-width:40px;min-height:32px;padding:4px 8px;border:0;border-radius:10px;background:transparent;box-shadow:none;color:var(--ac-text,#794f27);font-size:12px;font-weight:700;line-height:1.2}',
    '.pz-mode:hover:not(:disabled),.pz-size:hover:not(:disabled){background:var(--ac-hover,rgba(25,200,185,.12));color:var(--ac-text,#794f27);transform:none;box-shadow:none}',
    '.pz-mode:active:not(:disabled),.pz-size:active:not(:disabled){transform:none;box-shadow:none}',
    '.pz-mode[data-on="true"],.pz-size[data-on="true"]{background:var(--ac-primary,#19c8b9);color:#fff;box-shadow:none}',
    '.pz-mode[data-on="true"]:hover:not(:disabled),.pz-size[data-on="true"]:hover:not(:disabled){background:var(--ac-primary-hover,#15b3a6);color:#fff}',
    '.pz-seed{color:var(--ac-text-muted,#a08a6a);font-variant-numeric:tabular-nums}',
    '.pz-board{display:grid;gap:4px;padding:0;border:0;border-radius:0;background:transparent;touch-action:none}',
    '.pz-cell{position:relative;box-sizing:border-box;aspect-ratio:1;min-width:32px;min-height:32px;border:0;border-radius:4px;padding:0;font:inherit;font-size:15px;font-weight:700;color:var(--ac-text-2,#8a6a46);display:grid;place-items:center;cursor:pointer;touch-action:none;user-select:none;transition:transform .15s cubic-bezier(.4,0,.2,1)}',
    '.pz-cell:active{transform:scale(.95)}',
    '.pz-cell[data-done="true"],.pz-cell[data-locked="true"]{cursor:default}',
    '.pz-cell[data-hint="true"]{animation:pz-hint 1s ease-in-out infinite;outline:3px solid var(--ac-warning,#e3a24f);outline-offset:-2px;z-index:2}',
    '.pz-cell[data-pending="true"]{outline:2px solid var(--ac-primary,#19c8b9);outline-offset:-2px}',
    '.pz-pig{position:absolute;inset:10%;width:80%;height:80%;object-fit:contain;pointer-events:none;font-size:18px;display:grid;place-items:center}',
    '.pz-x{pointer-events:none;font-size:24px;line-height:1;font-weight:700;color:#fff;text-align:center}',
    '.pz-wrong{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none;z-index:3;font-size:26px;line-height:1;font-weight:700;color:#d9534f;text-shadow:0 0 2px #fff,0 0 4px #fff;animation:pz-wrong .55s ease-out both}',
    '.pz-wrong-hold{animation:none;opacity:1}',
    '.pz-status{box-sizing:border-box;min-height:20px;line-height:20px;padding:0;border:0;background:transparent;font-size:12px;font-weight:400;color:var(--ac-text-body,#6d512f)}',
    '.pz-hint{padding:5px 8px;border-radius:var(--ac-radius-sm,12px);background:var(--ac-bg-input,#fffdf3);border:2px dashed var(--ac-warning,#e3a24f);font-size:12px;color:var(--ac-text-body,#6d512f)}',
    '.pz-actions{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px}',
    '.pz-actions> :nth-child(-n+3){grid-column:span 2}',
    '.pz-actions> :nth-child(n+4){grid-column:span 3}',
    '.pz-actions .dp-btn,.pz-actions .dp-mini{min-width:0;min-height:36px;padding:6px;font-size:12px;white-space:nowrap}',
    '.pz-rules{display:grid;gap:3px;padding:7px 9px;border-radius:var(--ac-radius-sm,12px);background:var(--ac-bg-content,#fff8e3);border:2px solid var(--ac-border-light,#eadcc0);font-size:12px;color:var(--ac-text-body,#6d512f)}',
    '.pz-done{display:grid;gap:4px;padding:8px 9px;border-radius:var(--ac-radius-sm,12px);background:var(--ac-bg-content,#fff8e3);border:2px solid var(--ac-primary,#19c8b9);font-size:12px}',
    '.pz-done-title{font-size:12px;font-weight:700;color:var(--ac-text,#794f27)}',
    '.pz-done-row{display:flex;gap:4px}',
    '.pz-done-row .dp-btn,.pz-done-row .dp-mini{min-height:32px;flex:1;min-width:0;font-size:12px;padding:5px 3px}',
    '.pz-failed{display:grid;gap:4px;padding:8px 9px;border-radius:var(--ac-radius-sm,12px);background:var(--ac-bg-content,#fff8e3);border:2px solid var(--ac-warning,#e3a24f);font-size:12px}',
    '.pz-failed-title{font-size:12px;font-weight:700;color:var(--ac-text,#794f27)}',
    '.pz-failed-row{display:flex;gap:4px}',
    '.pz-failed-row .dp-btn,.pz-failed-row .dp-mini{min-height:32px;flex:1;min-width:0;font-size:12px;padding:5px 3px}',
    '.pz-rules-page .pz-scroll{display:flex;flex-direction:column;gap:8px}',
    '.pz-rules-title{font-size:12px;font-weight:700;color:var(--ac-text,#794f27);outline:none}',
    '.pz-rules-back{display:flex}',
    '.pz-rules-back .dp-btn{min-height:36px;flex:1}',
    '.pz-cell:focus-visible{outline:3px solid var(--ac-primary,#19c8b9);outline-offset:1px}',
    '@keyframes pz-hint{0%,100%{filter:brightness(1)}50%{filter:brightness(1.18)}}',
    '@keyframes pz-wrong{0%{transform:scale(.55);opacity:0}25%{transform:scale(1.14);opacity:1}65%{transform:scale(1);opacity:1}100%{transform:scale(1);opacity:0}}',
    '@container (max-height:320px){.pz:not(.pz-rules-page) .pz-head{display:none}.pz .pz-hint{max-height:64px;overflow:auto;box-sizing:border-box}}',
    '@media (prefers-reduced-motion:reduce){.pz-cell{transition:none}.pz-cell[data-hint="true"]{animation:none}.pz-wrong{animation:none;opacity:1}}',
  ].join('\n')

  function style() {
    var previous = typeof document.getElementById === 'function' && document.getElementById(STYLE_ID)
    if (previous) { if (previous.textContent !== CSS) previous.textContent = CSS; return }
    var node = document.createElement('style')
    node.id = STYLE_ID
    node.textContent = CSS
    ;(document.head || document.body).appendChild(node)
  }

  function fitPanel(root) {
    var outer = root.parentNode
    if (!outer || !outer.style || typeof outer.style.getPropertyValue !== 'function') return
    var available = parseFloat(outer.style.getPropertyValue('--ext-panel-height'))
    if (!(available > 0)) return
    var used = 0
    for (var i = 0; i < outer.children.length && outer.children[i] !== root; i++) {
      var node = outer.children[i]
      var rect = typeof node.getBoundingClientRect === 'function' ? node.getBoundingClientRect() : null
      used += Number(node.offsetHeight) || (rect && rect.height) || 0
      if (typeof window.getComputedStyle === 'function') {
        var css = window.getComputedStyle(node)
        used += (parseFloat(css.marginTop) || 0) + (parseFloat(css.marginBottom) || 0)
      }
    }
    root.style.setProperty('--pz-avail', Math.max(100, Math.floor(available - used)) + 'px')
  }

  function art(app, name) { return typeof app.asset === 'function' ? app.asset(name) : '' }
  function pigNode(app) {
    var url = art(app, 'pig.png')
    if (!url) return app.el('span', 'pz-pig', '🐖')
    var image = app.el('img', 'pz-pig')
    image.src = url
    image.alt = ''
    return image
  }

  function dateLabel(at) {
    var date = new Date(at)
    return (date.getMonth() + 1) + '月' + date.getDate() + '日'
  }

  function clearFeedbackTimer() {
    if (feedbackTimer !== null) {
      clearTimeout(feedbackTimer)
      feedbackTimer = null
    }
  }

  /**
   * 错误反馈按 feedback.seq 只播一次：首次挂载记住当前序号，刷新/轮询不会把旧红叉又翻出来；
   * 新序号出现后按固定寿命显示，超时由本地定时器撤掉。
   */
  function prepareFeedback(d) {
    var feedback = d && d.feedback
    var seq = feedback && Number.isInteger(feedback.seq) ? feedback.seq : 0
    if (feedbackSeen < 0) { feedbackSeen = seq; return }
    if (seq <= feedbackSeen) return
    feedbackSeen = seq
    var lifetime = feedback.kind === 'locked' ? LOCKED_FEEDBACK_MS : FEEDBACK_MS
    feedbackActive = {
      seq: seq,
      cells: Array.isArray(feedback.cells) ? feedback.cells.slice(0, 1) : [],
      kind: feedback.kind,
      until: Date.now() + lifetime,
      shown: false,
    }
    clearFeedbackTimer()
    feedbackTimer = setTimeout(function () {
      feedbackActive = null
      feedbackTimer = null
      feedbackNodes.forEach(function (node) { if (node && typeof node.remove === 'function') node.remove() })
      feedbackNodes = []
    }, lifetime)
  }

  function activeFeedbackCell(cell) {
    return feedbackActive !== null && Date.now() < feedbackActive.until && feedbackActive.cells.indexOf(cell.index) >= 0
  }

  function appendWrong(app, cell, node) {
    if (!activeFeedbackCell(cell)) return
    // 同一条错误在宿主轮询重绘时不重播缩放动画，只保留静态红叉直到寿命结束。
    var cross = app.el('span', feedbackActive.shown ? 'pz-wrong pz-wrong-hold' : 'pz-wrong', '×')
    cross.setAttribute('aria-hidden', 'true')
    node.appendChild(cross)
    feedbackNodes.push(cross)
    feedbackActive.shown = true
  }

  function closeRules(app) {
    rulesOpen = false
    pendingFocus = 'rules'
    app.rerender()
  }

  function modeLabel(mode) { return mode === 'exclude' ? '排除' : '放猪' }

  /** 这一格点一下在当前模式下是否真的会变：放猪会清除猪，排除会清除排除。 */
  function changes(cell, mode) {
    return mode === 'pig' ? cell.mark !== 'pig' : cell.mark !== 'pig'
  }

  /** 拖动只往空状态刷：已经是猪/已排除的格子不重复刷，免得拖过去反复切换。 */
  function paints(cell, mode) {
    return mode === 'pig' ? cell.mark !== 'pig' : cell.mark === 'empty'
  }

  function startDrag(app, cell, node, event, mode, button) {
    dragging = true
    dragMoved = false
    dragCells = []
    dragNodes = []
    dragMode = mode
    dragButton = button
    clickMode = mode
    dragOrigin = cell
    dragOriginNode = node
    dragApp = app
    // 捕获指针：在棋盘外松手也能收到 pointerup。真正丢了捕获时由 lostpointercapture 取消。
    if (event && typeof event.pointerId === 'number' && typeof node.setPointerCapture === 'function') {
      try { node.setPointerCapture(event.pointerId) } catch (error) { /* 系统不给捕获就靠 blur / pointercancel 收尾 */ }
    }
  }

  function addCell(cell, node) {
    if (dragCells.indexOf(cell.index) >= 0) return
    dragCells.push(cell.index)
    dragNodes.push(node)
    node.setAttribute('data-pending', 'true')
    if (!node.getAttribute('data-pending-bound')) {
      node.setAttribute('data-pending-bound', 'true')
      node.appendChild(dragApp.el('span', 'pz-x', dragMode === 'pig' ? '🐖' : '×'))
    }
  }

  /** 只有离开按下的那一格才算拖动；原地按一下仍然是点击。 */
  function enterCell(cell, node) {
    if (!dragging || !paints(cell, dragMode)) return
    if (dragCells.length === 0) {
      if (cell.index === dragOrigin.index) return
      if (paints(dragOrigin, dragMode)) addCell(dragOrigin, dragOriginNode)
    }
    addCell(cell, node)
  }

  function finishDrag() {
    if (!dragging) return
    var cells = dragCells.slice()
    var app = dragApp
    var mode = dragMode
    var button = dragButton
    dragging = false
    dragCells = []
    dragApp = null
    if (cells.length > 0) {
      dragMoved = true
      app.send('drag', { cells: cells, mode: mode })
    } else if (button === 2 && dragOrigin !== null && changes(dragOrigin, mode)) {
      // 鼠标右键不产生 click，原地右键要自己补一次排除。
      app.send('tap', { cell: dragOrigin.index, mode: mode })
    }
  }

  function cancelDrag() {
    dragNodes.forEach(function (node) {
      node.removeAttribute('data-pending')
      node.removeAttribute('data-pending-bound')
      for (var index = node.children.length - 1; index >= 0; index -= 1) {
        if (node.children[index].className === 'pz-x') node.children[index].remove()
      }
    })
    dragging = false
    dragCells = []
    dragNodes = []
    dragOrigin = null
    dragOriginNode = null
    dragApp = null
  }

  /** 松手是否属于本组：捕获后即使松在棋盘外，event.target 仍是按下的那一格。 */
  function releaseOnDrag(event) {
    var target = event && event.target
    while (target && (!target.getAttribute || target.getAttribute('data-cell') === null)) target = target.parentNode
    if (!target) return false
    var index = Number(target.getAttribute('data-cell'))
    return dragCells.indexOf(index) >= 0 || (dragOrigin !== null && index === dragOrigin.index)
  }

  function bindDocument() {
    if (dragBound) return
    dragBound = true
    document.addEventListener('pointerup', function (event) {
      if (!dragging) return
      // 只有属于本组的松手才算完成；别处的松手是丢失 pointerup 之后的余波，取消而不是补交。
      if (releaseOnDrag(event)) finishDrag()
      else cancelDrag()
    })
    document.addEventListener('pointercancel', function () { cancelDrag() })
    document.addEventListener('visibilitychange', function () {
      if (document.hidden || document.visibilityState === 'hidden') cancelDrag()
    })
    if (typeof window.addEventListener === 'function') {
      window.addEventListener('blur', function () { cancelDrag() })
    }
  }

  function renderModes(app) {
    var row = app.el('div', 'pz-modebar')
    row.setAttribute('role', 'group'); row.setAttribute('aria-label', '触屏/键盘标记')
    ;['pig', 'exclude'].forEach(function (mode) {
      var node = app.button('dp-mini pz-mode', {
        'data-mode': mode,
        'data-on': String(markMode === mode),
        'aria-pressed': String(markMode === mode),
        'aria-label': mode === 'pig' ? '标记模式：放猪' : '标记模式：排除',
      }, function () {
        markMode = mode
        app.rerender()
      })
      node.textContent = modeLabel(mode)
      row.appendChild(node)
    })
    return row
  }

  function renderSizes(app, d) {
    var row = app.el('div', 'pz-sizes')
    row.setAttribute('role', 'group'); row.setAttribute('aria-label', '棋盘尺寸')
    for (var size = d.level.min; size <= d.level.max; size += 1) {
      ;(function (value) {
        var node = app.button('dp-mini pz-size', {
          'data-size': String(value),
          'data-on': String(value === d.level.size),
          'aria-label': value + ' 乘 ' + value + (value === d.level.size ? '，当前尺寸' : '，换尺寸并开新局'),
        }, function () {
          app.send('new', { size: value })
        })
        node.textContent = value + '×' + value
        row.appendChild(node)
      })(size)
    }
    return row
  }

  function renderGrid(app, d, locked) {
    var size = d.level.size
    var board = app.el('div', 'pz-board')
    board.style.setProperty('--pz-size', String(size))
    board.style.gridTemplateColumns = 'repeat(' + size + ', minmax(0, 1fr))'
    board.setAttribute('role', 'group')
    board.setAttribute('data-puzzle-seed', String(d.level.seed))
    board.setAttribute('aria-label', d.level.size + ' 乘 ' + d.level.size + ' 棋盘')
    var nodes = []
    d.cells.forEach(function (cell) {
      var markText = cell.mark === 'pig' ? '猪' : cell.mark === 'excluded' ? '已排除' : '空格'
      var wrongHere = activeFeedbackCell(cell)
      var node = app.button('pz-cell', {
        'data-cell': String(cell.index),
        // 宿主轮询重绘整块内容时靠这个命名空间属性把键盘焦点还给同一格。
        'data-puzzle-cell': String(cell.index),
        'data-mark': cell.mark,
        'data-region': String(cell.region),
        'data-done': String(d.done),
        'data-locked': String(locked),
        'aria-label': '第 ' + cell.row + ' 行第 ' + cell.col + ' 列，第 ' + (cell.region + 1) + ' 区，' + markText
          + (wrongHere ? '，刚放错' : '') + (d.done ? '，本局已完成' : locked ? '，本局已锁定' : ''),
      }, function (event) {
        // 跨格拖动后浏览器补发的 click 落在格子上时只吞鼠标那一次；键盘/读屏的 Enter/Space
        // click detail 为 0，不能连第一次激活也吞掉（宿主会把焦点还给 data-puzzle-cell）。
        if (dragMoved) {
          dragMoved = false
          if (!event || event.detail !== 0) return
        }
        if (d.done || locked) return
        var mode = event && event.detail === 0 ? markMode : clickMode
        app.send('tap', { cell: cell.index, mode: mode })
      })
      node.style.backgroundColor = PALETTE[cell.region % PALETTE.length]
      // 色块无描边：相邻区划只靠底色和留白缝表达，不按异区画线；区号只留给 aria-label。
      if (cell.mark === 'pig') node.appendChild(pigNode(app))
      else if (cell.mark === 'excluded') node.appendChild(app.el('span', 'pz-x', '×'))
      if (d.hint && d.hint.cell === cell.index && (d.hint.kind === 'place' || d.hint.kind === 'exclude')) node.setAttribute('data-hint', 'true')
      appendWrong(app, cell, node)
      node.setAttribute('aria-disabled', String(d.done || locked))
      node.addEventListener('pointerdown', function (event) {
        // 新的一次按下永远结束上一组：上一次可能因为窗口失焦 / 在窗外松手没收到 pointerup。
        cancelDrag()
        if (d.done || locked) return
        if (event && typeof event.button === 'number' && event.button !== 0 && event.button !== 2) return
        var button = event && typeof event.button === 'number' ? event.button : 0
        var touch = event && (event.pointerType === 'touch' || event.pointerType === 'pen')
        var mode = button === 2 ? 'exclude' : touch ? markMode : 'pig'
        clickMode = mode
        if (!changes(cell, mode)) return
        startDrag(app, cell, node, event, mode, button)
      })
      node.addEventListener('pointerenter', function () { enterCell(cell, node) })
      node.addEventListener('pointerup', function () {
        if (!dragging) return
        // 这一格必须真的进过本组（或就是按下的起点），否则是丢掉的 pointerup 之后的无关松手。
        if (dragCells.indexOf(cell.index) >= 0 || (dragOrigin !== null && cell.index === dragOrigin.index)) finishDrag()
        else cancelDrag()
      })
      node.addEventListener('pointercancel', cancelDrag)
      node.addEventListener('lostpointercapture', function () { if (dragging) cancelDrag() })
      nodes[cell.index] = node
      board.appendChild(node)
    })
    board.addEventListener('pointermove', function (event) {
      if (!dragging || !event || typeof document.elementFromPoint !== 'function') return
      var target = /** @type {any} */ (document.elementFromPoint(event.clientX, event.clientY))
      while (target && (!target.getAttribute || target.getAttribute('data-cell') === null)) target = target.parentNode
      if (!target) return
      var index = Number(target.getAttribute('data-cell'))
      if (!Number.isInteger(index) || !d.cells[index] || !nodes[index]) return
      enterCell(d.cells[index], nodes[index])
    })
    board.addEventListener('contextmenu', function (event) { if (typeof event.preventDefault === 'function') event.preventDefault() })
    board.addEventListener('keydown', function (event) {
      var key = event && event.key
      if (!key || !event.target || typeof event.target.getAttribute !== 'function') return
      var at = event.target.getAttribute('data-cell')
      if (at === null) return
      if (key === 'x' || key === 'X' || key === 'Delete' || key === 'Backspace') {
        if (typeof event.preventDefault === 'function') event.preventDefault()
        var cell = d.cells[Number(at)]
        if (!cell || d.done || locked) return
        var mode = key === 'Delete' || key === 'Backspace' ? (cell.mark === 'pig' ? 'pig' : 'exclude') : 'exclude'
        app.send('tap', { cell: cell.index, mode: mode })
        return
      }
      var row = Math.floor(Number(at) / size)
      var col = Number(at) % size
      if (key === 'ArrowLeft') col = Math.max(0, col - 1)
      else if (key === 'ArrowRight') col = Math.min(size - 1, col + 1)
      else if (key === 'ArrowUp') row = Math.max(0, row - 1)
      else if (key === 'ArrowDown') row = Math.min(size - 1, row + 1)
      else if (key === 'Home') col = 0
      else if (key === 'End') col = size - 1
      else return
      if (typeof event.preventDefault === 'function') event.preventDefault()
      var target = nodes[row * size + col]
      if (target && typeof target.focus === 'function') target.focus()
    })
    return board
  }

  function renderActions(app, d, locked) {
    var bar = app.el('div', 'pz-actions')
    var undo = app.button('dp-btn', { 'data-op': 'undo', 'aria-label': '撤销上一次操作' }, function () { app.send('undo', {}) })
    undo.textContent = '撤销'
    undo.disabled = d.done || locked || !d.canUndo
    bar.appendChild(undo)
    var restart = app.button('dp-btn', { 'data-op': 'restart', 'aria-label': '重开本局，题目不变' }, function () { app.send('restart', {}) })
    restart.textContent = '重开'
    bar.appendChild(restart)
    var rules = app.button('dp-btn', { 'data-op': 'rules', 'aria-expanded': 'false', 'aria-label': '看规则' }, function () {
      rulesOpen = true
      pendingFocus = 'rules-title'
      app.rerender()
    })
    rules.textContent = '规则'
    rulesButtonNode = rules
    bar.appendChild(rules)
    // DOM 顺序与两行视觉一致：第一行撤销/重开/规则，第二行提示/新一局。
    var hint = app.button('dp-btn', { 'data-op': 'hint', 'aria-label': '给一个有理由的提示，不自动落猪' }, function () { app.send('hint', {}) })
    hint.textContent = '提示'
    hint.disabled = d.done || locked
    bar.appendChild(hint)
    var fresh = app.button('dp-mini', { 'data-op': 'new', 'aria-label': '新一局，换一道随机题' }, function () { app.send('new', {}) })
    fresh.textContent = '新一局'
    bar.appendChild(fresh)
    return bar
  }

  function renderFailed(app, d) {
    var box = app.el('div', 'pz-failed')
    box.setAttribute('role', 'group')
    box.setAttribute('aria-label', '机会用完了')
    box.appendChild(app.el('div', 'pz-failed-title', '机会用完了，盘面已锁定。'))
    box.appendChild(app.el('div', null, '重试同一道题，或换一道新题；两种都会恢复 ' + d.maxLives + ' 次机会。'))
    var row = app.el('div', 'pz-failed-row')
    var same = app.button('dp-btn', { 'data-retry': 'same', 'aria-label': '再试这道题，机会恢复三次，盘面清空' }, function () { app.send('restart', {}) })
    same.textContent = '再试这道'
    row.appendChild(same)
    var fresh = app.button('dp-mini', { 'data-retry': 'new', 'aria-label': '换一道新题，机会恢复三次' }, function () { app.send('new', {}) })
    fresh.textContent = '换一局'
    row.appendChild(fresh)
    box.appendChild(row)
    return box
  }

  function renderRulesPage(app) {
    var root = app.el('div', 'pz pz-rules-page')
    var head = app.el('div', 'pz-head')
    head.appendChild(app.el('span', 'pz-title', '藏猪方块 · 规则'))
    root.appendChild(head)
    var scroller = app.el('div', 'pz-scroll')
    var card = app.el('div', 'pz-rules')
    card.setAttribute('role', 'region')
    card.setAttribute('aria-labelledby', 'pz-rules-title')
    var title = app.el('div', 'pz-rules-title', '怎么玩')
    title.setAttribute('id', 'pz-rules-title')
    title.setAttribute('tabindex', '-1')
    card.appendChild(title)
    ;[
      '每行、每列、每个颜色区各放一只猪。',
      '猪之间不能挨着，斜着也不行；只隔一格的斜线不算。',
      '每局 3 次机会。放错一格扣 1 次，错猪不会留在盘上；一次拖动只算 1 次。',
      '排除不扣机会；撤销不返还机会。机会用完盘面锁定，再选「再试这道」或「换一局」。',
      '鼠标左键放猪，再点清除；右键标记排除，再点清除。',
      '触屏先选「放猪」或「排除」；键盘 Enter/Space 用当前模式，X 排除。',
      '按住拖动按当前模式连划，一组一次撤销。提示只解释，不自动落猪。',
    ].forEach(function (line) { card.appendChild(app.el('div', null, line)) })
    scroller.appendChild(card)
    root.appendChild(scroller)
    var footer = app.el('div', 'pz-footer')
    var backRow = app.el('div', 'pz-rules-back')
    var back = app.button('dp-btn', { 'data-op': 'rules-back', 'aria-label': '返回棋盘，盘面不变' }, function () { closeRules(app) })
    back.textContent = '返回棋盘'
    backRow.appendChild(back)
    footer.appendChild(backRow)
    root.appendChild(footer)
    root.addEventListener('keydown', function (event) {
      if (!event || event.key !== 'Escape') return
      if (typeof event.preventDefault === 'function') event.preventDefault()
      closeRules(app)
    })
    app.content.appendChild(root)
    fitPanel(root)
    scroller.scrollTop = 0
    if (pendingFocus === 'rules-title') {
      pendingFocus = null
      if (typeof title.focus === 'function') title.focus()
    }
  }

  function renderDone(app, d) {
    var box = app.el('div', 'pz-done')
    box.appendChild(app.el('div', 'pz-done-title', '藏好了！' + d.level.size + ' 只小猪都住进自己的格子。'))
    box.appendChild(app.el('div', null, '这一局用了 ' + d.moves + ' 步' + (d.doneAt ? ' · ' + dateLabel(d.doneAt) : '') + '。没有金币奖励，只是一道逻辑题。'))
    var row = app.el('div', 'pz-done-row')
    var again = app.button('dp-btn', { 'data-op': 'new', 'aria-label': '再来一局，换一道随机题' }, function () { app.send('new', {}) })
    again.textContent = '再来一局'
    row.appendChild(again)
    var restart = app.button('dp-btn', { 'data-op': 'restart', 'aria-label': '重开本局，题目不变' }, function () { app.send('restart', {}) })
    restart.textContent = '重开本局'
    row.appendChild(restart)
    box.appendChild(row)
    return box
  }

  function render(app) {
    style()
    bindDocument()
    // 宿主轮询重绘在 renderHold 里推迟到松手之后；抑制标记不能跨过一次重绘留到下一次激活。
    if (!dragging) dragMoved = false
    var d = app.data
    if (!d || !Array.isArray(d.cells)) {
      app.content.appendChild(app.el('div', 'dp-empty', '藏猪方块还在准备……'))
      return
    }
    prepareFeedback(d)
    feedbackNodes = []
    if (rulesOpen) {
      renderRulesPage(app)
      return
    }
    var locked = d.locked === true || (d.lives === 0 && !d.done)
    rulesButtonNode = null
    var root = app.el('div', 'pz')
    var head = app.el('div', 'pz-head')
    head.appendChild(app.el('span', 'pz-title', '藏猪方块 · ' + d.level.size + '×' + d.level.size))
    head.appendChild(app.el('span', 'pz-solved', '已通关 ' + d.solved + ' 局'))
    root.appendChild(head)
    var controls = app.el('div', 'pz-controls')
    controls.appendChild(renderSizes(app, d)); controls.appendChild(renderModes(app))
    root.appendChild(controls)
    if (scrollState.seed !== d.level.seed || (d.done && !scrollState.done) || (locked && !scrollState.locked)) scrollState.top = 0
    scrollState.seed = d.level.seed; scrollState.done = d.done; scrollState.locked = locked
    var scroller = app.el('div', 'pz-scroll')
    scroller.addEventListener('scroll', function () { scrollState.top = scroller.scrollTop })
    if (d.done) scroller.appendChild(renderDone(app, d))
    else if (locked) scroller.appendChild(renderFailed(app, d))
    scroller.appendChild(renderGrid(app, d, locked))
    root.appendChild(scroller)
    var footer = app.el('div', 'pz-footer')
    var status = app.el('div', 'pz-status', d.status)
    status.setAttribute('role', 'status')
    status.setAttribute('aria-live', 'polite')
    footer.appendChild(status)
    if (d.hint) {
      var hintBox = app.el('div', 'pz-hint', d.hint.text)
      hintBox.setAttribute('role', 'note')
      footer.appendChild(hintBox)
    }
    footer.appendChild(renderActions(app, d, locked))
    root.appendChild(footer)
    app.content.appendChild(root)
    fitPanel(root)
    scroller.scrollTop = scrollState.top
    if (pendingFocus === 'rules' && rulesButtonNode) {
      pendingFocus = null
      if (typeof rulesButtonNode.focus === 'function') rulesButtonNode.focus()
    }
  }

  var host = /** @type {any} */ (window)
  if (host.dshPiggyExtensions) host.dshPiggyExtensions.register('pig-puzzle', { render: render })
})()
