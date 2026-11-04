// @ts-check
/**
 * 桌面旧外壳的锚边模块：决定面板朝哪一侧开、猪钉住窗口的哪两条边，并生成上报键。
 *
 * 只做布局判断和 host 的 CSS 定位，不量整页、不上报。引脚位置变化时写一次
 * inline style，后续同值直接跳过，避免每帧触碰样式。
 */
;(function () {
  /** @type {any} */
  var w = window
  var parts = w.__dshPiggyShellParts || (w.__dshPiggyShellParts = {})

  /**
   * @param {{
   *   layoutBox: (node: any) => { x: number, y: number, width: number, height: number },
   *   step: number,
   *   padding: number,
   * }} deps
   */
  parts.createAnchor = function (deps) {
    /** 上一次写过的样式，避免每帧都改。 */
    var pinned = ''
    /** 当前锚边：面板收起（内容对称）时保持不变。 */
    var lastVertical = 'bottom'
    var lastHorizontal = 'right'

    /** @returns {{ vertical: string, horizontal: string }} */
    function current() { return { vertical: lastVertical, horizontal: lastHorizontal } }

    /**
     * 让**整块内容**（猪、面板、HUD、气泡）离窗口的锚边正好 PAD。
     *
     * 以前钉的是猪：面板朝下开时 HUD 在猪上面，猪离顶边 16px，HUD 就伸到窗口外面去了。
     * 现在按内容外接框反推 host 的内边距；猪在屏幕上不动由主进程的两步补正保证。
     * 一次就收敛：下一帧量到的内容边正好在 PAD。
     * @param {string} vertical
     * @param {string} horizontal
     * @param {{ x: number, y: number, width: number, height: number }} hostBox
     * @param {{ left: number, top: number, right: number, bottom: number }} contentBox
     */
    function pinPig(vertical, horizontal, hostBox, contentBox) {
      var host = /** @type {any} */ (document.querySelector('[data-dsh-pig]'))
      if (host === null) return
      var want = {}
      if (horizontal === 'left') {
        want.left = Math.round(hostBox.x - contentBox.left + deps.padding) + 'px'
        want.right = 'auto'
      } else {
        want.right = Math.round(contentBox.right - hostBox.x - hostBox.width + deps.padding) + 'px'
        want.left = 'auto'
      }
      if (vertical === 'top') {
        want.top = Math.round(hostBox.y - contentBox.top + deps.padding) + 'px'
        want.bottom = 'auto'
      } else {
        want.bottom = Math.round(contentBox.bottom - hostBox.y - hostBox.height + deps.padding) + 'px'
        want.top = 'auto'
      }
      var key = [vertical, horizontal, want.left, want.right, want.top, want.bottom].join('|')
      if (key === pinned) return
      pinned = key
      host.style.left = want.left
      host.style.right = want.right
      host.style.top = want.top
      host.style.bottom = want.bottom
    }

    /**
     * 面板在猪的哪一侧 → 猪该钉哪两条边。
     *
     * 直接看面板（.dp-card）相对猪的位置，不能看内容框对称性：宿主本来就比猪高（HUD 那几
     * 像素），收起时会被误判成「面板在下面」，一开除就翻锚点、窗口带着猪跳。
     * 面板收起时保持上一次的锚边（首次是右下角）。
     * @param {any} host
     * @returns {{ vertical: string, horizontal: string }}
     */
    function sides(host) {
      var card = host.querySelector === undefined ? null : /** @type {any} */ (host.querySelector('.dp-card'))
      var pigNode = host.querySelector === undefined ? null : /** @type {any} */ (host.querySelector('.dp-pig'))
      if (card === null || pigNode === null || card.hidden === true) return current()
      var cardBox = deps.layoutBox(card)
      var pigBox = deps.layoutBox(pigNode)
      if (cardBox.width < 1 || cardBox.height < 1) return current()
      // 面板在猪上方 → 猪贴窗口底边；在下方 → 贴顶边。横向同理。
      // 比中心而不是比边：面板比猪宽得多，可能和猪的范围重叠。
      var pigCenterY = pigBox.y + pigBox.height / 2
      var cardCenterY = cardBox.y + cardBox.height / 2
      var pigCenterX = pigBox.x + pigBox.width / 2
      var cardCenterX = cardBox.x + cardBox.width / 2
      lastVertical = cardCenterY < pigCenterY ? 'bottom' : 'top'
      lastHorizontal = cardCenterX < pigCenterX ? 'right' : 'left'
      return current()
    }

    /**
     * @param {{ width: number, height: number }} content
     * @param {Array<{ x: number, y: number, width: number, height: number }>} shape
     * @param {{ x: number, y: number }} pig
     * @param {{ x: number, y: number }} pigBox
     * @returns {string}
     */
    function keyOf(content, shape, pig, pigBox) {
      // 猪在内容框里的位置也算进去：面板从上方翻到下方时尺寸可能没变，
      // 但锚点换边了，主进程必须知道。
      // 内容和猪在内容框里的位置按 4px 一档（动画抖动不算变化）；猪在**窗口坐标**里的
      // 位置按 1px 一档 —— 主进程补平移之后要靠这次重报验证，粗了会漏掉 4px 以内的补正。
      var values = [Math.floor(content.width / deps.step), Math.floor(content.height / deps.step),
        Math.floor(pig.x / deps.step), Math.floor(pig.y / deps.step),
        Math.floor(pigBox.x), Math.floor(pigBox.y)]
      for (var i = 0; i < shape.length; i += 1) values.push(shape[i].x, shape[i].y, shape[i].width, shape[i].height)
      // 4px 一档：动画抖几像素不会换 key。
      return values.slice(0, 4).concat(values.slice(4, 6),
        values.slice(6).map(function (n) { return Math.floor(n / deps.step) })).join(',')
    }

    return { current: current, pinPig: pinPig, sides: sides, keyOf: keyOf }
  }
})()
