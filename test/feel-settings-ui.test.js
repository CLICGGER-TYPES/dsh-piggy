// @ts-check
// 设置页的两节：手感档位与音效开关/音量，改完写本机并立刻生效。
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { SNAPSHOT, contentOf, findByAttr, mount, openPanel } from './helpers/bundle.js'

test('设置页有手感和音效两节，默认值与开关写入本机', async () => {
  const { dom, store } = await mount({ status: SNAPSHOT })
  openPanel(dom, 'settings')
  const content = contentOf(dom)
  assert.match(content.allText(), /手感/)
  assert.match(content.allText(), /音效/)
  assert.match(content.allText(), /标准/)
  assert.match(content.allText(), /轻柔/)
  assert.match(content.allText(), /关闭/)

  findByAttr(content, 'data-feel-mode', 'soft').fire('click')
  assert.equal(store.get('dsh-piggy:feel'), 'soft', '手感档位写本机')

  assert.equal(findByAttr(contentOf(dom), 'data-feel-mode', 'soft').attributes['aria-pressed'], 'true', '选中态跟着变')

  findByAttr(contentOf(dom), 'data-sound', 'off').fire('click')
  assert.deepEqual(JSON.parse(store.get('dsh-piggy:sound')), { on: true, volume: 2 }, '音效默认关，打开后中等音量')

  findByAttr(contentOf(dom), 'data-sound-volume', '0').fire('click')
  assert.deepEqual(JSON.parse(store.get('dsh-piggy:sound')), { on: true, volume: 0 }, '音量档位写本机')
})
