// @ts-check
/**
 * 菜地、地块、详情、工具与帮工视图。
 * 小农场顶栏左边进入大农场、右边显示菜币；底部保留工具、背包和商店。
 * 大农场仍使用 6×3 地块，菜地、详情与图文工具维持原有顺序。
 * 纸感场景、尺寸和页面文案保持既有设计；本模块只组织现有宿主快照。
 */
/** @param {any} state @param {any} modules @returns {any} */
export function createFarmGardenRenderer(state, modules) {
  function reclaimSign(app, data, index) {
      var node = modules.host.button(app, 'fm-chip fm-expand', { 'data-farm-reclaim': String(index), 'aria-label': '开垦这块荒地 ' + data.reclaimPrice + ' 菜币' }, '开垦 ' + data.reclaimPrice, function (event) { event.stopPropagation(); if (node.parentNode) node.parentNode.removeAttribute('data-farm-hover'); if (!data.plots[index].next) return modules.events.say(app, '要先开前一块荒地'); if (data.balance < data.reclaimPrice) return modules.events.say(app, '开垦要 ' + data.currency.emoji + ' ' + data.reclaimPrice); app.send('unlock', { plot: index }) })
      return modules.host.bg(app, node, 'big-sign-expand')
    }

  function plotCard(app, data, index, kind) {
      var plot = data.plots[index]
      var attrs = { 'data-farm-plot': String(index), 'aria-label': plotLabel(plot) }
      var card = plot.wild ? app.el('div', 'fm-plot') : app.button('fm-plot' + (plot.ripe ? ' fm-ripe' : ''), attrs, function () { modules.events.clickPlot(app, data, index) })
      if (plot.wild) card.setAttribute('role', 'group')
      if (plot.wild) Object.keys(attrs).forEach(function (key) { card.setAttribute(key, attrs[key]) })
      if (plot.wild) card.addEventListener('click', function () { modules.events.clickPlot(app, data, index) })
      modules.host.put(card, modules.host.picture(app, 'fm-soil', modules.host.paper(app, 'paper-soil-patch')))
      var pointerFocus = false
      card.addEventListener('pointerdown', function () { pointerFocus = true })
      card.addEventListener('focus', function () { if (pointerFocus) { pointerFocus = false; return } if (state.selectedPlot !== index) { state.selectedPlot = index; app.rerender() } })
      card.addEventListener('blur', function () { pointerFocus = false })
      card.addEventListener('mousemove', function () { card.setAttribute('data-farm-hover', 'true') })
      card.addEventListener('mouseleave', function () { card.removeAttribute('data-farm-hover') })
      card.addEventListener('click', function () { card.removeAttribute('data-farm-hover') })
      card.setAttribute('data-farm-soil', plot.wild ? 'wild' : modules.events.pestsOf(plot).indexOf('dry') >= 0 ? 'dry' : 'farmed')
      card.setAttribute('data-farm-valid', String(modules.events.validPlot(plot)))
      if (state.fx && !state.fx.lesson && state.fx.plot === index) { card.setAttribute('data-farm-fx', state.fx.kind); card.style.setProperty('--fm-fx-delay', -(Date.now() - state.fx.at) + 'ms') }
      if (plot.wild) {
        if (plot.next) modules.host.put(card, reclaimSign(app, data, index))
        else modules.host.put(card, modules.host.bg(app, app.el('span', 'fm-lock'), 'lock-badge'))
        return card
      }
      if (plot.empty && state.hand.kind === 'seed' && !plot.stubble && modules.events.pestsOf(plot).indexOf('weed') < 0) {
        var ghost = modules.host.put(card, modules.host.bg(app, app.el('span', 'fm-ghost'), 'plot-ghost-seed'))
        modules.host.put(ghost, modules.host.img(app, null, 'produce-' + state.hand.key))
      }
      if (plot.stubble) modules.host.put(card, modules.host.img(app, 'fm-crop', 'withered'))
      if (plot.empty && modules.events.pestsOf(plot).indexOf('weed') >= 0) modules.host.put(card, modules.host.img(app, 'fm-pest', 'weed')).setAttribute('data-pest', 'weed')
      modules.events.pestsOf(plot).forEach(function (pest, n) { var bubble = modules.host.put(card, modules.host.img(app, 'fm-bubble', 'plot-bubble-' + (pest === 'dry' ? 'water' : pest))); bubble.style.right = kind === 'big' ? 'calc(50% - 36px + ' + n * 24 + 'px)' : (n * 23) + '%'; bubble.setAttribute('data-farm-bubble', pest) })
      if (state.tip && state.tipPlot === index && Date.now() - state.tipAt < 2400) renderTip(app, card)
      if (plot.empty) return card
      if (plot.guarded === true && plot.withered !== true) {
        var guard = modules.host.put(card, app.el('span', 'fm-plot-guard', '守')); guard.setAttribute('aria-hidden', 'true')
        card.setAttribute('data-farm-guard', 'true')
        card.setAttribute('aria-label', plotLabel(plot) + ' 有人守')
      }
      if (plot.lossPercent > 0) card.setAttribute('data-farm-loss', String(plot.lossPercent))
      modules.host.put(card, modules.host.img(app, 'fm-crop', modules.events.cropArt(plot), plot.emoji))
      if (modules.events.pestsOf(plot).indexOf('weed') >= 0) modules.host.put(card, modules.host.img(app, 'fm-pest', 'weed')).setAttribute('data-pest', 'weed')
      var chip = plot.ripe ? '收 ' + plot.yield + ' 个' + (plot.lossPercent > 0 ? ' · −' + plot.lossPercent + '%' : '') : plot.withered ? '枯了' : ''
      if (chip) modules.host.put(card, app.el('span', 'fm-chip', chip))
      return card
    }

  function plotLabel(plot) {
      if (plot.wild) return plot.next ? '荒地，点木牌开垦' : '荒地，要先开垦前一块'
      if (plot.empty) return '空地'
      return plot.label + (plot.withered ? ' 枯了' : plot.ripe ? ' 熟了' : modules.events.pestsOf(plot).length ? ' ' + modules.events.pestText(plot, '、') : '')
    }

  function levelBadge(app, data) {
      var node = app.button('dp-btn fm-stat fm-level', { 'data-farm-level': 'info', 'aria-label': '等级与经验' }, function () { modules.events.say(app, '等级 ' + data.level + ' · 经验 ' + data.exp + ' / ' + data.need) })
      modules.host.put(node, app.el('b', null, 'Lv.' + data.level))
      var exp = modules.host.put(node, modules.host.bg(app, app.el('span', 'fm-exp'), 'ui-exp-frame')); exp.setAttribute('title', '经验 ' + data.exp + ' / ' + data.need)
      modules.host.put(exp, app.el('i')).style.width = Math.max(0, Math.min(90, data.exp / data.need * 90)) + '%'
      return node
    }

  function metaRow(app, data, box) {
      var meta = modules.host.put(box, app.el('div', 'fm-advanced-meta')); modules.host.put(meta, levelBadge(app, data))
      modules.host.put(meta, modules.host.button(app, 'fm-meta fm-weather', { 'data-farm-weather': 'info' }, '天气：' + (data.weather === 'rain' ? '下雨' : '晴天'), function () { modules.events.say(app, '天气：' + (data.weather === 'rain' ? '下雨' : '晴天')) }))
      return meta
    }

  function toolSlot(app, spec) {
      var pressed = spec.pressed === true || !!spec.hand && state.hand.kind === spec.hand.kind && state.hand.key === spec.hand.key
      var node = app.button('dp-btn fm-slot', { 'data-farm-tool': spec.key, 'aria-pressed': String(pressed), 'data-locked': String(!!spec.locked), 'aria-label': spec.label, title: spec.label }, function () {
        modules.events.rememberScroll(app, modules.events.pageKey(app))
        state.confirmClear = null
        state.drawerOpen = false
        if (spec.locked) return modules.events.goShop(app, 'tool')
        if (spec.run) return spec.run()
        state.hand = pressed ? state.AUTO : spec.hand
        state.popup = null
        app.rerender()
      })
      node.addEventListener('mousemove', function () { node.setAttribute('data-farm-hover', 'true') }); node.addEventListener('mouseleave', function () { node.removeAttribute('data-farm-hover') }); node.addEventListener('click', function () { node.removeAttribute('data-farm-hover') })
      modules.host.put(node, modules.host.img(app, null, spec.art, spec.emoji))
      modules.host.put(node, app.el('span', 'fm-tool-label', spec.label.split('：')[0].split('（')[0]))
      if (spec.locked) modules.host.put(node, modules.host.bg(app, app.el('span', 'fm-lock'), 'lock-badge'))
      else if (spec.count > 0) modules.host.put(node, app.el('i', 'fm-n', String(spec.count)))
      return node
    }

  function careCount(data, kind) { return data.plots.slice(0, data.unlocked).filter(function (plot) { return modules.events.pestsOf(plot).indexOf(kind) >= 0 }).length }

  function fertCount(data) { return (data.fert || []).reduce(function (sum, fert) { return sum + fert.count }, 0) }

  function allTools(app, data) {
      var all = modules.events.survey(data, 0, data.unlocked)
      var seed = state.hand.kind === 'seed' ? modules.events.seedOf(data, state.hand.key) : null
      var specs = [
        Object.assign({}, state.CARE_TOOLS[3], { count: all.ripe.length }),
        { key: 'seedbag', art: 'tool-seedbag', emoji: '🌰', label: '种子袋：选种子播种', run: function () { modules.events.goBag(app, 'seed') }, count: seed ? seed.count : 0 },
        Object.assign({}, state.CARE_TOOLS[0], { count: careCount(data, 'dry') }),
        { key: 'shovel', art: 'tool-shovel', emoji: '🪏', label: '铁锹：点地铲掉，正在长的作物要确认', hand: { kind: 'shovel', key: null }, count: all.withered.length },
        Object.assign({}, state.CARE_TOOLS[1], { count: careCount(data, 'weed') }),
        Object.assign({}, state.CARE_TOOLS[2], { count: careCount(data, 'bug') }),
      ]
      state.ONE_CLICK.forEach(function (spec) {
        var owned = modules.events.owns(data, spec.key)
        specs.push({ key: spec.key, art: 'tool-' + spec.key, emoji: '🧰', locked: !owned, count: all[{ harvestAll: 'ripe', careAll: 'pests', clearAll: 'withered', plantAll: 'empty' }[spec.op]].length,
          label: owned ? spec.label : spec.label + '（去商店买' + spec.tool + '）', run: function () { if (spec.op !== 'plantAll') return modules.events.sendAction(app, spec.op, {}); var seed = modules.events.seedInHand(data); return seed ? modules.events.sendAction(app, 'plantAll', { item: seed.key }) : modules.events.goShop(app, 'seed') } })
      })
      specs.push({ key: 'fert', art: 'fert-1', emoji: '🧪', label: '肥料：点正在长的地', run: function () { return fertCount(data) > 0 ? modules.events.goBag(app, 'item') : modules.events.goShop(app, 'fert') }, count: fertCount(data) })
      return specs
    }

  function renderDrawer(app, data, box) {
      var drawer = modules.host.put(box, app.el('div', 'fm-drawer'))
      drawer.id = 'dsh-piggy-farm-tools'; drawer.setAttribute('data-farm-drawer', 'tools')
      var grid = modules.host.put(drawer, app.el('div', 'fm-advanced-grid'))
      allTools(app, data).forEach(function (spec) { modules.host.put(grid, toolSlot(app, spec)) })
      var actions = modules.host.put(drawer, app.el('div', 'fm-advanced-actions'))
      if (data.helper) modules.host.put(actions, modules.host.button(app, 'fm-nav-action', { 'data-farm-helper': data.helper.hired ? 'collect' : 'hire', 'aria-label': modules.events.helperText(data.helper) }, modules.events.helperText(data.helper), function () { modules.events.rememberScroll(app, modules.events.pageKey(app)); modules.events.helperClick(app, data.helper, data.now) }))
      if (app.mode !== 'big') metaRow(app, data, drawer)
    }

  function dock(app, data, box) {
      var bar = modules.host.put(box, app.el('div', 'fm-dock'))
      function entry(attrs, label, artwork, run) {
        var node = modules.host.put(bar, modules.host.button(app, 'fm-dock-btn', attrs, '', run))
        modules.host.put(node, modules.host.img(app, null, artwork)); modules.host.put(node, app.el('span', null, label))
      }
      entry({ 'data-farm-tools': 'toggle', 'aria-expanded': String(state.drawerOpen), 'aria-controls': 'dsh-piggy-farm-tools', 'aria-label': '工具' }, '工具', 'tool-gloves', function () { modules.events.rememberScroll(app, modules.events.pageKey(app)); state.drawerOpen = !state.drawerOpen; state.revealTools = state.drawerOpen; app.rerender() })
      entry({ 'data-farm-bag': 'open', 'aria-label': '背包' }, '背包', 'ui-storage', function () { modules.events.goBag(app) })
      entry({ 'data-farm-shop': 'shelf', 'aria-label': '商店' }, '商店', 'ui-shop', function () { modules.events.goShop(app) })
      return bar
    }

  function header(app, data, big, box) {
      if (big && typeof app.closeBig === 'function') modules.host.put(box, modules.host.button(app, 'dp-drill-back fm-back', { 'data-farm-big': 'close', 'aria-label': '回小农场' }, '‹', function () { modules.events.rememberScroll(app, modules.events.pageKey(app)); app.closeBig() }))
      if (big || !app.header) modules.host.put(box, app.el('b', 'fm-garden-title', '菜园'))
      if (!big && typeof app.openBig === 'function') modules.host.put(box, modules.host.button(app, 'fm-big-open', { 'data-farm-big': 'open', 'aria-label': '打开大农场' }, '大农场', function () { modules.events.rememberScroll(app, modules.events.pageKey(app)); app.openBig() }))
      var coin = modules.host.put(box, app.button('dp-btn fm-stat fm-coin', { 'data-farm-coin': 'open', 'aria-label': '菜币余额 ' + data.balance + '，去换菜币' }, function () { modules.events.goPage(app, 'wallet') }))
      modules.host.put(coin, modules.host.img(app, null, 'coin-veg', data.currency.emoji)); modules.host.put(coin, app.el('span', null, '菜币 ' + data.balance))
    }

  function mainAction(data, look) {
      if (state.selectedPlot !== null && data.plots[state.selectedPlot].wild) { var wild = data.plots[state.selectedPlot]; return { label: wild.next ? '开垦这块地' : '尚未解锁', sub: wild.next ? '需要 ' + data.reclaimPrice + ' 菜币' : '先开前一块地', op: 'unlock', payload: { plot: state.selectedPlot }, plot: state.selectedPlot, idle: !wild.next || data.balance < data.reclaimPrice } }
      var one = function (list, label, op, fx, rest) { return { label: label, sub: list.length > 1 ? '还有 ' + (list.length - 1) + ' 块' + rest : '', op: op, payload: { plot: list[0] }, plot: list[0], fx: fx } }
      if (look.ripe.length) return one(look.ripe, '收菜', 'harvest', '✨', '熟了')
      if (look.pests.length) {
        var index = look.pests[0], kind = modules.events.pestsOf(data.plots[index])[0]
        return { label: { dry: '浇这块地', weed: '给这块地除草', bug: '给这块地除虫' }[kind], op: 'care', plot: index, payload: { plot: index, kind: kind }, fx: kind === 'dry' ? '💧' : '✨' }
      }
      if (look.withered.length) return one(look.withered, '铲枯苗', 'clear', '🪏', '枯了')
      var stubble = look.empty.find(function (index) { return data.plots[index].stubble })
      if (stubble >= 0) return { label: '铲杂草', op: 'clear', payload: { plot: stubble }, plot: stubble, fx: '🪏' }
      if (look.empty.length) {
        var seed = modules.events.seedInHand(data)
        if (!seed) return { label: '去买种子', shop: true, plot: look.empty[0] }
        return { label: '种' + seed.label, op: 'plant', payload: { plot: look.empty[0], item: seed.key }, plot: look.empty[0], fx: '🌱' }
      }
      return { label: '都在长', sub: look.soonest < Infinity ? '最快 ' + modules.events.shortTime(look.soonest) : '', idle: true }
    }

  function lessonOf(data) { var on = data.onboarding; return on && !on.legacy && on.step !== 'done' ? on : null }

  function lessonText(on) { return on.canPlant ? '待播种' : on.canHarvest ? '可以收了' : on.canWater ? '待浇水' : '生长中' }

  function lessonAction(on) {
      if (on.canPlant) return { label: '种下第一课', sub: '课内' + on.seed.label + ' ×' + on.seed.count, lesson: true }
      if (on.canHarvest) return { label: '收获第一课', sub: on.reward.currency + ' 菜币 + ' + on.seed.label + ' ×1', lesson: true }
      if (on.canWater) return { label: '浇这块地', sub: '浇水后 2 分钟成熟', lesson: true }
      return { label: '等它长大', sub: '还剩 ' + modules.events.shortTime(on.remainingMs), idle: true }
    }

  function goalText(data, look) {
      var on = data.onboarding
      if (on && !on.legacy && on.step === 'offer') return '先试种一轮。'
      if (on && !on.legacy && on.step === 'planted') return on.canHarvest ? '第一课熟了，收下吧。' : '第一课 · 小葱 · ' + lessonText(on) + '。'
      if (on && !on.legacy && state.lessonRewardAt && Date.now() - state.lessonRewardAt < 60000) return '第一课完成：' + on.reward.currency + ' 菜币 + ' + on.seed.label + ' ×1'
      if (look.ripe.length) return '有 ' + look.ripe.length + ' 块菜能收了。'
      if (look.pests.length) return look.pests.length + ' 块地要照料。'
      if (look.withered.length) return '有枯苗要铲掉。'
      if (look.empty.length) return '点空地种点新菜。'
      return look.soonest < Infinity ? '都在长，最快 ' + modules.events.shortTime(look.soonest) + '。' : ''
    }

  function lessonTile(app, on) {
      var card = app.button('fm-plot fm-s-lesson', { 'data-farm-lesson': on.step, 'data-farm-lesson-plot': 'true', 'data-farm-target': String(state.selectedPlot === null), 'data-farm-next': 'true', 'aria-label': '第一课 小葱 ' + lessonText(on) }, function () { state.selectedPlot = null; doLesson(app, on); app.rerender() })
      if (state.fx && state.fx.lesson) { card.setAttribute('data-farm-fx', state.fx.kind); card.style.setProperty('--fm-fx-delay', -(Date.now() - state.fx.at) + 'ms') }
      modules.host.put(card, modules.host.picture(app, 'fm-soil', modules.host.paper(app, 'paper-soil-patch')))
      if (on.canPlant) {
        var ghost = modules.host.put(card, modules.host.bg(app, app.el('span', 'fm-ghost'), 'plot-ghost-seed'))
        modules.host.put(ghost, modules.host.img(app, null, 'produce-scallion'))
      } else {
        var stage = on.progress >= 1 ? 'ripe' : on.progress >= 2 / 6 ? 'seedling' : 'seed' // 只用服务器给的 progress 选课内三段图，不在页面里重算成熟时间。
        var paperCrop = modules.host.paper(app, 'paper-scallion-' + stage)
        var crop = modules.host.put(card, modules.host.picture(app, 'fm-crop', paperCrop || modules.host.art(app, modules.events.cropArt({ crop: 'scallion', stage: stage })), '🌱'))
        if (paperCrop) crop.setAttribute('data-paper-stage', stage)
      }
      if (on.canWater) modules.host.put(card, modules.host.img(app, 'fm-bubble', 'plot-bubble-water', '💧'))
      modules.host.put(card, app.el('span', 'fm-chip', on.canPlant ? '试种' : on.canHarvest ? '可收' : on.canWater ? '待浇水' : '生长中'))
      return card
    }

  function doLesson(app, on) {
      var op = on.canPlant ? 'plant' : on.canHarvest ? 'harvest' : on.canWater ? 'water' : null
      if (!op || state.inflight) return
      state.fx = null; state.pendingAction = { op: 'onboarding', before: app.data, lessonOp: op }
      return modules.events.sendAction(app, 'onboarding', { op: op })
    }

  function detailCard(app, root, data, on, index) {
      var plot = on ? null : data.plots[index]
      var box = modules.host.put(root, app.el('div', 'fm-s-detail')); box.setAttribute('data-farm-detail', on ? 'lesson' : String(index))
      var head = modules.host.put(box, app.el('div', 'fm-s-detail-head'))
      modules.host.put(head, app.el('b', null, on ? '小葱' : plot.wild ? '荒地' : plot.empty ? '空地' : plot.label))
      modules.host.put(head, app.el('span', 'fm-s-phase', on ? lessonText(on) : plot.wild ? plot.next ? '可开垦' : '尚未解锁' : plot.empty ? plot.stubble ? '剩茬' : '空地' : plot.withered ? '枯了' : plot.ripe ? '可以收了' : modules.events.pestsOf(plot).length ? '要照料 · ' + modules.events.pestText(plot, '、') : { seed: '种子', sprout: '发芽', seedling: '小苗', growing: '长大', flowering: '开花' }[plot.stage] || '生长中'))
      if (plot && plot.wild) {
        var order = modules.host.put(box, app.el('div', 'fm-s-progress'))
        modules.host.put(order, app.el('span', null, '开垦顺序 · ' + (plot.next ? '下一块' : '第 ' + (index - data.unlocked + 1) + ' 块')))
        modules.host.put(box, app.el('small', null, plot.next ? '需要 ' + data.reclaimPrice + ' 菜币 · 点木牌开垦' : '先开前面 ' + (index - data.unlocked) + ' 块 · 价格同样 ' + data.reclaimPrice + ' 菜币'))
        return box
      }
      var progress = Math.max(0, Math.min(1, on ? on.progress : plot.progress || 0))
      var line = modules.host.put(box, app.el('div', 'fm-s-progress')); line.setAttribute('data-farm-progress', String(Math.round(progress * 100)))
      modules.host.put(line, app.el('span', null, '生长进度'))
      var track = modules.host.put(line, app.el('span', 'fm-s-track')); modules.host.put(track, app.el('i')).style.width = Math.round(progress * 100) + '%'
      var text = on ? on.canPlant ? '课内' + on.seed.label + ' ×' + on.seed.count : on.canHarvest ? '点主按钮收获' : on.canWater ? '浇水后 2 分钟成熟' : '还剩 ' + modules.events.shortTime(on.remainingMs) : plot.empty ? '先选种子 / 去商店买' : plot.ripe ? '收 ' + plot.yield + ' 个 · 等主按钮' : plot.withered ? '用铁锹铲掉' : (plot.helper && data.helper && data.helper.continuous ? '帮工照料 · ' : '') + '还剩 ' + modules.events.shortTime(plot.remainingMs)
      if (!on && plot && !plot.wild && Number.isInteger(plot.zone)) text += ' · 巡逻区 ' + (plot.zone + 1) + '（' + plot.zoneFrom + '–' + plot.zoneTo + ' 号地）· ' + (plot.guarded === true ? '有人守' : '无人看守')
      if (!on && plot && plot.lossPercent > 0) text += ' · ' + plot.lossNote
      modules.host.put(box, app.el('small', null, text))
      return box
    }

  function renderGarden(app, data) {
      var big = app.mode === 'big'
      var root = app.el('div', big ? 'fm fm-big' : 'fm'); root.setAttribute('data-scroll-page', big ? 'farm-large' : 'farm')
      if (big) root.setAttribute('data-scroll-key', 'farm-large:page')
      var panel = typeof app.content.closest === 'function' ? app.content.closest('.dp-card') : null
      if (panel && parseFloat(panel.style.maxHeight) < 450) root.setAttribute('data-farm-compact', 'true')
      var lesson = lessonOf(data), on = state.selectedPlot === null ? lesson : null, shown = Math.min(big ? data.total - (lesson ? 1 : 0) : lesson ? state.SMALL_PLOTS - 1 : state.SMALL_PLOTS, data.total)
      var all = modules.events.survey(data, 0, data.unlocked)
      var action = on ? lessonAction(on) : mainAction(data, modules.events.survey(data, state.selectedPlot === null ? 0 : state.selectedPlot, state.selectedPlot === null ? shown : state.selectedPlot + 1))
      var focus = state.selectedPlot === null ? action.plot : state.selectedPlot
      if (focus === undefined) { focus = 0; for (var at = 0; at < shown; at += 1) if (data.plots[at] && !data.plots[at].empty) { focus = at; break } }
      var head = modules.host.put(root, app.el('div', 'fm-s-header'))
      header(app, data, big, head)
      if (!big && app.header) { root.setAttribute('data-farm-integrated', 'true'); while (head.firstChild) app.header.appendChild(head.firstChild) }
      var body = big ? modules.host.put(root, app.el('div', 'fm-b-body')) : root
      var stage = big ? modules.host.put(body, app.el('div', 'fm-b-stage')) : body
      modules.host.put(stage, app.el('div', 'fm-s-goal', goalText(data, all)))
      var scene = modules.host.put(stage, modules.host.paint(app.el('div', 'fm-s-scene'), modules.host.paper(app, big ? 'paper-garden-wide' : 'paper-garden-background')))
      var field = modules.host.put(scene, app.el('div', 'fm-s-field')); field.setAttribute('data-farm-grid', big ? 'expanded' : 'compact')
      if (lesson) modules.host.put(field, lessonTile(app, lesson))
      for (var index = 0; index < shown; index += 1) {
        var card = modules.host.put(field, plotCard(app, data, index, big ? 'big' : 'small'))
        if (!on && focus === index) { card.setAttribute('data-farm-next', 'true'); card.setAttribute('data-farm-target', 'true') }
      }
      if (state.fx && state.fx.lesson && !on) { scene.setAttribute('data-farm-fx', state.fx.kind); scene.style.setProperty('--fm-fx-delay', -(Date.now() - state.fx.at) + 'ms') }
      var noteFrom = shown
      if (!big && data.unlocked > noteFrom) {
        var rest = modules.events.survey(data, noteFrom, data.unlocked)
        var parts = [[rest.ripe, ' 块熟了'], [rest.pests, ' 块要照料'], [rest.withered, ' 块枯了'], [rest.empty, ' 块空着']].filter(function (p) { return p[0].length }).map(function (p) { return p[0].length + p[1] })
        modules.host.put(stage, app.el('div', 'fm-s-note', '另外 ' + (data.unlocked - noteFrom) + ' 块地：' + (parts.join('，') || '都在长')))
      }
      var side = big ? modules.host.put(body, app.el('div', 'fm-b-controls')) : stage
      var detail = detailCard(app, side, data, on, focus)
      var plank = modules.host.put(side, app.el('div', 'fm-s-plank'))
      if (!action.shop && !action.idle) {
      detail.setAttribute('data-has-action', 'true')
      var row = modules.host.put(detail, app.el('div', 'fm-s-acts'))
      var main = modules.host.put(row, app.button('dp-mini fm-main', { 'data-farm-main': action.lesson ? 'onboarding' : action.op || (action.shop ? 'shop' : 'idle') }, function () {
        if (action.lesson) return doLesson(app, on)
        if (action.shop) return modules.events.goShop(app, 'seed')
        if (!action.idle) modules.events.act(app, action.plot, action.fx, action.op, action.payload)
      }))
      modules.host.put(main, app.el('span', null, action.label))
      modules.host.put(main, app.el('small', null, state.inflight ? '处理中…' : action.sub || ''))
      main.disabled = action.idle === true || !!state.inflight
      if (state.inflight) main.setAttribute('aria-busy', 'true')
      }
      if (big) metaRow(app, data, side)
      dock(app, data, side)
      if (state.drawerOpen) renderDrawer(app, data, side)
      modules.commerce.renderLayers(app, data, root)
      if (state.tip && state.tipPlot == null && Date.now() - state.tipAt < 2400) renderTip(app, root)
      app.content.appendChild(root)
      return root
    }

  function renderTip(app, box) {
      var node = modules.host.put(box, app.el('div', 'fm-toast', state.tip)); node.setAttribute('role', 'status'); node.style.animationDelay = '-' + Math.max(0, Date.now() - state.tipAt) + 'ms'
    }

  return { reclaimSign, plotCard, plotLabel, levelBadge, metaRow, toolSlot, careCount, fertCount, allTools, renderDrawer, dock, header, mainAction, lessonOf, lessonText, lessonAction, goalText, lessonTile, doLesson, detailCard, renderGarden, renderTip }
}
