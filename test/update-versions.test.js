// @ts-check
/**
 * 更新页版本列表：DSH 插件列出发布页上的正式版和测试版并给出版本安装命令，
 * 桌面版把测试版清楚列出来但不推荐、不提醒。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { fakeDom } from './helpers/bundle.js'
import { CHANNEL } from '../channel.js'
import { createUpdateNotice } from '../src/client/update-notice.js'
import { gameReleases, gameTag, renderDshUpdate } from '../src/client/tabs/update-versions.js'
import { renderUpdateTab } from '../src/client/tabs/update.js'

/** 换掉 document / window / fetch，并在 finally 里按原名恢复。 */
function installGlobals(dom, extraWindow) {
  const saved = ['document', 'window', 'fetch'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)])
  Object.defineProperty(globalThis, 'document', { configurable: true, value: dom.document })
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { open() {}, ...(extraWindow ?? {}) },
  })
  return () => {
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor)
      else delete globalThis[name]
    }
  }
}

function setFetch(doFetch) {
  Object.defineProperty(globalThis, 'fetch', { configurable: true, value: doFetch })
}

function flush() {
  return new Promise(resolve => setTimeout(resolve, 0))
}

function findByAttribute(root, attribute, value) {
  let match = null
  root.walk(node => { if (node.getAttribute(attribute) === value) match = node })
  return match
}

function dshUi(dom, options = {}) {
  const ui = {
    content: dom.body,
    tab: 'update',
    view: { version: options.version ?? '0.37.1' },
    updateNotice: options.notice ?? null,
    renderContent() {
      dom.body.textContent = ''
      renderDshUpdate(ui)
    },
  }
  return ui
}

test('发行版标签只认游戏版本：草稿和扩展发行版都不进列表', () => {
  assert.equal(gameTag('v0.37.2-rc.2'), '0.37.2-rc.2')
  assert.equal(gameTag('0.37.2'), '0.37.2')
  assert.equal(gameTag('ext-farm-4.0.10'), null)
  assert.equal(gameTag('v0.38'), null)

  const releases = gameReleases([
    { tag_name: 'ext-farm-4.0.10', draft: false },
    { tag_name: 'v0.37.2-rc.2', draft: false, prerelease: true, body: 'rc notes' },
    { tag_name: 'v0.37.2', draft: true, body: 'draft notes' },
    { tag_name: 'v0.37.1', draft: false, prerelease: false, published_at: '2026-10-16T08:00:00Z', body: 'stable notes' },
  ])
  assert.deepEqual(releases.map(release => release.version), ['0.37.2-rc.2', '0.37.1'])
  assert.equal(releases[0].prerelease, true)
  assert.equal(releases[0].page, CHANNEL.releasesPage + '/tag/v0.37.2-rc.2')
  assert.equal(releases[1].date, '2026-10-16')
  assert.equal(releases[1].notes, 'stable notes')
})

test('Gitee 没带 prerelease 标记时，版本号里的 -rc.N 仍算测试版', () => {
  const releases = gameReleases([
    { tag_name: 'v0.37.2-rc.2', draft: false, body: 'rc' },
    { tag_name: 'v0.37.2', draft: false, body: 'stable' },
  ])
  assert.deepEqual(releases.map(release => release.version), ['0.37.2', '0.37.2-rc.2'])
  assert.equal(releases[1].prerelease, true)
})

