import assert from 'node:assert/strict'
import { test } from 'node:test'
import farm from '../extensions/farm/server.js'
import { api, establishedFarm, renderFarm } from './helpers/farm-ui.js'

function openTools(ui) { if (ui.find('data-farm-tools', 'toggle').getAttribute('aria-expanded') !== 'true') ui.find('data-farm-tools', 'toggle').fire('click') }

test('大小农场共用同套场景和全套工具抽屉，不再加载旧大农场部件', () => {
  for (const mode of ['panel', 'big']) {
    const ui = renderFarm(farm.view(establishedFarm(), api()), mode)
    assert.equal(ui.dom.body.querySelectorAll('.fm-s-scene').length, 1)
    assert.equal(ui.dom.body.querySelectorAll('.fm-b-field').length, 0)
    assert.equal(ui.dom.body.querySelectorAll('.fm-b-bar').length, 0)
    openTools(ui)
    assert.deepEqual(ui.all('data-farm-tool').map(x => x.getAttribute('data-farm-tool')),
      ['gloves', 'seedbag', 'can', 'shovel', 'weedkiller', 'pesticide', 'sickle', 'sprayer', 'rake', 'planter', 'fert'])
  }
})

test('高级工具每格都是标准文字按钮，图仅为子内容；辅助导航不是主按钮', () => {
  const ui = renderFarm(farm.view(establishedFarm(), api()), 'panel', { asset: x => '/asset/' + x, openBig() {} })
  openTools(ui)
  const grid = ui.dom.body.querySelectorAll('.fm-advanced-grid')[0]
  assert.equal(grid.children.length, 11)
  for (const tool of grid.children) {
    assert.equal(tool.tagName, 'button')
    assert.match(tool.className, /\bdp-btn\b/)
    assert.doesNotMatch(tool.className, /\bdp-mini\b/)
    assert.equal(tool.querySelectorAll('img').length, 1)
    assert.ok(tool.querySelectorAll('.fm-tool-label')[0].textContent)
    assert.ok(tool.allText().trim())
    assert.equal(tool.style.backgroundImage, undefined)
  }
  for (const node of [ui.find('data-farm-helper', 'hire'), ui.find('data-farm-big', 'open')]) {
    assert.match(node.className, /\bdp-btn\b/)
    assert.doesNotMatch(node.className, /\bdp-mini\b/)
  }
  const css = ui.dom.head.children[0].textContent
  const broad = /\.fm button:not\(\.dp-drill-back\),\.fm input\{([^}]*)\}/.exec(css)[1]
  assert.doesNotMatch(broad, /border-radius|(?:^|;)width:|(?:^|;)height:/, '通用规则不能把所有工具强制变成圆形')
  assert.match(css, /\.fm \.fm-slot>img\{width:40px;height:40px/)
})

test('工具抽屉用带 aria-expanded 的图文按钮开合，不再有第二个关闭叉', () => {
  const ui = renderFarm(farm.view(establishedFarm(), api()), 'panel', { asset: x => '/asset/' + x })
  const toggle = ui.find('data-farm-tools', 'toggle')
  assert.match(toggle.allText(), /工具/)
  assert.equal(toggle.querySelectorAll('img').length, 1)
  assert.equal(toggle.getAttribute('aria-expanded'), 'false')
  toggle.fire('click')
  assert.equal(ui.find('data-farm-tools', 'toggle').getAttribute('aria-expanded'), 'true')
  assert.equal(ui.all('data-farm-close').length, 0)
  ui.find('data-farm-tools', 'toggle').fire('click')
  assert.equal(ui.find('data-farm-drawer', 'tools'), undefined)
})

test('商店页签图标也有独立尺寸约束，不能让原始图片撑开按钮', () => {
  const ui = renderFarm(farm.view(establishedFarm(), api()), 'big', { asset: x => '/asset/' + x })
  ui.find('data-farm-shop', 'shelf').fire('click')
  assert.equal(ui.all('data-farm-tab').length, 4)
  for (const tab of ui.all('data-farm-tab')) {
    assert.match(tab.className, /\bdp-btn\b/)
    assert.equal(tab.querySelectorAll('img').length, 1)
    assert.ok(tab.textContent || tab.allText())
  }
  const css = ui.dom.head.children[0].textContent
  assert.match(css, /\.fm-tab>img\{width:18px;height:18px;flex:none\}/)
})

test('锁定工具去工具货架、缺肥料去肥料货架，商店入口落在种子货架', () => {
  const ui = renderFarm(farm.view(establishedFarm(), api()), 'panel')
  openTools(ui)
  ui.find('data-farm-tool', 'sickle').fire('click')
  assert.equal(ui.find('data-farm-tab', 'tool').getAttribute('aria-selected'), 'true')
  ui.find('data-farm-back', 'true').fire('click')
  openTools(ui)
  ui.find('data-farm-tool', 'fert').fire('click')
  assert.equal(ui.find('data-farm-tab', 'fert').getAttribute('aria-selected'), 'true', '没有肥料就直接去肥料货架')
  ui.find('data-farm-back', 'true').fire('click')
  const fresh = renderFarm(farm.view(establishedFarm(), api()), 'panel')
  fresh.find('data-farm-shop', 'shelf').fire('click')
  assert.equal(fresh.find('data-farm-tab', 'seed').getAttribute('aria-selected'), 'true', '从商店入口进默认种子货架')
})
