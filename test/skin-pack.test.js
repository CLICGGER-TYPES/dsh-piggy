import test from 'node:test'
import assert from 'node:assert/strict'

import { validateSkinFiles } from '../store/skin-pack.js'

const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path fill="#abc" d="M1 1h8v8Z"/></svg>'
const files = extra => new Map([
  ['skin.json', Buffer.from(JSON.stringify({ key: 'berry', label: '莓果猪', author: '玩家', description: '甜甜的', emoji: '🫐' }))],
  ...['idle', 'eat', 'bathe', 'play', 'pet'].map(scene => [`${scene}.svg`, Buffer.from(svg)]),
  ...(extra ?? []),
])

test('C6 accepts the documented five-scene skin pack', () => {
  const result = validateSkinFiles(files())
  assert.equal(result.ok, true)
  assert.equal(result.metadata.art, 'custom-berry')
  assert.deepEqual(result.metadata.scenes, ['idle', 'eat', 'bathe', 'play', 'pet'])
})

test('an imported sleep pose is optional and retained in skin metadata', () => {
  const result = validateSkinFiles(files([['sleep.svg', Buffer.from(svg)]]))
  assert.equal(result.ok, true)
  assert.ok(result.metadata.scenes.includes('sleep'))
})

test('C6 rejects missing scenes and unsafe SVG features', () => {
  const missing = files()
  missing.delete('pet.svg')
  assert.equal(validateSkinFiles(missing).ok, false)
  const unsafe = files([['work.svg', Buffer.from('<svg viewBox="0 0 64 64"><image href="https://example.test/x.png"/></svg>')]])
  assert.equal(validateSkinFiles(unsafe).ok, false)
})

test('C6 custom keys cannot shadow the default or a built-in skin', () => {
  const builtIn = files()
  builtIn.set('skin.json', Buffer.from(JSON.stringify({ key: 'mint', label: '冒牌薄荷' })))
  assert.equal(validateSkinFiles(builtIn).ok, false)
  const defaultSkin = files()
  defaultSkin.set('skin.json', Buffer.from(JSON.stringify({ key: 'default', label: '冒牌默认' })))
  assert.equal(validateSkinFiles(defaultSkin).ok, false)
})

// 桌面版的本地协议把请求体当文本读，原始二进制 ZIP 会被读坏；客户端改成发 base64。
// 两种请求体都要能导入，嵌套目录要报看得懂的错。
test('skin import accepts a raw ZIP body and a base64 body, and explains nested folders', async () => {
  const { mkdtempSync, readFileSync, rmSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const { createStore } = await import('../store.js')
  const { registerRoutes } = await import('../routes.js')
  const dir = mkdtempSync(join(tmpdir(), 'dsh-piggy-skin-'))
  const store = createStore(join(dir, 'state.json'))
  const routes = {}
  const webServer = { register: route => { routes[route.path] = route; return () => {} } }
  registerRoutes({ inject: (deps, fn) => { if (deps.includes('webServer')) fn({ webServer }) } }, store)
  const post = body => new Promise((resolve, reject) => {
    let status = 200
    const req = { method: 'POST', async *[Symbol.asyncIterator]() { yield Buffer.from(body) } }
    const res = {
      writeHead(code) { status = code; return res },
      setHeader() {},
      end(chunk) { resolve({ status, body: JSON.parse(String(chunk)) }) },
    }
    Promise.resolve(routes['/dsh-piggy/skins/import'].handler(req, res)).catch(reject)
  })
  try {
    const good = readFileSync(new URL('../docs/examples/skin-pack-example.zip', import.meta.url))
    const viaBase64 = await post(good.toString('base64'))
    // 存档里还没有猪，选不上皮肤，但包本身已经解开并装好了。
    assert.equal(viaBase64.body.imported, 'mint-example', JSON.stringify(viaBase64.body.errors))
    const viaRaw = await post(good)
    assert.equal(viaRaw.body.imported, 'mint-example', JSON.stringify(viaRaw.body.errors))
    const notZip = await post(Buffer.from('hello').toString('base64'))
    assert.deepEqual(notZip.body.errors, ['这不是 ZIP 文件'])
  } finally {
    store.dispose()
    rmSync(dir, { recursive: true, force: true })
  }
})
