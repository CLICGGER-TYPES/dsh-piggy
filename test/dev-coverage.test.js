/**
 * C1：调试模式「解锁才开」+ 调试页覆盖所有可解锁内容。
 *
 * 用户 2026-10-01：调试模式原来是 Ctrl+Shift+D + localStorage 永久记住，用户看到
 * 「没关」——现在改成主屏版本号连点 7 次解锁、只存内存，刷新就关。
 *
 * 第二条是这个文件存在的长期理由：以后每加一种形态（PR #3 的恶魔猪）、皮肤、鱼，
 * 只要调试页忘了放入口，这里的循环就会红。
 *
 * Run: node --test test/*.test.js
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { FORMS } from '../packages/pet-core/src/data/evolution.js'
import { lifeStageByKey } from '../packages/pet-core/src/data/life.js'
import { renderDevTab } from '../src/client/tabs/dev.js'
import { applyDevPatch, layEgg } from '../packages/pet-core/src/core.js'
import { SNAPSHOT, PIG, fakeDom, findByAttr, findByClass, contentOf, hostOf, mount, openPanel, sceneOf, settle, tapVersion } from './helpers/bundle.js'

/** 形态所在阶段的起始等级，测试里从数据表取（和宿主同源，不写死数字）。 */
const LIFE_FROM_LEVEL = Object.fromEntries(FORMS.map(form => [form.stage, lifeStageByKey(form.stage).fromLevel]))

// ---------------------------------------------------------------------------
// 「解锁才开」
// ---------------------------------------------------------------------------

test('调试模式默认关着：面板上没有 🔧，控制台也没有开关', async () => {
  const { dom } = await mount()
  openPanel(dom)
  assert.equal(hostOf(dom).getAttribute('data-dev'), 'false', '刷新后调试模式必须是关的')
  assert.equal(findByAttr(contentOf(dom), 'data-app', 'dev'), undefined, '刷新后不该有调试 App')
  assert.equal(globalThis.window.dshPigDev?.on, undefined, 'dshPigDev.on 必须不存在')
  assert.equal(globalThis.window.dshPigDev?.toggle, undefined, 'dshPigDev.toggle 必须不存在')
  assert.equal(typeof globalThis.window.dshPigDev?.off, 'function', 'off 保留，方便救急')
})

test('老版本存在 localStorage 的「已开」状态会被清掉', async () => {
  const { dom, store } = await mount({ store: { 'dsh-piggy:dev': '1' } })
  openPanel(dom)
  assert.equal(hostOf(dom).getAttribute('data-dev'), 'false', '存过的 1 不该把调试模式带起来')
  assert.equal(store.get('dsh-piggy:dev'), '0', '启动时把它写成 0')
})

test('主屏底部有一行版本号', async () => {
  const { dom } = await mount()
  openPanel(dom)
  const line = findByAttr(contentOf(dom), 'data-version', 'true')
  assert.notEqual(line, undefined)
  assert.ok(line.allText().includes('0.25.0'), `版本号要写出来：${line?.allText()}`)
})

test('3 秒内连点 6 次不开，第 7 次才开', async () => {
  const realNow = Date.now
  let now = 1_000_000
  Date.now = () => now
  try {
    const { dom } = await mount()
    openPanel(dom)
    for (let i = 0; i < 6; i += 1) {
      now += 100
      tapVersion(dom)
    }
    assert.equal(hostOf(dom).getAttribute('data-dev'), 'false', '6 次还不够')
    now += 100
    tapVersion(dom)
    assert.equal(hostOf(dom).getAttribute('data-dev'), 'true', '第 7 次解锁')
  } finally {
    Date.now = realNow
  }
})

test('第 4 次起气泡提示还差几次', async () => {
  const realNow = Date.now
  let now = 2_000_000
  Date.now = () => now
  try {
    const { dom } = await mount()
    openPanel(dom)
    const bubble = () => findByClass(sceneOf(dom), 'dp-bubble').allText()
    for (let i = 0; i < 3; i += 1) { now += 100; tapVersion(dom) }
    assert.equal(bubble().includes('再点'), false, '前三次不提示')
    now += 100
    tapVersion(dom)
    assert.ok(bubble().includes('再点 3 次'), `第 4 次该说还差 3 次：${bubble()}`)
    now += 100
    tapVersion(dom)
    now += 100
    tapVersion(dom)
    assert.ok(bubble().includes('再点 1 次'), `第 6 次该说还差 1 次：${bubble()}`)
  } finally {
    Date.now = realNow
  }
})

