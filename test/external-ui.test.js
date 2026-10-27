// @ts-check
/**
 * 外部桌宠（#14）界面测试：API 封装、卡片、两猪选择、强制终结、预览身份选择、
 * 成功/失败/撤销、断线标签和外部模式禁用项。
 *
 * 只测 src/client 源码（client.js 由 root 统一构建），DOM 用最小假实现，
 * 网络用假 fetch，断言请求体和界面文案，不依赖真实桌面版。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

class Node {
  constructor(tag) {
    this.tagName = tag.toUpperCase()
    this.children = []
    this.parentNode = null
    this.attrs = {}
    this.listeners = {}
    this.style = { setProperty() {}, getPropertyValue() { return '' }, removeProperty() {} }
    this.className = ''
    this._text = ''
    this.value = ''
    this.disabled = false
    this.hidden = false
    this.type = ''
    this.maxLength = 0
    this.min = ''
    this.max = ''
    this.selected = false
    this.scrollTop = 0
  }
  get textContent() { return this._text ?? '' }
  set textContent(value) {
    this._text = String(value)
    for (const child of this.children) child.parentNode = null
    this.children = []
  }
  appendChild(node) { node.parentNode = this; this.children.push(node); return node }
  insertBefore(node) { return this.appendChild(node) }
  setAttribute(key, value) { this.attrs[key] = String(value) }
  getAttribute(key) { return this.attrs[key] ?? null }
  hasAttribute(key) { return Object.prototype.hasOwnProperty.call(this.attrs, key) }
  removeAttribute(key) { delete this.attrs[key] }
  addEventListener(name, fn) { (this.listeners[name] ??= []).push(fn) }
  removeEventListener(name, fn) { this.listeners[name] = (this.listeners[name] ?? []).filter(item => item !== fn) }
  fire(name, event = {}) {
    for (const fn of this.listeners[name] || []) fn({ target: this, preventDefault() {}, stopPropagation() {}, ...event })
  }
  click() { this.fire('click') }
  focus() { if (this.ownerDocument) this.ownerDocument.activeElement = this }
  setSelectionRange() {}
  contains(node) { for (let cur = node; cur; cur = cur.parentNode) if (cur === this) return true; return false }
  remove() {
    if (this.parentNode) this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1)
    this.parentNode = null
  }
  matches(selector) {
    return selector.split(',').some(part => {
      let text = part.trim()
      const notDisabled = text.includes(':not([disabled])')
      if (notDisabled) text = text.replace(':not([disabled])', '')
      if (notDisabled && this.disabled) return false
      if (text === '') return false
      if (text.startsWith('.')) return this.className.split(/\s+/).includes(text.slice(1))
      if (text.startsWith('[')) {
        const match = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(text)
        if (match === null) return false
        return match[2] === undefined ? this.hasAttribute(match[1]) : this.getAttribute(match[1]) === match[2]
      }
      if (text.includes(' ') || text.includes('>')) return false
      return this.tagName === text.toUpperCase()
    })
  }
  querySelectorAll(selector) {
    const found = []
    const visit = node => {
      for (const child of node.children) {
        if (child.matches(selector)) found.push(child)
        visit(child)
      }
    }
    visit(this)
    return found
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null }
  get allText() { return [this.textContent, ...this.children.map(child => child.allText)].join(' ') }
}

function fixture() {
  const document = {
    activeElement: null,
    body: null,
    keydown: [],
    createElement(tag) { const node = new Node(tag); node.ownerDocument = document; return node },
    createElementNS(_ns, tag) { return this.createElement(tag) },
    addEventListener(name, fn) { if (name === 'keydown') this.keydown.push(fn) },
    removeEventListener(name, fn) { if (name === 'keydown') this.keydown = this.keydown.filter(item => item !== fn) },
  }
  document.body = document.createElement('body')
  document.activeElement = document.body
  const content = document.createElement('main')
  document.body.appendChild(content)
  const ui = {
    content,
    view: {},
    messages: [],
    selects: [],
    tab: 'settings',
    showBubble(text) { this.messages.push(text) },
    renderContent() {},
    select(tab) { this.tab = tab },
    fitPanel() {},
  }
  return { document, ui, content }
}

function installGlobals() {
  const old = { document: globalThis.document, window: globalThis.window, fetch: globalThis.fetch }
  const dom = fixture()
  globalThis.document = dom.document
  globalThis.window = { setTimeout, clearTimeout, setInterval, clearInterval, location: { reload() {} } }
  return { dom, restore() { globalThis.document = old.document; globalThis.window = old.window; globalThis.fetch = old.fetch } }
}

function sectionFactory(document) {
  return (ui, title, note) => {
    const box = document.createElement('section')
    box.className = 'dp-set'
    const head = document.createElement('header')
    box.appendChild(head)
    const label = document.createElement('b')
    label.textContent = title
    head.appendChild(label)
    if (note) {
      const small = document.createElement('small')
      small.textContent = note
      head.appendChild(small)
    }
    ui.content.appendChild(box)
    return { box, head }
  }
}

function clearContent(ui) {
  for (const child of ui.content.children.slice()) { child.parentNode = null }
  ui.content.children = []
}

function status(overrides = {}) {
  return {
    ok: true, mode: 'internal', pigState: 'none', connection: 'disconnected', merged: false,
    desktop: { found: false, enabled: false, reason: '', appVersion: '', gameVersion: '', stateVersion: 0, mergeRulesVersion: 0, pid: 0, running: true },
    target: { exists: false, hatched: false, dead: false, box: false, state: '', name: '', level: 0, days: 0, coins: 0, items: 0, badges: 0 },
    local: { exists: false, hatched: false, dead: false, box: false, state: '', name: '', level: 0, days: 0, coins: 0, items: 0, badges: 0 },
    queued: 0, canMerge: false, canRollback: false, canRecoverInternal: false, mergeId: '', merge: null, lastAt: 0, error: '',
    ...overrides,
  }
}

const alive = (name, extra = {}) => ({ exists: true, hatched: true, dead: false, box: false, state: 'alive', name, level: 9, days: 21, coins: 880, items: 31, badges: 12, ...extra })
const box = { exists: true, hatched: false, dead: false, box: true, state: 'box', name: '', level: 0, days: 0, coins: 500, items: 0, badges: 0 }
const dead = (name) => ({ exists: true, hatched: true, dead: true, box: false, state: 'dead', name, level: 5, days: 9, coins: 20, items: 2, badges: 3 })
const none = { exists: false, hatched: false, dead: false, box: false, state: '', name: '', level: 0, days: 0, coins: 0, items: 0, badges: 0 }

async function settle() { await new Promise(resolve => setImmediate(resolve)) }

function resetSession(session) {
  session.open = false
  session.step = ''
  session.status = null
  session.error = ''
  session.busy = false
  session.loading = false
  session.mode = 'connect'
  session.blockers = []
  session.terminate = null
  session.preview = null
  session.choices = null
  session.result = null
  session.manageStep = ''
  session.withdrawDiscard = false
  session.lastLoad = 0
  session.closeOverlay?.()
  if (session.timer !== null) { clearInterval(session.timer); session.timer = null }
  session.ui = null
}

test('normalizeStatus/preview/result keep the shapes the UI relies on', async () => {
  const { normalizeStatus, normalizePreview, normalizeResult } = await import('../src/client/external-api.js')
  const state = normalizeStatus({
    mode: 'external', pigState: 'paused', connection: 'connected',
    desktop: { found: true, enabled: true, appVersion: '0.6.7', gameVersion: '0.37.1', stateVersion: 15, mergeRulesVersion: 1 },
    target: { exists: true, summary: { name: '团团', level: 12, days: 30, coins: 1240, items: 46, badges: 18, hatched: true } },
    local: { exists: true, summary: { name: '猪猪', level: 9, coins: 880, hatched: true } },
    queued: 12, can: { connect: true, merge: true, rollback: false, restoreEmbedded: false, act: false }, lastAt: 1760000000000,
  })
  assert.equal(state.mode, 'external')
  assert.equal(state.connection, 'connected')
  assert.equal(state.canMerge, true)
  assert.equal(state.target.name, '团团')
  assert.equal(state.local.coins, 880)
  assert.equal(state.queued, 12)

  const preview = normalizePreview({
    ok: true, mergeId: 'm1', previewToken: 't1', expiresAt: 1760000600000, blocked: true,
    details: { blockers: [{ side: 'target', kind: 'work', label: '正在打工' }] },
    target: { summary: { name: '团团', level: 12, coins: 1240, hatched: true }, runtimeId: 'r1', epoch: 4 },
    source: { summary: { name: '猪猪', level: 9, coins: 880, hatched: true } },
    result: { name: '团团', level: 12, coins: 2120, items: 77, badges: 25, newBadges: 7, newDex: 12, newDiary: 4 },
    choices: [{ key: 'name', label: '名字', default: 'target' }],
    conflicts: [{ key: 'ext:garden', label: '小花园', options: ['target', 'source'], default: 'target' }],
    warnings: ['需要重新安装扩展'], backups: { target: 'piggy-save.zip' },
  })
  assert.equal(preview.blockers.length, 1)
  assert.equal(preview.blockers[0].kind, 'work')
  assert.equal(preview.target.name, '团团')
  assert.equal(preview.result.coins, 2120)
  assert.equal(preview.conflicts[0].key, 'ext:garden')
  assert.equal(preview.runtimeId, 'r1')

  const result = normalizeResult({ ok: true, restored: { target: true, source: false }, backups: { target: 'a.zip', cleanup: 'failed' } })
  assert.deepEqual(result.restored, { target: true, source: false })
  assert.equal(result.cleanup, 'failed')
})

test('两猪选择按 4.3 的表：纸盒/墓碑/没有猪只给允许的动作', async () => {
  const { mergeOptions, summaryLine } = await import('../src/client/external-rules.js')
  assert.equal(mergeOptions(alive('团团'), alive('猪猪')).canMerge, true)
  assert.equal(mergeOptions(alive('团团'), box).canMerge, false)
  assert.match(mergeOptions(alive('团团'), box).note, /先拆盒/)
  assert.equal(mergeOptions(alive('团团'), none).canMerge, false)
  assert.equal(mergeOptions(alive('团团'), dead('猪猪')).canMerge, true)
  const moved = mergeOptions(box, alive('猪猪'))
  assert.equal(moved.canMerge, true)
  assert.equal(moved.mergeLabel, '搬到桌宠')
  assert.equal(mergeOptions(none, alive('猪猪')).canMerge, true)
  assert.match(mergeOptions(none, alive('猪猪')).note, /不补初始金币/)
  assert.match(mergeOptions(box, box).note, /两边都还没拆盒/)
  assert.equal(mergeOptions(dead('团团'), dead('猪猪')).canMerge, false)
  assert.equal(mergeOptions(dead('团团'), box).canMerge, false)
  assert.equal(mergeOptions(dead('团团'), alive('猪猪')).canMerge, true)
  assert.equal(summaryLine(alive('团团', { level: 12, days: 30 })), '团团 · Lv.12 · 30 天 · 🪙880 · 🎒31 · 🏅12')
  assert.equal(summaryLine(box), '纸盒（还没拆）')
})

test('身份选择默认值与校验：名字按当前 5 字、口头禅 6 字、钓点必须在表里', async () => {
  const { defaultChoices, validateChoices, choicesPayload, sideValues } = await import('../src/client/external-rules.js')
  const preview = {
    target: { name: '团团' }, source: { name: '猪猪' },
    choices: [
      { key: 'name', default: 'target' },
      { key: 'look', default: 'target' },
      { key: 'personality', default: 'source' },
      { key: 'preferences', default: 'target' },
    ],
    sides: {
      target: { name: '团团', form: 'normal', skin: 'default', worn: ['hat'], personality: 'genki', catchphrase: '加油鸭', motto: '今天也要开心', birthday: '5/2', ownerName: '主人', quiet: false, isOfflineFeedEnabled: true, timeScale: 1, spot: 'pond' },
      source: { name: '猪猪', form: 'chubby', skin: 'mint', worn: [], personality: 'calm', catchphrase: '慢慢来', motto: '', birthday: '6/3', ownerName: '老板', quiet: true, isOfflineFeedEnabled: false, timeScale: 2, spot: 'lake' },
    },
    editors: { look: { form: [{ key: 'normal' }, { key: 'chubby' }], skin: [{ key: 'default' }, { key: 'mint' }], worn: [{ key: 'hat' }] }, personality: { personality: [{ key: 'genki' }, { key: 'calm' }] }, preferences: { spot: [{ key: 'pond' }, { key: 'lake' }] } },
    conflicts: [{ key: 'ext:garden', default: 'target' }],
    duplicate: null,
  }
  const choices = defaultChoices(preview)
  assert.equal(choices.name.pick, 'target')
  assert.equal(choices.name.value, '团团')
  assert.equal(choices.personality.pick, 'source')
  assert.equal(choices.conflicts['ext:garden'], 'target')
  assert.equal(validateChoices(preview, choices).ok, true)

  choices.name.pick = 'custom'
  choices.name.value = ''
  assert.equal(validateChoices(preview, choices).errors.name, '名字不能为空')
  choices.name.value = '一二三四五六'
  assert.match(validateChoices(preview, choices).errors.name, /5/)
  choices.name.value = '团圆'
  assert.equal(validateChoices(preview, choices).ok, true)

  choices.look.pick = 'custom'
  Object.assign(choices.look, sideValues(preview, 'source'))
  choices.look.form = 'missing'
  assert.match(validateChoices(preview, choices).errors.look, /形态/)
  choices.look.form = 'chubby'
  choices.look.skin = 'default'
  choices.look.worn = []
  assert.equal(validateChoices(preview, choices).ok, true)

  choices.preferences.pick = 'custom'
  Object.assign(choices.preferences, sideValues(preview, 'source'))
  choices.preferences.spot = 'sea'
  assert.match(validateChoices(preview, choices).errors.preferences, /钓点/)
  choices.preferences.spot = 'lake'
  choices.preferences.timeScale = 0
  assert.match(validateChoices(preview, choices).errors.preferences, /时间倍率/)

  const payload = choicesPayload({ ...choices, name: { pick: 'custom', value: ' 团圆 ' }, duplicate: 'merge' })
  assert.deepEqual(payload.name, { side: 'custom', value: '团圆' })
  assert.equal(payload.duplicate, 'merge')
  assert.deepEqual(payload.extensions, { garden: 'target' })
})

test('设置卡片按 4.1 显示：没找到、就绪、已连接、断线、已合并离线', async () => {
  const env = installGlobals()
  try {
    const { renderExternalPetSettings } = await import('../src/client/external-pet.js')
    const { session } = await import('../src/client/external-session.js')
    const section = sectionFactory(env.dom.document)
    const ui = env.dom.ui
    const paint = status => {
      resetSession(session)
      session.status = paintStatus(status)
      session.lastLoad = Date.now()
      clearContent(ui)
      renderExternalPetSettings(ui, section)
      return env.dom.content.allText
    }
    function paintStatus(overrides) {
      return status(overrides)
    }
    let text = paint({})
    assert.match(text, /外部桌宠/)
    assert.match(text, /没找到已开启联动的桌面版/)

    text = paint({ desktop: { ...status().desktop, found: true, enabled: true }, target: alive('团团', { level: 12 }) })
    assert.match(text, /桌面版已就绪 · 团团 · Lv\.12/)
    assert.match(text, /连接后，DSH 的工作和面板操作都交给桌面上的猪/)
    assert.ok(env.dom.content.querySelector('[data-external-action="connect"]'))

    text = paint({ mode: 'external', pigState: 'paused', connection: 'connected', desktop: { ...status().desktop, found: true, enabled: true }, target: alive('团团', { level: 12 }) })
    assert.match(text, /● 已连接 · 团团 · Lv\.12/)
    assert.match(text, /DSH 的工作正在投给桌面上的猪/)
    assert.ok(env.dom.content.querySelector('[data-external-action="withdraw"]'))

    text = paint({ mode: 'external', pigState: 'paused', connection: 'disconnected', queued: 12, lastAt: 1760000000000, desktop: { ...status().desktop, found: true, enabled: true }, target: alive('团团') })
    assert.match(text, /○ 没连上桌面版/)
    assert.match(text, /工作事件在排队（12 条）/)
    assert.ok(env.dom.content.querySelector('[data-external-action="recheck"]'))

    text = paint({ mode: 'external', pigState: 'merged', merged: true, connection: 'disconnected', queued: 3, desktop: { ...status().desktop, found: true, enabled: true }, target: alive('团团') })
    assert.match(text, /○ 已合并 · 桌面版没开/)
    assert.match(text, /撤销合并要等桌面版连上/)
  } finally {
    env.restore()
  }
})

test('DSH 重启后桌面离线：持久化摘要不等于「桌面版在运行」，卡片给重新连接 + 管理', async () => {
  const env = installGlobals()
  try {
    const { renderExternalPetSettings } = await import('../src/client/external-pet.js')
    const { normalizeStatus } = await import('../src/client/external-api.js')
    const { session } = await import('../src/client/external-session.js')
    const section = sectionFactory(env.dom.document)
    const ui = env.dom.ui
    // 真实 /external/status 形状：桌面发现失败（desktop.found=false），但 config 里的
    // target 摘要还在（DSH 重启前最后一次 /pair/info）。
    const normalized = normalizeStatus({
      ok: true, mode: 'external', pigState: 'paused', connection: 'disconnected',
      desktop: { found: false, running: true, enabled: false, reason: 'missing-marker', appVersion: '', gameVersion: '', stateVersion: 0, mergeRulesVersion: 0, pid: 0 },
      target: { pid: 4242, summary: { name: '团团', level: 12, days: 30, coins: 494, items: 1, badges: 3, hatched: true, dead: false, box: false, kind: 'alive' } },
      source: { summary: null, hasPig: false },
      queued: 12, lastAt: 1760000000000,
      can: { connect: false, merge: true, rollback: false, restoreEmbedded: false, act: false },
    })
    assert.equal(normalized.mode, 'external')
    assert.equal(normalized.desktop.found, false, '发现结果不能被 target 摘要覆盖')
    assert.equal(normalized.target.coins, 494, '持久化摘要仍可读，供管理/卡片使用')
    resetSession(session)
    session.status = normalized
    session.lastLoad = Date.now()
    clearContent(ui)
    renderExternalPetSettings(ui, section)
    const text = env.dom.content.allText
    assert.match(text, /○ 没连上桌面版/)
      assert.match(text, /工作事件在排队（12 条）/)
    assert.ok(env.dom.content.querySelector('[data-external-action="recheck"]'))
    assert.ok(env.dom.content.querySelector('[data-external-action="manage"]'), '断线仍要能进管理（切回/只恢复）')
    assert.doesNotMatch(text, /没找到已开启联动的桌面版/)
    assert.doesNotMatch(text, /桌面版在运行，但没开联动/)
  } finally {
    env.restore()
  }
})

test('两猪选择默认只连接；选合并后预览被活动挡住，强制终结带确认并按 side 发请求', async () => {
  const env = installGlobals()
  const calls = []
  let sessionRef = null
  try {
    globalThis.fetch = async (url, options = {}) => {
      calls.push({ url, body: options.body ? JSON.parse(options.body) : null })
      if (String(url).endsWith('/external/status')) return { ok: true, status: 200, async json() { return { ok: true, ...status({ desktop: { ...status().desktop, found: true, enabled: true }, target: alive('团团', { level: 12 }), local: alive('猪猪') }) } } }
      if (String(url).endsWith('/external/recheck')) return { ok: true, status: 200, async json() { return { ok: true, ...status({ desktop: { ...status().desktop, found: true, enabled: true }, target: alive('团团', { level: 12 }), local: alive('猪猪') }) } } }
      if (String(url).endsWith('/external/connect')) return { ok: true, status: 200, async json() { return { ok: true, mode: 'merge', target: { summary: { name: '团团', level: 12, days: 30, coins: 1240, items: 46, badges: 18, hatched: true } }, source: { summary: { name: '猪猪', level: 9, days: 21, coins: 880, items: 31, badges: 12, hatched: true } }, blockers: [] } } }
      if (String(url).endsWith('/external/merge/preview')) return { ok: true, status: 200, async json() { return { ok: true, blocked: true, details: { blockers: [{ side: 'target', kind: 'work', label: '正在打工', refund: 0 }] } } } }
      if (String(url).endsWith('/external/merge/prepare')) return { ok: true, status: 200, async json() { return { ok: true, alreadyFinished: false } } }
      return { ok: false, status: 500, async json() { return { ok: false, reason: 'unknown' } } }
    }
    const { renderExternalPetSettings } = await import('../src/client/external-pet.js')
    const { session } = await import('../src/client/external-session.js')
    sessionRef = session
    const section = sectionFactory(env.dom.document)
    const ui = env.dom.ui
    resetSession(session)
    const paint = () => { clearContent(ui); renderExternalPetSettings(ui, section) }
    ui.renderContent = paint
    paint()
    await settle()
    await settle()
    const connect = env.dom.content.querySelector('[data-external-action="connect"]')
    connect.click()
    await settle()
    await settle()
    assert.equal(session.open, true)
    assert.match(env.dom.content.allText, /连接桌面猪/)
    assert.match(env.dom.content.allText, /只把工作和面板交给桌面猪/)
    const merge = env.dom.content.querySelector('[data-external-choice="merge"]')
    assert.ok(merge)
    merge.click()
    assert.equal(session.mode, 'merge')
    env.dom.content.querySelector('[data-external-action="choose-next"]').click()
    await settle()
    await settle()
    assert.equal(session.step, 'blockers')
    const prepareCalls = () => calls.filter(call => call.url.endsWith('/merge/prepare'))
    assert.equal(prepareCalls().length, 0)
    env.dom.content.querySelector('[data-external-force="work"]').click()
    assert.match(env.dom.content.allText, /这班还没做完，提前回来拿不到工资/)
    env.dom.content.querySelector('[data-external-action="force-go"]').click()
    await settle()
    await settle()
    assert.equal(prepareCalls().length, 1)
    assert.equal(prepareCalls()[0].body.target, 'activity')
    assert.equal(prepareCalls()[0].body.side, 'target')
  } finally {
    if (sessionRef !== null) resetSession(sessionRef)
    env.restore()
  }
})

test('预览：结果数字、身份改…、扩展二选一、副本必须选一项、提交带 choices', async () => {
  const env = installGlobals()
  const calls = []
  let sessionRef = null
  try {
    const previewBody = {
      ok: true, mergeId: 'merge-1', previewToken: 'token-1', expiresAt: Date.now() + 600000,
      target: { summary: { name: '团团', level: 12, days: 30, coins: 1240, items: 46, badges: 18, hatched: true } },
      source: { summary: { name: '猪猪', level: 9, days: 21, coins: 880, items: 31, badges: 12, hatched: true } },
      result: { name: '团团', level: 12, days: 30, coins: 2120, items: 77, badges: 25, newBadges: 7, newDex: 12, newDiary: 4 },
      choices: [
        { key: 'name', label: '名字', options: ['target', 'source', 'custom'], default: 'target', value: '团团' },
        { key: 'look', label: '样子', options: ['target', 'source', 'custom'], default: 'target', editable: ['form', 'skin', 'worn'], value: { side: 'target', form: 'normal', skin: 'default', worn: [] } },
        { key: 'personality', label: '性格', options: ['target', 'source', 'custom'], default: 'target', editable: ['personality', 'catchphrase', 'motto', 'birthday'], value: { side: 'target', personality: 'genki', catchphrase: '加油鸭', motto: '今天也要开心', birthday: { month: 5, day: 2 } } },
        { key: 'preferences', label: '偏好', options: ['target', 'source', 'custom'], default: 'target', editable: ['ownerName', 'quiet', 'isOfflineFeedEnabled', 'timeScale', 'fishing.spot'], value: { side: 'target', ownerName: '主人', quiet: false, isOfflineFeedEnabled: true, timeScale: 1, spot: 'pond' } },
      ],
      conflicts: [{ key: 'ext:garden', label: '第三方·小花园', options: ['target', 'source'], default: 'target' }],
      duplicate: { suspected: true },
      warnings: ['桌宠没装农场扩展；数据会保留'],
      autoMerge: ['进度取更高：Lv.9 → Lv.12', '金币和物品相加：+880，苹果 +3'],
      backups: { target: 'piggy-save-20261018-1420-a1b2c3d4.zip', source: 'external-20261018-1420-a1b2c3d4.zip' },
    }
    globalThis.fetch = async (url, options = {}) => {
      calls.push({ url, body: options.body ? JSON.parse(options.body) : null })
      if (String(url).endsWith('/external/status') || String(url).endsWith('/external/recheck')) {
        return { ok: true, status: 200, async json() { return { ok: true, ...status({ desktop: { ...status().desktop, found: true, enabled: true }, target: alive('团团', { level: 12 }), local: alive('猪猪') }) } } }
      }
      if (String(url).endsWith('/external/connect')) {
        return { ok: true, status: 200, async json() { return { ok: true, mode: 'merge', target: { summary: { name: '团团', level: 12, days: 30, coins: 1240, items: 46, badges: 18, hatched: true } }, source: { summary: { name: '猪猪', level: 9, days: 21, coins: 880, items: 31, badges: 12, hatched: true } }, blockers: [] } } }
      }
      if (String(url).endsWith('/merge/preview')) return { ok: true, status: 200, async json() { return previewBody } }
      if (String(url).endsWith('/merge/commit')) return { ok: true, status: 200, async json() { return { ok: true, status: 'committed', result: { name: '团团', level: 12, coins: 2120, items: 77, badges: 25 }, backups: { target: 'piggy-save-x.zip', source: 'external-x.zip', cleanup: 'done' } } } }
      return { ok: false, status: 500, async json() { return { ok: false, reason: 'unknown' } } }
    }
    const { renderExternalPetSettings } = await import('../src/client/external-pet.js')
    const { session } = await import('../src/client/external-session.js')
    sessionRef = session
    const section = sectionFactory(env.dom.document)
    const ui = env.dom.ui
    resetSession(session)
    const paint = () => { clearContent(ui); renderExternalPetSettings(ui, section) }
    ui.renderContent = paint
    paint()
    await settle()
    await settle()
    env.dom.content.querySelector('[data-external-action="connect"]').click()
    await settle()
    await settle()
    env.dom.content.querySelector('[data-external-choice="merge"]').click()
    env.dom.content.querySelector('[data-external-action="choose-next"]').click()
    await settle()
    await settle()
    assert.equal(session.step, 'preview')
    const text = env.dom.content.allText
    assert.match(text, /合并后：团团/)
    assert.match(text, /🪙2,120/)
    assert.match(text, /🎒77/)
    assert.match(text, /🏅25/)
    assert.match(text, /第三方·小花园/)
    assert.match(text, /这两只猪看起来是同一份存档的副本/)
    assert.match(text, /进度取更高：Lv\.9 → Lv\.12/)
    assert.match(text, /piggy-save-20261018-1420-a1b2c3d4\.zip/)
    let submit = env.dom.content.querySelector('[data-external-submit="true"]')
    assert.equal(submit.disabled, true, 'duplicate warning must block until the user picks one')
    env.dom.content.querySelector('[data-external-duplicate]').querySelector('[data-external-choice="merge"]').click()
    assert.equal(env.dom.content.querySelector('[data-external-submit="true"]').disabled, false)

    env.dom.content.querySelector('[data-external-edit="look"]').click()
    const form = env.dom.content.querySelector('[data-external-field="form"]')
    form.value = 'chubby'
    form.fire('input')
    const conflictSource = env.dom.content.querySelector('[data-external-conflict="ext:garden"]').querySelector('[data-external-choice="source"]')
    conflictSource.click()
    submit = env.dom.content.querySelector('[data-external-submit="true"]')
    submit.click()
    await settle()
    await settle()
    const commitCall = calls.find(call => call.url.endsWith('/merge/commit'))
    assert.ok(commitCall)
    assert.equal(commitCall.body.mergeId, undefined)
    assert.equal(commitCall.body.choices.look.side, 'custom')
    assert.equal(commitCall.body.choices.look.form, 'chubby')
    assert.equal(commitCall.body.choices.extensions.garden, 'source')
    assert.equal(commitCall.body.choices.duplicate, 'merge')
    assert.equal(session.step, 'success')
    assert.match(env.dom.content.allText, /合并完成/)
    assert.match(env.dom.content.allText, /piggy-save-x\.zip/)
    assert.match(env.dom.content.allText, /external-x\.zip/)
  } finally {
    if (sessionRef !== null) resetSession(sessionRef)
    env.restore()
  }
})

test('成功页「撤销合并」进入二次确认；部分撤销不谎称完成', async () => {
  const env = installGlobals()
  try {
    const { renderRollbackConfirm, renderRollbackPartial } = await import('../src/client/external-result.js')
    const { session } = await import('../src/client/external-session.js')
    const { createOverlay } = await import('../src/client/external-ui.js')
    const ui = env.dom.ui
    const overlay = createOverlay(ui, { label: 'test', step: 'rollback', onCancel() {} })
    const handlers = { close() {}, rollbackGo() {} }
    renderRollbackConfirm(overlay.dialog, session, handlers)
    assert.match(env.dom.content.allText, /撤销合并？/)
    assert.match(env.dom.content.allText, /合并后新增的进度会丢失/)
    assert.match(env.dom.content.allText, /合并时从内嵌猪复制过来的皮肤会撤回/)

    overlay.dialog.textContent = ''
    session.result = { restored: { target: true, source: false }, backups: { target: 'a.zip', source: 'b.zip' } }
    renderRollbackPartial(overlay.dialog, session, handlers)
    assert.match(env.dom.content.allText, /部分撤销/)
    assert.match(env.dom.content.allText, /桌面猪已恢复。内嵌猪没恢复。/)
    overlay.dispose()
  } finally {
    env.restore()
  }
})

test('外部样式表拼成一张 CSS 字符串（数组忘了 join 会让浏览器丢掉整段规则）', async () => {
  const { CSS_EXTERNAL } = await import('../src/client/external-css.js')
  const { CSS } = await import('../src/client/styles.js')
  assert.equal(typeof CSS_EXTERNAL, 'string')
  assert.match(CSS_EXTERNAL, /\.dp-ext-card-actions\{/)
  assert.match(CSS_EXTERNAL, /\.dp-link\[hidden\]\{display:none\}/)
  assert.match(CSS, /\.dp-ext-card-actions\{/)
  assert.match(CSS, /\.dp-link\[hidden\]\{display:none\}/)
})

test('断线标签：桌面猪 · 连接中断 + 最后更新/队列；内嵌模式不显示', async () => {
  const env = installGlobals()
  try {
    const { updateLinkBar, externalActionsBlocked, externalConnected } = await import('../src/client/external-link.js')
    const document = env.dom.document
    const linkBar = document.createElement('div')
    const linkNote = document.createElement('div')
    const host = document.createElement('div')
    const ctx = {
      host, linkBar, linkNote,
      view: { link: { state: 'disconnected', lastAt: 1760000000000, queued: 12, merged: false, dead: false }, pig: null },
      busy: false,
      showBubble() {}, renderContent() {}, refresh() {},
    }
    updateLinkBar(ctx)
    assert.equal(linkBar.hidden, false)
    assert.match(linkBar.allText, /桌面猪 · 连接中断/)
    assert.match(linkNote.allText, /最后更新/)
    assert.match(linkNote.allText, /工作事件在排队（12 条）/)
    assert.equal(host.getAttribute('data-link'), 'disconnected')
    assert.equal(externalActionsBlocked(ctx.view), true)
    assert.equal(externalConnected(ctx.view), false)

    ctx.view.link = { state: 'connected', lastAt: 1, queued: 0, merged: true, dead: false }
    updateLinkBar(ctx)
    assert.match(linkBar.allText, /桌面猪 · 已连接（已合并）/)
    assert.equal(linkNote.hidden, true)
    assert.equal(externalConnected(ctx.view), true)

    ctx.view.link = null
    updateLinkBar(ctx)
    assert.equal(linkBar.hidden, true)
    assert.equal(linkNote.hidden, true)
    assert.equal(host.getAttribute('data-link'), null)
  } finally {
    env.restore()
  }
})

test('外部模式下存档导入导出禁用并说明去桌面版；内嵌模式不受影响', async () => {
  const env = installGlobals()
  const calls = []
  let sessionRef = null
  try {
    globalThis.fetch = async (url, options = {}) => { calls.push(url); return { ok: false, status: 500, async json() { return {} } } }
    const { renderSaveTransferSettings } = await import('../src/client/save-transfer.js')
    const section = sectionFactory(env.dom.document)
    const ui = env.dom.ui
    ui.view = { link: { state: 'connected', lastAt: 1, queued: 0, merged: false, dead: false }, pig: { name: '团团' } }
    clearContent(ui)
    renderSaveTransferSettings(ui, section)
    const exportButton = env.dom.content.querySelector('[data-save-trigger="export"]')
    const importButton = env.dom.content.querySelector('[data-save-trigger="import"]')
    assert.equal(exportButton.disabled, true)
    assert.equal(importButton.disabled, true)
    exportButton.click()
    assert.match(ui.messages.join(' '), /外部桌宠模式下，这一项在桌面版设置里操作/)
    assert.equal(calls.length, 0)
  } finally {
    env.restore()
  }
})

test('「管理」：已合并时只给只恢复内嵌猪；桌面离线时撤销合并禁用', async () => {
  const env = installGlobals()
  try {
    const { renderManageDialog } = await import('../src/client/external-card.js')
    const { createOverlay } = await import('../src/client/external-ui.js')
    const ui = env.dom.ui
    const overlay = createOverlay(ui, { label: 'manage', step: 'manage', onCancel() {} })
    const sessionState = { status: status({ mode: 'external', pigState: 'merged', merged: true, connection: 'disconnected', queued: 2, target: alive('团团', { level: 12 }), canRollback: true }), busy: false, manageStep: '' }
    const handlers = { closeManage() {}, withdraw() {}, recoverLocal() {}, rollback() {}, setManageStep() {}, mergeStaged() {} }
    renderManageDialog(ui, sessionState, handlers, overlay)
    assert.match(env.dom.content.allText, /内嵌猪已经合并到桌宠并退役/)
    assert.match(env.dom.content.allText, /只恢复内嵌猪/)
    assert.equal(overlay.dialog.querySelector('[data-external-action="manage-rollback"]').disabled, true)
    overlay.dispose()
  } finally {
    env.restore()
  }
})

test('未知瞬态没有强制终结按钮；4.4 表里的活动才有', async () => {
  const env = installGlobals()
  try {
    const { renderBlockers } = await import('../src/client/external-wizard.js')
    const { createOverlay } = await import('../src/client/external-ui.js')
    const ui = env.dom.ui
    const overlay = createOverlay(ui, { label: 'blockers', step: 'blockers', onCancel() {} })
    const sessionState = {
      status: null, busy: false, error: '',
      blockers: [
        { side: 'target', kind: 'work', label: '正在打工', finished: false, refund: 0, bait: 0, phase: '' },
        { side: 'source', kind: 'mystery', label: '未知状态', finished: false, refund: 0, bait: 0, phase: '' },
      ],
    }
    const handlers = { close() {}, recheck() {}, goHandle() {}, askForce() {} }
    renderBlockers(overlay.dialog, sessionState, handlers)
    assert.ok(overlay.dialog.querySelector('[data-external-force="work"]'))
    assert.equal(overlay.dialog.querySelector('[data-external-force="mystery"]'), null)
    assert.match(env.dom.content.allText, /版本不支持这种状态/)
    overlay.dispose()
  } finally {
    env.restore()
  }
})

test('外部模式扩展页不请求在线目录、不显示导入和删除；内嵌模式保持原入口', async () => {
  const env = installGlobals()
  const calls = []
  try {
    globalThis.fetch = async (url) => { calls.push(String(url)); return { ok: true, status: 200, async json() { return { entries: [] } } } }
    const { renderExtensionsTab, extensionUpdateAvailable } = await import('../src/client/tabs/extensions.js')
    const ui = env.dom.ui
    const extension = { key: 'farm', label: '菜园', emoji: '🌾', on: true, installed: true, builtin: true, apps: ['farm'], dexSections: [], shopKinds: [], version: '' }
    ui.view = { extensions: [extension], link: { state: 'connected', lastAt: 1, queued: 0, merged: false, dead: false } }
    clearContent(ui)
    renderExtensionsTab(ui)
    assert.match(env.dom.content.allText, /外部桌宠模式下只显示已安装扩展/)
    assert.equal(env.dom.content.querySelector('[data-ext-remove="farm"]'), null)
    assert.equal(env.dom.content.querySelector('[data-ext-import-confirm]'), null)
    assert.equal(calls.length, 0)
    assert.equal(extensionUpdateAvailable(ui), false)
    assert.equal(calls.length, 0)

    ui.view = { extensions: [extension], link: null }
    clearContent(ui)
    renderExtensionsTab(ui)
    assert.match(env.dom.content.allText, /在线扩展/)
    assert.ok(env.dom.content.querySelector('[data-ext-remove="farm"]'))
    assert.ok(calls.some(url => url.includes('/extensions/online')))
  } finally {
    env.restore()
  }
})

test('契约流程：merge 页的源端阻塞先终结，side=source 参数正确，再回到选择页', async () => {
  const env = installGlobals()
  const calls = []
  let mergeCalls = 0
  let sessionRef = null
  try {
    globalThis.fetch = async (url, options = {}) => {
      calls.push({ url: String(url), body: options.body ? JSON.parse(options.body) : null })
      const path = String(url)
      if (path.endsWith('/external/status') || path.endsWith('/external/recheck')) {
        return { ok: true, status: 200, async json() { return { ok: true, ...status({ desktop: { ...status().desktop, found: true, enabled: true }, target: { summary: { name: '团团', level: 12, coins: 1240, hatched: true } } }) } } }
      }
      if (path.endsWith('/external/connect')) {
        mergeCalls += 1
        const blockers = mergeCalls === 1 ? [{ side: 'source', reason: 'activity', label: '打工' }] : []
        return { ok: true, status: 200, async json() { return { ok: true, mode: 'merge', target: { summary: { name: '团团', level: 12, coins: 1240, hatched: true } }, source: { summary: { name: '猪猪', level: 9, coins: 880, hatched: true } }, blockers } } }
      }
      if (path.endsWith('/external/merge/prepare')) return { ok: true, status: 200, async json() { return { ok: true, alreadyFinished: false } } }
      return { ok: false, status: 500, async json() { return { ok: false, reason: 'unknown' } } }
    }
    const { renderExternalPetSettings } = await import('../src/client/external-pet.js')
    const { session } = await import('../src/client/external-session.js')
    sessionRef = session
    const section = sectionFactory(env.dom.document)
    const ui = env.dom.ui
    resetSession(session)
    const paint = () => { clearContent(ui); renderExternalPetSettings(ui, section) }
    ui.renderContent = paint
    paint()
    await settle()
    await settle()
    env.dom.content.querySelector('[data-external-action="connect"]').click()
    await settle()
    await settle()
    assert.equal(session.step, 'choose')
    assert.match(env.dom.content.allText, /只把工作和面板交给桌面猪/)
    env.dom.content.querySelector('[data-external-choice="merge"]').click()
    env.dom.content.querySelector('[data-external-action="choose-next"]').click()
    await settle()
    assert.equal(session.step, 'blockers')
    assert.equal(env.dom.content.querySelectorAll('[data-external-force="activity"]').length, 1)
    env.dom.content.querySelector('[data-external-force="activity"]').click()
    env.dom.content.querySelector('[data-external-action="force-go"]').click()
    await settle()
    await settle()
    const prepared = calls.filter(call => call.url.endsWith('/merge/prepare'))
    assert.equal(prepared.length, 1, JSON.stringify({ step: session.step, calls: calls.map(c => c.url), terminate: session.terminate, error: session.error }))
    assert.deepEqual(prepared[0].body, { target: 'activity', side: 'source' })
    assert.equal(session.step, 'choose')
    assert.equal(mergeCalls, 2)
  } finally {
    if (sessionRef !== null) resetSession(sessionRef)
    env.restore()
  }
})

test('配置损坏时卡片给恢复入口，不显示成新猪', async () => {
  const env = installGlobals()
  try {
    const { renderExternalPetSettings } = await import('../src/client/external-pet.js')
    const { session } = await import('../src/client/external-session.js')
    const section = sectionFactory(env.dom.document)
    const ui = env.dom.ui
    resetSession(session)
    session.status = status({ configCorrupt: true, mode: 'external', pigState: 'paused', connection: 'disconnected' })
    session.lastLoad = Date.now()
    clearContent(ui)
    renderExternalPetSettings(ui, section)
    const text = env.dom.content.allText
    assert.match(text, /外部桌宠配置读不出来/)
    assert.match(text, /不会自动删除，也不会打开已合并的旧存档/)
    assert.ok(env.dom.content.querySelector('[data-external-action="restore-backup"]'))
    assert.ok(env.dom.content.querySelector('[data-external-action="withdraw"]'))
  } finally {
    env.restore()
  }
})

test('切回：有队列先问等待/丢弃；暂存被改过有单独确认页', async () => {
  const env = installGlobals()
  try {
    const { renderWithdraw, renderWithdrawChanged } = await import('../src/client/external-result.js')
    const { createOverlay } = await import('../src/client/external-ui.js')
    const ui = env.dom.ui
    const overlay = createOverlay(ui, { label: 'withdraw', step: 'withdraw', onCancel() {} })
    const statusState = status({ mode: 'external', pigState: 'paused', connection: 'disconnected', queued: 12 })
    const handlers = { close() {}, withdraw() {}, waitDeliver() {}, recoverLocal() {}, rollback() {}, withdrawChangedGo() {} }
    renderWithdraw(overlay.dialog, { status: statusState, busy: false, withdrawDiscard: false }, handlers)
    assert.match(env.dom.content.allText, /切回内嵌猪？/)
    assert.match(env.dom.content.allText, /暂存期间不饿、不病、不长大/)
    assert.match(env.dom.content.allText, /还有 12 条工作没送到/)

    overlay.dialog.textContent = ''
    renderWithdraw(overlay.dialog, { status: statusState, busy: false, withdrawDiscard: true }, handlers)
    assert.match(env.dom.content.allText, /等待送达/)
    assert.match(env.dom.content.allText, /丢弃并切回/)

    overlay.dialog.textContent = ''
    renderWithdrawChanged(overlay.dialog, { status: statusState, busy: false, error: '' }, handlers)
    assert.match(env.dom.content.allText, /暂存期间存档被改过/)
    assert.match(env.dom.content.allText, /按正常离线结算/)
    overlay.dispose()
  } finally {
    env.restore()
  }
})

test('merge-unknown：轮询 status 到 committed 后进入成功页并采用最终结果', async () => {
  const env = installGlobals()
  const realSetTimeout = globalThis.setTimeout
  let sessionRef = null
  try {
    globalThis.fetch = async () => ({ ok: true, status: 200, async json() { return { ok: true, reason: 'committed', status: 'committed', mergeId: 'm-9', result: { name: '团团', level: 12, coins: 2120, items: 77, badges: 25 }, backups: { target: 'a.zip', source: 'b.zip', cleanup: 'done' } } } })
    const { session } = await import('../src/client/external-session.js')
    sessionRef = session
    resetSession(session)
    session.step = 'failure'
    session.result = { mergeId: 'm-9' }
    const hooks = { reload: async () => {}, repaint() {}, close() {}, bubble() {}, render() {} }
    globalThis.setTimeout = fn => { fn(); return 0 }
    const { pollMergeUnknown } = await import('../src/client/external-runtime.js')
    await pollMergeUnknown(session, hooks)
    assert.equal(session.step, 'success')
    assert.equal(session.result.result.coins, 2120)
  } finally {
    if (sessionRef !== null) resetSession(sessionRef)
    globalThis.setTimeout = realSetTimeout
    env.restore()
  }
})

test('切回确认与丢弃确认按钮实际发送 disconnect，而非再次打开确认框', async () => {
  const env = installGlobals()
  const { session, handler } = await import('../src/client/external-session.js')
  const { renderWithdraw } = await import('../src/client/external-result.js')
  try {
    for (const discard of [false, true]) {
      resetSession(session)
      clearContent(env.dom.ui)
      session.ui = env.dom.ui
      session.status = status({ mode: 'external', pigState: 'paused', queued: discard ? 3 : 0 })
      session.withdrawDiscard = discard
      const calls = []
      globalThis.fetch = async (url, options = {}) => {
        calls.push({ url, body: options.body && JSON.parse(options.body) })
        return { ok: true, status: 200, async json() { return { ok: true, mode: 'embedded', pigState: 'none' } } }
      }
      renderWithdraw(env.dom.content, session, handler)
      env.dom.content.querySelector('[data-external-action="' + (discard ? 'discard-go' : 'withdraw-go') + '"]').click()
      await settle()
      const request = calls.find(call => call.url === '/dsh-piggy/external/disconnect')
      assert.ok(request, '确认按钮必须真正发送切回请求')
      assert.equal(request.body.discardQueue, discard)
      assert.ok(env.dom.ui.messages.includes('已切回内嵌猪'))
      env.dom.ui.messages.length = 0
    }
  } finally { resetSession(session); env.restore() }
})
