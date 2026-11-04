import test from 'node:test'
import assert from 'node:assert/strict'

import { SNAPSHOT, contentOf, findByAttr, mount, openPanel, settle } from '../../helpers/bundle.js'

const skins = {
  current: 'default',
  entries: [
    { key: 'default', label: '默认小猪', emoji: '🐷', art: 'piglet', current: true, custom: false, author: 'dsh-piggy', description: '熟悉的小猪。', scenes: ['idle'] },
    { key: 'mint', label: '薄荷小猪', emoji: '🌿', art: 'skin-mint', current: false, custom: false, author: 'dsh-piggy', description: '清凉的薄荷色。', scenes: ['idle', 'eat', 'bathe', 'play', 'pet'] },
  ],
}

test('C6 main menu has a skin app with switching and ZIP import', async () => {
  const { dom, calls } = await mount({ status: { ...SNAPSHOT, skins } })
  openPanel(dom)
  const app = findByAttr(contentOf(dom), 'data-app', 'skins')
  assert.notEqual(app, undefined)
  app.fire('click')
  const mint = findByAttr(contentOf(dom), 'data-skin', 'mint')
  assert.notEqual(mint, undefined)
  assert.match(mint.className, /\bdp-mini\b/, '换肤按钮应复用全站标准操作按钮')
  assert.match(mint.parentNode.className, /\bdp-item\b/, '皮肤应使用背包/列表同款货架行')
  mint.fire('click')
  await settle()
  assert.deepEqual(JSON.parse(calls.at(-1).body), { action: 'skin', skin: 'mint' })
  const input = findByAttr(contentOf(dom), 'data-skin-import', 'zip')
  assert.notEqual(input, undefined)
  assert.match(input.getAttribute('accept'), /zip/)
  assert.match(input.parentNode.className, /\bdp-pick\b/, '导入区应使用全站标准操作卡')
})

test('locked career looks show their unlock route and cannot be selected early', async () => {
  const career = { key: 'chef', label: '厨师猪', emoji: '👨‍🍳', art: 'career-chef', current: false,
    custom: false, unlocked: false, unlockJob: 'chef', author: 'dsh-piggy', description: '完成厨师工作后解锁', scenes: ['idle'] }
  const { dom, calls } = await mount({ status: { ...SNAPSHOT, skins: { current: 'default', entries: [...skins.entries, career] } } })
  openPanel(dom, 'skins')
  const pick = findByAttr(contentOf(dom), 'data-skin', 'chef')
  assert.ok(pick.disabled)
  assert.match(pick.parentNode.allText(), /完成厨师工作/)
  pick.fire('click')
  assert.equal(calls.some(call => call.method === 'POST'), false)
})
