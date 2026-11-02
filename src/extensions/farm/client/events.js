// @ts-check
/** 操作动作、页面导航、键盘和弹窗焦点；每个 client 实例共享一份状态。 */
/** @param {any} state @param {any} modules @returns {any} */
export function createFarmEvents(state, modules) {
  function say(app, text, index) { state.tip = text; state.tipAt = Date.now(); state.tipPlot = index; app.rerender() }

  function pageKey(app) {
      var mode = (app || state.currentApp || {}).mode === 'big' ? 'farm-large' : 'farm'
      if (state.purchase) return mode + ':buy:' + state.purchase.key
      if (state.confirmClear !== null) return mode + ':clear:' + state.confirmClear
      if (state.popup) return mode + ':page:' + state.popup + ':' + (state.popup === 'shop' ? state.shopTab : state.popup === 'bag' ? state.bagTab : '')
      return mode + ':field'
    }

  function scrollNode(app) { return app.mode === 'big' ? state.lastRoot : app.content }

  function rememberScroll(app, key) { var node = scrollNode(app); if (node) state.scrollMemory[key] = node.scrollTop || 0 }

  function restoreScroll(app, key) {
      var node = scrollNode(app); if (!node) return
      var top = state.scrollMemory[key] || 0
      // 宿主写完自己的滚动位置之后再落，避免被它按上一页重置掉（只影响子页返回时的位置）。
      if (typeof Promise === 'function') Promise.resolve().then(function () {
        if (node.scrollTop !== top) node.scrollTop = top
        if (state.revealTools && state.drawerOpen) {
          state.revealTools = false
          var dock = node.querySelector('.fm-dock')
          if (dock && typeof dock.scrollIntoView === 'function') dock.scrollIntoView({ block: 'start', behavior: 'instant' })
        }
      })
    }

  function watchScroll(node) { if (node && typeof node.addEventListener === 'function') node.addEventListener('scroll', function () { if (state.currentKey) state.scrollMemory[state.currentKey] = node.scrollTop }) }

  function goPage(app, name) { rememberScroll(app, pageKey(app)); state.popup = name; state.purchase = null; state.confirmClear = null; app.rerender() }

  function closePage(app) { rememberScroll(app, pageKey(app)); state.popup = null; state.purchase = null; state.confirmClear = null; app.rerender() }

  function goShop(app, tab) { rememberScroll(app, pageKey(app)); if (tab) state.shopTab = tab; state.popup = 'shop'; state.purchase = null; app.rerender() }

  function goBag(app, tab) { rememberScroll(app, pageKey(app)); if (tab) state.bagTab = tab; state.popup = 'bag'; app.rerender() }

  function shortTime(ms) {
      var minutes = Math.ceil(ms / 60000)
      return minutes < 60 ? minutes + ' 分钟' : Math.floor(minutes / 60) + ' 小时' + (minutes % 60 ? ' ' + minutes % 60 + ' 分' : '')
    }

  function owns(data, key) { return (data.tools || []).some(function (tool) { return tool.key === key && tool.owned }) }

  function seedOf(data, key) { return (data.seeds || []).find(function (seed) { return seed.key === key }) || null }

  function firstSeed(data) { return (data.seeds || []).find(function (seed) { return seed.count > 0 && !seed.locked }) || null }

  function seedInHand(data) { return state.hand.kind === 'seed' ? seedOf(data, state.hand.key) : firstSeed(data) }

  function pestsOf(plot) { return plot.pests || [] }

  function pestText(plot, sep) { return pestsOf(plot).map(function (p) { return state.PEST_LABEL[p] }).join(sep) }

  function cropArt(plot) { return plot.withered ? 'withered' : plot.stage === 'seed' || plot.stage === 'sprout' ? plot.stage : 'crop-' + plot.crop + '-' + plot.stage }

  function survey(data, from, to) {
      var pick = function (test) { var out = []; for (var i = from; i < to; i += 1) if (test(data.plots[i])) out.push(i); return out }
      return {
        ripe: pick(function (p) { return p.ripe }), pests: pick(function (p) { return pestsOf(p).length > 0 && !p.ripe }),
        withered: pick(function (p) { return p.withered }), empty: pick(function (p) { return p.empty }),
        soonest: data.plots.slice(from, to).reduce(function (min, p) { return p.remainingMs > 0 ? Math.min(min, p.remainingMs) : min }, Infinity),
      }
    }

  function validPlot(plot) {
      if (plot.wild) return false
      if (state.hand.kind === 'auto') return plot.ripe === true
      if (state.hand.kind === 'shovel') return !plot.empty || plot.stubble || plot.withered
      if (state.hand.kind === 'care') return pestsOf(plot).indexOf(state.hand.key) >= 0
      if (state.hand.kind === 'seed') return plot.empty === true && !plot.stubble && pestsOf(plot).indexOf('weed') < 0
      return false
    }

  function syncHand(data) {
      var seed = state.hand.kind === 'seed' ? seedOf(data, state.hand.key) : null
      if (state.hand.kind === 'seed' && (!seed || seed.count < 1 || seed.locked)) state.hand = state.AUTO
      var fert = state.hand.kind === 'fert' ? (data.fert || []).find(function (f) { return f.key === state.hand.key }) : null
      if (state.hand.kind === 'fert' && (!fert || fert.count < 1)) state.hand = state.AUTO
    }

  function sendAction(app, op, payload) {
      if (state.inflight) return null
      var result = app.send(op, payload), ticket = {}
      if (!result || typeof result.then !== 'function') return result
      state.inflight = ticket; if (state.pendingAction && state.pendingAction.op === op) state.pendingAction.awaiting = ticket; app.rerender()
      var settle = function (next) { if (state.inflight !== ticket) return; state.inflight = null; if (!next || next.ok === false) { state.pendingAction = null; return app.rerender() } if (state.pendingAction && state.pendingAction.awaiting === ticket) { state.pendingAction.awaiting = null; finishAction(app, app.data) } app.rerender() }
      result.then(settle, function () { settle(null) })
      return result
    }

  function act(app, index, emoji, op, payload) { if (state.inflight) return; state.fx = null; state.pendingAction = { op: op, plot: index, before: app.data, fx: emoji }; sendAction(app, op, payload) }

  function clickPlot(app, data, index) {
      if (state.inflight) return
      state.selectedPlot = index
      var plot = data.plots[index]
      var shovel = state.hand.kind === 'shovel'
      if (plot.wild) return say(app, plot.next ? '点木牌开垦' : '要先开前一块荒地')
      if (shovel && plot.empty && !plot.stubble) return say(app, '这块地是空的', index)
      if (shovel && !plot.empty && !plot.withered) { rememberScroll(app, pageKey(app)); state.confirmClear = index; state.modalReturn = { attr: 'data-farm-plot', value: String(index) }; return app.rerender() }
      if (shovel) { state.confirmClear = null; return act(app, index, '🪏', 'clear', plot.withered || plot.stubble ? { plot: index } : { plot: index, force: true }) }
      state.confirmClear = null
      if (state.hand.kind === 'care') {
        if (pestsOf(plot).indexOf(state.hand.key) >= 0) return act(app, index, state.hand.key === 'dry' ? '💧' : '✨', 'care', { plot: index, kind: state.hand.key })
        return say(app, state.hand.key === 'dry' ? '这块地不用浇水' : '这块地没有' + state.PEST_LABEL[state.hand.key], index)
      }
      if (state.hand.kind === 'fert') return plot.empty || plot.ripe || plot.withered ? say(app, '肥料要施在正在长的地上') : app.send('fertilize', { plot: index, item: state.hand.key })
      if (state.hand.kind === 'auto') {
        if (plot.ripe) return act(app, index, '✨', 'harvest', { plot: index })
        state.tip = null; return app.rerender()
      }
      if (plot.empty && (plot.stubble || pestsOf(plot).indexOf('weed') >= 0)) return say(app, '先除草 / 铲掉杂草', index)
      if (plot.empty) { var seed = seedInHand(data); return seed ? act(app, index, '🌱', 'plant', { plot: index, item: seed.key }) : goShop(app, 'seed') }
      say(app, '这块地不是空地', index)
    }

  function finishAction(app, data) {
      if (state.fx && Date.now() - state.fx.at >= 620) state.fx = null
      if (!state.pendingAction || state.pendingAction.before === data || state.pendingAction.awaiting) return
      var action = state.pendingAction, old = action.before, plot = action.plot, text = null
      state.pendingAction = null
      if (action.op === 'onboarding') {
        var now = data.onboarding || {}
        if (action.lessonOp === 'plant' && now.step === 'planted') text = '第一课种下了'
        if (action.lessonOp === 'water' && now.watered && !(old.onboarding && old.onboarding.watered)) text = '浇水成功'
        if (action.lessonOp === 'harvest' && now.step === 'done') { state.lessonRewardAt = Date.now(); text = '第一课完成：' + now.reward.currency + ' 菜币 + ' + now.seed.label + ' ×1' }
      }
      if (action.op === 'plant' && old.plots[plot].empty && !data.plots[plot].empty) text = '播种成功'
      if (action.op === 'harvest' && old.plots[plot].ripe && !data.plots[plot].ripe) text = '收获 ' + old.plots[plot].yield + ' 个'
      if (action.op === 'care' && pestsOf(data.plots[plot]).length < pestsOf(old.plots[plot]).length) text = '照料成功'
      if (action.op === 'clear' && (data.plots[plot].empty || !data.plots[plot].stubble)) text = '铲除成功'
      if (/All$/.test(action.op) && JSON.stringify(old.plots) !== JSON.stringify(data.plots)) text = '操作成功'
      if (action.item && old.balance - data.balance === action.item.price * action.count) text = '购买成功！' + action.item.label + ' ×' + action.count + '，花费 ' + action.item.price * action.count + ' 菜币'
      if (text) {
        state.tip = text; state.tipAt = Date.now(); state.tipPlot = plot
        var kind = action.op === 'onboarding' ? { plant: 'sow', water: 'water', harvest: 'harvest' }[action.lessonOp] : action.op === 'plant' ? 'sow' : action.op === 'harvest' ? 'harvest' : action.op === 'care' && action.fx === '💧' ? 'water' : null
        if (kind) state.fx = { plot: plot, lesson: action.op === 'onboarding', kind: kind, at: Date.now() }
      }
    }

  function bindKeyboard() {
      if (state.keyboardBound) return
      state.keyboardBound = true
      document.addEventListener('focusin', function (event) { if (state.modalOpen && inDialog(event.target)) state.modalFocus = focusDescriptor(event.target) || state.modalFocus })
      document.addEventListener('keydown', function (event) {
        var dialog = state.currentApp && state.currentApp.content.querySelector('[role="dialog"]')
        if (dialog && event.key === 'Tab') {
          var focusable = Array.prototype.filter.call(dialog.querySelectorAll('button,input,select,textarea,a'), function (node) { return !node.disabled && node.getAttribute('tabindex') !== '-1' })
          if (!focusable.length) { event.preventDefault(); dialog.focus(); return }
          var active = document.activeElement, first = focusable[0], last = focusable[focusable.length - 1]
          if (!inDialog(active) || event.shiftKey && active === first || !event.shiftKey && active === last) {
            event.preventDefault(); (event.shiftKey ? last : first).focus()
          }
          return
        }
        if (state.currentApp && event.key === 'Escape') {
          if (state.cancelLayer) state.cancelLayer()
          else if (state.popup) closePage(state.currentApp)
          else if (state.drawerOpen) { state.drawerOpen = false; state.currentApp.rerender() }
          return
        }
        if (!state.currentApp || state.currentApp.mode !== 'big' || !state.currentApp.content.querySelector('.fm-big') || event.ctrlKey || event.altKey || event.metaKey || (/** @type {HTMLElement} */ (event.target)).isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/i.test((/** @type {HTMLElement} */ (event.target)).tagName)) return
        var tools = { q: { kind: 'care', key: 'dry' }, w: { kind: 'care', key: 'weed' }, e: { kind: 'care', key: 'bug' }, r: state.AUTO }
        var chosen = tools[String(event.key).toLowerCase()]
        if (chosen) { event.preventDefault(); state.hand = chosen; state.currentApp.rerender() }
      })
    }

  function focusDescriptor(node) {
      if (!node) return null
      var attrs = ['data-farm-quantity-field', 'data-farm-quantity', 'data-farm-back', 'data-farm-confirm', 'data-farm-cancel']
      for (var i = 0; i < attrs.length; i += 1) if (node.getAttribute(attrs[i]) !== null) return { attr: attrs[i], value: node.getAttribute(attrs[i]) }
      return null
    }

  function inDialog(node) {
      while (node) { if (node.getAttribute && node.getAttribute('role') === 'dialog') return true; node = node.parentNode }
      return false
    }

  function syncModalFocus(app, root) {
      var dialog = root.querySelector('[role="dialog"]')
      if (dialog) {
        var target = null
        if (state.modalOpen && state.modalFocus) target = dialog.querySelector('[' + state.modalFocus.attr + '="' + state.modalFocus.value + '"]')
        if (target && target.disabled) target = null
        if (!state.modalOpen || !target) {
          var field = dialog.querySelector('[data-farm-quantity-field="true"]'), confirm = dialog.querySelector('[data-farm-confirm="true"]')
          target = field && !field.disabled ? field : confirm && !confirm.disabled ? confirm : dialog.querySelector('[data-farm-cancel="true"]')
        }
        state.modalOpen = true
        if (target && document.activeElement !== target) target.focus()
        state.modalFocus = focusDescriptor(target) || state.modalFocus
        return
      }
      if (state.modalOpen) {
        var trigger = state.modalReturn && root.querySelector('[' + state.modalReturn.attr + '="' + state.modalReturn.value + '"]')
        state.modalOpen = false; state.modalFocus = null; state.modalReturn = null
        if (trigger) trigger.focus()
      }
    }

  function helperText(helper) { return !helper.hired ? '雇帮工猪' : helper.full ? '帮工仓库满了' : helper.stored > 0 ? '帮工收了 ' + helper.stored + ' 个' : !helper.enabled ? '帮工已暂停' : helper.missing.length ? '缺' + helper.missing.join('、') + '种子' : helper.seedless ? '帮工没种子' : '帮工 · ' + helper.plots + ' 块地' }

  function helperClick(app, helper) { if (!helper.hired) return sendAction(app, 'hire', {}); if (helper.stored > 0 || helper.full) return sendAction(app, 'collect', {}); if (!helper.enabled) return goShop(app, 'helper'); if (helper.missing.length || helper.seedless) return goShop(app, 'seed'); say(app, '帮工正在照顾 ' + helper.plots + ' 块地') }

  return { say, pageKey, scrollNode, rememberScroll, restoreScroll, watchScroll, goPage, closePage, goShop, goBag, shortTime, owns, seedOf, firstSeed, seedInHand, pestsOf, pestText, cropArt, survey, validPlot, syncHand, sendAction, act, clickPlot, finishAction, bindKeyboard, focusDescriptor, inDialog, syncModalFocus, helperText, helperClick }
}
