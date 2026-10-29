// @ts-check
/** 透明置顶窗口不能使用系统 title 提示；改成可访问名称，避免 Windows 原生提示破坏绘制。 */
export function suppressNativeTooltips() {
  document.addEventListener('mouseover', function (event) {
    const target = /** @type {any} */ (event.target)
    const titled = target !== null && typeof target.closest === 'function' ? target.closest('[title]') : null
    if (titled === null) return
    if (!titled.getAttribute('aria-label')) titled.setAttribute('aria-label', titled.getAttribute('title'))
    titled.removeAttribute('title')
  }, true)
}