test('点得比 3 秒慢就不算连点', async () => {
  const realNow = Date.now
  let now = 3_000_000
  Date.now = () => now
  try {
    const { dom } = await mount()
    openPanel(dom)
    for (let i = 0; i < 4; i += 1) { now += 100; tapVersion(dom) }
    now += 4000
    for (let i = 0; i < 3; i += 1) { now += 100; tapVersion(dom) }
    assert.equal(hostOf(dom).getAttribute('data-dev'), 'false', '中间断了就要重新数')
  } finally {
    Date.now = realNow
  }
})

test('Ctrl+Shift+D 不再开调试模式', async () => {
  const { dom, windowListeners } = await mount()
  openPanel(dom)
  for (const fn of windowListeners.keydown ?? []) {
    fn({ ctrlKey: true, shiftKey: true, key: 'd', preventDefault() {} })
  }
  assert.equal(hostOf(dom).getAttribute('data-dev'), 'false', '快捷键必须撤掉')
})

test('调试页顶部有「关闭调试」，点了就关，而且是内存态（没写 localStorage）', async () => {
  const { dom, store } = await mount()
  openPanel(dom)
  const realNow = Date.now
  let now = 4_000_000
  Date.now = () => now
  try {
    for (let i = 0; i < 7; i += 1) { now += 100; tapVersion(dom) }
    // 解锁后直接落在调试页，先回主屏再进去一次（顺带验证两个方向都在）
    const home = findByAttr(contentOf(dom), 'data-home', 'true')
    if (home !== undefined) home.fire('click')
    findByAttr(contentOf(dom), 'data-app', 'dev').fire('click')
    const off = findByAttr(contentOf(dom), 'data-dev', 'devOff')
    assert.notEqual(off, undefined, '调试页顶部要有「关闭调试」')
    off.fire('click')
    assert.equal(hostOf(dom).getAttribute('data-dev'), 'false', '关掉后调试模式是关的')
    assert.equal(findByAttr(contentOf(dom), 'data-app', 'dev'), undefined, '关掉后调试 App 消失')
    assert.equal(store.get('dsh-piggy:dev'), '0', '只在内存里开关，存储里始终是 0')
  } finally {
    Date.now = realNow
  }
})

// ---------------------------------------------------------------------------
// 覆盖：调试页要能进每一种形态（以后还有皮肤、鱼）
// ---------------------------------------------------------------------------

/** 解锁并停在调试页（可指定快照 / POST 返回）。 */
async function openDevTab(options) {
  const mounted = await mount(options ?? {})
  const realNow = Date.now
  let now = 5_000_000
  Date.now = () => now
  try {
    openPanel(mounted.dom)
    for (let i = 0; i < 7; i += 1) { now += 100; tapVersion(mounted.dom) }
    const home = findByAttr(contentOf(mounted.dom), 'data-home', 'true')
    if (home !== undefined) home.fire('click')
    findByAttr(contentOf(mounted.dom), 'data-app', 'dev').fire('click')
  } finally {
    Date.now = realNow
  }
  return mounted
}

/** 老名字，保持既有调用不变。 */
const openDevTabWith = openDevTab

test('每种形态在调试页都有一个入口，外加「恢复普通」', async () => {
  const { dom } = await openDevTab()
  for (const form of FORMS) {
    assert.notEqual(
      findByAttr(contentOf(dom), 'data-dev', 'form:' + form.key),
      undefined,
      `调试页少了形态入口 ${form.key}（${form.label}）—— 新加形态时记得补`,
    )
  }
  assert.notEqual(findByAttr(contentOf(dom), 'data-dev', 'form:none'), undefined, '要有「恢复普通」')
})

test('C3 每种晋升道具在调试页都有一键给予入口', async () => {
  const status = {
    ...SNAPSHOT,
    forms: { current: null, forms: FORMS.map(form => ({
      key: form.key, item: form.item, label: form.label, emoji: form.emoji,
      stage: form.stage, fromLevel: lifeStageByKey(form.stage).fromLevel,
      current: false, ready: false, requirements: [],
    })) },
  }
  const { dom } = await openDevTab({ status })
  for (const form of FORMS) {
    assert.notEqual(findByAttr(contentOf(dom), 'data-dev', 'item:' + form.item), undefined, form.item)
  }
})

test('以后加的皮肤和鱼也必须进调试页（表还不存在就先跳过）', async () => {
  const tables = []
  for (const entry of [
    { file: 'skins.js', table: 'SKINS', prefix: 'skin:' },
    { file: 'fish.js', table: 'FISH', prefix: 'fish:' },
  ]) {
    try {
      const module = await import('../packages/pet-core/src/data/' + entry.file)
      const rows = module[entry.table]
      if (Array.isArray(rows) && rows.length > 0) tables.push({ rows, prefix: entry.prefix, table: entry.table })
    } catch (error) {
      // 表还没建：C5/C6 会加，那时这条断言自动生效。
    }
  }
  if (tables.length === 0) return
  const { dom } = await openDevTab()
  for (const { rows, prefix, table } of tables) {
    for (const row of rows) {
      assert.notEqual(
        findByAttr(contentOf(dom), 'data-dev', prefix + row.key),
        undefined,
        `${table} 里的 ${row.key} 在调试页没有入口`,
      )
    }
  }
})

