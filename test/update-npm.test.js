// @ts-check
/**
 * 更新页版本详情的 npm 核对：只有选中才问、只问精确版本、200 才给安装命令，
 * 404 说明这一版没发到 npm，网络失败给可重试状态；快速换版本或离开页面时，
 * 迟到的结果不能覆盖现在看到的状态。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { fakeDom } from './helpers/bundle.js'
import { NPM_REGISTRY, fetchNpmVersion, npmVersionUrl } from '../src/client/tabs/update-npm.js'
import { renderDshUpdate } from '../src/client/tabs/update-versions.js'

const RELEASES = [
  { tag_name: 'v0.37.2', draft: false, prerelease: false, published_at: '2026-10-24T08:00:00Z' },
  { tag_name: 'v0.37.1', draft: false, prerelease: false, published_at: '2026-10-16T08:00:00Z' },
]

/** 假 Response：只要 ok / status / json，够页面判断。 */
function reply(status, body) {
  return { ok: status >= 200 && status < 300, status, async json() { return body } }
}

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
    renders: 0,
    view: { version: options.version ?? '0.36.0' },
    updateNotice: null,
    renderContent() {
      ui.renders += 1
      dom.body.textContent = ''
      renderDshUpdate(ui)
    },
  }
  return ui
}

/** 假 fetch：发布页和 npm 各回各的，并把问过的地址记下来。 */
function routingFetch(options = {}) {
  const calls = { releases: [], npm: [], all: [] }
  const doFetch = async (url) => {
    calls.all.push(url)
    if (url.startsWith(NPM_REGISTRY)) {
      calls.npm.push(url)
      const version = decodeURIComponent(url.slice(url.lastIndexOf('/') + 1))
      const answer = (options.npm ?? {})[version]
      if (answer === undefined || answer === 'offline') throw new Error('offline')
      return reply(answer, answer === 200 ? { name: 'dsh-piggy', version } : { error: 'version not found' })
    }
    calls.releases.push(url)
    return reply(200, options.releases ?? RELEASES)
  }
  return { doFetch, calls }
}

test('npm 精确版本地址：200 算有、404 算这一版没发，其它情况只报没问出来', async () => {
  assert.equal(npmVersionUrl('0.37.2-rc.2'), NPM_REGISTRY + '/dsh-piggy/0.37.2-rc.2')
  const asked = []
  const found = await fetchNpmVersion('0.37.2', async (url, init) => {
    asked.push({ url, init })
    return reply(200, { version: '0.37.2' })
  })
  assert.equal(found, 'found')
  assert.equal(asked[0].url, NPM_REGISTRY + '/dsh-piggy/0.37.2')
  assert.equal(asked[0].init.cache, 'no-store')
  assert.equal(asked[0].init.headers.accept, 'application/json')
  assert.equal(await fetchNpmVersion('0.37.1', async () => reply(404, {})), 'missing')
  await assert.rejects(() => fetchNpmVersion('0.37.2', async () => reply(500, {})), /npm 500/)
  await assert.rejects(() => fetchNpmVersion('0.37.2', async () => { throw new Error('offline') }), /没连上 npm/)
})

