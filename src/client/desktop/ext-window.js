// @ts-check
/**
 * 扩展大窗口里的页面（外壳 0.6.5 起，role=ext）：菜园的「大农场」这种要一整幅横版场景的界面。
 *
 * 一扇普通的带标题栏的窗口，能拉大缩小。页面还是同一份游戏包，只把面板卡片铺满整个窗口，
 * 里面直接画这个扩展的大界面（panel.js 看 ctx.extBig）；猪、名牌、底栏都藏起来。
 * 对猪的反应（收菜时猪说话）照面板窗口的办法转给猪窗口去演。
 */

const EXT_CSS = [
  'html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#7fae5a}',
  '[data-piggy-role="ext"] [data-dsh-pig]{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;transform:none!important;pointer-events:auto!important}',
  '[data-piggy-role="ext"] .dp-scene,[data-piggy-role="ext"] .dp-hud,[data-piggy-role="ext"] .dp-bar,[data-piggy-role="ext"] .dp-panel-footer{display:none!important}',
  '[data-piggy-role="ext"] .dp-card{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;max-height:none!important;max-width:none!important;',
  'border:0!important;border-radius:0!important;box-shadow:none!important;margin:0!important;background:#7fae5a!important}',
  '[data-piggy-role="ext"] [data-ext-view="big"] .dp-content{padding:0!important;overflow:hidden!important;height:100%}',
].join('\n')

/** loader.js 在挂载游戏之前调用（扩展大窗口）。 */
export function installExt(bridge) {
  document.documentElement.setAttribute('data-piggy-role', 'ext')
  const style = document.createElement('style')
  style.setAttribute('data-piggy-ext-style', '')
  style.textContent = EXT_CSS
  document.head.appendChild(style)
  ;/** @type {any} */ (window).__dshPiggyShell = {
    role: 'ext',
    extKey: typeof bridge.extKey === 'string' ? bridge.extKey : null,
    ext: bridge.ext,
    proxy: bridge.proxy,
    fullscreen: bridge.fullscreen,
    split: true,
    panel: bridge.panel,
    onStateChanged: bridge.onStateChanged,
    // 这里没有猪可拖：给「认桌面版」用的空动作（desktop-shell.js 按 beginDrag 认）。
    beginDrag: function () {},
    endDrag: function () {},
    dragHeartbeat: function () {},
    syncGeometry: function () {},
  }
}
