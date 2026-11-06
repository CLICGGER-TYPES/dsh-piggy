// @ts-check
/** 联机房间边界编辑器的菜单条、模式按钮和底部提示。 */
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
      return '编辑 · ' + name + '：拖障碍移动，拖小方块改形状。'
    }
    if (shape === 'node') return '新建 · 边界节点：点地面加边界点，已有节点可直接拖。'
    if (shape === 'rect') return '新建 · 矩形障碍：在地面上拖出一个矩形。'
    if (shape === 'circle') return '新建 · 圆形障碍：在地面上拖出一个圆形。'
    return '新建 · 手绘障碍：点地面加节点，点第一个点或双击闭合；按住 Shift 拉直线。'
  }

  function create(options) {
    var bar = options.bar
    var status = options.status
    var menuTriggers = bar ? Array.prototype.slice.call(bar.querySelectorAll('[data-menu]')) : []
    var mapTrigger = bar ? bar.querySelector('[data-menu="map"]') : null
    var objectTrigger = bar ? bar.querySelector('[data-menu="object"]') : null

    function setStatus(text) {
      if (!status) return
      status.textContent = text
      status.hidden = text === ''
    }
    function setUndoEnabled(enabled) {
      if (!bar) return
      bar.querySelectorAll('[data-edit-action="undo"]').forEach(function (button) {
        button.disabled = !enabled
      })
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

    return {
      anyMenuOpen: anyMenuOpen,
      closeMenus: closeMenus,
      setState: setState,
      setStatus: setStatus,
      setUndoEnabled: setUndoEnabled,
      updateMapMenu: updateMapMenu,
    }
  }

  ;/** @type {any} */ (window).PiggyRoomEditorUI = { create: create }
})()
