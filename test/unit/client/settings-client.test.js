// @ts-check
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { SNAPSHOT, contentOf, findByAttr, findByClass, mount, openPanel, settle } from '../../helpers/bundle.js'

test('气泡大小可加减和输入，独立保存，轮询不打断正在输入的比例', async () => {
  const { dom, store, intervals } = await mount({ store: { 'dsh-piggy:pig-size': 'scale:2' } })
  openPanel(dom)
  findByAttr(contentOf(dom), 'data-app', 'settings').fire('click')
  await settle()
  const percent = findByAttr(contentOf(dom), 'data-bubble-scale', 'true')
  assert.equal(percent.value, '100')
  findByAttr(contentOf(dom), 'data-bubble-size-step', 'plus').fire('click')
  assert.equal(percent.value, '110')
  findByAttr(contentOf(dom), 'data-bubble-size-step', 'minus').fire('click')
  assert.equal(percent.value, '100')
  percent.value = '200'
  percent.fire('change')
  assert.equal(store.get('dsh-piggy:bubble-size'), '2')
  assert.equal(store.get('dsh-piggy:pig-size'), 'scale:2')
  percent.value = ''
  percent.fire('change')
  assert.equal(percent.value, '200')
  dom.document.activeElement = percent
  for (const timer of intervals.filter(timer => timer.delay === 4000)) await timer.fn()
  await settle()
  assert.equal(findByAttr(contentOf(dom), 'data-bubble-scale', 'true'), percent)
})

test('云存档设置先关闭、配置后显式测试，关闭保留仓库且保存不测试', async () => {
  let cloud = { version: 1, enabled: false, provider: 'github', remote: '', branch: 'main' }
  const saved = [], tested = []
  const { dom } = await mount({ fetch: async (url, options) => {
    if (String(url).includes('/dsh-piggy/cloud/settings')) {
      if (options?.method === 'POST') { cloud = JSON.parse(options.body); saved.push({ ...cloud }) }
      return { ok: true, status: 200, async json() { return { ok: true, config: { ...cloud } } } }
    }
    if (String(url).includes('/dsh-piggy/cloud/test-connection')) {
      tested.push(JSON.parse(options.body))
      return { ok: true, status: 200, async json() { return { ok: true } } }
    }
    return undefined
  } })
  openPanel(dom)
  const content = contentOf(dom)
  findByAttr(content, 'data-app', 'settings').fire('click')
  await settle()
  assert.equal(findByAttr(content, 'data-cloud-enabled', 'off').getAttribute('aria-pressed'), 'false')

  findByAttr(content, 'data-cloud-enabled', 'off').fire('click')
  await settle()
  const remote = findByAttr(content, 'data-cloud-remote', 'true')
  assert.ok(remote, content.allText())
  remote.value = 'https://github.com/acme/pig.git'
  remote.fire('input')
  findByAttr(content, 'data-cloud-action', 'save').fire('click')
  await settle()
  assert.equal(cloud.enabled, true)
  assert.equal(cloud.remote, 'https://github.com/acme/pig.git')
  assert.equal(tested.length, 0, 'saving the address never starts a connection test')
  assert.ok(content.allText().includes('待连接'))
  assert.ok(findByAttr(content, 'data-cloud-action', 'test'))

  findByAttr(content, 'data-cloud-action', 'test').fire('click')
  await settle()
  assert.equal(tested.length, 1)
  assert.ok(content.allText().includes('尚未同步存档'))

  findByAttr(content, 'data-cloud-action', 'close').fire('click')
  await settle()
  assert.equal(cloud.enabled, false)
  assert.equal(cloud.remote, 'https://github.com/acme/pig.git')
  assert.ok(saved.every(value => value.enabled !== undefined))
})

test('云设置草稿不受轮询影响，其他设置重绘保留草稿/焦点/披露且显式保存仍刷新', async () => {
  let cloud = { version: 1, enabled: false, provider: 'github', remote: '', branch: 'main' }
  const { dom, intervals } = await mount({ fetch: async (url, options) => {
    if (String(url).includes('/dsh-piggy/cloud/settings')) {
      if (options?.method === 'POST') cloud = JSON.parse(options.body)
      return { ok: true, status: 200, async json() { return { ok: true, config: { ...cloud } } } }
    }
    if (String(url).includes('/dsh-piggy/cloud/test-connection')) return { ok: true, status: 200, async json() { return { ok: true } } }
    return undefined
  } })
  openPanel(dom)
  const content = contentOf(dom)
  findByAttr(content, 'data-app', 'settings').fire('click')
  await settle()
  findByAttr(content, 'data-cloud-enabled', 'off').fire('click')
  await settle()

  const remote = findByAttr(content, 'data-cloud-remote', 'true')
  remote.value = 'https://github.com/acme/pig.git'
  remote.fire('input')
  const branch = findByAttr(content, 'data-cloud-branch', 'true')
  branch.value = 'release'
  branch.fire('input')

  const advanced = findByClass(content, 'dp-cloud-advanced')
  const summary = findByAttr(content, 'data-cloud-advanced-summary', 'true')
  summary.fire('click')
  advanced.open = true // Fake DOM has no native <details> default action.
  advanced.fire('toggle')
  dom.document.activeElement = branch
  for (const timer of intervals.filter(timer => timer.delay === 4000)) await timer.fn()
  await settle()
  assert.equal(findByAttr(content, 'data-cloud-branch', 'true'), branch, 'poll leaves the focused input node in place')
  assert.equal(findByClass(content, 'dp-cloud-advanced'), advanced, 'poll leaves the disclosure node in place')
  assert.equal(advanced.open, true)

  const soundToggle = findByAttr(content, 'data-sound', 'off')
  dom.document.activeElement = soundToggle // The user has moved focus away from the cloud editor.
  soundToggle.fire('click')
  const remoteAfterSettingsRender = findByAttr(content, 'data-cloud-remote', 'true')
  const branchAfterSettingsRender = findByAttr(content, 'data-cloud-branch', 'true')
  const advancedAfterSettingsRender = findByClass(content, 'dp-cloud-advanced')
  const soundToggleAfterSettingsRender = findByAttr(content, 'data-sound', 'on')
  assert.notEqual(branchAfterSettingsRender, branch, 'the unrelated settings action may repaint the panel')
  assert.ok(soundToggleAfterSettingsRender, 'the explicit sound change becomes visible')
  assert.equal(remoteAfterSettingsRender.value, 'https://github.com/acme/pig.git')
  assert.equal(branchAfterSettingsRender.value, 'release')
  assert.equal(advancedAfterSettingsRender.open, true, 'the disclosure remains open after the repaint')
  assert.equal(dom.document.activeElement, soundToggleAfterSettingsRender, 'the repaint preserves focus on the sound control the user chose')

  findByAttr(content, 'data-cloud-action', 'save').fire('click')
  await settle()
  assert.equal(cloud.remote, 'https://github.com/acme/pig.git')
  assert.equal(cloud.branch, 'release')
  assert.ok(findByAttr(content, 'data-cloud-action', 'test'), 'explicit cloud save refreshes to the saved summary')
})

