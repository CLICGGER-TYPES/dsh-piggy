// @ts-check
/**
 * 成就数据的守卫（规则见 docs/guides/adding-achievements.md）：加一条成就时最容易漏的几处，
 * 漏了以前不会报错，只会「这个成就永远解锁不了」或「图鉴里一张空白徽章」。
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { test } from 'node:test'

import { ACHIEVEMENTS } from '../data.js'
import { EXTENSION_ACHIEVEMENTS } from '../packages/pet-core/src/data/extension-achievements.js'
import { EXTENSION_EVENTS } from '../packages/pet-core/src/data/extension-events.js'

const ASSETS = new URL('../assets/', import.meta.url)
const CORE = new URL('../packages/pet-core/src/core/', import.meta.url)
const coreSource = readdirSync(CORE).filter(name => name.endsWith('.js')).map(name => readFileSync(new URL(name, CORE), 'utf8')).join('\n')
/** 不是「state.stats 里的计数」的指标：achievements.js 里各有专门的算法。 */
const SPECIAL = new Set(['fishKinds', 'souvenirKinds', 'king', 'devil', 'level', 'extension'])
/** 扩展成就的 mode → 事件里要带的字段。 */
const MODE_FIELD = { total: 'total', kinds: 'items', maximum: 'maximum' }

test('成就 key 不重复，扩展成就都并进了总表', () => {
  assert.equal(new Set(ACHIEVEMENTS.map(item => item.key)).size, ACHIEVEMENTS.length)
  for (const item of EXTENSION_ACHIEVEMENTS) assert.ok(ACHIEVEMENTS.some(entry => entry.key === item.key), item.key)
})

test('计数类成就的指标，领域层真的有地方在加（不然永远解锁不了）', () => {
  const counters = [...new Set(ACHIEVEMENTS.map(item => item.metric).filter(metric => !SPECIAL.has(metric)))]
  const missing = counters.filter(metric => !new RegExp('stats\\.' + metric + '\\s*(\\+=|=)').test(coreSource))
  assert.deepEqual(missing, [], '新指标要么在 state.stats 里有人累加，要么在 core/achievements.js 里写专门算法并加进这里的 SPECIAL')
})

test('扩展成就引用的事件和字段在公共事件目录里', () => {
  for (const item of EXTENSION_ACHIEVEMENTS) {
    const fields = EXTENSION_EVENTS[item.extension]?.[item.event]
    assert.ok(fields, item.key + '：extension-events.js 里没有 ' + item.extension + '.' + item.event)
    assert.ok(fields.includes(MODE_FIELD[item.mode]), item.key + '：事件 ' + item.event + ' 不带 ' + MODE_FIELD[item.mode])
  }
})

test('每个成就都有自己的小猪徽章 SVG（64×64，≤ 6KB）', () => {
  for (const item of ACHIEVEMENTS) {
    assert.match(item.art, /^badge-pig-[a-z0-9-]+$/, item.key)
    const file = new URL(item.art + '.svg', ASSETS)
    assert.ok(existsSync(file), item.key + ' 缺 assets/' + item.art + '.svg')
    assert.match(readFileSync(file, 'utf8'), /viewBox="0 0 64 64"/, item.art)
    assert.ok(statSync(file).size <= 6 * 1024, item.art + ' 超过 6KB')
  }
})
