// @ts-check
/** CDP 只读布局验收：不发送鼠标、不改 DOM、不改窗口。Node 22+；输出原始问题供逐项复核。 */
import { writeFileSync } from 'node:fs'

const args = process.argv.slice(2)
const value = (key, fallback = '') => args.indexOf(key) < 0 ? fallback : args[args.indexOf(key) + 1] ?? fallback
const endpoint = value('--cdp', 'http://127.0.0.1:9333')
const role = value('--role')
const output = value('--out')

/** 页面内只读取布局与样式，滚动容器外的项目不属于当前可见状态。 */
function inspectLayout() {
  const overlaps = [], driftedAttachments = [], clippedText = [], smallText = []
  const occludedControls = [], smallTargets = [], smallIcons = [], outsideContainers = []
  const rect = element => {
    const box = element.getBoundingClientRect()
    return { x: box.x, y: box.y, width: box.width, height: box.height, right: box.right, bottom: box.bottom }
  }
  const label = element => ({ tag: element.tagName.toLowerCase(), id: element.id, class: element.className, text: (element.textContent || '').trim().slice(0, 80) })
  const area = (left, right) => Math.max(0, Math.min(left.right, right.right) - Math.max(left.x, right.x)) * Math.max(0, Math.min(left.bottom, right.bottom) - Math.max(left.y, right.y))
  const viewport = { x: 0, y: 0, right: innerWidth, bottom: innerHeight }
  const clippedBy = element => {
    const ancestors = [viewport]
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent)
      if (/(hidden|clip|auto|scroll)/.test(style.overflow + style.overflowX + style.overflowY)) ancestors.push(rect(parent))
    }
    return ancestors
  }
  const visible = element => {
    const box = rect(element)
    if (!box.width || !box.height || !area(box, viewport)) return false
    for (let current = element; current; current = current.parentElement) {
      const style = getComputedStyle(current)
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0 || current.hidden) return false
    }
    return clippedBy(element).every(parent => area(box, parent) > 0)
  }
  const elements = Array.from(document.querySelectorAll('body *')).filter(visible)
  const controls = elements.filter(element => element.matches('button,input,select,textarea,a[href],[role="button"],[tabindex],.dp-pig'))
  for (const control of controls) {
    const box = rect(control), hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
    if (!hit || !(hit === control || control.contains(hit))) occludedControls.push({ element: label(control), hit: hit ? label(hit) : null, box })
    if (box.width < 32 || box.height < 32) smallTargets.push({ element: label(control), box })
    const clipped = clippedBy(control).filter(parent => area(box, parent) + 0.1 < box.width * box.height)
    if (clipped.length) outsideContainers.push({ element: label(control), box, containers: clipped })
  }
  const peers = elements.filter(element => controls.includes(element) || element.matches('label,progress,.dp-hud,.dp-bubble,.dp-meter,.dp-progress,.dp-tile-badge,.dp-set-head>b,.dp-set-head>small,.dp-item-count,.fm-plot,.fm-sign,.fm-price,[data-layout-peer]'))
  for (let index = 0; index < peers.length; index++) {
    for (const other of peers.slice(index + 1)) {
      const first = peers[index]
      if (first.contains(other) || other.contains(first)) continue
      const intersection = area(rect(first), rect(other))
      if (intersection > 0.1) overlaps.push({ first: label(first), second: label(other), area: intersection })
    }
  }
  for (const element of elements) {
    const textNodes = Array.from(element.childNodes).filter(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim())
    if (textNodes.length) {
      const style = getComputedStyle(element), box = rect(element)
      const measured = /** @type {HTMLElement} */ (element)
      const scale = measured.offsetHeight ? box.height / measured.offsetHeight : 1
      const fontSize = parseFloat(style.fontSize) * scale
      if (fontSize < 12 - 0.05) smallText.push({ element: label(element), fontSize })
      const clips = []
      for (const node of textNodes) {
        const range = document.createRange(); range.selectNodeContents(node)
        for (const line of Array.from(range.getClientRects())) {
          const lineBox = { x: line.x, y: line.y, right: line.right, bottom: line.bottom, width: line.width, height: line.height }
          for (const parent of clippedBy(element)) if (area(lineBox, parent) + 0.1 < line.width * line.height) clips.push({ line: lineBox, container: parent })
        }
      }
      if (clips.length || element.clientWidth && element.scrollWidth > element.clientWidth) clippedText.push({ element: label(element), scrollWidth: element.scrollWidth, clientWidth: element.clientWidth, clips })
    }
    if (element.matches('.dp-tile-icon,.dp-tile-emoji,.dp-ico,img') && rect(element).width < 24) smallIcons.push({ element: label(element), box: rect(element) })
    // 新组件可声明归属；已有角标从它的可点对象取得所属范围。
    if (element.matches('[data-audit-owner],.dp-tile-badge,.dp-meter,.dp-progress,.dp-item-count,.dp-bubble,.dp-daily')) {
      const owner = element.hasAttribute('data-audit-owner') ? document.querySelector(element.getAttribute('data-audit-owner')) : element.closest('button,.dp-item,.dp-set,.dp-scene') ?? element.parentElement
      const box = rect(element), owned = owner && rect(owner)
      if (!owned || box.x + box.width / 2 < owned.x || box.x + box.width / 2 > owned.right || box.y + box.height / 2 < owned.y || box.y + box.height / 2 > owned.bottom) driftedAttachments.push({ element: label(element), owner: owner && label(owner), box, ownerBox: owned })
    }
  }
  const findings = { overlaps, driftedAttachments, clippedText, smallText, smallIcons, smallTargets, occludedControls, outsideContainers }
  return { role: (/** @type {any} */ (window)).piggyShell?.role ?? 'web', url: location.href, viewport: { width: innerWidth, height: innerHeight }, title: document.title, visibleElements: elements.length, visibleControls: controls.length, layoutPeers: peers.length, counts: Object.fromEntries(Object.entries(findings).map(([key, entries]) => [key, entries.length])), findings }
}

/** 每个 CDP 请求最多等待 3 秒，失败就保留报错而不是无限等。 */
async function inspectTarget(target) {
  const address = new URL(target.webSocketDebuggerUrl)
  address.host = new URL(endpoint).host
  const socket = new WebSocket(address)
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.close(); reject(new Error('CDP connection timed out')) }, 3000)
    socket.onopen = event => { clearTimeout(timer); resolve(event) }
    socket.onerror = event => { clearTimeout(timer); reject(event) }
  })
  const pending = new Map()
  socket.onmessage = event => {
    const message = JSON.parse(String(event.data)), request = pending.get(message.id)
    if (request) { pending.delete(message.id); message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result) }
  }
  const call = (id, method, params) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out`)) }, 3000)
    pending.set(id, { resolve: result => { clearTimeout(timer); resolve(result) }, reject: error => { clearTimeout(timer); reject(error) } })
    socket.send(JSON.stringify({ id, method, params }))
  })
  try {
    const result = await call(1, 'Runtime.evaluate', { expression: `(${inspectLayout.toString()})()`, returnByValue: true })
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
    return result.result.value
  } finally { socket.close() }
}

const targets = await (await fetch(endpoint + '/json/list')).json()
const reports = []
for (const target of targets.filter(target => target.type === 'page')) {
  const report = await inspectTarget(target)
  if (!role || report.role === role) reports.push(report)
}
if (!reports.length) throw new Error(`No page matched role: ${role || 'any'}`)
const serialized = JSON.stringify({ reports }, null, 2) + '\n'
if (output) writeFileSync(output, serialized)
else process.stdout.write(serialized)