test('选中版本才问 npm：200 才给按版本安装命令，收起再打开用记住的答案', async () => {
  const dom = fakeDom()
  const restore = installGlobals(dom)
  const { doFetch, calls } = routingFetch({ npm: { '0.37.2': 200 } })
  setFetch(doFetch)
  try {
    const ui = dshUi(dom)
    ui.renderContent()
    await flush()
    assert.deepEqual(calls.npm, [], '列表本身不替用户查 npm')
    assert.doesNotMatch(dom.body.allText(), /dsh plugin --profile web add/)

    findByAttribute(dom.body, 'data-dsh-open', '0.37.2').fire('click')
    assert.match(dom.body.allText(), /正在确认 npm 上有没有 v0\.37\.2/)
    await flush()

    assert.deepEqual(calls.npm, [NPM_REGISTRY + '/dsh-piggy/0.37.2'], '只问精确版本，不拉整包元数据')
    const text = dom.body.allText()
    assert.match(text, /dsh plugin --profile web add dsh-piggy@0\.37\.2/)
    assert.match(text, /装完重启 DSH/)
    assert.doesNotMatch(text, /手动发布/, '不再把内部发布流程塞给玩家')

    findByAttribute(dom.body, 'data-dsh-open', '0.37.2').fire('click')
    findByAttribute(dom.body, 'data-dsh-open', '0.37.2').fire('click')
    await flush()
    assert.equal(calls.npm.length, 1, '同一版的成功结果要记住')
    assert.match(dom.body.allText(), /dsh-piggy@0\.37\.2/)
  } finally {
    restore()
  }
})

test('npm 404：说这一版没发到 npm 并给发布页，不给安装命令，结论也会记住', async () => {
  const dom = fakeDom()
  const restore = installGlobals(dom)
  const { doFetch, calls } = routingFetch({ npm: { '0.37.1': 404 } })
  setFetch(doFetch)
  try {
    const ui = dshUi(dom)
    ui.renderContent()
    await flush()

    findByAttribute(dom.body, 'data-dsh-open', '0.37.1').fire('click')
    await flush()

    const text = dom.body.allText()
    assert.match(text, /npm 上还没有 v0\.37\.1/)
    assert.match(text, /只在发布页上/)
    assert.doesNotMatch(text, /dsh-piggy@0\.37\.1/, '没发到 npm 就不给一个装不上的命令')
    assert.notEqual(findByAttribute(dom.body, 'data-update-page', '0.37.1'), null, '还有发布页入口')

    findByAttribute(dom.body, 'data-dsh-open', '0.37.1').fire('click')
    findByAttribute(dom.body, 'data-dsh-open', '0.37.1').fire('click')
    await flush()
    assert.equal(calls.npm.length, 1)
    assert.doesNotMatch(dom.body.allText(), /不存在/)
  } finally {
    restore()
  }
})

test('npm 问不到：说没能确认、可以重试，不冒充版本不存在；重试成功后才出命令', async () => {
  const dom = fakeDom()
  const restore = installGlobals(dom)
  let npmStatus = 'offline'
  const npmCalls = []
  setFetch(async (url) => {
    if (url.startsWith(NPM_REGISTRY)) {
      npmCalls.push(url)
      if (npmStatus === 'offline') throw new Error('offline')
      return reply(200, { name: 'dsh-piggy' })
    }
    return reply(200, RELEASES)
  })
  try {
    const ui = dshUi(dom)
    ui.renderContent()
    await flush()
    findByAttribute(dom.body, 'data-dsh-open', '0.37.2').fire('click')
    await flush()

    const failed = dom.body.allText()
    assert.match(failed, /没能确认 npm 上有没有 v0\.37\.2/)
    assert.match(failed, /不代表这一版不存在/)
    assert.doesNotMatch(failed, /dsh-piggy@0\.37\.2/)

    const again = findByAttribute(dom.body, 'data-dsh-npm-retry', '0.37.2')
    assert.notEqual(again, null, '失败后要有重试按钮')
    npmStatus = 'found'
    again.fire('click')
    await flush()

    assert.equal(npmCalls.length, 2)
    assert.match(dom.body.allText(), /dsh-piggy@0\.37\.2/)
  } finally {
    restore()
  }
})

