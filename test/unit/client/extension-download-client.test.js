// 扩展下载的界面反馈：点下去要立刻有「下载中…」，失败要留在卡片上并能重试。
// 起因：直连 GitHub 很慢时请求会卡住，界面却毫无变化，用户只会看到「点了没反应」。
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { SNAPSHOT, contentOf, findByAttr, mount, openPanel, settle } from '../../helpers/bundle.js'

const LOCAL = [
  { key: 'pomodoro', label: '番茄钟', on: true, installed: true, builtin: true, apps: ['pomodoro'], dexSections: [], shopKinds: [] },
  { key: 'fishing', label: '钓鱼', on: true, installed: true, builtin: true, apps: ['fishing'], dexSections: ['fish'], shopKinds: ['bait'] },
]
const ONLINE = {
  entries: [
    { key: 'farm', label: '菜园', emoji: '🥬', description: '种地', version: '1.0.0', builtin: false, installed: false, blocked: null, update: false },
  ],
}
const FAILED = {
  ...SNAPSHOT, ok: false, reason: 'download-failed',
  message: 'server.js 下载失败：连接 github.com 超时（试了 3 次）',
}

/** 打开设置 → 扩展，停在在线扩展列表上。 */
async function openExtensions(options) {
  const mounted = await mount(options)
  openPanel(mounted.dom)
  await settle()
  findByAttr(contentOf(mounted.dom), 'data-app', 'settings').fire('click')
  findByAttr(contentOf(mounted.dom), 'data-open-extensions', 'true').fire('click')
  await settle()
  return mounted
}

const installCalls = calls => calls.filter(call => String(call.body ?? '').includes('installExtension'))

test('点下载立刻显示「下载中…」并挡住重复点击', async () => {
  const { dom } = await openExtensions({
    status: { ...SNAPSHOT, extensions: LOCAL },
    onlineResponse: ONLINE,
    actResult: FAILED,
  })
  const get = findByAttr(contentOf(dom), 'data-ext-install', 'farm')
  assert.equal(get.textContent, '下载')
  get.fire('click')
  const during = findByAttr(contentOf(dom), 'data-ext-install', 'farm')
  assert.equal(during.textContent, '下载中…', 'must react on the very same click')
  assert.equal(during.disabled, true)
})

test('下载失败留在卡片上，说清原因，按钮变成「重试」', async () => {
  const { dom, calls } = await openExtensions({
    status: { ...SNAPSHOT, extensions: LOCAL },
    onlineResponse: ONLINE,
    actResult: FAILED,
  })
  findByAttr(contentOf(dom), 'data-ext-install', 'farm').fire('click')
  await settle()
  // 失败原因留在卡片上（不只是一闪而过的气泡），跟「加载出错」同一个样式。
  const card = findByAttr(contentOf(dom), 'data-online-extension', 'farm')
  assert.match(card.allText(), /没装上：server\.js 下载失败：连接 github\.com 超时/)
  // 卡片上还是那一个按钮，只是改叫「重试」——不去另造一个按钮。
  const retry = findByAttr(contentOf(dom), 'data-ext-install', 'farm')
  assert.equal(retry.textContent, '重试')
  assert.equal(installCalls(calls).length, 1)

  retry.fire('click')
  await settle()
  assert.equal(installCalls(calls).length, 2, 'retry sends the action again')
})

test('装上以后卡片消失，不再留失败提示', async () => {
  const { dom, calls } = await openExtensions({
    status: { ...SNAPSHOT, extensions: LOCAL },
    onlineResponse: ONLINE,
    actResult: { ...SNAPSHOT, extensions: [...LOCAL, { key: 'farm', label: '菜园', on: true, installed: true, builtin: false, version: '1.0.0', apps: [], dexSections: [], shopKinds: [] }] },
  })
  findByAttr(contentOf(dom), 'data-ext-install', 'farm').fire('click')
  await settle()
  assert.equal(findByAttr(contentOf(dom), 'data-online-extension', 'farm'), undefined, 'no card, no failure note')
  assert.equal(findByAttr(contentOf(dom), 'data-extension', 'farm') !== null, true, 'now listed as a local extension')
  assert.match(String(installCalls(calls)[0].body), /"key":"farm"/)
})
