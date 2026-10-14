// @ts-check
/**
 * 重绘后把悬停态还回去（hover-restore.js）：宿主补发一次带 movement 的 mousemove。
 *
 * 快照真变了的那次重绘会把整块内容换掉，挂在扩展节点上的悬停（菜园的悬停卡）跟着没。
 * 这里守三件事：模块自己只在该补的时候补（指针在内容里、没离开过、这期间没再动过、不重入），
 * 补发排在渲染前（不把强制布局放回轮询里），以及宿主面板真的把它接在了重绘路径上
 * （轮询短路时不空转）。测试里把 requestAnimationFrame 换成立即执行的桩，
 * 补发就是同步的（真浏览器里它排到这一帧渲染之前，见 hover-restore.js）。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { restoreHover } from '../src/client/hover-restore.js'

import { contentOf, mount, openPanel, settle, SNAPSHOT } from './helpers/bundle.js'

/** 合成事件的记录本：拿它当「补发出来的那一次 mousemove」。 */
class FakeMouseEvent {
  constructor(type, init = {}) {
    this.type = type
    Object.assign(this, init)
  }
}

/** 立即回掉的 rAF：测试里补发变成同步的。 */
const rafNow = fn => { fn(); return 1 }

/** 一个只够模块用的内容元素：能挂监听、能手动触发、scrollTop 的写入会被记下来。 */
function stubContent() {
  const listeners = {}
  const writes = []
  const content = {
    parentNode: null,
    addEventListener: (name, fn) => { (listeners[name] ??= []).push(fn) },
    fire: (name, event = {}) => { for (const fn of listeners[name] ?? []) fn(event) },
    get scrollTop() { return 0 },
    set scrollTop(value) { writes.push(value) },
  }
  content.writes = writes
  return content
}

test('补发：指针还在内容里才补一次带 movement 的 mousemove；离开、出了内容、重入都不补', () => {
  const content = stubContent()
  const seen = []
  let reentered = null
  const target = {
    parentNode: content,
    dispatchEvent: event => {
      seen.push(event)
      // 扩展在悬停里又重绘了一次（真的接在重绘路径上的话，这里就是递归点）
      reentered = restoreHover(content)
    },
  }
  const doc = { elementFromPoint: () => target }
  globalThis.document = doc
  globalThis.window = { MouseEvent: FakeMouseEvent, requestAnimationFrame: rafNow }

  assert.equal(restoreHover(content), false, '还没见过指针就不排')
  assert.deepEqual(seen, [])

  content.fire('mousemove', { clientX: 300, clientY: 240 })
  content.fire('mousemove', { clientX: 310, clientY: 250 })
  assert.equal(restoreHover(content), true, '重绘后该补一次')
  assert.equal(seen.length, 1)
  assert.equal(seen[0].type, 'mousemove')
  assert.equal(seen[0].movementX, 1, '扩展的守卫只认「真的动了」，movement 必须非 0')
  assert.equal(seen[0].movementY, 1)
  assert.equal(seen[0].bubbles, true, '事件要冒泡到挂在扩展节点上的监听器')
  assert.deepEqual([seen[0].clientX, seen[0].clientY], [310, 250], '补的是最后一个已知位置')
  assert.equal(reentered, false, '补发期间的重绘不许再排（防重入）')
  assert.equal(seen.length, 1, '补发不会把自己转成第二轮')
  assert.deepEqual(content.writes, [], '补发不写 scrollTop')

  content.fire('mouseleave')
  assert.equal(restoreHover(content), false, '指针离开过内容就不补')
  assert.equal(seen.length, 1)

  // 指针位置记着，但命中的节点已经不在内容里了（面板收起、被别的层盖住）：不补
  content.fire('mousemove', { clientX: 20, clientY: 30 })
  doc.elementFromPoint = () => ({ parentNode: null })
  restoreHover(content)
  assert.equal(seen.length, 1, '命中的不是内容的后代就不补')
  doc.elementFromPoint = () => null
  restoreHover(content)
  assert.equal(seen.length, 1, '命中不到东西就不补')
  doc.elementFromPoint = undefined
  restoreHover(content)
  assert.equal(seen.length, 1, '拿不到命中测试的宿主（jsdom 之类）不补，也不许抛')
})

