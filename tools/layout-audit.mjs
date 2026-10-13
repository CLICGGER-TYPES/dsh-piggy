// @ts-check
/** 通过 CDP 只读检查可见布局；不点击、不改 DOM、不调用游戏接口。结果对应 QA-SPEC 第5节。 */
import { writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

/** 在被检查页面执行的纯读取函数；附属元素按现有场景父容器归属检查。 */
export function auditVisibleLayout() {
  const viewport = { width: innerWidth, height: innerHeight }
  const rows = [], skipped = []
  const rectOf = rect => ({ x: rect.x, y: rect.y, width: rect.width, height: rect.height })
  const contains = (box, point) => point.x >= box.x && point.x <= box.x + box.width
    && point.y >= box.y && point.y <= box.y + box.height
  function describe(element) {
    return { tag: element.tagName.toLowerCase(), id: element.id, class: element.className?.toString(),
      text: element.textContent?.trim().slice(0, 90) }
  }
  function clippingBox(element) {
    let box = { x: 0, y: 0, width: innerWidth, height: innerHeight }
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent), bounds = parent.getBoundingClientRect()
      const clipsX = /(hidden|clip|scroll|auto)/.test(style.overflowX)
      const clipsY = /(hidden|clip|scroll|auto)/.test(style.overflowY)
      const right = clipsX ? Math.min(box.x + box.width, bounds.right) : box.x + box.width
      const bottom = clipsY ? Math.min(box.y + box.height, bounds.bottom) : box.y + box.height
      box.x = clipsX ? Math.max(box.x, bounds.left) : box.x
      box.y = clipsY ? Math.max(box.y, bounds.top) : box.y
      box.width = Math.max(0, right - box.x); box.height = Math.max(0, bottom - box.y)
    }
    return box
  }
  function isHiddenByAncestor(element) {
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      if (Number(getComputedStyle(parent).opacity) === 0 || parent.hidden) return true
    }
    return false
  }
  for (const element of Array.from(document.body.querySelectorAll('*'))) {
    const bounds = element.getBoundingClientRect(), style = getComputedStyle(element)
    if (!bounds.width || !bounds.height || style.visibility !== 'visible' || Number(style.opacity) === 0) continue
    // 整页透明动画、隐藏页签和轮播中未进入裁切容器的下一页不是可见元素，单独列出而非静默吞掉。
    if (isHiddenByAncestor(element)) continue
    const clip = clippingBox(element)
    if (bounds.right <= clip.x || bounds.left >= clip.x + clip.width
      || bounds.bottom <= clip.y || bounds.top >= clip.y + clip.height) {
      skipped.push({ element: describe(element), reason: 'fully outside viewport or ancestor clip' }); continue
    }
    rows.push({ element, bounds, style, clip, info: describe(element) })
  }
  const overlaps = [], decorationOverlaps = [], backgroundExceptions = [], attachments = [], clippedText = [], smallText = [], obstructed = [], smallTargets = [], overflow = [], smallIcons = []
  const interactive = rows.filter(row => row.element.matches('button,input,select,textarea,a[href],[role="button"],.dp-pig'))
  const sameLayer = rows.filter(row => row.element.matches('button,input,select,textarea,a[href],[role="button"],label,.dp-pig,.dp-bubble,.dp-work,.dp-progress,.dp-hud,.dp-nap-zzz,.dp-pomo,.dp-tile-dot,[data-layout-label],[data-layout-progress]'))
  for (let index = 0; index < interactive.length; index += 1) {
    const row = interactive[index], center = { x: row.bounds.x + row.bounds.width / 2, y: row.bounds.y + row.bounds.height / 2 }
    const hit = document.elementFromPoint(center.x, center.y)
    if (!hit || !row.element.contains(hit)) obstructed.push({ element: row.info, center, hit: hit ? describe(hit) : null })
    if (row.bounds.width < 32 || row.bounds.height < 32) smallTargets.push({ element: row.info, bounds: rectOf(row.bounds), minimum: 32 })
  }
  for (let index = 0; index < sameLayer.length; index += 1) {
    const row = sameLayer[index]
    for (const other of sameLayer.slice(index + 1)) {
      if (row.element.contains(other.element) || other.element.contains(row.element)) continue
      const width = Math.min(row.bounds.right, other.bounds.right) - Math.max(row.bounds.left, other.bounds.left)
      const height = Math.min(row.bounds.bottom, other.bounds.bottom) - Math.max(row.bounds.top, other.bounds.top)
      if (width > 0 && height > 0) overlaps.push({ first: row.info, second: other.info, area: width * height })
    }
  }
  for (const decoration of rows.filter(row => row.element.matches('img,[data-layout-decoration]'))) {
    for (const control of interactive) {
      if (control.element.contains(decoration.element) || decoration.element.contains(control.element)) continue
      const width = Math.min(decoration.bounds.right, control.bounds.right) - Math.max(decoration.bounds.left, control.bounds.left)
      const height = Math.min(decoration.bounds.bottom, control.bounds.bottom) - Math.max(decoration.bounds.top, control.bounds.top)
      if (width <= 0 || height <= 0) continue
      const detail = { decoration: decoration.info, control: control.info, area: width * height }
      const decorationLayer = Number(decoration.style.zIndex) || 0, controlLayer = Number(control.style.zIndex) || 0
      const isEarlier = Boolean(decoration.element.compareDocumentPosition(control.element) & Node.DOCUMENT_POSITION_FOLLOWING)
      if (decorationLayer < controlLayer || (decorationLayer === controlLayer && isEarlier))
        backgroundExceptions.push({ ...detail, reason: '装饰在较低层或同层较早绘制，需截图核对背景归属' })
      else decorationOverlaps.push({ ...detail, reason: '装饰矩形可能覆盖控件；透明像素须截图逐项确认，不能默认豁免' })
    }
  }
  const fixedOffsetExceptions = []
  const attachmentOwners = [
    ['.dp-bubble,.dp-daily,.dp-work', '.dp-scene'],
    ['.dp-progress', '.dp-work'], ['.dp-tile-dot,.dp-tile-badge', '.dp-tile'],
    ['.dp-dress,.dp-pomo', '.dp-pig'],
  ]
  for (const row of rows) {
    if (row.bounds.x < row.clip.x - .5 || row.bounds.y < row.clip.y - .5
      || row.bounds.right > row.clip.x + row.clip.width + .5 || row.bounds.bottom > row.clip.y + row.clip.height + .5)
      overflow.push({ element: row.info, bounds: rectOf(row.bounds), visibleContainer: row.clip })
    for (const [selector, ownerSelector] of attachmentOwners) {
      if (!row.element.matches(selector)) continue
      const owner = row.element.closest(ownerSelector), center = { x: row.bounds.x + row.bounds.width / 2, y: row.bounds.y + row.bounds.height / 2 }
      const parentBounds = owner?.getBoundingClientRect()
      // 日常气泡、台词和番茄角标按现有CSS固定挂在对象外侧，不把约定偏移误报成漂移。
      const isFixed = row.element.matches('.dp-daily,.dp-bubble,.dp-pomo') && row.style.position === 'absolute'
      const left = parseFloat(row.style.left), right = parseFloat(row.style.right)
      const top = parseFloat(row.style.top), bottom = parseFloat(row.style.bottom)
      const marginLeft = parseFloat(row.style.marginLeft) || 0
      let expected = parentBounds && {
        x: Number.isFinite(left) ? parentBounds.x + left + marginLeft + row.bounds.width / 2 : parentBounds.right - right - row.bounds.width / 2,
        y: Number.isFinite(top) ? parentBounds.y + top + row.bounds.height / 2 : parentBounds.bottom - bottom - row.bounds.height / 2,
      }
      const host = row.element.closest('[data-dsh-pig]')
      const isPanelOpen = host?.getAttribute('data-open') === 'true' || host?.getAttribute('data-panel-open') === 'true'
      if (parentBounds && row.element.matches('.dp-daily') && !isPanelOpen) {
        const gap = host?.getAttribute('data-open') === 'false' ? 16 : 7
        expected = { x: parentBounds.x + parentBounds.width / 2, y: parentBounds.y - gap - row.bounds.height / 2 }
      }
      const tolerance = row.element.matches('.dp-daily') ? 3.5 : .5
      const followsFixedOffset = isFixed && expected && Math.abs(center.x - expected.x) <= .5 && Math.abs(center.y - expected.y) <= tolerance
      if (parentBounds && !contains(parentBounds, center) && followsFixedOffset) fixedOffsetExceptions.push({ element: row.info, center, expected, tolerance,
        reason: '现有css-tabs.js / css-tiles.js声明的外侧固定定位；日常气泡仅允许3px呼吸位移' })
      else if (!owner || !contains(owner.getBoundingClientRect(), center)) attachments.push({ element: row.info,
        owner: owner ? describe(owner) : null, center, ownerBounds: owner ? rectOf(owner.getBoundingClientRect()) : null })
    }
    if (row.element.matches('.dp-tile-e,.dp-pig-emoji,[data-layout-icon]') && Math.min(row.bounds.width, row.bounds.height) < 24)
      smallIcons.push({ element: row.info, bounds: rectOf(row.bounds), minimum: 24 })
    for (const node of Array.from(row.element.childNodes)) {
      if (node.nodeType !== Node.TEXT_NODE || !node.textContent?.trim()) continue
      const range = document.createRange(); range.selectNodeContents(node)
      const textBounds = range.getBoundingClientRect()
      const unscaledWidth = row.element instanceof HTMLElement ? row.element.offsetWidth : row.bounds.width
      const scale = unscaledWidth ? row.bounds.width / unscaledWidth : 1
      const fontSize = parseFloat(row.style.fontSize) * scale
      if ((row.element.closest('button,a[href],[role="button"]') || row.element.matches('.dp-tile-e,[data-layout-icon]'))
        && /^\p{Extended_Pictographic}[\uFE0F\u200D\p{Extended_Pictographic}]*$/u.test(node.textContent.trim()) && fontSize < 24 - .01)
        smallIcons.push({ element: row.info, icon: node.textContent.trim(), renderedFontSize: fontSize, minimum: 24 })
      if (fontSize < 12 - .01) smallText.push({ element: row.info, text: node.textContent.trim(), renderedFontSize: fontSize })
      const isClipped = textBounds.left < row.clip.x - .5 || textBounds.top < row.clip.y - .5
        || textBounds.right > row.clip.x + row.clip.width + .5 || textBounds.bottom > row.clip.y + row.clip.height + .5
      const isOverflow = row.element.clientWidth > 0 && row.element.scrollWidth > row.element.clientWidth
      if (isClipped || isOverflow) clippedText.push({ element: row.info, text: node.textContent.trim(),
        bounds: rectOf(textBounds), visibleContainer: row.clip, scrollWidth: row.element.scrollWidth, clientWidth: row.element.clientWidth })
    }
  }
  // 装饰覆盖用真实中心命中守住；透明图像的矩形无法代表可见像素，不编造像素重叠结论。
  return { url: location.href, title: document.title, hidden: document.hidden, viewport, visibleElements: rows.length,
    overlaps, decorationOverlaps, backgroundExceptions, attachments, clippedText, smallText, obstructed, smallTargets, overflow, smallIcons, skipped, fixedOffsetExceptions,
    limitations: ['装饰重叠按矩形和绘制层级保守检测；透明像素、背景例外及文字对比度须逐张截图核对。'],
    counts: { overlaps: overlaps.length, decorationOverlaps: decorationOverlaps.length, attachments: attachments.length, clippedText: clippedText.length,
      smallText: smallText.length, obstructed: obstructed.length, smallTargets: smallTargets.length,
      overflow: overflow.length, smallIcons: smallIcons.length } }
}