test('DSH 更新页用当前渠道问发布页，正式版直接列、测试版点开可看说明和安装命令', async () => {
  const dom = fakeDom()
  const restore = installGlobals(dom)
  const calls = []
  const payload = [
    { tag_name: 'v0.37.2-rc.2', draft: false, prerelease: true, body: 'RC 说明：修了激活失败', html_url: 'https://example.test/v0.37.2-rc.2' },
    { tag_name: 'v0.37.1', draft: false, prerelease: false, published_at: '2026-10-16T08:00:00Z', body: '正式版说明' },
    { tag_name: 'v0.38.0', draft: true, prerelease: false, body: '还没发' },
    { tag_name: 'ext-farm-4.0.10', draft: false, prerelease: false, body: '扩展发行版' },
  ]
  setFetch(async (url) => {
    calls.push(url)
    // 选中测试版后才问 npm；这一版确认发过，才应该给按版本安装的命令。
    if (url.startsWith('https://registry.npmjs.org/')) return { ok: true, status: 200, async json() { return { version: '0.37.2-rc.2' } } }
    return { ok: true, status: 200, async json() { return payload } }
  })
  try {
    const ui = dshUi(dom)
    ui.renderContent()
    await flush()

    assert.deepEqual(calls, [CHANNEL.releasesList], '只展开列表时不问 npm')
    const collapsed = dom.body.allText()
    assert.match(collapsed, /正式版/)
    assert.match(collapsed, /v0\.37\.1/)
    assert.doesNotMatch(collapsed, /4\.0\.10/)
    assert.doesNotMatch(collapsed, /v0\.38\.0/)
    assert.equal(findByAttribute(dom.body, 'data-dsh-release', '0.37.2-rc.2'), null, '测试版默认收着')

    findByAttribute(dom.body, 'data-dsh-previews', '').fire('click')
    assert.notEqual(findByAttribute(dom.body, 'data-dsh-release', '0.37.2-rc.2'), null)
    findByAttribute(dom.body, 'data-dsh-open', '0.37.2-rc.2').fire('click')
    await flush()

    const expanded = dom.body.allText()
    assert.match(expanded, /RC 说明/)
    assert.match(expanded, /dsh plugin --profile web add dsh-piggy@0\.37\.2-rc\.2/)
    assert.doesNotMatch(expanded, /手动发布/, '发布流程不塞给玩家')
    assert.notEqual(findByAttribute(dom.body, 'data-update-page', '0.37.2-rc.2'), null)
    assert.deepEqual(calls, [CHANNEL.releasesList, 'https://registry.npmjs.org/dsh-piggy/0.37.2-rc.2'])
  } finally {
    restore()
  }
})

test('发布页问不到时给重试；重试后空列表说明原因并给发布页入口', async () => {
  const dom = fakeDom()
  const restore = installGlobals(dom)
  let mode = 'fail'
  let calls = 0
  setFetch(async () => {
    calls += 1
    if (mode === 'fail') throw new Error('offline')
    return { ok: true, status: 200, async json() { return [] } }
  })
  try {
    const ui = dshUi(dom)
    ui.renderContent()
    await flush()
    assert.match(dom.body.allText(), /没问到 GitHub 发布页/)

    const retry = findByAttribute(dom.body, 'data-dsh-retry', '')
    assert.ok(retry, '失败后应该有重试按钮')
    mode = 'empty'
    retry.fire('click')
    await flush()

    assert.equal(calls, 2)
    const text = dom.body.allText()
    assert.match(text, /发布页上还没有能安装的版本/)
    assert.notEqual(findByAttribute(dom.body, 'data-dsh-page', ''), null)
  } finally {
    restore()
  }
})

test('刷新失败保留上一次的版本列表，只多一行原因', async () => {
  const dom = fakeDom()
  const restore = installGlobals(dom)
  let calls = 0
  let fail = false
  setFetch(async () => {
    calls += 1
    if (fail) throw new Error('offline')
    return {
      ok: true,
      status: 200,
      async json() {
        return [
          { tag_name: 'v0.37.2-rc.2', draft: false, prerelease: true, body: 'RC 说明' },
          { tag_name: 'v0.37.1', draft: false, prerelease: false, body: '正式版说明' },
        ]
      },
    }
  })
  try {
    const ui = dshUi(dom)
    ui.renderContent()
    await flush()
    assert.match(dom.body.allText(), /v0\.37\.1/)

    fail = true
    findByAttribute(dom.body, 'data-dsh-refresh', '').fire('click')
    await flush()

    assert.equal(calls, 2)
    const text = dom.body.allText()
    assert.match(text, /刷新失败：没问到 GitHub 发布页/)
    assert.match(text, /v0\.37\.1/, '旧列表还在')
    assert.match(text, /测试版/)
  } finally {
    restore()
  }
})

