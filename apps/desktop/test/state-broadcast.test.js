import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'

for (const file of ['preload.cjs', 'stage/preload.cjs']) {
  test(`${file} decodes worker broadcasts without losing pending events or legacy payloads`, () => {
    const exposed = {}, handlers = new Map(), received = []
    const ipcRenderer = { on(channel, callback) { handlers.set(channel, callback) }, removeListener() {} }
    runInNewContext(readFileSync(new URL('../' + file, import.meta.url), 'utf8'), {
      require: () => ({ contextBridge: { exposeInMainWorld(name, api) { exposed[name] = api } }, ipcRenderer }),
    })
    exposed.piggyShell.onStateChanged(view => received.push(view))
    const payload = { pig: { name: '广播猪' }, pending: [{ id: 7, kind: 'line', text: '收到消息' }] }
    const listener = handlers.get('piggy:state-changed')
    listener({}, JSON.stringify(payload))
    listener({}, payload)
    listener({}, undefined)
    assert.deepEqual(JSON.parse(JSON.stringify(received.slice(0, 2))), [payload, payload])
    assert.equal(received.length, 3)
    assert.equal(received[2], undefined, 'empty notification must continue to request a fresh snapshot')
  })
}
