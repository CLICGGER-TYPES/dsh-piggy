// @ts-check
/** 动作立绘切换（src/client/art.js），用例来自 PR #2（作者 1nuoiscute）。 */
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { test } from 'node:test'
import { syncPigArt } from '../src/client/art.js'

test('care reactions temporarily replace activity sprites and restore afterward', () => {
  const attrs = { 'data-art': 'pig-king', 'data-art-actions': 'true', 'data-activity': 'work' }
  const pig = { getAttribute: key => attrs[key] ?? null, setAttribute: (key, value) => { attrs[key] = value } }
  let source = ''
  let assigned = 0
  const image = {
    get src() { return 'https://example.test' + source },
    set src(value) { source = value; assigned += 1 },
    getAttribute() { return source },
  }
  for (const [reaction, art] of [['feed', 'eat'], ['bathe', 'bathe'], ['play', 'play'], ['pet', 'pet'], ['levelup', 'relaxed']]) {
    attrs['data-react'] = reaction
    syncPigArt(pig, image)
    assert.ok(image.src.endsWith('pig-king-' + art + '.svg'))
    assert.ok(existsSync(new URL('../assets/pig-king-' + art + '.svg', import.meta.url)))
    const beforePoll = assigned
    syncPigArt(pig, image)
    assert.equal(assigned, beforePoll, 'relative attribute avoids redundant requests with an absolute src getter')
    assert.ok(image.src.endsWith('pig-king-' + art + '.svg'), 'polling preserves reaction')
    delete attrs['data-react']
    syncPigArt(pig, image)
    assert.ok(image.src.endsWith('pig-king-work.svg'))
  }
  attrs['data-activity'] = ''
  syncPigArt(pig, image)
  assert.ok(image.src.endsWith('pig-king.svg'))
  attrs['data-art'] = 'piglet'
  attrs['data-art-actions'] = 'false'
  attrs['data-react'] = 'pet'
  syncPigArt(pig, image)
  assert.match(image.src, /\/feedback\/collection-(?:stack|badge)\.png$/, 'ordinary pigs use the approved reaction art')
})
