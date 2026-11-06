// @ts-check
/** 联机房间边界编辑器的菜单条、底部提示和右侧对象面板。 */
;(function () {
  var LABELS = {
    add: '新建 · 边界节点：点地面加边界点。',
    outer: '编辑 · 拖动边界节点：拖小圆点调整边界。',
    'delete-node': '删除 · 节点：点边界节点删除，至少保留 3 个。',
    'delete-blocker': '删除 · 障碍：点场景里的障碍删除。',
    rect: '新建 · 矩形障碍：在地面上拖出一个矩形。',
    circle: '新建 · 圆形障碍：在地面上拖出一个圆形。',
    lasso: '新建 · 手绘障碍：按住拖动，画任意形状。',
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
    function updateMenuState() {
      if (!bar) return
      bar.querySelectorAll('[data-edit-tool]').forEach(function (button) {
        var active = button.getAttribute('aria-pressed') === 'true'
        var item = button.closest('.menu-item')
        if (item && active) item.setAttribute('data-active', 'true')
      })
      bar.querySelectorAll('.menu-item').forEach(function (item) {
        if (!item.querySelector('[data-edit-tool][aria-pressed="true"]')) item.removeAttribute('data-active')
      })
    }
    function setTool(tool) {
      if (bar) {
        bar.querySelectorAll('[data-edit-tool]').forEach(function (button) {
          button.setAttribute('aria-pressed', String(button.getAttribute('data-edit-tool') === tool))
        })
      }
      updateMenuState()
      setStatus(LABELS[tool] || '')
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
    bar?.querySelectorAll('[data-edit-tool]').forEach(function (button) {
      button.addEventListener('click', function () {
        options.onTool(button.getAttribute('data-edit-tool'))
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
      setStatus: setStatus,
      setTool: setTool,
      updateMapMenu: updateMapMenu,
    }
  }

  ;/** @type {any} */ (window).PiggyRoomEditorUI = { create: create }
})()
