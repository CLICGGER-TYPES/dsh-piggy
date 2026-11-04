// @ts-check
/** 帮工托管面板：总览、排班、精力条、单只休息/角色；只读 view，不改结算。 */
/** @param {any} state @param {any} modules @returns {any} */
export function createFarmHelperRenderer(state, modules) {
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

  /** 展示用状态：idle=true 是「没活睡觉」，优先于班次休息显示为待命。 */
  function helperVisualState(worker) {
      if (worker.status === 'paused') return 'paused'
      if (worker.idle === true) return 'idle'
      return worker.status || 'idle'
  }

  /** 状态词只读 view：paused / resting / idle / patrol / working。 */
  function helperStatusWord(worker) {
      if (worker.status === 'paused') return '已暂停'
      if (worker.idle === true) return '待命'
      if (worker.status === 'resting') return '休息中'
      if (worker.status === 'idle') return '待命'
      if (worker.status === 'patrol') return '巡逻中'
      return '工作中'
  }

  function helperEnergyPercent(worker) {
      var energy = Number(worker.energy)
      if (!Number.isFinite(energy)) energy = 0
      return Math.max(0, Math.min(100, Math.round(energy * 100)))
  }

  /** 休息中报「多久回来」，工作中报「还剩多久」，待命说明是没活睡觉；暂停不报倒计时。 */
  function helperEnergyNote(worker) {
      var shortTime = modules.events.shortTime
      if (worker.status === 'paused') return '托管暂停'
      if (worker.idle === true) return '管区没活，先歇着'
      if (worker.status === 'resting') return worker.restRemainingMs > 0 ? shortTime(worker.restRemainingMs) + '后回来' : '马上回来'
      if (worker.status === 'idle') return '管区没活，先歇着'
      return worker.workRemainingMs > 0 ? '还剩 ' + shortTime(worker.workRemainingMs) : '精力充足'
  }

  /** 最近一次偷窃 / 被赶走的文案；没有就写「最近没有偷窃」。 */
  function theftKind(event) {
      if (event.kind === 'bird') return '鸟'
      return event.heavy === true ? '野猪' : '小偷猪'
  }

  function theftTime(data, at) {
      var diff = Math.max(0, (Number.isFinite(data.now) ? data.now : Date.now()) - at)
      return diff < 60000 ? '刚刚' : modules.events.shortTime(diff) + '前'
  }

  function theftEventText(data, event) {
      var when = theftTime(data, event.at)
      var place = (event.plot + 1) + ' 号地'
      if (event.blocked === true) return '最近：' + when + ' · ' + (event.patrolId ? '#' + event.patrolId : '巡逻') + ' 赶走了' + theftKind(event) + '（' + place + '）'
      var who = event.kind === 'bird' ? '鸟' : event.heavy === true ? '野猪' : '小偷猪'
      var verb = event.kind === 'bird' ? '啄了' : '拱了'
      return '最近：' + when + ' · ' + who + verb + ' ' + place + '，少收 ' + Math.round((event.loss || 0) * 100) + '%'
  }

  function theftRecent(app, panel, data) {
      var latest = data.theft && data.theft.latest
      if (!latest) return
      modules.host.put(panel, app.el('small', 'fm-patrol-event', theftEventText(data, latest)))
  }

  /** 区 pill 的状态词：颜色之外必须有文字，屏幕阅读器也读 aria-label。 */
  function patrolZoneWord(zone) {
      if (zone.state === 'guarded') return '有人守'
      if (zone.state === 'resting') return '休息中'
      if (zone.state === 'idle') return '待命'
      if (zone.state === 'paused') return '无人守'
      return '无巡逻'
  }

  /** 巡逻覆盖卡：每区状态、有人守/无人守、休息/机动提醒、最近事件。纯 CSS，无新素材。 */
  function helperPatrol(app, panel, data) {
      var theft = data.theft
      if (!theft || !Array.isArray(theft.zones)) return
      var card = modules.host.put(panel, app.el('div', 'fm-helper-card fm-patrol'))
      card.setAttribute('data-farm-patrol', 'zones')
      card.setAttribute('data-paused', String(theft.paused === true))
      var head = modules.host.put(card, app.el('div', 'fm-patrol-head'))
      modules.host.put(head, app.el('b', 'fm-helper-label', '巡逻覆盖'))
      modules.host.put(head, app.el('span', 'fm-patrol-count', (theft.guardedZones || 0) + '/' + (theft.totalZones || 0) + ' 区有人守'))
      var zones = modules.host.put(card, app.el('div', 'fm-patrol-zones'))
      zones.setAttribute('role', 'list')
      zones.setAttribute('aria-label', '巡逻区覆盖')
      theft.zones.forEach(function (zone) {
        var word = patrolZoneWord(zone)
        var pill = modules.host.put(zones, app.el('div', 'fm-patrol-zone'))
        pill.setAttribute('role', 'listitem')
        pill.setAttribute('data-farm-patrol-zone', String(zone.index))
        pill.setAttribute('data-guarded', String(zone.guarded === true))
        pill.setAttribute('aria-label', zone.label + '，' + zone.from + ' 到 ' + zone.to + ' 号地，' + word + (zone.patrolId !== null ? '，巡逻 #' + zone.patrolId : ''))
        modules.host.put(pill, app.el('b', null, zone.label))
        modules.host.put(pill, app.el('small', null, zone.from + '–' + zone.to))
        modules.host.put(pill, app.el('small', 'fm-patrol-state', word))
      })
      if ((theft.patrols || 0) === 0) {
        modules.host.put(card, app.el('small', 'fm-helper-warning', '没有巡逻帮工'))
        modules.host.put(card, app.el('small', 'fm-helper-hint', '把一只改成巡逻可以守 4 块地；休息时那区没人。'))
      } else if (theft.patrols > theft.totalZones) {
        modules.host.put(card, app.el('small', 'fm-helper-warning', '巡逻帮工比巡逻区多，多出的不会提高防御'))
        modules.host.put(card, app.el('small', 'fm-helper-hint', '多出的巡逻改回收菜更划算。'))
      } else if (theft.paused) {
        modules.host.put(card, app.el('small', 'fm-helper-hint', '托管暂停 · 偷窃也暂停；恢复后不补。'))
      } else if (theft.guardedZones === 0) {
        modules.host.put(card, app.el('small', 'fm-helper-hint', '巡逻都在休息，田里暂时没人守。'))
      }
      modules.host.put(card, app.el('small', 'fm-patrol-event', theft.latest ? theftEventText(data, theft.latest) : '最近没有偷窃'))
      modules.host.put(card, app.el('small', 'fm-helper-hint', '巡逻只守自己的区；休息时那区没人，会直接被偷。即使在岗，也有 5% 概率被偷；无人守时还会偶发重损。'))
  }

  /** 排班卡：auto 自动错峰、manual 可逐只休息；只影响以后雇佣的默认角色。 */
  function helperSchedule(app, panel, schedule) {
      var current = schedule === 'manual' ? 'manual' : 'auto'
      var card = modules.host.put(panel, app.el('div', 'fm-helper-card fm-helper-schedule'))
      var head = modules.host.put(card, app.el('div', 'fm-helper-card-head'))
      modules.host.put(head, app.el('b', 'fm-helper-label', '排班'))
      modules.host.put(head, app.el('span', 'fm-helper-schedule-current', current === 'auto' ? '自动' : '手动'))
      var modes = modules.host.put(card, app.el('div', 'fm-helper-schedule-modes'))
      ;[['auto', '自动排班'], ['manual', '手动排班']].forEach(function (mode) {
        var active = current === mode[0]
        var button = modules.host.put(modes, modules.host.button(app, 'fm-helper-schedule-btn', {
          type: 'button', 'data-farm-schedule': mode[0], 'aria-pressed': String(active), 'aria-label': mode[1],
        }, mode[1], function () {
          if (state.inflight || current === mode[0]) return
          modules.events.rememberScroll(app, modules.events.pageKey(app))
          modules.events.setSchedule(app, mode[0])
        }))
        button.disabled = !!state.inflight || active
      })
      modules.host.put(card, app.el('small', 'fm-helper-schedule-note', current === 'auto'
        ? '自动：新雇按需分工，同角色帮工班次自动错峰（每只差 30 分钟上班）。'
        : '手动：新雇默认收菜，可以逐只休息 / 叫醒。'))
  }

  /** 旧服务端有 workers 但没有 energy/state：退回旧单帮工卡片，避免渲染空精力条。 */
  function helperEnergyReady(helper) {
      return Array.isArray(helper.workers) && helper.workers.length > 0 && helper.workers.every(function (worker) {
        return Number.isFinite(worker.energy) && typeof worker.status === 'string'
      })
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
      theftRecent(app, panel, data)

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

  /** 多帮工总览 + 列表：每只一行，角色/休息只改这只，不碰结算。 */
  function renderHelperCrew(app, data, box, items) {
      var helper = data.helper, enabled = helper.enabled === true, workers = helper.workers
      var max = helper.max || 5
      var patrol = workers.filter(function (worker) { return worker.role === 'patrol' }).length
      var harvest = workers.length - patrol
      var onDuty = Number.isFinite(helper.onDuty) ? helper.onDuty : workers.filter(function (worker) { return worker.working === true }).length
      var restingCount = Number.isFinite(helper.resting) ? helper.resting : workers.filter(function (worker) { return worker.status === 'resting' }).length
      var restStatus = workers.filter(function (worker) { return worker.status === 'resting' && worker.idle !== true }).length
      var sleeping = workers.filter(function (worker) { return worker.idle === true }).length
      var panel = modules.host.put(box, app.el('section', 'fm-helper-panel')); panel.setAttribute('aria-label', '帮工托管')
      helperStatus(app, panel, '帮工 ' + workers.length + '/' + max,
        '收菜 ' + harvest + ' 只 · 巡逻 ' + patrol + ' 只 · 在岗 ' + onDuty + ' / 休息 ' + restingCount + ' · 共管 ' + helper.plots + ' 块地', enabled)
      helperToggle(app, panel, enabled)
      helperSchedule(app, panel, helper.schedule)
      helperPatrol(app, panel, data)

      if (harvest === 0) {
        modules.host.put(panel, app.el('small', 'fm-helper-warning', '没有收菜帮工，菜不会自动收'))
        modules.host.put(panel, app.el('small', 'fm-helper-hint', '巡逻帮工不占地；至少留一只收菜帮工才会自动收获。'))
      } else if (!enabled) {
        modules.host.put(panel, app.el('small', 'fm-helper-hint', '托管已暂停；恢复后按各自精力复工，熟地会等复工再收。'))
      } else if (restStatus === workers.length && onDuty === 0) {
        var wait = Number.isFinite(helper.restUntil) ? Math.max(0, helper.restUntil - data.now) : 0
        modules.host.put(panel, app.el('small', 'fm-helper-hint', '帮工都在休息' + (wait > 0 ? '，' + modules.events.shortTime(wait) + '后陆续回来' : '，精力恢复后自动回来') + '；熟地会等复工再收。'))
      } else if (sleeping === workers.length && onDuty === 0) {
        modules.host.put(panel, app.el('small', 'fm-helper-hint', '管区暂时没活，帮工在待命休息；种上作物后会自动回来。'))
      }

      var list = modules.host.put(panel, app.el('div', 'fm-helper-workers')); list.setAttribute('role', 'list'); list.setAttribute('aria-label', '帮工列表')
      workers.forEach(function (worker) {
        var visual = helperVisualState(worker)
        var row = modules.host.put(list, app.el('div', 'fm-helper-worker')); row.setAttribute('role', 'listitem'); row.setAttribute('data-farm-helper-worker', String(worker.id)); row.setAttribute('data-state', visual)
        modules.host.put(row, app.el('b', 'fm-helper-worker-id', '#' + worker.id))
        var badge = modules.host.put(row, app.el('span', 'fm-role-badge', worker.roleLabel || (worker.role === 'patrol' ? '巡逻' : '收菜')))
        badge.setAttribute('data-role', worker.role === 'patrol' ? 'patrol' : 'harvest')
        modules.host.put(row, app.el('span', 'fm-helper-worker-plots', worker.role === 'patrol'
          ? (Number.isInteger(worker.zone) ? '守 ' + (worker.zone + 1) + ' 区 · ' + worker.zoneFrom + '–' + worker.zoneTo + ' 号地' : worker.maneuver === true ? '机动（无空闲区）' : '不占地')
          : '收 ' + (worker.plotCount || 0) + ' 块'))

        var acts = modules.host.put(row, app.el('div', 'fm-helper-worker-acts'))
        var manualRest = worker.resting === true
        // 班次休息 / 全局暂停不显示「叫醒」死按钮：前者到点自醒，后者由总开关恢复。
        if (worker.status !== 'paused' && (manualRest || worker.status !== 'resting')) {
          var restButton = modules.host.put(acts, modules.host.button(app, 'fm-helper-rest', {
            type: 'button', 'data-farm-rest': manualRest ? 'wake' : 'rest', 'data-farm-helper-id': String(worker.id),
            'aria-label': (manualRest ? '叫醒' : '让') + ' #' + worker.id + ' 帮工' + (manualRest ? '复工' : '休息'),
            'aria-disabled': String(!!state.inflight),
          }, manualRest ? '叫醒' : '休息', function () {
            if (state.inflight) return
            modules.events.rememberScroll(app, modules.events.pageKey(app))
            modules.events.setRest(app, worker.id, !manualRest)
          }))
          restButton.disabled = !!state.inflight
        }

        var target = worker.role === 'patrol' ? 'harvest' : 'patrol'
        var button = modules.host.put(acts, modules.host.button(app, 'fm-role-btn', {
          type: 'button', 'data-farm-role': target, 'data-farm-helper-id': String(worker.id),
          'aria-label': '把 #' + worker.id + ' 帮工改成' + (target === 'harvest' ? '收菜' : '巡逻'),
          'aria-disabled': String(!!state.inflight),
        }, target === 'harvest' ? '改收菜' : '改巡逻', function () {
          if (state.inflight) return
          modules.events.rememberScroll(app, modules.events.pageKey(app))
          modules.events.setRole(app, worker.id, target)
        }))
        button.disabled = !!state.inflight

        var percent = helperEnergyPercent(worker)
        var energy = modules.host.put(row, app.el('div', 'fm-energy'))
        energy.setAttribute('data-state', visual)
        energy.setAttribute('data-farm-helper-energy', String(worker.id))
        var track = modules.host.put(energy, app.el('span', 'fm-energy-track'))
        track.setAttribute('role', 'progressbar')
        track.setAttribute('aria-valuemin', '0'); track.setAttribute('aria-valuemax', '100'); track.setAttribute('aria-valuenow', String(percent))
        track.setAttribute('aria-label', '帮工 #' + worker.id + ' 精力 ' + percent + '% · ' + helperStatusWord(worker))
        modules.host.put(track, app.el('i')).style.width = percent + '%'
        var copy = modules.host.put(energy, app.el('span', 'fm-energy-copy'))
        modules.host.put(copy, app.el('span', 'fm-energy-state', helperStatusWord(worker)))
        modules.host.put(copy, app.el('span', 'fm-energy-value', percent + '% · ' + helperEnergyNote(worker)))
      })

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
      // 旧服务端没有 workers / energy 时退回旧单帮工卡片；有精力字段才渲染精力条。
      if (helperEnergyReady(data.helper)) return renderHelperCrew(app, data, box, items)
      return renderHelperSingle(app, data, box, items)
    }

  return { renderHelperSingle, renderHelperCrew, renderHelperControls, helperEnergyReady }
}
