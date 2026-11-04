// @ts-check
/**
 * 桌面旧外壳的原生提示抑制：鼠标碰到 [title] 时把 title 换成 aria-label。
 *
 * 桌面版不用系统原生的 title 小提示框：Windows 上透明置顶窗口里的原生提示会画坏
 * （用户 2026-10-05「点礼物后弹窗显示异常」）。只改属性，不改 DOM 结构。
 */
;(function () {
  /** @type {any} */
  var w = window
  var parts = w.__dshPiggyShellParts || (w.__dshPiggyShellParts = {})

  parts.createTooltip = function () {
    function install() {
      if (typeof document.addEventListener !== 'function') return
      document.addEventListener('mouseover', function (event) {
        var target = /** @type {any} */ (event.target)
        var titled = target !== null && typeof target.closest === 'function' ? target.closest('[title]') : null
        if (titled === null) return
        if (!titled.getAttribute('aria-label')) titled.setAttribute('aria-label', titled.getAttribute('title'))
        titled.removeAttribute('title')
      }, true)
    }

    return { install: install }
  }
})()
