// @ts-check
/**
 * 面板渲染：开关面板、切页签、把快照画到 DOM 上
 * 只通过 ctx 读写外壳的状态与元素（getter/setter 转发），不直接碰全局。
 * @module dsh-piggy/client/panel
 */
import { syncPigArt, syncSleepArt } from './art.js'
import { DEV_TAB, OPEN_KEY, QUIT_TAB, TABS, UPDATE_TAB } from './constants.js'
import { button, el } from './dom.js'
import { desktopRole, desktopShell } from './desktop-shell.js'
import { processPending } from './pending.js'
import { splitSetOpen } from './split.js'
import { normalize } from './normalize.js'
import { displayedPigSize } from './pig-size.js'
import { applyEmojiStyle } from './emoji-style.js'
import { writeStore } from './storage.js'
import { cakeTakenToday } from './birthday.js'
import { CSS } from './styles.js'
import { animateAppEntry, animatePanelClose, animatePanelOpen } from './interaction-motion.js'
import { renderBagTab } from './tabs/bag.js'
import { renderCardTab } from './tabs/card.js'
import { renderDexTab } from './tabs/dex.js'
import { closeFishing, renderFishingTab } from './tabs/fishing.js'
import { appHeader, orderHomeApps, renderHome } from './tabs/home.js'
import { clockText, renderPomodoroTab } from './tabs/pomodoro.js'
import { renderDevTab } from './tabs/dev.js'
import { renderUpdateTab, updatesBridge } from './tabs/update.js'
import { renderShopTab } from './tabs/shop.js'
import { renderStatusTab } from './tabs/status.js'
import { renderStudyTab } from './tabs/study.js'
import { renderSkinsTab } from './tabs/skins.js'
import { renderSettingsTab } from './tabs/settings.js'
import { renderExtensionsTab } from './tabs/extensions.js'
import { applyExtensions, enabledTabs } from './extensions.js'
import { renderTravelTab } from './tabs/travel.js'
import { renderWorkTab } from './tabs/work.js'
import { str } from './values.js'