/** 只发 Runtime.evaluate；连接关闭时释放所有待响应请求。 */
async function readPageLayout(url) {
  const socket = new WebSocket(url)
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })
  try {
    const reply = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('CDP layout read timed out')), 10000)
      socket.addEventListener('message', event => {
        const message = JSON.parse(String(event.data))
        if (message.id !== 1) return
        clearTimeout(timer)
        if (message.error) reject(new Error(JSON.stringify(message.error)))
        else resolve(message.result)
      })
      socket.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: {
        expression: '(' + auditVisibleLayout.toString() + ')()', returnByValue: true,
      } }))
    })
    if (reply.exceptionDetails) throw new Error(JSON.stringify(reply.exceptionDetails))
    return reply.result.value
  } finally { socket.close() }
}

/** 接收转发后的 CDP 地址，可选输出路径；不新开页面、不改变窗口尺寸。 */
export async function runLayoutAudit(endpoint, output) {
  const response = await fetch(endpoint + '/json/list', { signal: AbortSignal.timeout(10000) })
  if (!response.ok) throw new Error('CDP list failed: ' + response.status)
  const targets = await response.json()
  const pages = []
  for (const target of targets.filter(target => target.type === 'page')) {
    const url = new URL(target.webSocketDebuggerUrl)
    url.host = new URL(endpoint).host
    pages.push({ targetId: target.id, ...await readPageLayout(url.toString()) })
  }
  const visiblePages = pages.filter(page => !page.hidden && page.visibleElements > 0)
  const issueCount = visiblePages.reduce((sum, page) => sum + Object.values(page.counts).reduce((total, count) => total + Number(count), 0), 0)
  const status = visiblePages.length === 0 ? 'incomplete' : issueCount > 0 ? 'failed' : 'passed'
  const report = { checkedAt: new Date().toISOString(), endpoint, status, issueCount, pages }
  if (output) await writeFile(output, JSON.stringify(report, null, 2) + '\n')
  process.stdout.write(JSON.stringify(report, null, 2) + '\n')
  return report
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const endpoint = process.argv[2] || 'http://127.0.0.1:19346'
  try {
    const report = await runLayoutAudit(endpoint, process.argv[3])
    if (report.status !== 'passed') process.exitCode = 1
  } catch (error) {
    const report = { checkedAt: new Date().toISOString(), endpoint, status: 'incomplete',
      error: error instanceof Error ? error.message : String(error), pages: [] }
    if (process.argv[3]) await writeFile(process.argv[3], JSON.stringify(report, null, 2) + '\n')
    process.stdout.write(JSON.stringify(report, null, 2) + '\n')
    process.exitCode = 1
  }
}