test('调试补丁能直接设形态，也能恢复普通（核心侧）', () => {
  const state = layEgg(0)
  applyDevPatch(state, { form: 'king' }, 0)
  assert.equal(state.form, 'king')
  applyDevPatch(state, { form: null }, 0)
  assert.equal(state.form, null, '恢复普通')
  applyDevPatch(state, { form: 'nope' }, 0)
  assert.equal(state.form, null, '不认识的形态键忽略掉')
})

// ---------------------------------------------------------------------------
// C1 尾巴：形态按钮顺手把等级拉到该形态所在阶段
// ---------------------------------------------------------------------------

/** 打开调试页并点一个形态按钮，返回最后一条 dev patch。 */
async function tapForm(key, status) {
  const mounted = await mount({ status })
  const realNow = Date.now
  let now = 9_000_000
  Date.now = () => now
  try {
    openPanel(mounted.dom)
    for (let i = 0; i < 7; i += 1) { now += 100; tapVersion(mounted.dom) }
    const home = findByAttr(contentOf(mounted.dom), 'data-home', 'true')
    if (home !== undefined) home.fire('click')
    findByAttr(contentOf(mounted.dom), 'data-app', 'dev').fire('click')
    const button = findByAttr(contentOf(mounted.dom), 'data-dev', 'form:' + key)
    assert.notEqual(button, undefined, `调试页没有 ${key} 入口`)
    button.fire('click')
  } finally {
    Date.now = realNow
  }
  const post = mounted.calls.filter(call => call.method === 'POST').at(-1)
  assert.notEqual(post, undefined, '点了形态按钮却没有发请求')
  return { body: JSON.parse(String(post.body)), dom: mounted.dom }
}

test('幼年猪点猪猪王：同一次补丁里把等级拉到该阶段起始等级', async () => {
  const want = lifeStageByKey(FORMS[0].stage).fromLevel
  const { body } = await tapForm(FORMS[0].key)
  assert.equal(body.action, 'dev')
  assert.equal(body.patch.form, FORMS[0].key, '形态要设上')
  assert.equal(body.patch.level, want, `等级要拉到 ${FORMS[0].stage} 的起始等级 ${want}（从 data/life.js 读）`)
})

test('等级已经够就只改形态，不动等级', async () => {
  const want = lifeStageByKey(FORMS[0].stage).fromLevel
  const status = { ...SNAPSHOT, pig: { ...PIG, levelInfo: { ...PIG.levelInfo, level: want + 5 } } }
  const { body } = await tapForm(FORMS[0].key, status)
  assert.equal(body.patch.form, FORMS[0].key)
  assert.equal(body.patch.level, undefined, '等级够了就不该出现在补丁里')
})

test('纸盒的猪：形态按钮置灰并写明「先孵化」，恢复普通照旧能用', async () => {
  // 纸盒存档在真机上根本进不到调试页（面板整屏是纸盒页），所以这条直接渲染调试页
  // 验证置灰逻辑：只要视图说没孵化，形态按钮就点不动，并且旁边写明原因。
  const { document } = fakeDom()
  globalThis.document = document
  const content = document.createElement('div')
  const ui = {
    content: content,
    view: { version: '0.25.1', hatched: false, dead: false, pig: null, forms: SNAPSHOT.forms, maxHealth: 5 },
    send() {}, devOff() {}, setOpen() {}, host: { getAttribute: () => 'false' },
  }
  renderDevTab(ui)
  for (const form of FORMS) {
    const button = findByAttr(content, 'data-dev', 'form:' + form.key)
    assert.notEqual(button, undefined, `纸盒也该看到形态按钮 ${form.key}`)
    assert.equal(button.disabled, true, '纸盒时形态按钮要置灰')
  }
  assert.ok(content.allText().includes('先孵化'), content.allText())
  assert.equal(findByAttr(content, 'data-dev', 'form:none').disabled, false, '恢复普通不受影响')
})

