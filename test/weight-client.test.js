// @ts-check
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderDevTab } from '../src/client/tabs/dev.js'
import {
  PIG, SNAPSHOT, contentOf, fakeDom, findByAttr, mount, openPanel,
} from './helpers/bundle.js'

const BODY = {
  class: 'fat', label: '胖胖', visible: true,
  idealG: 39690, roundAtG: 51597, fatAtG: 63504,
  ideal: '39.7 kg', roundAt: '51.6 kg', fatAt: '63.5 kg', playsLeft: 7,
}

test('C7 status shows body class, ideal weight and the useful next action', async () => {
  const status = { ...SNAPSHOT, pig: { ...PIG, weight: '64.0 kg', bodyWeight: BODY } }
  const { dom } = await mount({ status })
  openPanel(dom, 'status')
  const text = contentOf(dom).allText()
  // G 批次反馈：体重就一行小字，不要刻度条和说明。
  assert.match(text, /体重\s*64\.0 kg · 胖胖/)
  assert.equal(text.includes("理想"), false)
})

test('C7 debug page has normal, round and fat weight entries that send symbolic patches', () => {
  const { document } = fakeDom()
  globalThis.document = document
  const content = document.createElement('div')
  const sent = []
  renderDevTab({
    content,
    view: {
      ...SNAPSHOT,
      pig: { ...PIG, bodyWeight: BODY },
    },
    send(action, payload) { sent.push({ action, payload }) },
    devOff() {},
    setOpen() {},
    host: { getAttribute: () => 'false' },
  })
  for (const bodyClass of ['normal', 'round', 'fat']) {
    const entry = findByAttr(content, 'data-dev', 'weight:' + bodyClass)
    assert.notEqual(entry, undefined, bodyClass)
    entry.fire('click')
    assert.equal(sent.at(-1).action, 'dev')
    assert.equal(sent.at(-1).payload.patch.weightClass, bodyClass)
  }
})

test('体型锁在状态页显示，药水合并到药品货架并能发送使用请求', async () => {
  const shop = [
    {key:'body-fat',kind:'body',label:'巨胖药水',emoji:'🧪',price:100,affordable:true,useLabel:'变巨胖'},
    {key:'body-lock',kind:'body',label:'锁定药水',emoji:'🔒',price:100,affordable:true,useLabel:'锁定当前胖瘦'},
    {key:'body-reset',kind:'body',label:'初始药水',emoji:'🧪',price:100,affordable:true,useLabel:'解除胖瘦锁定'},
  ]
  const status={...SNAPSHOT,pig:{...PIG,weight:'64.0 kg',bodyWeight:{...BODY,locked:true}},shop,inventory:{'body-fat':1,'body-lock':1,'body-reset':1}}
  let {dom,calls}=await mount({status})
  openPanel(dom,'status');assert.match(contentOf(dom).allText(),/已锁定/)
  ;({dom,calls}=await mount({status}))
  openPanel(dom,'shop');findByAttr(contentOf(dom),'data-shelf','medicine').fire('click')
  assert.ok(findByAttr(contentOf(dom),'data-buy','body-fat'))
  ;({dom,calls}=await mount({status}))
  openPanel(dom,'bag');findByAttr(contentOf(dom),'data-bag','medicine').fire('click')
  findByAttr(contentOf(dom),'data-use','body-reset').fire('click')
  await new Promise(resolve=>setTimeout(resolve,0))
  assert.ok(calls.some(c=>c.method==='POST'&&JSON.parse(c.body).action==='use'&&JSON.parse(c.body).item==='body-reset'))
})
