// @ts-check
/** 菜园客户端作者源码拆分后，在线扩展仍通过一个 classic script 分发。 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'

import { buildFarmClient } from '../../../scripts/build-farm-client.mjs'

const generatedUrl = new URL('../../../extensions/farm/client.js', import.meta.url)

test('the generated farm client on disk is exactly the readable bundle built from its source modules', async () => {
  assert.ok(existsSync(generatedUrl), 'extensions/farm/client.js is missing — run `npm run build` first')
  const generated = readFileSync(generatedUrl, 'utf8')
  const rebuilt = await buildFarmClient()
  assert.equal(generated, rebuilt, 'extensions/farm/client.js is stale — run `npm run build`')
  assert.match(generated, /^\/\/ GENERATED FILE\. Edit src\/extensions\/farm\/client\//)
})

test('the generated farm client preserves the single classic-script download contract', () => {
  const bundle = readFileSync(generatedUrl, 'utf8')
  assert.match(bundle, /dshPiggyExtensions\.register\(["']farm["']/)
  assert.ok(!/^\s*import\s/m.test(bundle), 'a downloaded classic script must not import modules at runtime')
  assert.ok(!/\bfrom\s+["'][^"']+["']/.test(bundle.replace(/\/\/.*$/gm, '')), 'no module specifiers at runtime')
  assert.ok(!/\brequire\s*\(/.test(bundle), 'no CommonJS runtime imports')
})
