// @ts-check
/** Paperbox and disconnected external views share the panel's empty-data branch. */
import { button, el } from './dom.js'
import { TABS } from './constants.js'
import { isExternalMode } from './external-link.js'
import { appHeader } from './tabs/home.js'
import { renderSettingsTab } from './tabs/settings.js'
import { syncPigArt } from './art.js'
import { syncPigSize } from './pig-size.js'
import { applyEmojiStyle } from './emoji-style.js'

export function renderEmptyPanel(ctx) {
  if (ctx.view.pig !== null) return false
  {
          // 外部模式没有快照时不能摆内嵌纸盒：那会把「DSH 里的新内嵌猪」假装出来，
          // 而外部模式根本不打开内嵌存档。给一条只读说明和设置入口（重新连接、
          // 管理、切回都在设置卡片里，沿用同一套控件）。
          if (isExternalMode(ctx.view)) {
            if (ctx.tab === 'settings') {
              var settingsApp = TABS.find(function (entry) { return entry.key === 'settings' })
              if (settingsApp !== undefined) appHeader(ctx, settingsApp)
              renderSettingsTab(ctx)
              ctx.fitPanel()
              return true
            }
            ctx.host.setAttribute('data-ext-view', '')
            var extHead = el('div', 'dp-title')
            extHead.appendChild(el('b', null, '桌面猪'))
            extHead.appendChild(el('span', null, '没连上'))
            ctx.content.appendChild(extHead)
            var extBox = el('div', 'dp-set')
            var extBoxHead = el('div', 'dp-set-head')
            extBoxHead.appendChild(el('b', null, '外部桌宠'))
            extBox.appendChild(extBoxHead)
            extBox.appendChild(el('p', 'dp-dim', '桌面猪没连上，DSH 不会打开内嵌猪；工作事件在排队（' + (ctx.view.link === null ? 0 : ctx.view.link.queued) + ' 条）。在设置里可以重新连接、切回内嵌猪或查看队列。'))
            ctx.content.appendChild(extBox)
            var extActions = el('div', 'dp-actions')
            var openSettings = button('dp-btn dp-btn-wide', { 'data-external-open-settings': 'true' }, function () { ctx.select('settings') })
            openSettings.textContent = '打开设置'
            extActions.appendChild(openSettings)
            ctx.content.appendChild(extActions)
            ctx.fitPanel()
            return true
          }
          ctx.content.appendChild(el('div', 'dp-empty', '门口放着一个纸盒，里面窸窸窣窣 📦'))
          var grid = el('div', 'dp-actions')
          var hatch = button('dp-btn dp-btn-wide', { 'data-action': 'hatch' }, function () { ctx.send('hatch') })
          hatch.appendChild(el('span', null, '🥚'))
          hatch.appendChild(el('span', null, '拆开纸盒'))
          grid.appendChild(hatch)
          ctx.content.appendChild(grid)
          return true
        }
}

export function renderUnhatchedPig(ctx) {
          if (ctx.view.pig === null && isExternalMode(ctx.view)) {
            // 外部模式断开且没有可显示的快照：不画纸盒/不提示戳三下（那是内嵌新猪）。
            // 只留一个中性、去色的猪占位和「没连上」名牌，真实数据在设置卡片里。
            ctx.pig.setAttribute('data-stage', 'offline')
            ctx.pig.setAttribute('data-art', '')
            ctx.pig.setAttribute('data-activity', '')
            ctx.pig.setAttribute('data-activity-key', '')
            ctx.pigEmoji.textContent = '🐖'
            ctx.pig.setAttribute('data-mood', 'offline')
            syncPigArt(ctx.pig, ctx.pigArt, ctx.pigEmoji)
            syncPigSize(ctx.host, ctx.view.boxStage.size)
            applyEmojiStyle(ctx.host)
            ctx.soul.hidden = true
            ctx.host.setAttribute('data-soul', 'false')
            ctx.host.setAttribute('data-faded', 'false')
            ctx.host.setAttribute('data-unhatched', 'false')
            ctx.pokeHint.hidden = true
            ctx.hudName.textContent = '桌面猪 · 没连上'
            ctx.hudCoins.textContent = ''
            ctx.hudHealth.textContent = ''
            ctx.lastStage = null
          } else {
            ctx.pig.setAttribute('data-stage', 'box')
            ctx.pig.setAttribute('data-art', '')
            ctx.pig.setAttribute('data-activity', '')
            ctx.pig.setAttribute('data-activity-key', '')
            ctx.pigEmoji.textContent = ctx.view.boxStage.emoji
            ctx.pig.setAttribute('data-mood', 'box')
            syncPigArt(ctx.pig, ctx.pigArt, ctx.pigEmoji)
            // Size comes from the host so the box and the pig can never drift.
            syncPigSize(ctx.host, ctx.view.boxStage.size)
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
          }

}
