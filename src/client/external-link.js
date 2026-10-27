// @ts-check
/**
 * 外部模式下顶部连接标签、断线提示和「哪些入口不能再写」的判断。
 *
 * 快照里的 `link` 是 DSH 宿主加的（附录 A.3）；没有它说明还是内嵌模式，
 * 这里不猜、不把内嵌猪标成桌面猪。断线只改标签和按钮，不回退到内嵌猪。
 * @module dsh-piggy/client/external-link
 */
import { recheck } from './external-api.js'
import { button, el } from './dom.js'
import { DEV_TAB } from './constants.js'
import { linkLabel, linkNote } from './external-rules.js'
import { isObj, num, str } from './values.js'

/** 从快照里读连接信息；旧宿主没有就返回 null。 */
export function externalLinkOf(view) {
  const raw = isObj(view) ? view.link : null
  if (!isObj(raw)) return null
  const state = str(raw.state, '')
  if (!['connecting', 'connected', 'reconnecting', 'disconnected', 'merging'].includes(state)) return null
  return {
    state,
    lastAt: num(raw.lastAt, 0),
    queued: num(raw.queued, 0),
    merged: raw.merged === true,
    dead: raw.dead === true,
  }
}

/** 是否处于外部桌宠模式（不管连没连上）。 */
export function isExternalMode(view) {
  return externalLinkOf(view) !== null
}

/** 动作/命令能不能写：只有 connected 才放行，merging 也不接受新动作。 */
export function externalConnected(view) {
  const link = externalLinkOf(view)
  return link !== null && link.state === 'connected'
}

/** 断线/合并中时，面板动作一律不执行、不排队。 */
export function externalActionsBlocked(view) {
  const link = externalLinkOf(view)
  return link !== null && link.state !== 'connected'
}

/** 断线时给用户的解释：只说没执行，不说「已送达」。 */
export function externalBlockedMessage(view) {
  const link = externalLinkOf(view)
  if (link !== null && link.state === 'merging') return '正在合并，先等桌面版处理完'
  return '桌宠没开，动作没有执行；工作事件已排队。打开桌面版后再试。'
}

/**
 * 画顶部标签。magic：标签和提示条挂在面板 card 上（见 scene.js），
 * 每次 render 重建里面的按钮，避免旧快照留下过期的重连回调。
 * @param {any} ctx
 */
export function updateLinkBar(ctx) {
  const bar = ctx.linkBar
  const hint = ctx.linkNote
  if (bar === undefined || hint === undefined) return
  const link = externalLinkOf(ctx.view)
  if (link === null) {
    bar.hidden = true
    hint.hidden = true
    ctx.host.removeAttribute('data-link')
    return
  }
  bar.hidden = false
  bar.setAttribute('data-link', link.state)
  bar.setAttribute('data-dead', String(link.dead === true))
  bar.textContent = ''
  bar.appendChild(el('span', 'dp-link-dot', link.state === 'connected' || link.state === 'merging' ? '●' : '○'))
  bar.appendChild(el('span', 'dp-link-text', linkLabel(link)))
  ctx.host.setAttribute('data-link', link.state)

  hint.hidden = link.state === 'connected'
  hint.textContent = ''
  if (link.state !== 'connected') hint.appendChild(el('span', null, linkNote(link)))
  if (link.state === 'disconnected' || link.state === 'reconnecting') {
    const retry = button('dp-mini', { 'data-external-reconnect': 'true' }, function () { reconnect(ctx) })
    retry.textContent = '重新连接'
    retry.disabled = link.state === 'reconnecting'
    hint.appendChild(retry)
  }
}

/** 面板上的重新连接：只读发现文件并请求 /pair/info，不改存档。 */
export async function reconnect(ctx) {
  if (ctx.busy) return
  ctx.busy = true
  try {
    const result = await recheck()
    if (result.ok) ctx.showBubble('桌面版连上了', 2600)
    else ctx.showBubble('还没连上：' + (result.error?.message ?? '桌面版没开'), 4000)
    ctx.renderContent?.()
    ctx.refresh?.()
  } finally {
    ctx.busy = false
  }
}

/** 轮询重画会打断预览里的输入框：光标还在 field 上就先不画内容。 */
export function externalRenderBlocked() {
  const active = document.activeElement
  return active?.getAttribute?.('data-external-field') != null || active?.getAttribute?.('data-external-select') != null
}

/** 主菜单的调试入口：外部模式不显示（dev/giveAll 不转发）。 */
export function externalDevTabs(ctx) {
  return ctx.devMode && !isExternalMode(ctx.view) ? [DEV_TAB] : []
}

/** 一次更新连接标签和它的 dead 状态；面板早退也不会漏掉标签。 */
export function syncExternalPanel(ctx) {
  const link = externalLinkOf(ctx.view)
  if (link !== null) ctx.view.link = { ...link, dead: ctx.view.dead === true }
  // 切到外部模式时如果正停在调试页，调试入口已经隐藏，退回主屏。
  if (link !== null && ctx.tab === DEV_TAB.key) ctx.tab = 'home'
  ctx.host.setAttribute('data-dead', ctx.view.dead ? 'true' : 'false')
  updateLinkBar(ctx)
}

/** 外部模式禁用的设置项统一这句提示，不写「请到桌面版」以外的假按钮。 */
export const MIRROR_NOTE = '外部桌宠模式下，这一项在桌面版设置里操作'

/** 存档导出/导入、扩展安装删除、皮肤导入在外部模式下一律禁用。 */
export function externalWriteBlocked(view) {
  return isExternalMode(view)
}
