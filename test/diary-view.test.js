/**
 * 日记展示：正文与游戏系统摘要分开，照料记录默认收起。
 *
 * 这些测试直接跑源码模块（不经过 client.js），所以不用等主代理构建；
 * 构建后的整包行为另由 test/client.test.js 覆盖。
 */

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

import { splitDiaryText } from '../packages/pet-core/src/core/diary-text.js'
import { normalizeDiary, normalizeDiaryEntry } from '../src/client/normalize-diary.js'
import { normalize } from '../src/client/normalize.js'
import { renderBagTab } from '../src/client/tabs/bag.js'
import { fakeDom } from './helpers/bundle.js'

// 真实摘要由 offline-feed 写出：物品带「×份数」，多条用「、」或「；」连起来。
const MIXED = [
  '今天主人带我晒了太阳，很舒服。',
  '你不在的时候，猪猪自己吃了 苹果×1',
  '你不在的时候，猪猪自己玩了 皮球×2',
  '背包里没吃的了',
].join('\n')

/** 只画日记那一层，足够检查展开/收起，不需要整包挂载。 */
function openDiaryPage(diary, pick) {
  const dom = fakeDom()
  globalThis.document = dom.document
  const content = dom.document.createElement('div')
  const sent = []
  const ui = {
    view: { diary, care: {}, shop: [], inventory: {} },
    drill: { bag: 'diary', pick: pick ?? null, from: null },
    content,
    send(op, payload) { sent.push({ op, payload }) },
    select() {},
    renderContent() {
      content.textContent = ''
      renderBagTab(ui)
    },
  }
  renderBagTab(ui)
  const all = (predicate) => {
    const found = []
    content.walk(node => { if (predicate(node)) found.push(node) })
    return found
  }
  const byClass = className => all(node => typeof node.className === 'string'
    && node.className.split(/\s+/).includes(className))[0]
  const byAttr = (name, value) => all(node => node.attributes?.[name] === value)[0]
  return {
    dom, ui, content, sent, all, byClass, byAttr,
    toggle: () => byAttr('data-diary-care', ui.drill.pick),
    tile: day => byAttr('data-diary', day),
    setView(next) { ui.view = next; ui.renderContent() },
    text: () => content.allText(),
  }
}

test('mixed diary text is split into body and care notes', () => {
  const split = splitDiaryText(MIXED)
  assert.equal(split.body, '今天主人带我晒了太阳，很舒服。')
  assert.deepEqual(split.careNotes, [
    '你不在的时候，猪猪自己吃了 苹果×1',
    '你不在的时候，猪猪自己玩了 皮球×2',
    '背包里没吃的了',
  ])
})

test('normalize keeps the raw text and passes a host body/careNotes through', () => {
  const entry = normalizeDiaryEntry({
    day: '2026-10-02',
    text: MIXED,
    body: '今天很开心。',
    careNotes: ['你不在的时候，猪猪自己洗了 香皂×1'],
  })
  assert.equal(entry.text, MIXED, 'raw text is still there for old clients')
  assert.equal(entry.body, '今天很开心。')
  assert.deepEqual(entry.careNotes, ['你不在的时候，猪猪自己洗了 香皂×1'])
})

test('an old host with only day/text derives body and careNotes', () => {
  const [entry] = normalize({ diary: [{ day: '2026-10-02', text: MIXED }] }).diary
  assert.equal(entry.text, MIXED)
  assert.equal(entry.body, '今天主人带我晒了太阳，很舒服。')
  assert.deepEqual(entry.careNotes, [
    '你不在的时候，猪猪自己吃了 苹果×1',
    '你不在的时候，猪猪自己玩了 皮球×2',
    '背包里没吃的了',
  ])
})

test('an empty body does not fall back to the raw receipts', () => {
  const [entry] = normalizeDiary([{ day: '2026-10-02', text: '你不在的时候，猪猪自己吃了 苹果×1', body: '', careNotes: [] }])
  assert.equal(entry.body, '')

  const page = openDiaryPage([entry], '2026-10-02')
  assert.equal(page.byClass('dp-diary-body'), undefined, 'nothing pretends to be the body')
  assert.equal(page.toggle(), undefined, 'no notes, no toggle')
  assert.ok(!page.text().includes('猪猪自己吃了'), page.text())
})

test('a care-only page says so, without inventing a diary body', () => {
  const diary = normalizeDiary([{ day: '2026-10-02', text: MIXED }])
  assert.equal(diary[0].body, '今天主人带我晒了太阳，很舒服。')
  const careOnly = normalizeDiary([{ day: '2026-10-03', text: '你不在的时候，猪猪自己玩了 皮球×1' }])
  assert.equal(careOnly[0].body, '')
  assert.equal(careOnly[0].careNotes.length, 1)

  const page = openDiaryPage(careOnly, '2026-10-03')
  assert.equal(page.byClass('dp-diary-body'), undefined)
  assert.ok(page.byClass('dp-diary-note').allText().includes('这页只有照料记录。'))
  assert.ok(page.toggle(), 'the notes are still reachable')
  assert.ok(!page.text().includes('编'), 'no made-up entry text')
})

