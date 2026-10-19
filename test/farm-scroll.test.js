import assert from 'node:assert/strict'
import { test } from 'node:test'
import farm from '../extensions/farm/server.js'
import { api, renderFarm } from './helpers/farm-ui.js'

test('the outer scrolling farm shop keeps a stable key across paints and separates tabs', () => {
  const ui = renderFarm(farm.view(farm.init(), api()), 'panel')
  ui.find('data-farm-shop', 'shelf').fire('click')
  const popup = () => ui.find('data-farm-overlay', 'shop')
  const key = popup().getAttribute('data-scroll-key')
  assert.equal(key, 'farm-popup:shop:seed')
  ui.app.rerender()
  assert.equal(popup().getAttribute('data-scroll-key'), key)
  ui.find('data-farm-tab', 'tool').fire('click')
  assert.notEqual(popup().getAttribute('data-scroll-key'), key)
})
