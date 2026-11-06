// @ts-check
/** 联机房间边界编辑器的菜单条、模式按钮、底部提示和右侧对象面板。 */
;(function () {
  var SHAPE_LABELS = {
    node: '边界节点',
    rect: '矩形障碍',
    circle: '圆形障碍',
    lasso: '手绘障碍',
  }

  function statusText(shape, mode) {
    var name = SHAPE_LABELS[shape] || SHAPE_LABELS.node
    if (mode === 'delete') return '删除：点边界节点或场景障碍删除；边界至少保留 3 个节点。'
    if (mode === 'edit') {
      if (shape === 'node') return '编辑 · 边界节点：拖小圆点调整边界。'
      return '编辑 · ' + name + '：拖动场景里的障碍移动位置。'
    }
    if (shape === 'node') return '新建 · 边界节点：点地面加边界点。'
    if (shape === 'rect') return '新建 · 矩形障碍：在地面上拖出一个矩形。'
    if (shape === 'circle') return '新建 · 圆形障碍：在地面上拖出一个圆形。'
    return '新建 · 手绘障碍：按住拖动，画任意形状。'
  }

  function create(options) {
    var bar = options.bar
    var status = options.status
    var objectPanel = options.objectPanel
    var objectList = options.objectList
    var objectCount = options.objectCount
    var objectPin = options.objectPin
    var objectFlip = options.objectFlip
    var menuTriggers = bar ? Array.prototype.slice.call(bar.querySelectorAll('[data-menu]')) : []
    var mapTrigger = bar ? bar.querySelector('[data-menu="map"]') : null
    var objectTrigger = bar ? bar.querySelector('[data-menu="object"]') : null
    var panelSide = 'right'
    var panelPinned = false
    var flipTimer = null

    function setStatus(text) {
      if (!status) return
      status.textContent = text
      status.hidden = text === ''
    }
    function menuPanel(name) {
      return bar ? bar.querySelector('[data-menu-panel="' + name + '"]') : null
    }
    function closeMenus() {
      menuTriggers.forEach(function (trigger) {
        trigger.setAttribute('aria-expanded', 'false')
      })
      if (bar) {
        bar.querySelectorAll('[data-menu-panel]').forEach(function (panel) {
          panel.setAttribute('hidden', '')
        })
      }
    }
    function openMenu(name) {
      closeMenus()
      var trigger = bar ? bar.querySelector('[data-menu="' + name + '"]') : null
      var panel = menuPanel(name)
      if (!trigger || !panel) return
      trigger.setAttribute('aria-expanded', 'true')
      panel.removeAttribute('hidden')
    }
    function toggleMenu(name) {
      var trigger = bar ? bar.querySelector('[data-menu="' + name + '"]') : null
      if (trigger && trigger.getAttribute('aria-expanded') === 'true') closeMenus()
      else openMenu(name)
    }
    function anyMenuOpen() {
      for (var i = 0; i < menuTriggers.length; i += 1) {
        if (menuTriggers[i].getAttribute('aria-expanded') === 'true') return true
      }
      return false
    }
    function updateMapMenu(scene) {
      if (!bar) return
      bar.querySelectorAll('[data-map-scene]').forEach(function (button) {
        button.setAttribute('aria-current', String(button.getAttribute('data-map-scene') === scene))
      })
      if (mapTrigger) mapTrigger.textContent = '地图 · ' + (scene === 'room' ? '房间' : '猪圈') + ' ▾'
    }
    function setState(shape, mode) {
      if (bar) {
        bar.querySelectorAll('[data-object]').forEach(function (button) {
          button.setAttribute('aria-pressed', String(button.getAttribute('data-object') === shape))
        })
        bar.querySelectorAll('[data-edit-mode]').forEach(function (button) {
          button.setAttribute('aria-pressed', String(button.getAttribute('data-edit-mode') === mode))
        })
      }
      if (objectTrigger) objectTrigger.textContent = (SHAPE_LABELS[shape] || SHAPE_LABELS.node) + ' ▾'
      setStatus(statusText(shape, mode))
    }
    function applyPanelSide() { if (objectPanel) objectPanel.setAttribute('data-side', panelSide) }
    function clearFlip() {
      if (flipTimer !== null) clearTimeout(flipTimer)
      flipTimer = null
    }
    function flipPanel() {
      panelSide = panelSide === 'right' ? 'left' : 'right'
      applyPanelSide()
    }
    function setPanelVisible(visible) {
      if (!objectPanel) return
      if (visible) {
        objectPanel.removeAttribute('hidden')
        applyPanelSide()
      } else {
        objectPanel.setAttribute('hidden', '')
        clearFlip()
      }
    }
    function renderPanel(area) {
      if (!objectPanel || !objectList || !objectCount) return
      objectCount.textContent = '障碍 ' + area.blockers.length
      objectList.textContent = ''
      var outerRow = document.createElement('div')
      outerRow.className = 'object-row'
      var outerLabel = document.createElement('span')
      outerLabel.className = 'object-label object-boundary'
      outerLabel.textContent = '外边界'
      outerRow.appendChild(outerLabel)
      objectList.appendChild(outerRow)
      area.blockers.forEach(function (blocker, index) {
        var row = document.createElement('div')
        row.className = 'object-row' + (blocker.hidden === true ? ' is-hidden' : '')
        var label = document.createElement('span')
        label.className = 'object-label'
        var name = blocker.type === 'rect' ? '矩形障碍' : blocker.type === 'circle' ? '圆形障碍' : '手绘障碍'
        label.textContent = name + ' ' + (index + 1)
        row.appendChild(label)
        var eye = document.createElement('button')
        eye.type = 'button'
        eye.textContent = blocker.hidden === true ? '显' : '隐'
        eye.title = blocker.hidden === true ? '显示障碍' : '隐藏障碍'
        eye.addEventListener('click', function () { options.onToggleBlocker(index) })
        row.appendChild(eye)
        var trash = document.createElement('button')
        trash.type = 'button'
        trash.textContent = '删'
        trash.title = '删除障碍'
        trash.addEventListener('click', function () { options.onDeleteBlocker(index) })
        row.appendChild(trash)
        objectList.appendChild(row)
      })
    }

    menuTriggers.forEach(function (trigger) {
      trigger.addEventListener('click', function (event) {
        event.preventDefault()
        event.stopPropagation()
        toggleMenu(trigger.getAttribute('data-menu'))
      })
    })
    document.addEventListener('pointerdown', function (event) {
      if (!anyMenuOpen()) return
      var target = /** @type {any} */ (event.target)
      if (target && target.closest && target.closest('.menu-item')) return
      closeMenus()
    })
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && anyMenuOpen()) closeMenus()
    })
    bar?.querySelectorAll('[data-map-scene]').forEach(function (button) {
      button.addEventListener('click', function () {
        closeMenus()
        options.onScene(button.getAttribute('data-map-scene'))
      })
    })
    bar?.querySelectorAll('[data-object]').forEach(function (button) {
      button.addEventListener('click', function () {
        options.onShape(button.getAttribute('data-object'))
        closeMenus()
      })
    })
    bar?.querySelectorAll('[data-edit-mode]').forEach(function (button) {
      button.addEventListener('click', function () {
        options.onMode(button.getAttribute('data-edit-mode'))
        closeMenus()
      })
    })
    bar?.querySelectorAll('[data-edit-action]').forEach(function (button) {
      button.addEventListener('click', function () {
        var action = button.getAttribute('data-edit-action')
        closeMenus()
        options.onAction(action)
      })
    })
    objectPanel?.addEventListener('pointerenter', function () {
      if (panelPinned || !options.isPointTool()) return
      clearFlip()
      flipTimer = setTimeout(function () {
        flipTimer = null
        flipPanel()
      }, 450)
    })
    objectPanel?.addEventListener('pointerleave', clearFlip)
    objectPin?.addEventListener('click', function () {
      panelPinned = !panelPinned
      objectPin.setAttribute('aria-pressed', String(panelPinned))
      objectPin.textContent = panelPinned ? '解' : '锁'
      objectPin.title = panelPinned ? '解锁面板' : '锁定面板'
      if (panelPinned) clearFlip()
    })
    objectFlip?.addEventListener('click', function () { clearFlip(); flipPanel() })

    return {
      anyMenuOpen: anyMenuOpen,
      closeMenus: closeMenus,
      renderPanel: renderPanel,
      setPanelVisible: setPanelVisible,
      setState: setState,
      setStatus: setStatus,
      updateMapMenu: updateMapMenu,
    }
  }

  ;/** @type {any} */ (window).PiggyRoomEditorUI = { create: create }
})()