test('测试版只进列表：正式版检查看不到 RC，不亮红点也不弹气泡', async () => {
  const saved = new Map()
  const bubbles = []
  const notice = createUpdateNotice({
    currentVersion: () => '0.37.1',
    getDesktop: () => null,
    // GitHub 的 latest 接口只返回正式版；RC 只在发布页列表里。
    fetchLatest: async () => ({ version: '0.37.1', page: 'release', notes: '', prerelease: false }),
    read: key => saved.get(key) ?? null,
    write: (key, value) => saved.set(key, value),
    canBubble: () => true,
    showBubble: text => bubbles.push(text),
    changed: () => {},
  })
  await notice.check()
  assert.equal(notice.latest, null)
  assert.equal(notice.unread, false)
  assert.deepEqual(bubbles, [])

  const dom = fakeDom()
  const restore = installGlobals(dom)
  setFetch(async () => ({
    ok: true,
    status: 200,
    async json() {
      return [
        { tag_name: 'v0.37.2-rc.2', draft: false, prerelease: true, body: 'RC 说明' },
        { tag_name: 'v0.37.1', draft: false, prerelease: false, body: '正式版说明' },
      ]
    },
  }))
  try {
    const ui = dshUi(dom, { notice })
    ui.renderContent()
    await flush()
    assert.doesNotMatch(dom.body.allText(), /发现新版本 v0\.37\.2-rc\.2/)

    findByAttribute(dom.body, 'data-dsh-previews', '').fire('click')
    assert.notEqual(findByAttribute(dom.body, 'data-dsh-release', '0.37.2-rc.2'), null, 'RC 仍在版本列表里可选')
  } finally {
    restore()
  }
})

test('桌面更新页把 RC 只放在列表里：不推荐更新，点开版本组就能手动安装', async () => {
  const dom = fakeDom()
  const opened = []
  const releases = [
    { version: '0.37.2-rc.2', date: '2026-10-26', prerelease: true, blocked: null, page: 'rc', notes: 'RC 说明', manifest: { shellVersion: '0.6.8-rc.1' } },
    { version: '0.37.1', date: '2026-10-16', prerelease: false, blocked: null, current: true, page: 'stable', notes: '正式版说明' },
  ]
  const piggyShell = {
    openPage(page) { opened.push(page) },
    updates: {
      current: async () => ({ version: '0.37.1', shell: '0.6.7', bundled: false, previous: null }),
      list: async () => ({ ok: true, releases }),
      install: async version => ({ ok: true, version }),
      rollback: async () => ({ ok: true }),
      onProgress() {},
    },
    shellUpdates: { status: async () => ({ mode: 'automatic' }), onProgress() {} },
  }
  const restore = installGlobals(dom, { piggyShell })
  try {
    const ui = {
      content: dom.body,
      view: { version: '0.37.1' },
      renderContent() {
        dom.body.textContent = ''
        renderUpdateTab(ui)
      },
    }
    ui.renderContent()
    await flush()

    const text = dom.body.allText()
    assert.match(text, /列表里还有 1 个测试版/)
    assert.equal(findByAttribute(dom.body, 'data-update-latest', '0.37.2-rc.2'), null)
    assert.doesNotMatch(text, /更新到最新 v0\.37\.2-rc\.2/)

    const group = findByAttribute(dom.body, 'data-release-group', '0.37.2')
    assert.ok(group, 'RC 应该有自己的版本组')
    assert.match(group.allText(), /测试版 1/)
    findByAttribute(dom.body, 'data-release', '0.37.2-rc.2').fire('click')
    assert.notEqual(findByAttribute(dom.body, 'data-update-install', '0.37.2-rc.2'), null)
    assert.match(dom.body.allText(), /配套桌面外壳 v0\.6\.8-rc\.1/)
    findByAttribute(dom.body, 'data-preview-shell', '0.37.2-rc.2').fire('click')
    assert.deepEqual(opened, ['rc'], 'RC 外壳通过所选版本发布页手动下载，不参与自动推荐')
    releases[0].current = true
    ui.renderContent()
    assert.equal(findByAttribute(dom.body, 'data-update-install', '0.37.2-rc.2').disabled, true)
    assert.notEqual(findByAttribute(dom.body, 'data-preview-shell', '0.37.2-rc.2'), null, '已经换过游戏包也能补装配套外壳')
    releases[0].manifest.shellVersion = '0.6.6'
    ui.renderContent()
    assert.equal(findByAttribute(dom.body, 'data-preview-shell', '0.37.2-rc.2'), null, '不提示降级外壳')
  } finally {
    restore()
  }
})