test('扩展收进设置；有扩展更新时设置方块和入口都有红点，返回设置', async () => {
  const extensions = [
    { key: 'pomodoro', label: '番茄钟', on: true, installed: true, builtin: true, apps: ['pomodoro'], dexSections: [], shopKinds: [] },
    { key: 'fishing', label: '钓鱼', on: true, installed: true, builtin: true, apps: ['fishing'], dexSections: ['fish'], shopKinds: ['bait'] },
    { key: 'blindbox', label: '盲盒', on: true, installed: true, builtin: false, version: '2.0.0', app: { emoji: '🎁', label: '盲盒' }, apps: [], dexSections: [], shopKinds: [] },
  ]
  const { dom } = await mount({ status: { ...SNAPSHOT, extensions }, onlineResponse: { entries: [{ key: 'blindbox', update: true, version: '2.1.0' }] } })
  openPanel(dom)
  await settle()
  const settings = findByAttr(contentOf(dom), 'data-app', 'settings')
  assert.ok(findByClass(settings, 'dp-tile-badge'))
  settings.fire('click')
  const entry = findByAttr(contentOf(dom), 'data-open-extensions', 'true')
  assert.ok(findByClass(entry, 'dp-update-dot'))
  entry.fire('click')
  assert.ok(findByAttr(contentOf(dom), 'data-extension', 'blindbox'))
  findByAttr(contentOf(dom), 'data-home', 'true').fire('click')
  assert.ok(findByAttr(contentOf(dom), 'data-open-extensions', 'true'))
})

test('设置里没有「主菜单图标」选项：主菜单一律用 emoji，手绘 SVG 不上设置', async () => {
  const { dom, store } = await mount()
  store.set('dsh-piggy:icon-style', 'built-in')
  openPanel(dom)
  // 主角是 emoji，不是手绘 SVG（用户 2026-10-06：手绘那版不要）。
  assert.equal(findByAttr(contentOf(dom), 'data-app', 'shop').allText().includes('🛒'), true)
  assert.equal(findByClass(findByAttr(contentOf(dom), 'data-app', 'shop'), 'dp-tile-svg'), undefined)
  findByAttr(contentOf(dom), 'data-app', 'settings').fire('click')
  assert.equal(findByAttr(contentOf(dom), 'data-icon-style', 'built-in'), undefined)
  assert.equal(findByAttr(contentOf(dom), 'data-icon-style', 'system'), undefined)
})

test('every App icon in the bundle has a real SVG asset', () => {
  for (const key of ['status', 'card', 'dex', 'skins', 'study', 'work', 'shop', 'travel', 'bag', 'pomodoro', 'fishing', 'settings', 'update', 'quit', 'dev']) {
    const svg = readFileSync(new URL(`../../../assets/ui-${key}.svg`, import.meta.url), 'utf8')
    assert.match(svg, /<svg\b/)
    assert.match(svg, /viewBox="0 0 32 32"/)
  }
})

test('换肤 App 有「怎么做皮肤」页：十一张图的文件名、必须/可选，和完整教程、示例包的链接', async () => {
  const { dom } = await mount()
  openPanel(dom)
  findByAttr(contentOf(dom), 'data-app', 'skins').fire('click')
  findByAttr(contentOf(dom), 'data-skin-guide', 'true').fire('click')
  const text = contentOf(dom).allText()
  for (const file of ['idle.png', 'eat.png', 'bathe.png', 'play.png', 'pet.png', 'relaxed.png', 'work.png', 'study.png', 'trip.png', 'fish.png', 'sleep.png']) assert.ok(text.includes(file), file)
  assert.ok(text.includes('透明底 PNG'))
  assert.ok(findByAttr(contentOf(dom), 'data-skin-guide-open', 'true'))
  assert.ok(findByAttr(contentOf(dom), 'data-skin-example', 'true'))
})
