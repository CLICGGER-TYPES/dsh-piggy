import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mount, hostOf } from './helpers/bundle.js'

for (const constructPlugin of [false, true]) {
  test(`DSH client mounts without reading host context as stage options (construct=${constructPlugin})`, async () => {
    const pluginContext = new Proxy({}, { get(_target, key) {
      throw new Error(`cannot get property "${String(key)}" without inject`)
    } })
    const result = await mount({ pluginContext, constructPlugin })
    assert.ok(hostOf(result.dom), 'client must mount its actual UI')
    assert.ok(result.calls.some(call => String(call.url).includes('/dsh-piggy/state')), 'client must load game state')
  })
}