test('快速换版本：先选的那版晚回来的结果不覆盖现在选中的版本', async () => {
  const dom = fakeDom()
  const restore = installGlobals(dom)
  const pending = new Map()
  const npmCalls = []
  setFetch(async (url) => {
    if (url.startsWith(NPM_REGISTRY)) {
      npmCalls.push(url)
      const version = decodeURIComponent(url.slice(url.lastIndexOf('/') + 1))
      return new Promise(resolve => pending.set(version, resolve))
    }
    return reply(200, RELEASES)
  })
  try {
    const ui = dshUi(dom)
    ui.renderContent()
    await flush()

    findByAttribute(dom.body, 'data-dsh-open', '0.37.2').fire('click')
    await flush()
    findByAttribute(dom.body, 'data-dsh-open', '0.37.1').fire('click')
    await flush()

    pending.get('0.37.1')(reply(200, { name: 'dsh-piggy' }))
    await flush()
    assert.match(dom.body.allText(), /dsh-piggy@0\.37\.1/)

    // 先选那版的答案后到（而且是个 404）：既不能重画，也不能跑到现在这版的详情里。
    const renders = ui.renders
    pending.get('0.37.2')(reply(404, { error: 'version not found' }))
    await flush()
    const text = dom.body.allText()
    assert.match(text, /dsh-piggy@0\.37\.1/)
    assert.equal(ui.renders, renders, '选的不是 0.37.2，它晚回来的结果不该重画页面')
    assert.doesNotMatch(text, /npm 上还没有 v0\.37\.2/, '结果只属于 0.37.2，不能盖掉 0.37.1')
    assert.doesNotMatch(text, /dsh-piggy@0\.37\.2/)

    // 再点回 0.37.2：用刚才记住的答案，不再问一遍。
    findByAttribute(dom.body, 'data-dsh-open', '0.37.2').fire('click')
    await flush()
    assert.match(dom.body.allText(), /npm 上还没有 v0\.37\.2/)
    assert.equal(npmCalls.length, 2, '两个版本各问一次，不能因为晚到就重问')
  } finally {
    restore()
  }
})

test('离开更新页后 npm 结果才回来：不重画，别的页状态不被覆盖', async () => {
  const dom = fakeDom()
  const restore = installGlobals(dom)
  const pending = new Map()
  setFetch(async (url) => {
    if (url.startsWith(NPM_REGISTRY)) {
      const version = decodeURIComponent(url.slice(url.lastIndexOf('/') + 1))
      return new Promise(resolve => pending.set(version, resolve))
    }
    return reply(200, RELEASES)
  })
  try {
    const ui = dshUi(dom)
    ui.renderContent()
    await flush()
    findByAttribute(dom.body, 'data-dsh-open', '0.37.2').fire('click')
    await flush()

    ui.tab = 'home'
    dom.body.textContent = '主屏'
    const renders = ui.renders
    pending.get('0.37.2')(reply(200, { name: 'dsh-piggy' }))
    await flush()

    assert.equal(ui.renders, renders, '已经离开更新页，不该再重画')
    assert.equal(dom.body.allText().trim(), '主屏')
  } finally {
    restore()
  }
})

test('选旧版本先提醒导出存档、旧版可能不兼容，只给命令不自动降级', async () => {
  const dom = fakeDom()
  const opened = []
  const restore = installGlobals(dom, { open: url => opened.push(url) })
  const { doFetch } = routingFetch({ npm: { '0.37.1': 200 } })
  setFetch(doFetch)
  try {
    const ui = dshUi(dom, { version: '0.38.0' })
    ui.renderContent()
    await flush()

    findByAttribute(dom.body, 'data-dsh-open', '0.37.1').fire('click')
    await flush()

    const text = dom.body.allText()
    assert.match(text, /这是旧版本 v0\.37\.1/)
    assert.match(text, /先导出存档再装/)
    assert.match(text, /旧版本可能读不了现在的存档/)
    assert.match(text, /不会自动降级/)
    assert.match(text, /dsh-piggy@0\.37\.1/, 'npm 确认有这一版才给命令')
    assert.equal(findByAttribute(dom.body, 'data-update-install', '0.37.1'), null, '不提供一键降级')
    assert.deepEqual(opened, [], '没点发布页就不该打开任何东西')
  } finally {
    restore()
  }
})
