import assert from 'node:assert/strict'
import { test } from 'node:test'
import { diaryView, composeDiary } from '../packages/pet-core/src/core/diary.js'
import { splitDiaryText } from '../packages/pet-core/src/core/diary-text.js'
import { DIARY_BOOK } from '../packages/pet-core/src/data.js'

const care = '你不在的时候，猪猪自己吃了 草莓×1、南瓜粥×1、洗了 香皂×1'
const body = '我怀疑饭盆有自己的想法，总想让我多看它一眼。'
const stateOf = text => ({ diary: { entries: [{ day: '2026-10-22', text }], today: { day: '2026-10-23', counts: { feed: 1 } } } })

test('日记快照分开正文和照料明细，原始text及存档不改写', () => {
  const raw = care + '\n' + body
  const state = stateOf(raw)
  const before = structuredClone(state)
  assert.deepEqual(diaryView(state)[0], { day: '2026-10-22', text: raw, body, careNotes: [care] })
  assert.deepEqual(state, before)
})

test('纯正文即使提到吃饭或次数也不会变成系统记录', () => {
  for (const text of ['今天吃了一个念头，我怀疑脑袋比肚子还饿。', '我想给自己打×100分，只怕鼻子翘得太高。', '你不在的时候，我想了很多事。', '你不在的时候，猪猪自己吃了 一个梦想']) {
    assert.deepEqual(splitDiaryText(text), { body: text, careNotes: [] })
  }
})

test('只有照料明细时正文为空，不捏造一篇历史日记', () => {
  const notes = care + '\n背包里没吃的了'
  assert.deepEqual(diaryView(stateOf(notes))[0], { day: '2026-10-22', text: notes, body: '', careNotes: [care, '背包里没吃的了'] })
})

test('多条记录保留顺序、原有正文段落与相同的记录', () => {
  const second = '你不在的时候，猪猪自己玩了 悠悠球×3；背包里没吃的了'
  const raw = body + '\n\n' + care + '\n后来又想到了饭盆。\n' + second + '\n' + care
  assert.deepEqual(splitDiaryText(raw), { body: body + '\n\n后来又想到了饭盆。', careNotes: [care, second, care] })
})

test('只识别确定的系统结算格式，不把相似的散文句拆走', () => {
  for (const text of ['你不在的时候，猪猪自己学会了发呆。', '背包里没吃的了，但我的想法还挺多。', '你不在的时候，猪猪自己吃了 一个念头×很久']) {
    assert.deepEqual(splitDiaryText(text), { body: text, careNotes: [] })
  }
  assert.deepEqual(splitDiaryText(null), { body: '', careNotes: [] })
})

test('附过照料摘要的旧正文仍参与去重，只调用一次既有随机源', () => {
  const said = text => text.replaceAll('[主人]', '主人')
  const recent = DIARY_BOOK.bathe.slice(1).map(text => care + '\n' + said(text))
  let calls = 0
  const result = composeDiary({ bathe: 1 }, '主人', () => { calls++; return 0.99 }, recent)
  assert.equal(result, said(DIARY_BOOK.bathe[0]))
  assert.equal(calls, 1)
})