test('补发是延后的：排下之后指针又动过就不补了（那个事件自己会把悬停带对）', () => {
  const content = stubContent()
  const seen = []
  const frames = []
  const target = { parentNode: content, dispatchEvent: event => { seen.push(event) } }
  const doc = { elementFromPoint: () => target }
  globalThis.document = doc
  globalThis.window = { MouseEvent: FakeMouseEvent, requestAnimationFrame: fn => { frames.push(fn); return frames.length } }

  content.fire('mousemove', { clientX: 100, clientY: 100, movementX: 2, movementY: 0 })
  assert.equal(restoreHover(content), false, '第一次调用只是把监听挂上（这一刻还没见过指针）')
  content.fire('mousemove', { clientX: 100, clientY: 100, movementX: 2, movementY: 0 })
  assert.equal(restoreHover(content), true, '重绘后排队')
  assert.equal(restoreHover(content), false, '还没跑之前再重绘，不重复排队')
  assert.deepEqual(seen, [], '排队中：这一刻还没补发')
  assert.equal(frames.length, 1)

  // 浏览器自己在布局变化后补的那次 mousemove（movement 为 0）不算「指针动过」，
  // 否则这正是我们要修的那个 bug：扩展把它挡掉，卡就再也回不来了。
  content.fire('mousemove', { clientX: 100, clientY: 100, movementX: 0, movementY: 0 })
  frames[0]()
  assert.equal(seen.length, 1, 'movement 为 0 的补发不取消排队')

  // 真的动了：那个事件自己会把悬停带对，别拿旧坐标去盖
  assert.equal(restoreHover(content), true, '下一次重绘照旧排队')
  content.fire('mousemove', { clientX: 120, clientY: 140, movementX: 12, movementY: 8 })
  frames[1]()
  assert.equal(seen.length, 1, '排队期间指针真动过：不补')

  assert.equal(restoreHover(content), true, '再下一次重绘还是排队')
  frames[2]()
  assert.equal(seen.length, 2)
  assert.deepEqual([seen[1].clientX, seen[1].clientY], [120, 140], '补的是最后那次位置')
})

test('面板：真重绘后补发一次，轮询短路时不补，鼠标离开后不补', async () => {
  const status = structuredClone(SNAPSHOT)
  const { dom, intervals } = await mount({ status, windowExtra: { MouseEvent: FakeMouseEvent, requestAnimationFrame: rafNow } })
  openPanel(dom)
  await settle()
  const content = contentOf(dom)
  const poll = intervals.find(entry => entry.delay === 4000).fn

  const seen = []
  const target = { parentNode: content, dispatchEvent: event => { seen.push(event) } }
  dom.document.elementFromPoint = () => target

  await poll()
  await settle()
  content.fire('mousemove', { clientX: 400, clientY: 300 })

  await poll()
  await settle()
  assert.equal(seen.length, 0, '画面没变就不重绘，也就没有要补的悬停')

  status.pig.coins += 1
  await poll()
  await settle()
  assert.equal(seen.length, 1, '真重绘之后补一次')
  assert.equal(seen[0].movementX, 1)
  assert.deepEqual([seen[0].clientX, seen[0].clientY], [400, 300])

  status.pig.coins += 1
  await poll()
  await settle()
  assert.equal(seen.length, 2, '还是同一块地，每次都该补回来')

  content.fire('mouseleave')
  status.pig.coins += 1
  await poll()
  await settle()
  assert.equal(seen.length, 2, '鼠标已经走了，重绘后不许凭空冒出一张卡')
})