export function createPanel(ctx) {
      var AWAY_LINE = {
        work: '在忙',
        study: '在念书',
        interest: '在学兴趣课',
        trip: '在路上',
      }

      function setOpen(next) {
        if (splitSetOpen(ctx, next)) return
        if (!next) { closeFishing(ctx); if (ctx.isOpen) animatePanelClose(ctx) }
        ctx.isOpen = next
        ctx.host.setAttribute('data-open', next ? 'true' : 'false')
        // Collapsed must be the pig and *nothing else*. One switch hides the
        // whole panel now that the pig is not inside it — and driving visibility
        // from the DOM rather than only from CSS makes it something a test can
        // actually assert.
        ctx.card.hidden = !next
        // The hud rides with the panel: a bare pig should not have a name floating beside it.
        ctx.hud.hidden = !next
        if (!next) ctx.bubble.hidden = true
        writeStore(OPEN_KEY, next ? 'true' : 'false')
        if (next) {
          renderContent()
          ctx.fitPanel()
          animatePanelOpen(ctx)
        } else {
          // Back to the default anchor so the next open starts from a clean
          // slate. `auto` (not '') keeps the stylesheet's bottom from re-applying
          // alongside a stale top.
          ctx.card.style.right = ''
          ctx.card.style.top = 'auto'
          ctx.card.style.bottom = ''
          ctx.card.style.maxHeight = ''
          ctx.card.style.maxWidth = ''
        }
        desktopShell()?.syncGeometry?.()
      }

      function select(next) {
        var previous = ctx.tab
        // C4 replaced the old 加冕 App. Bookmarks and stale callers land in 图鉴.
        if (next === 'crown') next = 'dex'
        // 桌面版「退出」不是页签：直接让外壳存档关窗。
        if (next === 'quit') {
          var desk = updatesBridge()
          if (desk !== null && desk.quit) desk.quit()
          return
        }
        if (next === 'update') ctx.updateNotice?.markRead()
        ctx.tab = next
        ctx.picker = null
        // Opening a tile tab always starts at its top layer.
        if (next in ctx.drill) { ctx.drill[next] = null; ctx.drill.pick = null; ctx.drill.from = null }
        renderContent()
        if (previous !== next) {
          ctx.content.scrollTop = 0
          if (ctx.isOpen) animateAppEntry(ctx.content)
        }
        for (var k in ctx.icons) ctx.icons[k].setAttribute('data-active', k === ctx.tab ? 'true' : 'false')
      }

      /**
       * Repaint the panel body, keeping the reader's place.
       *
       * The body is rebuilt from scratch on every poll; without saving the
       * offset, a long shelf jumped back to the top every four seconds.
       */
      // 番茄钟完成的通知：同一个 finishedAt 只弹一次；没权限就退回猪的气泡。
      var pomodoroNotifiedAt = null
      function noticePomodoro(pomodoro) {
        if (pomodoro === null || pomodoro.finishedAt === null || pomodoro.finishedAt === pomodoroNotifiedAt) return
        pomodoroNotifiedAt = pomodoro.finishedAt
        var paid = pomodoro.todayDone <= pomodoro.cap
        var text = '今天第 ' + pomodoro.todayDone + ' 个' + (paid ? ' · +' + pomodoro.reward.coins + ' 🪙' : ' · 今天奖励已拿满')
        try {
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification('🍅 专注结束', { body: text })
            return
          }
        } catch (error) { /* 浏览器不给就算了 */ }
        ctx.showBubble('🍅 专注结束 · ' + text, 3200)
      }

      function renderContent() {
        var scrollTop = ctx.content.scrollTop
        paintContent()
        ctx.content.scrollTop = scrollTop
        ctx.justBought = null
      }

      function paintContent() {
        ctx.content.textContent = ''
        ctx.footer.textContent = ''
        ctx.footer.hidden = true
        for (var k = 0; k < TABS.length; k += 1) {
          ctx.icons[TABS[k].key].setAttribute('data-active', TABS[k].key === ctx.tab ? 'true' : 'false')
        }
        if (ctx.host.getAttribute('data-open') !== 'true') return

        // Only the host-version warning sits above every tab; the pig's own
        // banners (away / sick / gone) live on the status tab (B9).
        if (ctx.view.legacy) {
          var legacy = el('div', 'dp-alert dp-legacy')
          legacy.appendChild(el('b', null, '⚠️ 宿主是旧版本'))
          legacy.appendChild(el('div', null, '金币、健康、打工、商店这些是新增的，重启 dsh（不是刷新页面）之后才会出现。'))
          ctx.content.appendChild(legacy)
        }
        if (ctx.view.pig === null) {
          ctx.content.appendChild(el('div', 'dp-empty', '门口放着一个纸盒，里面窸窸窣窣 📦'))
          var grid = el('div', 'dp-actions')
          var hatch = button('dp-btn dp-btn-wide', { 'data-action': 'hatch' }, function () { ctx.send('hatch') })
          hatch.appendChild(el('span', null, '🥚'))
          hatch.appendChild(el('span', null, '拆开纸盒'))
          grid.appendChild(hatch)
          ctx.content.appendChild(grid)
          return
        }

        // B9: home first; every app's top layer gets a 「‹」 back (inside a category it goes up a layer).
        var shell = updatesBridge()
        var apps = orderHomeApps(enabledTabs(ctx, TABS).concat([UPDATE_TAB], shell !== null && shell.quit ? [QUIT_TAB] : [], ctx.devMode ? [DEV_TAB] : []))
        if (ctx.tab === 'home') {
          renderHome(ctx, apps.filter(function (a) { return a.key !== 'update' && a.key !== 'extensions' })) // 更新、扩展入口在设置里
          ctx.fitPanel()
          return
        }
        var drilled = ctx.tab in ctx.drill && ctx.drill[ctx.tab] !== null
        var app = apps.find(function (entry) { return entry.key === ctx.tab })
        if (app !== undefined && !drilled) appHeader(ctx, app, ctx.tab === 'shop' ? '🪙 ' + ctx.view.pig.coins : '')

        if (ctx.tab === 'status') renderStatusTab(ctx)
        else if (ctx.tab === 'card') renderCardTab(ctx)
        else if (ctx.tab === 'dex') renderDexTab(ctx)
        else if (ctx.tab === 'skins') renderSkinsTab(ctx)
        else if (ctx.tab === 'study') renderStudyTab(ctx)
        else if (ctx.tab === 'work') renderWorkTab(ctx)
        else if (ctx.tab === 'shop') renderShopTab(ctx)
        else if (ctx.tab === 'travel') renderTravelTab(ctx)
        else if (ctx.tab === 'fishing') renderFishingTab(ctx)
        else if (ctx.tab === 'pomodoro') { renderPomodoroTab(ctx); if (typeof ctx.pomoTick === 'function') ctx.pomoTick() }
        else if (ctx.tab === 'dev') renderDevTab(ctx)
        else if (ctx.tab === 'update') renderUpdateTab(ctx)
        else if (ctx.tab === 'settings') renderSettingsTab(ctx)
        else if (ctx.tab === 'extensions' || String(ctx.tab).startsWith('ext:')) renderExtensionsTab(ctx) // ext:<key> 是下载扩展的 App
        else renderBagTab(ctx)

        // Every tab is a different height: refit after each render, not only on open.
        ctx.fitPanel()
      }

      function render(next) {
        var previousFishing = ctx.view?.fishing?.pending
        ctx.view = applyExtensions(normalize(next))
        // Never leave the study tab parked on a stage the pig cannot attend —
        // but only until the user picks one themselves: after that the poll
        // must not yank their choice away.
        var stageEntry = null
        var firstOpen = null
        for (var s = 0; s < ctx.view.stages.length; s += 1) {
          var entry = ctx.view.stages[s]
          if (entry.unlocked !== false && firstOpen === null) firstOpen = entry.key
          if (entry.key === ctx.stage) stageEntry = entry
        }
        // The 兴趣 button is not a stage; leave it selected.
        if (!ctx.stagePicked && firstOpen !== null && (stageEntry === null || stageEntry.unlocked === false)) ctx.stage = firstOpen
        ctx.host.setAttribute('data-dead', ctx.view.dead ? 'true' : 'false')
        // 猪窗口里 isOpen 只表示「另一个窗口的面板开着」，自己永远按收起排版（不然会撑大猪窗口）
        ctx.host.setAttribute('data-open', ctx.isOpen && desktopRole() !== 'pet' ? 'true' : 'false')
        ctx.host.setAttribute('data-dev', ctx.devMode ? 'true' : 'false')
        // Drives both the prop and the pig's own activity animation.
        ctx.host.setAttribute('data-away', ctx.view.activity === null ? 'false' : ctx.view.activity.kind)
        if (ctx.view.activity === null) {
          ctx.work.hidden = true
        } else {
          ctx.work.hidden = false
          ctx.prop.textContent = ctx.view.activity.emoji
          ctx.progressFill.style.width = ctx.view.activity.progress + '%'
          ctx.work.setAttribute('data-kind', ctx.view.activity.kind)
          ctx.work.title = (AWAY_LINE[ctx.view.activity.kind] ?? '在外面') + '：' + ctx.view.activity.label
        }

        if (ctx.view.hatched !== true) {
          ctx.pig.setAttribute('data-stage', 'box')
          ctx.pig.setAttribute('data-art', '')
          ctx.pig.setAttribute('data-activity', '')
          ctx.pig.setAttribute('data-activity-key', '')
          ctx.pigEmoji.textContent = ctx.view.boxStage.emoji
          ctx.pig.setAttribute('data-mood', 'box')
          syncPigArt(ctx.pig, ctx.pigArt, ctx.pigEmoji)
          // Size comes from the host so the box and the pig can never drift.
          ctx.host.style.setProperty('--pig-size', displayedPigSize(ctx.view.boxStage.size) + 'px')
          applyEmojiStyle(ctx.host)
          ctx.soul.hidden = true
          ctx.host.setAttribute('data-soul', 'false')
          ctx.host.setAttribute('data-faded', 'false')
          ctx.host.setAttribute('data-unhatched', 'true')
          ctx.pokeHint.hidden = false
          ctx.hudName.textContent = '一个' + ctx.view.boxStage.label
          ctx.hudCoins.textContent = '点开拆开它'
          ctx.hudHealth.textContent = ''
          ctx.lastStage = null
        } else {
          const pigStage = ctx.view.pig.stage
          syncSleepArt(pigStage.art, pigStage.artScenes, ctx.pigSleep)
          ctx.pig.setAttribute('data-stage', pigStage.key)
          ctx.pig.setAttribute('data-art', pigStage.art || '')
          ctx.pig.setAttribute('data-art-actions', pigStage.actionArt ? 'true' : 'false')
          ctx.pig.setAttribute('data-art-scenes', pigStage.artScenes.join(','))
          ctx.host.setAttribute('data-art-actions', pigStage.actionArt ? 'true' : 'false')
          ctx.pig.setAttribute('data-activity', ctx.view.activity === null ? '' : ctx.view.activity.kind)
          ctx.pig.setAttribute('data-activity-key', ctx.view.activity === null ? '' : ctx.view.activity.key)
          ctx.pig.setAttribute('data-mood', ctx.view.pig.mood)
          var ill = ctx.view.pig.illness
          ctx.pig.setAttribute('data-illness', ill === null || ill.chainKey === '' ? '' : ill.chainKey + ':' + ill.stage)
          ctx.pigEmoji.textContent = pigStage.emoji
          syncPigArt(ctx.pig, ctx.pigArt, ctx.pigEmoji)
          // Display scale is a device preference; the stage remains save data.
          ctx.host.style.setProperty('--pig-size', displayedPigSize(pigStage.size) + 'px')
          applyEmojiStyle(ctx.host)
          ctx.host.setAttribute('data-soul', ctx.view.pig.soul ? 'true' : 'false')
          // Old age reads as a faded coat, since every stage is the same pig.
          ctx.host.setAttribute('data-faded', pigStage.faded ? 'true' : 'false')
          ctx.host.setAttribute('data-unhatched', 'false')
          ctx.pokeHint.hidden = true
          ctx.soul.hidden = ctx.view.pig.soul !== true || pigStage.key === 'grave'
          // 装扮挂在猪身上（见 .dp-slot），名字牌上不再重复一遍。
          ctx.dressSlots.textContent = ''
          for (var wd = 0; wd < ctx.view.dress.length; wd += 1) {
            var piece = ctx.view.dress[wd]
            if (!piece.worn || piece.slot === '') continue
            // 加冕后的样子自带王冠披风，盖住的位置不挂装扮（东西还在背包里）。
            if (pigStage.hides.indexOf(piece.slot) >= 0) continue
            var node = el('span', 'dp-slot', piece.emoji)
            node.setAttribute('data-slot', piece.slot)
            ctx.dressSlots.appendChild(node)
          }
          ctx.hudName.textContent = ctx.view.pig.name
            + (ctx.view.pig.sex !== null ? ' ' + ctx.view.pig.sex.symbol : '')
            + ' Lv.' + ctx.view.pig.level.level
            + ' · ' + pigStage.label
            + (ctx.view.pig.ageLabel ? ' · ' + ctx.view.pig.ageLabel : '')
            + (ctx.view.pig.ageForced ? ' 🔧' : '')
          ctx.hudCoins.textContent = '🪙 ' + ctx.view.pig.coins
          ctx.hudHealth.textContent = '💚 ' + ctx.view.pig.health + '/' + ctx.view.maxHealth
          // Growing up is announced with the same flourish a level-up used to get.
          if (ctx.lastStage !== null && pigStage.key !== ctx.lastStage) {
            ctx.react('levelup', 950)
            ctx.burst(['✨', '🎉', '⭐'], 4)
            ctx.showBubble('我长大啦！' + pigStage.emoji, 2600)
          }
          ctx.lastStage = pigStage.key
        }

        // 番茄钟（C2）：专注中挂在猪立绘右上角。data-pomo 让气泡收起后知道该不该放
        // 回来；气泡正说着就先不显示 —— 两者位置挨着，宁可角标让位。
        var pomo = ctx.view.pomodoro
        var pomoOn = pomo !== null && pomo.active
        ctx.pomoHint.setAttribute('data-pomo', pomoOn ? 'on' : '')
        ctx.pomoHint.hidden = !pomoOn || ctx.bubble.hidden === false
        if (pomoOn) ctx.pomoHint.textContent = '🍅 ' + clockText(pomo.secondsLeft)
        // 番茄钟结束的通知只在猪窗口发（拆窗口后两边都在渲染，不然会弹两次）。
        if (desktopRole() !== 'panel') noticePomodoro(pomo)
        if (typeof ctx.pomoTick === 'function') ctx.pomoTick()

        // 猪头上的日常提示：能签到就先显示签到，否则显示礼包。
        // 点一下直接领；点击不再冒泡到场景，免得同时被当成摸猪/拖动。
        var daily = ctx.view.daily
        // 生日当天（或调试页「过生日」）头顶冒蛋糕，点了当天就不再冒，见 index.js 的 celebrate。
        var cake = ctx.view.pig !== null && (ctx.view.pig.birthdayToday || ctx.cakeForced === true) && !cakeTakenToday()
        var dailyAction = daily.canSignIn ? 'signIn' : (daily.unclaimed > 0 ? 'openGift' : (cake ? 'cake' : null))
        ctx.dailyHint.hidden = dailyAction === null || ctx.view.pig === null
        if (dailyAction !== null) {
          ctx.dailyHint.textContent = dailyAction === 'signIn' ? '📅' : (dailyAction === 'cake' ? '🎂' : '🎁')
          ctx.dailyHint.title = dailyAction === 'signIn'
            ? '签到第 ' + daily.signInDay + '/' + daily.cycle + ' 天'
            : (dailyAction === 'cake' ? '今天是' + ctx.view.pig.name + '的生日' : '有 ' + daily.unclaimed + ' 个在线礼包')
          // 动作放在 data-action 上，监听只在外壳里注册一次（见 index.js），
          // 免得每 4 秒重绘都往上挂一个 listener。
          ctx.dailyHint.setAttribute('data-action', dailyAction)
        }

        // Alerts on the icon bar itself, so a collapsed pig still warns.
        // The study icon lights when there is a course to take right now:
        // idle, the stage on screen is unlocked, and it still has a subject.
        var studyStage = null
        for (var st = 0; st < ctx.view.stages.length; st += 1) {
          if (ctx.view.stages[st].key === ctx.stage) studyStage = ctx.view.stages[st]
        }
        var studyOpen = ctx.view.canGoOut && (studyStage === null || studyStage.unlocked !== false)
        // B4: no stage ladder any more, so "a course to take" is simply one the
        // pig can afford (older hosts still send stages, handled above).
        var hasCourse = studyOpen && ctx.view.subjects.some(function (subject) {
          var onStage = studyStage === null || studyStage.subjects.length === 0 || studyStage.subjects.indexOf(subject.key) >= 0
          return onStage && subject.affordable
        })
        ctx.icons.study.setAttribute('data-alert', hasCourse ? 'true' : 'false')
        ctx.icons.shop.setAttribute('data-alert', ctx.view.pig !== null && ctx.view.pig.illness !== null ? 'true' : 'false')
        ctx.icons.dex.setAttribute('data-alert', 'false')
        ctx.icons.travel.setAttribute('data-alert', ctx.view.pig !== null && ctx.view.pig.coins >= 400 ? 'true' : 'false')

        processPending(ctx, showPigLine)

        // Typing a new name: a repaint would drop the input and its focus.
        if ((ctx.ownerEdit !== null || ctx.pigNameEdit !== null) && ctx.tab === 'status') return
        if (ctx.cardEdit !== null && ctx.tab === 'card') return
        // Replacing a focused input drops the caret (including IME composition).
        if (ctx.tab === 'settings' && (document.activeElement?.getAttribute?.('data-proxy-address') === 'true' || document.activeElement?.getAttribute?.('data-pig-scale') === 'true')) return
        if (ctx.tab === 'dex' && document.activeElement?.getAttribute?.('data-dex-search') === 'items') return
        // The QTE and waiting animation own their DOM until the phase changes.
        // A four-second poll must not restart them or discard keyboard focus.
        var currentFishing = ctx.view.fishing.pending
        if (ctx.tab === 'fishing' && previousFishing && currentFishing
          && previousFishing.id === currentFishing.id && previousFishing.phase === currentFishing.phase
          && (currentFishing.phase === 'waiting' || currentFishing.phase === 'hooked')) return
        renderContent()
      }

  /** A line from the pig goes in its bubble, with the owner's reply buttons under it. */
  function showPigLine(event) {
    var lineId = event.id
    ctx.showLine(event.text, event.replies, function (index) {
      ctx.send('reply', { line: lineId, index: index })
    })
  }

  return { setOpen, select, renderContent, render }
}
