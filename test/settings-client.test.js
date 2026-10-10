// @ts-check
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { SNAPSHOT, contentOf, findByAttr, findByClass, mount, openPanel, settle } from './helpers/bundle.js'

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
    const svg = readFileSync(new URL(`../assets/ui-${key}.svg`, import.meta.url), 'utf8')
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
