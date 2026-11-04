// @ts-check
/** 商店、背包、购买确认和菜园覆盖层视图。 */
/** @param {any} state @param {any} modules @returns {any} */
export function createFarmCommerceRenderer(state, modules) {
  function product(app, item, className) {
      if (item.category !== 'seed') return modules.host.img(app, className, itemArt(item), item.emoji)
      var packet = modules.host.bg(app, app.el('span', className + ' fm-packet'), 'seed-packet')
      modules.host.put(packet, modules.host.img(app, null, itemArt(item), item.emoji))
      return packet
    }

  function itemArt(item) { return item.key.indexOf('helper-') === 0 ? 'tab-icon-helper' : item.key.indexOf('fert-') === 0 ? item.key : item.category === 'tool' ? 'tool-' + item.key : 'produce-' + item.key }

  function shopItems(data) {
      return data.shelf.items.map(function (entry) {
        var seed = modules.events.seedOf(data, entry.key), tool = data.tools.find(function (item) { return item.key === entry.key })
        return Object.assign({}, entry, seed || {}, { label: entry.label, category: seed ? 'seed' : tool ? 'tool' : entry.key.indexOf('helper-') === 0 ? 'helper' : 'fert', owned: tool && tool.owned })
      })
    }

  function tileNode(app, spec) {
      var node = app.button('dp-tile fm-tile' + (spec.soft === false ? '' : ' dp-tile-soft'), spec.data || {}, function () { spec.onPick() })
      node.setAttribute('data-color', spec.color || 'green'); if (spec.locked) node.setAttribute('data-locked', 'true'); if (spec.dim) node.setAttribute('data-dim', 'true')
      var icon = modules.host.put(node, app.el('span', 'dp-tile-icon'))
      if (spec.art) modules.host.put(icon, spec.art)
      else modules.host.put(icon, app.el('span', 'dp-tile-e', spec.emoji || '🌱'))
      if (spec.badge) modules.host.put(icon, app.el('b', 'dp-tile-badge', spec.badge))
      modules.host.put(node, app.el('span', 'dp-tile-n', spec.label)); if (spec.note) modules.host.put(node, app.el('span', 'dp-tile-note', spec.note))
      return node
    }

  function emptyTile(app, text, extra) {
      var node = app.el('div', 'fm-note', text); if (extra) extra.forEach(function (child) { modules.host.put(node, child) })
      return node
    }

  function helperToggle(app, panel, enabled) {
      var toggle = modules.host.put(panel, app.button('dp-btn fm-helper-card fm-helper-toggle', {
        type: 'button', role: 'switch', 'aria-checked': String(enabled),
        'aria-label': enabled ? '暂停帮工托管' : '开启帮工托管', 'data-farm-helper-toggle': 'true',
      }, function () {
        if (state.inflight) return
        modules.events.rememberScroll(app, modules.events.pageKey(app))
        modules.events.sendAction(app, 'toggleHelper', { enabled: !enabled })
      }))
      var toggleCopy = modules.host.put(toggle, app.el('span', 'fm-helper-toggle-copy'))
      modules.host.put(toggleCopy, app.el('b', null, '托管开关 · ' + (enabled ? '开启中' : '暂停中')))
      modules.host.put(toggleCopy, app.el('small', null, '控制整个帮工托管'))
      var switchTrack = modules.host.put(toggle, app.el('span', 'fm-helper-switch')); switchTrack.setAttribute('aria-hidden', 'true')
      modules.host.put(switchTrack, app.el('i'))
      toggle.disabled = !!state.inflight
      return toggle
    }

  function helperStorage(app, panel, helper) {
      var storage = modules.host.put(panel, app.el('div', 'fm-helper-card fm-helper-storage'))
      var storageCopy = modules.host.put(storage, app.el('div', 'fm-helper-copy'))
      modules.host.put(storageCopy, app.el('b', null, '帮工仓'))
      modules.host.put(storageCopy, app.el('small', null, helper.stored > 0 ? helper.stored + ' 个待领取 · 库存会保留' : '暂时没有待领取'))
      if (helper.stored > 0) modules.host.put(storage, modules.host.button(app, 'fm-helper-action', { 'data-farm-helper-storage': 'open' }, '去背包', function () { modules.events.goBag(app, 'crop') }))
      return storage
    }

  function helperFooter(app, panel, enabled) {
      modules.host.put(panel, app.el('small', 'fm-helper-footer', enabled
        ? '帮工照料、收获后入仓并按现有种子补种；作物按原时间自然生长。'
        : '暂停时照料、收获与补种停止；作物自然生长，帮工仓库存仍可领取。'))
    }

  function helperStatus(app, panel, title, note, enabled) {
      var status = modules.host.put(panel, app.el('div', 'fm-helper-card fm-helper-status'))
      var main = modules.host.put(status, app.el('div', 'fm-helper-status-main'))
      modules.host.put(main, modules.host.img(app, 'fm-helper-status-icon', 'tab-icon-helper'))
      var copy = modules.host.put(main, app.el('div', 'fm-helper-copy'))
      modules.host.put(copy, app.el('b', null, title))
      modules.host.put(copy, app.el('small', null, note))
      var badge = modules.host.put(status, app.el('span', 'fm-helper-badge', enabled ? '正在托管' : '已暂停'))
      badge.setAttribute('data-enabled', String(enabled))
      return status
    }

  /** 旧服务端（4.2.x）没有 workers：退回原单帮工卡片，升级档也照旧。 */
  function renderHelperSingle(app, data, box, items) {
      var helper = data.helper, enabled = helper.enabled === true
      var panel = modules.host.put(box, app.el('section', 'fm-helper-panel')); panel.setAttribute('aria-label', '帮工托管')
      helperStatus(app, panel, '帮工猪', '已雇用 · 管 ' + helper.plots + ' 块地', enabled)
      helperToggle(app, panel, enabled)

      var upgrade = items.find(function (item) { return item.key === 'helper-level' })
      if (upgrade) {
        var upgradeCard = modules.host.put(panel, app.el('div', 'fm-helper-card fm-helper-upgrade'))
        var upgradeHead = modules.host.put(upgradeCard, app.el('div', 'fm-helper-card-head'))
        modules.host.put(upgradeHead, app.el('b', 'fm-helper-label', '帮工升级'))
        modules.host.put(upgradeHead, app.el('span', 'fm-helper-price', upgrade.price.toLocaleString('zh-CN') + ' 菜币'))
        modules.host.put(upgradeCard, app.el('small', 'fm-helper-desc', '下一档：' + upgrade.label + ' · ' + upgrade.note))
        var upgradeButton = modules.host.put(upgradeCard, modules.host.button(app, 'fm-helper-action', { 'data-farm-item': upgrade.key, 'aria-label': '查看帮工升级' }, '查看升级', function () {
          modules.events.rememberScroll(app, modules.events.pageKey(app)); state.purchase = upgrade; state.quantity = 1; state.modalReturn = { attr: 'data-farm-item', value: upgrade.key }; app.rerender()
        }))
        upgradeButton.setAttribute('aria-disabled', String(!!upgrade.disabled))
      }

      helperStorage(app, panel, helper)
      helperFooter(app, panel, enabled)
    }

  /** 多帮工总览 + 列表：每只一行，角色按钮只改角色，不碰结算。 */
  function renderHelperCrew(app, data, box, items) {
      var helper = data.helper, enabled = helper.enabled === true, workers = helper.workers
      var max = helper.max || 5
      var patrol = workers.filter(function (worker) { return worker.role === 'patrol' }).length
      var harvest = workers.length - patrol
      var panel = modules.host.put(box, app.el('section', 'fm-helper-panel')); panel.setAttribute('aria-label', '帮工托管')
      helperStatus(app, panel, '帮工 ' + workers.length + '/' + max,
        '收菜 ' + harvest + ' 只 · 巡逻 ' + patrol + ' 只 · 共管 ' + helper.plots + ' 块地', enabled)

      var list = modules.host.put(panel, app.el('div', 'fm-helper-workers')); list.setAttribute('role', 'list'); list.setAttribute('aria-label', '帮工列表')
      workers.forEach(function (worker) {
        var row = modules.host.put(list, app.el('div', 'fm-helper-worker')); row.setAttribute('role', 'listitem'); row.setAttribute('data-farm-helper-worker', String(worker.id))
        modules.host.put(row, app.el('b', 'fm-helper-worker-id', '#' + worker.id))
        var badge = modules.host.put(row, app.el('span', 'fm-role-badge', worker.roleLabel || (worker.role === 'patrol' ? '巡逻' : '收菜')))
        badge.setAttribute('data-role', worker.role === 'patrol' ? 'patrol' : 'harvest')
        modules.host.put(row, app.el('span', 'fm-helper-worker-plots', worker.role === 'patrol' ? '不占地' : '收 ' + (worker.plotCount || 0) + ' 块'))
        var target = worker.role === 'patrol' ? 'harvest' : 'patrol'
        var button = modules.host.put(row, modules.host.button(app, 'fm-role-btn', {
          type: 'button', 'data-farm-role': target, 'data-farm-helper-id': String(worker.id),
          'aria-label': '把 #' + worker.id + ' 帮工改成' + (target === 'harvest' ? '收菜' : '巡逻'),
          'aria-disabled': String(!!state.inflight),
        }, target === 'harvest' ? '改收菜' : '改巡逻', function () {
          if (state.inflight) return
          modules.events.rememberScroll(app, modules.events.pageKey(app))
          modules.events.setRole(app, worker.id, target)
        }))
        button.disabled = !!state.inflight
      })

      if (helper.plots === 0) modules.host.put(panel, app.el('small', 'fm-helper-warning', '没有收菜帮工，菜不会自动收'))

      helperToggle(app, panel, enabled)

      var additional = items.find(function (item) { return item.key === 'helper-additional' })
      if (additional) {
        var hireCard = modules.host.put(panel, app.el('div', 'fm-helper-card'))
        var hireHead = modules.host.put(hireCard, app.el('div', 'fm-helper-card-head'))
        modules.host.put(hireHead, app.el('b', 'fm-helper-label', '再雇一只帮工猪'))
        modules.host.put(hireHead, app.el('span', 'fm-helper-price', additional.price.toLocaleString('zh-CN') + ' 菜币'))
        modules.host.put(hireCard, app.el('small', 'fm-helper-desc', '默认收菜 4 块地，雇来后可随时改成巡逻。'))
        var hireButton = modules.host.put(hireCard, modules.host.button(app, 'fm-helper-action', { 'data-farm-item': additional.key, 'aria-label': '追加雇佣帮工猪' }, '去雇佣', function () {
          if (state.inflight) return
          modules.events.rememberScroll(app, modules.events.pageKey(app)); state.purchase = additional; state.quantity = 1; state.modalReturn = { attr: 'data-farm-item', value: additional.key }; app.rerender()
        }))
        hireButton.setAttribute('aria-disabled', String(!!state.inflight || !!additional.disabled))
        hireButton.disabled = !!state.inflight
      }

      helperStorage(app, panel, helper)
      helperFooter(app, panel, enabled)
    }

  function renderHelperControls(app, data, box, items) {
      if (Array.isArray(data.helper.workers) && data.helper.workers.length) return renderHelperCrew(app, data, box, items)
      return renderHelperSingle(app, data, box, items)
    }

  function renderShop(app, data, box) {
      var wallet = modules.host.put(box, app.el('div', 'fm-shop-wallet'))
      modules.host.put(wallet, modules.host.img(app, 'fm-shop-coin', 'coin-veg')); modules.host.put(wallet, app.el('span', null, '菜币 ' + data.balance))
      var tabs = modules.host.put(box, app.el('div', 'fm-tabs')); tabs.setAttribute('role', 'tablist')
      ;[['seed', '种子'], ['tool', '工具'], ['fert', '肥料'], ['helper', '帮工']].forEach(function (tab) {
        var node = modules.host.put(tabs, modules.host.bg(app, app.button('dp-btn fm-tab', { role: 'tab', 'data-farm-tab': tab[0], 'aria-selected': String(state.shopTab === tab[0]) }, function () { modules.events.rememberScroll(app, modules.events.pageKey(app)); state.shopTab = tab[0]; app.rerender() }), state.shopTab === tab[0] ? 'shop-tab-active' : 'shop-tab'))
        modules.host.put(node, modules.host.img(app, null, 'tab-icon-' + tab[0])); modules.host.put(node, app.el('span', null, tab[1]))
      })
      var items = shopItems(data)
      if (state.shopTab === 'helper' && data.helper && data.helper.hired) renderHelperControls(app, data, box, items)
      // 帮工面板已经带升级 / 追加雇佣入口，货架不再重复放同一张卡片。
      var crew = data.helper && data.helper.hired && Array.isArray(data.helper.workers) && data.helper.workers.length > 0
      var visibleItems = items.filter(function (item) {
        if (item.category !== state.shopTab) return false
        if (!(state.shopTab === 'helper' && data.helper && data.helper.hired)) return true
        return item.key !== 'helper-level' && !(crew && item.key === 'helper-additional')
      })
      if (visibleItems.length) {
        var grid = modules.host.put(box, app.el('div', 'dp-tiles fm-tiles')); grid.setAttribute('role', 'tabpanel')
        grid.setAttribute('data-scroll-key', 'farm-shop:' + state.shopTab)
        visibleItems.sort(function (a, b) { return Number(a.disabled) - Number(b.disabled) }).forEach(function (item) {
        var seed = modules.events.seedOf(data, item.key)
        var note = item.price + ' 菜币' + (item.locked ? ' · 需要 ' + item.level + ' 级' : item.owned ? ' · 已拥有' : item.disabled ? ' · 菜币不足' : '')
        modules.host.put(grid, tileNode(app, { color: { seed: 'green', tool: 'blue', fert: 'teal', helper: 'purple' }[item.category], emoji: item.emoji, art: product(app, item, 'fm-product'), label: item.label, note: note, badge: seed && seed.count > 0 ? '×' + seed.count : '', locked: item.locked, dim: !!item.disabled, data: { 'data-farm-item': item.key, 'aria-disabled': String(!!item.disabled) },
          onPick: function () { modules.events.rememberScroll(app, modules.events.pageKey(app)); state.purchase = item; state.quantity = 1; state.modalReturn = { attr: 'data-farm-item', value: item.key }; app.rerender() } }))
        })
      }
    }

  function renderBag(app, data, box) {
      var tabs = modules.host.put(box, app.el('div', 'fm-tabs fm-tabs-3')); tabs.setAttribute('role', 'tablist')
      ;[['seed', '种子'], ['crop', '蔬菜'], ['item', '道具']].forEach(function (tab) {
        modules.host.put(tabs, app.button('dp-btn fm-tab', { role: 'tab', 'data-farm-bag-tab': tab[0], 'aria-selected': String(state.bagTab === tab[0]) }, function () { modules.events.rememberScroll(app, modules.events.pageKey(app)); state.bagTab = tab[0]; app.rerender() })).appendChild(app.el('span', null, tab[1]))
      })
      if (data.helper && data.helper.stored > 0) modules.host.put(box, modules.host.button(app, 'dp-mini', { 'data-farm-helper': 'collect' }, '把帮工仓库的 ' + data.helper.stored + ' 个搬进来', function () { modules.events.sendAction(app, 'collect', {}) }))
      var crops = data.harvest.filter(function (crop) { return crop.count > 0 })
      var worth = crops.reduce(function (sum, crop) { return sum + crop.count * crop.sell }, 0)
      if (state.bagTab === 'crop' && crops.length) {
        var bar = modules.host.put(box, app.el('div', 'fm-bag-tools'))
        modules.host.put(bar, app.el('span', 'fm-note', '蔬菜共值 ' + worth + ' 菜币'))
        modules.host.put(bar, modules.host.button(app, 'dp-mini', { 'data-farm-sell-everything': 'true' }, '全部卖掉 ' + data.currency.emoji + ' ' + worth, function () { state.openCrop = null; app.send('sell', { item: '*' }) }))
      }
      var grid = modules.host.put(box, app.el('div', 'dp-tiles fm-tiles')); grid.setAttribute('role', 'tabpanel')
      grid.setAttribute('data-scroll-key', 'farm-bag:' + state.bagTab)
      if (state.bagTab === 'seed') {
        var seeds = data.seeds.filter(function (seed) { return seed.count > 0 })
        if (!seeds.length) { modules.host.put(grid, emptyTile(app, '还没有种子，去商店看看。', [modules.host.button(app, 'dp-mini', { 'data-farm-shop': 'seed' }, '去买种子', function () { modules.events.goShop(app, 'seed') })])); return }
        seeds.forEach(function (seed) { modules.host.put(grid, tileNode(app, { color: 'green', art: product(app, { key: seed.key, category: 'seed', emoji: seed.emoji }, 'fm-product'), label: seed.label, badge: '×' + seed.count, data: { 'data-farm-seed': seed.key, 'aria-pressed': String(state.hand.kind === 'seed' && state.hand.key === seed.key) },
          onPick: function () { state.hand = { kind: 'seed', key: seed.key }; state.popup = null; app.rerender() } })) })
        return
      }
      if (state.bagTab === 'crop') {
        if (!crops.length) { modules.host.put(grid, emptyTile(app, '还没有收成。')); return }
        crops.forEach(function (item) {
          var open = state.openCrop === item.key
          modules.host.put(grid, tileNode(app, { color: 'orange', art: product(app, item, 'fm-product'), label: item.label, note: '卖 ' + item.sell + '/个', badge: '×' + item.count, data: { 'data-farm-crop': item.key, 'aria-expanded': String(open), 'aria-label': item.label + ' ' + item.count + ' 个' },
            onPick: function () { state.openCrop = open ? null : item.key; app.rerender() } }))
          if (!open) return
          var sell = modules.host.put(grid, app.el('div', 'fm-sellbar'))
          modules.host.put(sell, app.el('span', 'fm-note', item.label + ' · 一个卖 ' + item.sell))
          modules.host.put(sell, modules.host.button(app, 'dp-mini', { 'data-farm-sell': item.key }, '卖一个', function () { app.send('sell', { item: item.key }) }))
          if (item.count > 1) modules.host.put(sell, modules.host.button(app, 'dp-mini', { 'data-farm-sell-all': item.key }, '全卖 ' + data.currency.emoji + ' ' + item.count * item.sell, function () { state.openCrop = null; app.send('sell', { item: item.key, count: item.count }) }))
          if (item.food) modules.host.put(sell, modules.host.button(app, 'dp-mini dp-mini-plain', { 'data-farm-store': item.key }, '放进背包 · ' + item.foodLabel, function () { app.send('store', { item: item.key }) }))
        })
        return
      }
      var ferts = data.fert.filter(function (fert) { return fert.count > 0 })
      ferts.forEach(function (item) { modules.host.put(grid, tileNode(app, { color: 'teal', art: modules.host.img(app, 'fm-product', item.key, '🧪'), label: item.label, note: '多长 ' + item.hours + ' 小时', badge: '×' + item.count, data: { 'data-farm-fert': item.key, 'aria-pressed': String(state.hand.kind === 'fert' && state.hand.key === item.key) },
        onPick: function () { state.hand = { kind: 'fert', key: item.key }; state.popup = null; modules.events.say(app, '点正在长的地施' + item.label) } })) })
      data.tools.filter(function (tool) { return tool.owned }).forEach(function (tool) {
        modules.host.put(grid, tileNode(app, { color: 'blue', art: modules.host.img(app, 'fm-product', 'tool-' + tool.key, '🧰'), label: tool.label, note: '已拥有 · 工具里用', data: { 'data-farm-owned-tool': tool.key },
          onPick: function () { state.drawerOpen = true; state.popup = null; app.rerender() } }))
      })
      if (!ferts.length && !data.tools.some(function (tool) { return tool.owned })) modules.host.put(grid, emptyTile(app, '还没有肥料或道具。', [modules.host.button(app, 'dp-mini', { 'data-farm-shop': 'fert' }, '去买肥料', function () { modules.events.goShop(app, 'fert') })]))
    }

  function modal(app, root, className, cancel) {
      state.cancelLayer = cancel
      var mask = modules.host.put(root, app.el('div', 'fm-mask')); mask.addEventListener('click', function (event) { if (event.target === mask) { event.stopPropagation(); cancel() } })
      var box = modules.host.put(mask, modules.host.frame(app, app.el('div', className)))
      box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true')
      box.setAttribute('data-scroll-key', 'farm-dialog:' + (state.purchase ? state.purchase.key : 'clear'))
      return box
    }

  function modalButtons(app, box, run, cancel, disabled) {
      var row = modules.host.put(box, app.el('div', 'fm-modal-buttons')); modules.host.put(row, modules.host.bg(app, modules.host.button(app, 'dp-mini fm-confirm', { 'data-farm-confirm': 'true' }, '确定', run), 'btn-confirm')).disabled = !!disabled
      modules.host.put(row, modules.host.bg(app, modules.host.button(app, 'fm-cancel', { 'data-farm-cancel': 'true' }, '取消', cancel), 'btn-cancel'))
    }

  function renderPurchase(app, data, root) {
      var item = state.purchase
      var cancel = function () { modules.events.rememberScroll(app, modules.events.pageKey(app)); state.purchase = null; app.rerender() }
      var box = modal(app, root, 'fm-buy', cancel); box.setAttribute('aria-label', item.label)
      modules.host.put(box, modules.host.bg(app, app.el('b', 'fm-title', item.label), 'buy-title'))
      var columns = modules.host.put(box, app.el('div', 'fm-buy-columns'))
      modules.host.put(columns, product(app, item, 'fm-buy-art'))
      var info = modules.host.put(columns, app.el('div', 'fm-buy-info'))
      var rows = item.category === 'seed' ? [['成熟时间', item.hours + ' 小时'], ['能收几季', item.seasons + ' 季'], ['预计产量', item.yield + ' 个 / 季'], ['果实售价', item.sell + ' 菜币 / 个'], ['预计收入', item.yield * item.sell * item.seasons + ' 菜币'], ['收获经验', item.exp + ' / 季'], ['需要等级', item.level + ' 级']] : [['说明', item.note]]
      rows.forEach(function (row) { modules.host.put(info, modules.host.bg(app, app.el('div', 'fm-info-row', row[0] + '　' + row[1]), 'info-row')) })
      var many = item.category === 'seed' || item.category === 'fert'
      var stepper = modules.host.put(box, app.el('div', 'fm-stepper'))
      modules.host.put(stepper, app.el('span', null, '数量'))
      modules.host.put(stepper, modules.host.bg(app, modules.host.button(app, 'fm-step', { 'data-farm-quantity': 'minus', 'aria-label': '减少数量' }, '−', function () { state.quantity = Math.max(1, state.quantity - 1); app.rerender() }), 'stepper-minus')).disabled = !many || state.quantity === 1
      var field = modules.host.put(stepper, modules.host.bg(app, app.el('input', 'fm-quantity'), 'stepper-field')); field.type = 'number'; field.min = '1'; field.max = many ? '99' : '1'; field.value = String(state.quantity); field.disabled = !many; field.setAttribute('aria-label', '数量'); field.setAttribute('data-farm-quantity-field', 'true')
      ;['input', 'change'].forEach(function (type) { field.addEventListener(type, function () {
        state.quantity = Math.max(1, Math.min(many ? 99 : 1, Math.floor(Number(field.value) || 1)))
        total.textContent = '总价 ' + state.quantity * item.price + ' 菜币'; total.setAttribute('data-farm-total', String(state.quantity * item.price))
        box.querySelector('[data-farm-confirm]').disabled = item.disabled || state.quantity * item.price > data.balance
        ;['minus', 'plus'].forEach(function (key) { box.querySelector('[data-farm-quantity="' + key + '"]').disabled = !many || state.quantity === (key === 'minus' ? 1 : 99) })
        if (type === 'change') field.value = String(state.quantity)
      }) })
      modules.host.put(stepper, modules.host.bg(app, modules.host.button(app, 'fm-step', { 'data-farm-quantity': 'plus', 'aria-label': '增加数量' }, '+', function () { state.quantity = Math.min(99, state.quantity + 1); app.rerender() }), 'stepper-plus')).disabled = !many || state.quantity === 99
      var total = modules.host.put(box, app.el('div', 'fm-total', '总价 ' + state.quantity * item.price + ' 菜币' + (item.price > data.balance ? ' · 菜币不足' : item.level > data.level ? ' · 需要 ' + item.level + ' 级' : ''))); total.setAttribute('data-farm-total', String(state.quantity * item.price))
      modalButtons(app, box, function () { state.pendingAction = { op: 'buy', item: item, count: state.quantity, before: data }; modules.events.rememberScroll(app, modules.events.pageKey(app)); app.send('buy', { item: item.key, count: state.quantity }); state.purchase = null; app.rerender() }, cancel, item.disabled || state.quantity * item.price > data.balance)
    }

  function pageHead(app, box, title) {
      var head = modules.host.put(box, app.el('div', 'fm-page-head'))
      modules.host.put(head, modules.host.button(app, 'dp-drill-back fm-page-back', { 'data-farm-back': 'true', 'aria-label': '返回菜地' }, '‹', function () { modules.events.closePage(app) }))
      modules.host.put(head, app.el('b', 'fm-title', title))
      return head
    }

  function renderLayers(app, data, root) {
      state.cancelLayer = null
      if (state.popup) {
        var box = modules.host.put(root, app.el('div', 'fm-pop' + (state.popup === 'shop' ? ' fm-shop' : '')))
        box.setAttribute('data-scroll-key', 'farm-popup:' + state.popup + ':' + (state.popup === 'shop' ? state.shopTab : state.popup === 'bag' ? state.bagTab : 'wallet'))
        box.setAttribute('data-farm-overlay', state.popup)
        modules.host.frame(app, box)
        pageHead(app, box, { shop: '农场商店', bag: '背包', wallet: '菜币' }[state.popup])
        if (state.popup === 'shop') renderShop(app, data, box)
        else if (state.popup === 'bag') renderBag(app, data, box)
        else if (app.walletContent) modules.host.put(box, app.walletContent())
        else modules.host.put(box, app.el('div', 'fm-note', '钱包在设置里。'))
      }
      if (state.purchase) renderPurchase(app, data, root)
      if (state.confirmClear !== null) {
        var index = state.confirmClear, cancel = function () { modules.events.rememberScroll(app, modules.events.pageKey(app)); state.confirmClear = null; app.rerender() }
        var box = modal(app, root, 'fm-clear-confirm', cancel); box.setAttribute('aria-label', '铲除确认')
        modules.host.put(box, modules.host.bg(app, app.el('b', 'fm-title', '铲掉正在长的' + data.plots[index].label + '？'), 'shop-title'))
        modules.host.put(box, modules.host.img(app, 'fm-clear-art', 'produce-' + data.plots[index].crop))
        modalButtons(app, box, function () { modules.events.rememberScroll(app, modules.events.pageKey(app)); state.confirmClear = null; modules.events.act(app, index, '🪏', 'clear', { plot: index, force: true }) }, cancel)
      }
    }

  return { product, itemArt, shopItems, tileNode, emptyTile, renderHelperControls, renderShop, renderBag, modal, modalButtons, renderPurchase, pageHead, renderLayers }
}