test('care notes start folded, open on tap, and fold again', () => {
  const page = openDiaryPage(normalizeDiary([{ day: '2026-10-02', text: MIXED }]), '2026-10-02')
  const toggle = page.toggle()
  assert.ok(toggle, 'a page with notes has a toggle')
  assert.equal(toggle.getAttribute('aria-expanded'), 'false')
  assert.ok(toggle.allText().includes('照料记录（3 条）'))
  assert.equal(page.byClass('dp-diary-care'), undefined, 'folded by default')

  toggle.fire('click')
  assert.equal(page.toggle().getAttribute('aria-expanded'), 'true')
  const rows = page.all(node => typeof node.className === 'string'
    && node.className.split(/\s+/).includes('dp-diary-care-row'))
  assert.equal(rows.length, 3)
  assert.ok(rows[0].allText().includes('猪猪自己吃了'))
  assert.ok(rows[2].allText().includes('背包里没吃的了'))

  page.toggle().fire('click')
  assert.equal(page.toggle().getAttribute('aria-expanded'), 'false')
  assert.equal(page.byClass('dp-diary-care'), undefined, 'and folds again')
})

test('the open state survives a host repaint and is per day', () => {
  const first = normalizeDiary([{ day: '2026-10-02', text: MIXED }])
  const second = normalizeDiary([{ day: '2026-10-01', text: '今天主人没来。\n你不在的时候，猪猪自己洗了 香皂×1' }])
  const page = openDiaryPage(first.concat(second), '2026-10-02')
  page.toggle().fire('click')
  assert.equal(page.sent.length, 0, 'showing notes never sends a play request')

  // 轮询换了新数组：选中日期和展开状态都还在。
  page.setView({ diary: normalizeDiary(first.concat(second)).map(entry => ({ ...entry })) })
  assert.equal(page.ui.drill.pick, '2026-10-02')
  assert.equal(page.toggle().getAttribute('aria-expanded'), 'true')
  assert.ok(page.byClass('dp-diary-care'), 'still open after the repaint')

  // 换一天：那天默认收起；换回来原来那天仍然开着。
  page.tile('2026-10-01').fire('click')
  assert.equal(page.ui.drill.pick, '2026-10-01')
  assert.equal(page.toggle().getAttribute('aria-expanded'), 'false')
  assert.equal(page.byClass('dp-diary-care'), undefined)
  page.tile('2026-10-02').fire('click')
  assert.equal(page.toggle().getAttribute('aria-expanded'), 'true')

  assert.equal(page.sent.length, 0, 'no action was sent by any of the toggles')
})

test('malformed and malicious diary fields stay inert', () => {
  const [entry] = normalizeDiary([{
    day: '2026-10-02',
    text: '<img src=x onerror="alert(1)">\n你不在的时候，猪猪自己吃了 苹果×1',
    body: { evil: true }, // 不是字符串：不能当正文
    careNotes: ['<script>alert(1)</script>', 42, null, {}, ''],
  }])
  // body 不合法，所以这一项按 text 派生（把系统摘要切掉）；careNotes 是合法的
  // 数组，就照读，垃圾项丢掉。
  assert.equal(entry.body, '<img src=x onerror="alert(1)">')
  assert.deepEqual(entry.careNotes, ['<script>alert(1)</script>'])

  const page = openDiaryPage([entry], '2026-10-02')
  assert.ok(page.text().includes('<img src=x onerror="alert(1)">'), 'shown as text')
  page.toggle().fire('click')
  assert.ok(page.text().includes('<script>alert(1)</script>'), 'note shown as text')
  assert.equal(page.all(node => node.tagName === 'img' || node.tagName === 'script').length, 0,
    'nothing was turned into an element')
})

test('a careNotes list with junk only keeps the strings', () => {
  const [entry] = normalizeDiary([{
    day: '2026-10-02',
    text: '正文',
    body: '正文',
    careNotes: ['好的', 7, '', { a: 1 }, null],
  }])
  assert.deepEqual(entry.careNotes, ['好的'])
})

test('entries with no day or no text at all are dropped', () => {
  assert.deepEqual(normalizeDiary([
    { day: '', text: '没有日期' },
    { day: '2026-10-01', text: '' },
    { day: '2026-10-02', text: '有内容' },
  ]).map(entry => entry.day), ['2026-10-02'])
})

test('diary styles keep the cream/teal theme and the 292px panel readable', async () => {
  const css = await readFile(new URL('../src/client/css-tabs.js', import.meta.url), 'utf8')
  for (const rule of [
    '.dp-diary-body{margin-top:4px;font-size:14px;line-height:1.75;white-space:pre-line;',
    'color:var(--ac-text);overflow-wrap:anywhere}',
    '.dp-diary-care-toggle{display:flex;align-items:center;justify-content:space-between;gap:6px;',
    'width:100%;min-height:32px;margin-top:8px;padding:5px 10px;font:inherit;font-size:12px;',
    '.dp-diary-care{margin-top:6px;padding:8px 10px;font-size:12px;line-height:1.6;',
  ]) assert.ok(css.includes(rule), 'missing: ' + rule)
  // 不要固定高度裁字，也不要把宽度顶出面板。
  const bodyRule = css.match(/\.dp-diary-body\{[^}]*\}/)[0]
  assert.ok(!/(?<![-\w])height:/.test(bodyRule), 'the body must grow with its text')
  assert.ok(css.includes('overflow-wrap:anywhere'), 'long words may wrap')
})
