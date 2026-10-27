// @ts-check
/**
 * 合并预览的身份组摘要必须给玩家看中文，不能把存档里的技术 key
 * （default / mischievous / river / form / dress）直接写进界面。
 *
 * 字典优先用后端 `editors` 里真实已解锁候选的 label；自定义皮肤保留玩家起的名字。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fakeDom } from './helpers/bundle.js'
import { lookLine, personalityLine, preferenceLine, renderPreview } from '../src/client/external-preview.js'
import { defaultChoices } from '../src/client/external-rules.js'

const preview = {
  ok: true,
  expiresAt: 0,
  result: { name: '团团', level: 12, days: 30, coins: 2120, items: 77, badges: 25, newBadges: 0, newDex: 0, newDiary: 0, dead: false },
  target: { name: '团团' },
  source: { name: '猪猪' },
  choices: [
    { key: 'name', label: '名字', options: ['target', 'source', 'custom'], default: 'target', value: '团团', editable: [] },
    { key: 'look', label: '样子', options: ['target', 'source', 'custom'], default: 'target', editable: ['form', 'skin', 'worn'], value: { side: 'target', form: '', skin: 'default', worn: [] } },
    { key: 'personality', label: '性格', options: ['target', 'source', 'custom'], default: 'target', editable: ['personality', 'catchphrase', 'motto', 'birthday'], value: { side: 'target', personality: 'mischievous', catchphrase: '嘻嘻', motto: '一点点小捣蛋，很多很多喜欢。', birthday: { month: 5, day: 2 } } },
    { key: 'preferences', label: '偏好', options: ['target', 'source', 'custom'], default: 'target', editable: ['ownerName', 'quiet', 'isOfflineFeedEnabled', 'timeScale', 'fishing.spot'], value: { side: 'target', ownerName: '主人', quiet: false, isOfflineFeedEnabled: true, timeScale: 1, spot: 'river' } },
  ],
  sides: {
    target: { name: '团团', form: '', skin: 'default', worn: [], personality: 'mischievous', catchphrase: '嘻嘻', motto: '一点点小捣蛋，很多很多喜欢。', birthday: '5/2', ownerName: '主人', quiet: false, isOfflineFeedEnabled: true, timeScale: 1, spot: 'river' },
    source: { name: '猪猪', form: 'devil', skin: 'mint', worn: ['scarf'], personality: 'goofy', catchphrase: '唔', motto: '没想明白，也不耽误喜欢你。', birthday: '6/3', ownerName: '老板', quiet: true, isOfflineFeedEnabled: false, timeScale: 2, spot: 'lake' },
  },
  editors: {
    look: {
      form: [{ key: '', label: '默认形态' }, { key: 'king', label: '猪猪王' }, { key: 'devil', label: '恶魔猪' }],
      skin: [{ key: 'default', label: '默认' }, { key: 'mint', label: '薄荷小猪' }, { key: 'custom-tuan', label: '团子的薄荷' }],
      worn: [{ key: 'scarf', label: '围巾' }, { key: 'hat', label: '帽子' }],
    },
    personality: { personality: [{ key: 'mischievous', label: '调皮' }, { key: 'goofy', label: '呆萌' }] },
    preferences: { spot: [{ key: 'river', label: '小河' }, { key: 'lake', label: '小湖' }] },
  },
  conflicts: [],
  duplicate: null,
  warnings: [],
  autoMerge: [],
  backups: {},
  sourceBackup: '',
}

test('样子摘要用 editors 的中文 label：默认皮肤显示「默认」，形态和穿戴也不露 key', () => {
  assert.equal(lookLine(preview, preview.sides.target), '皮肤 默认')
  assert.equal(lookLine(preview, preview.sides.source), '形态 恶魔猪 · 皮肤 薄荷小猪 · 穿戴 围巾')
  assert.equal(lookLine(preview, { form: 'king', skin: 'custom-tuan', worn: ['hat'] }), '形态 猪猪王 · 皮肤 团子的薄荷 · 穿戴 帽子')
})

test('性格和偏好摘要用 editors 的中文 label，数字和用户文本原样保留', () => {
  assert.equal(personalityLine(preview, preview.sides.target), '调皮 · 「嘻嘻」 · 生日 5/2')
  assert.equal(personalityLine(preview, preview.sides.source), '呆萌 · 「唔」 · 生日 6/3')
  assert.equal(preferenceLine(preview, preview.sides.target), '称呼 主人 · 免打扰关 · 离线喂食开 · ×1 · 钓点 小河')
  assert.equal(preferenceLine(preview, preview.sides.source), '称呼 老板 · 免打扰开 · 离线喂食关 · ×2 · 钓点 小湖')
})

test('没有字典时用通用中文，不回显 form/skin/dress/personality/spot 的技术 key', () => {
  const bare = { editors: {} }
  assert.equal(lookLine(bare, { form: 'swamp', skin: 'default', worn: ['cape'] }), '形态未知 · 皮肤 默认 · 穿戴 未知装扮')
  assert.equal(lookLine(bare, { form: '', skin: 'custom-x', worn: [] }), '皮肤未知')
  assert.equal(personalityLine(bare, { personality: 'grumpy', catchphrase: '哼', birthday: '' }), '未知性格 · 「哼」')
  assert.equal(preferenceLine(bare, { ownerName: '', quiet: true, isOfflineFeedEnabled: true, timeScale: 1, spot: 'river' }), '免打扰开 · 离线喂食开 · ×1 · 钓点 未知')
  assert.equal(lookLine(bare, { form: '', skin: '', worn: [] }), '默认样子')
  assert.equal(personalityLine(bare, { personality: '', catchphrase: '', birthday: '' }), '默认性格')
})

test('后端只回填 key 当 label 时按没字典处理，不把 key 当名字展示', () => {
  const rawish = {
    editors: {
      look: { form: [{ key: 'king', label: 'king' }], skin: [{ key: 'mint' }], worn: [{ key: 'hat' }] },
      personality: { personality: [{ key: 'goofy', label: 'goofy' }] },
      preferences: { spot: [{ key: 'lake', label: 'lake' }] },
    },
  }
  assert.equal(lookLine(rawish, { form: 'king', skin: 'mint', worn: ['hat'] }), '形态未知 · 皮肤未知 · 穿戴 未知装扮')
  assert.equal(personalityLine(rawish, { personality: 'goofy', catchphrase: '', birthday: '' }), '未知性格')
  assert.equal(preferenceLine(rawish, { ownerName: '', quiet: false, isOfflineFeedEnabled: true, timeScale: 1, spot: 'lake' }), '免打扰关 · 离线喂食开 · ×1 · 钓点 未知')
})

test('预览正式渲染：三组摘要都是中文，不出现 default/mischievous/river 等内部 key', () => {
  const oldDocument = globalThis.document
  const dom = fakeDom()
  globalThis.document = dom.document
  try {
    const dialog = dom.document.createElement('div')
    const state = {
      preview,
      choices: defaultChoices(preview),
      status: {
        local: { exists: true, hatched: true, dead: false, box: false, state: 'alive', name: '团团' },
        target: { exists: true, hatched: true, dead: false, box: false, state: 'alive', name: '团团' },
      },
      busy: false,
      error: '',
    }
    const handlers = { close() {}, submit() {}, cancelPreview() {}, refresh() {} }
    renderPreview(dialog, state, handlers)
    const text = dialog.allText()
    assert.match(text, /样子/)
    assert.match(text, /皮肤 默认/)
    assert.match(text, /调皮/)
    assert.match(text, /钓点 小河/)
    assert.doesNotMatch(text, /default|mischievous|river/)
  } finally {
    globalThis.document = oldDocument
  }
})