test('直接渲染调试页：幼年猪点形态会把等级拉到起始等级', () => {
  const { document } = fakeDom()
  globalThis.document = document
  const content = document.createElement('div')
  const sent = []
  const ui = {
    content: content,
    view: {
      version: '0.25.1', hatched: true, dead: false, forms: SNAPSHOT.forms, maxHealth: 5,
      pig: { ...PIG, level: { level: 2 } },
    },
    send(action, payload) { sent.push({ action, payload }) },
    devOff() {}, setOpen() {}, host: { getAttribute: () => 'false' },
  }
  renderDevTab(ui)
  findByAttr(content, 'data-dev', 'form:' + FORMS[0].key).fire('click')
  const patch = sent.at(-1).payload.patch
  assert.equal(patch.form, FORMS[0].key)
  assert.equal(patch.level, lifeStageByKey(FORMS[0].stage).fromLevel)
})

test('死了的猪：形态按钮置灰并写明「先复活」', async () => {
  const status = { ...SNAPSHOT, dead: true, pig: { ...PIG, soul: true } }
  const { dom } = await openDevTab({ status })
  for (const form of FORMS) {
    assert.equal(findByAttr(contentOf(dom), 'data-dev', 'form:' + form.key).disabled, true, '死了不能变形态')
  }
  assert.ok(contentOf(dom).allText().includes('先复活'), contentOf(dom).allText())
  assert.equal(findByAttr(contentOf(dom), 'data-dev', 'form:none').disabled, false)
})

test('G 批次：调试页按模块分页，只显示当前页；左右箭头能切；每个按钮有说明', async () => {
  const { dom } = await mount({ status: { ...SNAPSHOT } })
  openPanel(dom)
  const realNow = Date.now
  let now = 4_000_000
  Date.now = () => now
  try { for (let i = 0; i < 7; i += 1) { now += 100; tapVersion(dom) } } finally { Date.now = realNow }
  // 解锁后直接落在调试页
  const pages = []
  contentOf(dom).walk(node => { if (node.attributes?.['data-dev-page-body'] !== undefined) pages.push(node) })
  assert.ok(pages.length >= 9, '至少九页')
  assert.equal(pages.filter(page => !page.hidden).length, 1, '只显示一页')
  const before = pages.find(page => !page.hidden).attributes['data-dev-page-body']
  findByAttr(contentOf(dom), 'data-dev-next', 'true').fire('click')
  const after = []
  contentOf(dom).walk(node => { if (node.attributes?.['data-dev-page-body'] !== undefined && !node.hidden) after.push(node.attributes['data-dev-page-body']) })
  assert.notEqual(after[0], before, '右箭头切到下一页')
  for (const key of ['signin:7', 'gifts:3', 'update:fake', 'say:eat']) assert.notEqual(findByAttr(contentOf(dom), 'data-dev', key), undefined, key)
})

// ---------------------------------------------------------------------------
// 立绘页：每张反馈图、每个小动作都要有入口（2026-10-09 用户：调试看不到新图）
// ---------------------------------------------------------------------------

test('调试页「立绘」列出 assets/feedback 里的每张图，且列出的图都真实存在', async () => {
  const { readdirSync } = await import('node:fs')
  const { feedbackArtUses } = await import('../src/client/tabs/dev.js')
  const files = readdirSync(new URL('../assets/feedback/', import.meta.url))
    .filter(name => name.endsWith('.png')).map(name => name.slice(0, -4)).sort()
  const listed = Object.keys(feedbackArtUses()).sort()
  assert.deepEqual(listed, files, '新加或删了反馈图，调试页和用图表要一起改')
  for (const [name, where] of Object.entries(feedbackArtUses())) assert.ok(where.every(w => w !== ''), `${name} 的用途说明不能是空的`)
})

test('调试页「立绘」：点图会让猪换图，小动作按指定的做', async () => {
  const { IDLE_ACTIONS } = await import('../src/client/life.js')
  const shown = []
  const idled = []
  const { document } = fakeDom()
  globalThis.document = document
  const ui = {
    view: { ...SNAPSHOT, pig: PIG },
    content: document.createElement('div'),
    send() {}, renderContent() {}, devOff() {}, setOpen() {}, host: { getAttribute: () => 'false' },
    previewArt: name => shown.push(name), idleNow: key => idled.push(key),
  }
  renderDevTab(ui)
  findByAttr(ui.content, 'data-dev', 'art:birthday').fire('click')
  findByAttr(ui.content, 'data-dev', 'art:auto').fire('click')
  assert.deepEqual(shown, ['birthday', null])
  for (const action of IDLE_ACTIONS) {
    const btn = findByAttr(ui.content, 'data-dev', 'idle:' + action.key)
    assert.ok(btn && !btn.disabled, `小动作 ${action.key} 要有入口`)
    btn.fire('click')
  }
  assert.deepEqual(idled, IDLE_ACTIONS.map(action => action.key))
})
