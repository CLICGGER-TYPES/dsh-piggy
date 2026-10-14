// @ts-check
/**
 * 4 秒轮询：快照「画面上」没变就别重画。
 *
 * 整块内容拆了重建（菜园一屏 160 个节点、52 张图）是白干，还会把悬停卡抹掉。
 * 这里跑的是真的 client.js（只有 DOM 和 fetch 是假的），看的是内容 DOM 的节点身份：
 * 没重画 = 还是同一批节点。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { contentOf, findByAttr, findByClass, mount, openPanel, settle, SNAPSHOT } from './helpers/bundle.js'

/** 一份带菜园 view 的快照：时间戳和生长期每 4 秒都在变，画面上看不出来。 */
function farmSnapshot() {
  const status = structuredClone(SNAPSHOT)
  status.extViews = {
    farm: {
      now: 1_791_950_400_000, balance: 240, level: 3,
      plots: [{ index: 0, progress: 0.5, remainingMs: 25_200_000, ripe: false }],
      helper: { usedHours: 0 },
    },
  }
  return status
}

test('轮询短路：同一份快照不重画，看不到的字段在动也不重画，真变了才重画', async () => {
  const status = farmSnapshot()
  const { dom, intervals } = await mount({ status })
  openPanel(dom)
  await settle() // 启动时还有一次「在线扩展目录」的请求，等它落地
  const content = contentOf(dom)
  const poll = intervals.find(entry => entry.delay === 4000).fn

  await poll()
  await settle()
  const painted = content.children[0]
  assert.notEqual(painted, undefined, '第一次轮询应该画出来')
  assert.ok(content.children.length > 0)

  await poll()
  await settle()
  assert.equal(content.children[0], painted, '同一份快照不该重建 DOM')

  // 只有「每 4 秒都在变、画面上看不出来」的字段变了：还是不重画
  status.extViews.farm.now += 4000
  status.extViews.farm.plots[0].remainingMs -= 4000
  status.extViews.farm.plots[0].progress += 0.0001
  status.extViews.farm.helper.usedHours += 0.0011
  await poll()
  await settle()
  assert.equal(content.children[0], painted, '看不到的变化不该重建 DOM')

  // 真的变了：重画（否则界面停在旧数字上）
  status.pig.coins += 1
  await poll()
  await settle()
  assert.notEqual(content.children[0], painted, '余额变了必须重画')
})

test('轮询短路：焦点早退那轮没画，下一轮没再变也要补画出来', async () => {
  // 焦点在受守卫控件（菜园购买数量框）上时 render 会早退、不重画内容区。
  // 这轮快照真变了，指纹不能记成「画过了」——否则下一轮同一份快照被短路，
  // 画面永久停在旧值（改前是下一轮重画、≤4 秒自愈）。
  const status = farmSnapshot()
  status.extensions = [{ key: 'farm', builtin: false, installed: true, on: true, app: { label: '菜园', emoji: '' } }]
  const { dom, intervals } = await mount({ status })
  openPanel(dom)
  await settle()
  findByAttr(contentOf(dom), 'data-app', 'ext:farm').fire('click')
  globalThis.window.dshPiggyExtensions.register('farm', {
    render(app) {
      app.content.appendChild(app.el('div', 'farm-balance', '菜币 ' + app.data.balance))
      app.content.appendChild(app.el('input', 'fm-quantity'))
    },
  })
  const content = contentOf(dom)
  const poll = intervals.find(entry => entry.delay === 4000).fn
  assert.ok(content.allText().includes('菜币 240'), '先把旧值画出来')

  // A：焦点在购买数量框、快照真变了 → render 早退，内容区留在旧值
  const field = findByClass(content, 'fm-quantity')
  field.value = '5'
  dom.document.activeElement = field
  status.extViews.farm.balance = 999
  await poll()
  await settle()
  assert.equal(findByClass(content, 'fm-quantity'), field, '焦点还在，内容区不该重画')
  assert.equal(content.allText().includes('菜币 999'), false, '早退这轮内容区就该停在旧值')

  // B：焦点走了、快照没再变 → 上一轮欠下的那次必须补上（改后这里曾经是 0 次重画）
  dom.document.activeElement = null
  await poll()
  await settle()
  assert.equal(content.allText().includes('菜币 999'), true, '焦点走了以后，同一份快照也要补画出来')
})

test('轮询短路：render 抛异常时指纹作废，下一轮的同一份快照还会重试', async () => {
  const status = farmSnapshot()
  status.extensions = [{ key: 'farm', builtin: false, installed: true, on: true, app: { label: '菜园', emoji: '' } }]
  const { dom, intervals } = await mount({ status })
  openPanel(dom)
  await settle()
  findByAttr(contentOf(dom), 'data-app', 'ext:farm').fire('click')
  globalThis.window.dshPiggyExtensions.register('farm', {
    render(app) { app.content.appendChild(app.el('div', 'farm-balance', '菜币 ' + app.data.balance)) },
  })
  const content = contentOf(dom)
  const poll = intervals.find(entry => entry.delay === 4000).fn
  const queryAll = content.querySelectorAll.bind(content)

  // 这轮快照变了，但 render 里抛（真浏览器里就是面板自己的代码出错）：异常由轮询的报错路径兜走，
  // 指纹必须作废，否则下一轮同一份快照被短路、永远停在出错时的画面。
  let boom = true
  content.querySelectorAll = selector => { if (boom) throw new Error('boom'); return queryAll(selector) }
  status.extViews.farm.balance = 500
  await poll()
  await settle()
  assert.equal(content.allText().includes('菜币 500'), false, '抛异常这轮没画成')

  boom = false
  await poll()
  await settle()
  assert.equal(content.allText().includes('菜币 500'), true, '异常之后同一份快照也要重试画出新值')
})
