// @ts-check
/**
 * 台词数据的守卫（规则见 docs/guides/adding-lines.md）。
 *
 * 1. 代码和数据表里点名的场景，台词表里都要有：写错一个字以前只是悄悄少一句台词。
 *    （运行时兜底在 test/helpers/strict-lines.js：测试里走到未知场景直接抛错。）
 * 2. 每句台词都短：气泡最多两行，太长会被截掉。
 * 3. 文本里只认 `[主人]` 这一个占位符，动作描写用全角括号。
 */
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { test } from 'node:test'

import { DATED_HOLIDAYS, LINES, OWNER_TOKEN, PET_PARTS, SOLAR_HOLIDAYS, TALK_SLOTS } from '../data.js'

/** 一句台词最多几个字（`[主人]` 按 2 个字算）：气泡宽 268px、两行，主人称呼最长 12 个字也放得下。 */
const LINE_MAX_CHARS = 30

const CORE = new URL('../packages/pet-core/src/core/', import.meta.url)
const coreFiles = readdirSync(CORE).filter(name => name.endsWith('.js')).map(name => ({ name, text: readFileSync(new URL(name, CORE), 'utf8') }))

/** 代码里直接写死的场景名：say(state, …, nowMs) 参数里的字面量、talk.js 的 return、care.js 的 CARE_SCENE。 */
function scenesNamedInCode() {
  const out = new Set()
  for (const { name, text } of coreFiles) {
    for (const call of text.matchAll(/\bsay\(state,([^\n]*?),\s*nowMs/g)) {
      // `rarity === 'rare' ? 'fishRare' : …` 里比较用的字面量不是场景名
      for (const literal of call[1].matchAll(/(?<!===?\s*)'([a-zA-Z][a-zA-Z0-9]*)'/g)) out.add(literal[1] + ' (' + name + ')')
    }
    if (name === 'talk.js') for (const literal of text.matchAll(/return '([a-zA-Z][a-zA-Z0-9]*)'/g)) out.add(literal[1] + ' (' + name + ')')
  }
  const care = coreFiles.find(file => file.name === 'care.js')?.text ?? ''
  const table = /CARE_SCENE = Object\.freeze\(\{([^}]*)\}/.exec(care)
  for (const literal of (table?.[1] ?? '').matchAll(/: '([a-zA-Z]+)'/g)) out.add(literal[1] + ' (care.js CARE_SCENE)')
  return [...out]
}

test('代码里点名的场景台词表里都有', () => {
  const named = scenesNamedInCode()
  assert.ok(named.length >= 20, '扫描规则失效了：只找到 ' + named.length + ' 个场景')
  const missing = named.filter(entry => (LINES[entry.split(' ')[0]] ?? []).length === 0)
  assert.deepEqual(missing, [])
})

test('按时间、节日、摸部位说话的场景台词表里都有', () => {
  const tables = [
    ...TALK_SLOTS.map(slot => slot.scene),
    ...Object.values(SOLAR_HOLIDAYS),
    ...Object.values(DATED_HOLIDAYS),
    ...Object.values(PET_PARTS),
  ]
  assert.deepEqual([...new Set(tables)].filter(scene => (LINES[scene] ?? []).length === 0), [])
})

test('农历节日表逐年连续（写到哪年在 adding-lines.md 里有说明，到期前要续）', () => {
  const years = [...new Set(Object.keys(DATED_HOLIDAYS).map(date => Number(date.slice(0, 4))))].sort()
  for (let index = 1; index < years.length; index += 1) assert.equal(years[index], years[index - 1] + 1)
})

test('每句台词不超过 ' + LINE_MAX_CHARS + ' 个字，只用 [主人] 一种占位符', () => {
  const tooLong = []
  const badToken = []
  for (const [scene, pool] of Object.entries(LINES)) {
    for (const line of pool) {
      const length = [...line.text.split(OWNER_TOKEN).join('主人')].length
      if (length > LINE_MAX_CHARS) tooLong.push(scene + ': ' + line.text)
      if (/\[(?!主人\])[^\]]*\]|\{[a-z]+\}/.test(line.text)) badToken.push(scene + ': ' + line.text)
      for (const reply of line.replies ?? []) if ([...reply.label].length > 8) tooLong.push(scene + ' 回复按钮: ' + reply.label)
    }
  }
  assert.deepEqual(tooLong, [])
  assert.deepEqual(badToken, [])
})

test('每个场景至少两句（只有一句会一直重复；一年一次的节日、生日除外）', () => {
  const yearly = new Set([...Object.values(SOLAR_HOLIDAYS), ...Object.values(DATED_HOLIDAYS), 'pigBirthday'])
  const single = Object.entries(LINES).filter(([scene, pool]) => pool.length < 2 && !yearly.has(scene)).map(([scene]) => scene)
  assert.deepEqual(single, [])
})
