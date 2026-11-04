// 网页版自带的 emoji 字体：很多机器没有对应的表情，或者长得跟别处完全不一样。
// 这一份随插件一起发，由 /dsh-piggy/emoji.woff2 提供；桌面版由外壳给同一个字体家族。
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { registerRoutes } from '../../../routes.js'
import { SNAPSHOT, contentOf, findByAttr, mount, openPanel } from '../../helpers/bundle.js'

const FONT = new URL('../../../assets/piggy-emoji.woff2', import.meta.url)

test('ships a small woff2 subset instead of the whole 10MB Noto font', () => {
  const font = readFileSync(FONT)
  assert.equal(font.subarray(0, 4).toString('latin1'), 'wOF2', 'must be a real woff2 file')
  assert.ok(font.length > 100 * 1024, 'a font with no glyphs is not a font')
  assert.ok(font.length < 2 * 1024 * 1024, `网页版不该塞整套字体（现在 ${(font.length / 1048576).toFixed(2)}MB）`)
})

test('the plugin serves that font, and only that file', async () => {
  const routes = {}
  registerRoutes({ inject: (deps, fn) => { if (deps.includes('webServer')) fn({ webServer: { register: route => { routes[route.path] = route; return () => {} } } }) } }, { ext: {} })
  const route = routes['/dsh-piggy/emoji.woff2']
  assert.ok(route, 'the route must be registered')

  const call = method => new Promise((resolve, reject) => {
    const req = { method, url: route.path, async *[Symbol.asyncIterator]() {} }
    const res = {
      headers: {},
      writeHead(code, headers) { this.status = code; Object.assign(this.headers, headers ?? {}); return this },
      end(chunk) { resolve({ status: this.status, headers: this.headers, body: chunk }) },
    }
    Promise.resolve(route.handler(req, res)).catch(reject)
  })

  const ok = await call('GET')
  assert.equal(ok.status, 200)
  assert.equal(ok.headers['content-type'], 'font/woff2')
  assert.match(String(ok.headers['cache-control']), /max-age=\d+/)
  assert.deepEqual(Buffer.from(ok.body), readFileSync(FONT), 'the bytes must be the shipped font')

  const wrongMethod = await call('POST')
  assert.equal(wrongMethod.status, 405)
})

test('the stylesheet declares the bundled emoji font and lets it be switched off', () => {
  const css = readFileSync(new URL('../../../client.js', import.meta.url), 'utf8')
  assert.match(css, /@font-face\{font-family:"Piggy Emoji"/, 'the web build must ship its own @font-face')
  assert.match(css, /url\(\/dsh-piggy\/emoji\.woff2\)/, 'the face must load from the plugin route')
  assert.match(css, /--ac-font:"Piggy Emoji",/, 'the bundled emoji comes first in the stack')
  assert.match(css, /\[data-dsh-pig\]\[data-dsh-pig\]\[data-emoji="system"\]\{--ac-font:Nunito/, 'choosing 系统自带 must drop it again')
})

test('网页版也能选 Emoji 样式（以前只有桌面版有）', async () => {
  const withFont = await mount({ status: SNAPSHOT, fonts: ['Piggy Emoji'] })
  openPanel(withFont.dom)
  findByAttr(contentOf(withFont.dom), 'data-app', 'settings').fire('click')
  assert.ok(findByAttr(contentOf(withFont.dom), 'data-emoji-style', 'bundled'), 'the choice must be offered')

  const withoutFont = await mount({ status: SNAPSHOT })
  openPanel(withoutFont.dom)
  findByAttr(contentOf(withoutFont.dom), 'data-app', 'settings').fire('click')
  assert.equal(findByAttr(contentOf(withoutFont.dom), 'data-emoji-style', 'bundled'), undefined, 'no font, no setting')
})
