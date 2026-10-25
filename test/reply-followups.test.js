// @ts-check
/**
 * 回复之后小猪接一句：文案表覆盖、稳定身份、性格回退和旧存档兼容。
 *
 * 文案来源：docs/numbers/reply-followups-20261022.md 与 -01/-02/-03 三份审稿稿。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { hatchEgg, migrate, replyToLine, say, setCatchphrase, setOwnerName } from '../core.js'
import { LINES, PERSONALITIES, REPLY_FOLLOWUPS, REPLY_HAPPINESS } from '../data.js'
import { ensureDialogue, replyFollowup } from '../packages/pet-core/src/core/lines.js'

const T0 = 1_700_000_000_000

/** 让 pickLine 选中场景里指定总表下标的那一句（前提：该句在当前性格下可选）。 */
const pickIndex = (scene, index) => () => (index + 0.5) / LINES[scene].length

/** 说指定的一句，返回它排进 pending 的那条消息。 */
function sayIndex(pig, scene, index, nowMs = T0) {
  assert.equal(say(pig, scene, nowMs, pickIndex(scene, index)), true)
  return pig.pending.at(-1)
}

/**
 * 说一句、回复它，返回接话事件和回复前的基准值。
 * @param {object} pig
 * @param {string} scene
 * @param {number} index
 * @param {number} replyIndex
 * @param {number} [nowMs]
 */
function replyOnce(pig, scene, index, replyIndex, nowMs = T0) {
  const original = sayIndex(pig, scene, index, nowMs)
  const before = {
    pending: pig.pending.length,
    happiness: pig.happiness,
    coins: pig.coins,
    pets: pig.stats.pets,
    satiety: pig.satiety,
    cleanliness: pig.cleanliness,
    weightG: pig.weightG,
    health: pig.health,
    inventory: JSON.stringify(pig.inventory),
  }
  const outcome = replyToLine(pig, original.id, replyIndex, nowMs + 1000)
  assert.deepEqual(outcome, { ok: true, reply: LINES[scene][index].replies[replyIndex].label })
  return { original, before, followup: pig.pending.at(-1) }
}

test('接话表逐个覆盖现有 144 个回复按钮：144 句通用 + 580 句性格，共 724 句', () => {
  const expected = []
  for (const scene of Object.keys(LINES)) {
    LINES[scene].forEach((line, index) => {
      (line.replies ?? []).forEach((reply, replyIndex) => {
        expected.push({ key: `${scene}:${index}:${replyIndex}`, scene, index, replyIndex, line, reply })
      })
    })
  }
  assert.equal(expected.length, 144, 'existing reply buttons changed; regenerate the followup table')
  assert.deepEqual(Object.keys(REPLY_FOLLOWUPS).sort(), expected.map(entry => entry.key).sort())

  let generic = 0
  let personalities = 0
  const personalityKeys = new Set(PERSONALITIES.map(entry => entry.key))
  for (const { key, scene, index, replyIndex, line, reply } of expected) {
    const entry = REPLY_FOLLOWUPS[key]
    assert.ok(entry !== undefined, `${key} has no followup`)
    assert.ok(Object.isFrozen(entry) && Object.isFrozen(entry.personalities), `${key} must stay immutable`)
    // 键必须真的对得上现有原句和按钮；表里不另存显示文字，避免按文字猜上下文。
    assert.equal(line.replies[replyIndex].label, reply.label)
    assert.ok(typeof entry.generic === 'string' && entry.generic.trim() !== '', `${key} generic`)
    assert.ok(entry.generic.length <= 30, `${key} generic too long`)
    assert.ok(!/\[[^\]]*\]/.test(entry.generic), `${key} generic has an unsupported placeholder`)
    generic += 1
    for (const [personality, text] of Object.entries(entry.personalities)) {
      assert.ok(personalityKeys.has(personality), `${key} unknown personality ${personality}`)
      assert.ok(typeof text === 'string' && text.trim() !== '', `${key} ${personality}`)
      assert.ok(text.length <= 30, `${key} ${personality} too long`)
      assert.ok(!/[\n\r]/.test(text), `${key} ${personality} has a line break`)
      assert.ok(!/\[[^\]]*\]/.test(text), `${key} ${personality} has an unsupported placeholder`)
      personalities += 1
    }
    // 原句适用的每个性格都必须有专属接话（审稿稿的承诺），不能只靠通用句。
    for (const personality of line.personalities ?? []) {
      assert.ok(typeof entry.personalities[personality] === 'string', `${key} lacks ${personality} followup`)
    }
  }
  assert.equal(generic, 144)
  assert.equal(personalities, 580)
  assert.equal(generic + personalities, 724)
})

test('审稿稿里的示例逐字进表（来源可复查）', () => {
  const examples = [
    ['eat:0:0', '好吃！还有吗？', '真乖', '饭好吃，夸奖更好吃', 'peppy', '夸得我尾巴都要起飞'],
    ['eat:0:0', '好吃！还有吗？', '真乖', '饭好吃，夸奖更好吃', 'curious', '你夸我乖，我吃得更香啦'],
    ['pet:20:0', '可以把这只手借我枕一下吗', '借给你', '枕到啦，我轻轻的，不压麻你的手', 'lazy', '软乎乎的，正适合打盹'],
    ['pet:15:0', '手别走，我已经靠过去了', '不走', '好，我就靠在这里', 'clingy', '好，我就在你手边趴好'],
    ['pigBirthday:0:0', '今天是我的生日！[主人]记得吗？', '生日快乐', '谢谢你记得我的生日！', 'earnest', '谢谢你记得，我好好收下啦'],
  ]
  for (const [key, text, label, generic, personality, personal] of examples) {
    const [scene, index, replyIndex] = key.split(':').map((part, at) => (at === 0 ? part : Number(part)))
    const line = LINES[scene][index]
    assert.equal(line.text, text)
    assert.equal(line.replies[replyIndex].label, label)
    assert.equal(REPLY_FOLLOWUPS[key].generic, generic)
    assert.equal(REPLY_FOLLOWUPS[key].personalities[personality], personal)
  }
})

test('合法回复只接一句纯接话：性格优先、不重复奖励、不摸摸、不附回复按钮', () => {
  const pig = hatchEgg(T0)
  pig.personality = 'peppy'
  pig.catchphrase = ''
  const { original, before, followup } = replyOnce(pig, 'wake', 9, 0)

  assert.equal(original.text, '是主人呀，那我不困了')
  assert.equal(followup.kind, 'line')
  assert.equal(followup.text, '醒啦，今天也想跟你玩')
  assert.deepEqual(followup.replies, [], '接话不再带回复按钮')
  assert.equal(pig.dialogue.open, null, '接话不能成为新的一轮 open')
  assert.equal(pig.pending.length, before.pending + 1)
  assert.equal(pig.happiness, before.happiness + REPLY_HAPPINESS)
  assert.equal(pig.coins, before.coins)
  assert.equal(pig.stats.pets, before.pets, '回复不算摸摸')
  assert.equal(pig.satiety, before.satiety)
  assert.equal(pig.cleanliness, before.cleanliness)
  assert.equal(pig.weightG, before.weightG)
  assert.equal(pig.health, before.health)
  assert.equal(JSON.stringify(pig.inventory), before.inventory, '接话不吃东西、不吃药')
  assert.equal(pig.lastActiveAt, T0 + 1000)

  // 同一条回复再来一次：不奖励、不接话、不刷新活跃时间。
  assert.deepEqual(replyToLine(pig, original.id, 0, T0 + 5000), { ok: false, reason: 'stale-line' })
  assert.equal(pig.pending.length, before.pending + 1)
  assert.equal(pig.happiness, before.happiness + REPLY_HAPPINESS)
  assert.equal(pig.lastActiveAt, T0 + 1000)
  // 接话自己没有 open，点它也不会再来一轮。
  assert.deepEqual(replyToLine(pig, followup.id, 0, T0 + 6000), { ok: false, reason: 'stale-line' })
  assert.equal(pig.pending.length, before.pending + 1)
})

test('换性格后用新性格的句子；不适用或未知性格回退通用句', () => {
  // 会话途中从元气换成呆萌：wake:9 有元气专属句，呆萌没有 → 通用句。
  const changed = hatchEgg(T0)
  changed.personality = 'peppy'
  changed.catchphrase = ''
  const original = sayIndex(changed, 'wake', 9)
  changed.personality = 'goofy'
  assert.equal(replyToLine(changed, original.id, 0, T0 + 1000).ok, true)
  assert.equal(changed.pending.at(-1).text, REPLY_FOLLOWUPS['wake:9:0'].generic)

  // 手改成未知性格：也走通用句，不能把 undefined 或函数当台词。
  const unknown = hatchEgg(T0)
  unknown.personality = 'peppy'
  unknown.catchphrase = ''
  const unknownLine = sayIndex(unknown, 'wake', 9)
  unknown.personality = 'not-a-personality'
  assert.equal(replyToLine(unknown, unknownLine.id, 0, T0 + 1000).ok, true)
  assert.equal(unknown.pending.at(-1).text, REPLY_FOLLOWUPS['wake:9:0'].generic)
  assert.equal(replyFollowup({ scene: 'wake', index: 9 }, 0, 'constructor'), REPLY_FOLLOWUPS['wake:9:0'].generic)

  // 只属于元气/好奇的按钮，换成温和后通用句回退。
  const restricted = hatchEgg(T0)
  restricted.personality = 'peppy'
  restricted.catchphrase = ''
  const eat = sayIndex(restricted, 'eat', 0)
  restricted.personality = 'normal'
  assert.equal(replyToLine(restricted, eat.id, 0, T0 + 1000).ok, true)
  assert.equal(restricted.pending.at(-1).text, REPLY_FOLLOWUPS['eat:0:0'].generic)
})

test('改名、换口头禅不影响接话身份', () => {
  const pig = hatchEgg(T0)
  pig.personality = 'peppy'
  pig.catchphrase = ''
  setOwnerName(pig, '小明')
  const original = sayIndex(pig, 'wake', 9)
  assert.equal(original.text, '是小明呀，那我不困了')
  // 回复前改名、设置口头禅：身份记的是场景/下标，不按显示文字或称呼匹配。
  setOwnerName(pig, '阿花')
  setCatchphrase(pig, '哼')
  assert.equal(replyToLine(pig, original.id, 0, T0 + 1000).ok, true)
  assert.equal(pig.pending.at(-1).text, REPLY_FOLLOWUPS['wake:9:0'].personalities.peppy)
  assert.equal(pig.dialogue.ownerName, '阿花')
  assert.equal(pig.catchphrase, '哼')

  // 原句本身被口头禅改写过，也不影响接话身份。
  const phrased = hatchEgg(T0)
  phrased.personality = 'peppy'
  phrased.catchphrase = '哼'
  setOwnerName(phrased, '小明')
  const values = [pickIndex('wake', 9)(), 0.1]
  assert.equal(say(phrased, 'wake', T0, () => values.shift() ?? 0.9), true)
  const phrasedLine = phrased.pending.at(-1)
  assert.equal(phrasedLine.text, '是小明呀，那我不困了，哼')
  setCatchphrase(phrased, '呼噜')
  assert.equal(replyToLine(phrased, phrasedLine.id, 0, T0 + 1000).ok, true)
  assert.equal(phrased.pending.at(-1).text, REPLY_FOLLOWUPS['wake:9:0'].personalities.peppy)
})

test('旧存档的 open 缺场景/下标：回复照常有效，但不猜接话；新台词起恢复', () => {
  const pig = hatchEgg(T0)
  pig.personality = 'peppy'
  pig.catchphrase = ''
  pig.happiness = 40
  pig.dialogue.open = { id: 77, replies: [{ label: '好', happiness: 3 }] }
  // lastByScene 只记各场景最近用过的下标，既分不出 open 属于哪个场景，也可能已被
  // 后面一句无回复台词盖过；用它反推就是猜，所以这里明确不接话。
  pig.dialogue.lastByScene = { eat: [0], pet: [11] }
  const pending = pig.pending.length
  assert.deepEqual(replyToLine(pig, 77, 0, T0 + 1000), { ok: true, reply: '好' })
  assert.equal(pig.happiness, 43)
  assert.equal(pig.pending.length, pending, '旧 open 没有稳定身份，不能凭最近台词猜一句接话')
  assert.equal(pig.dialogue.open, null)

  // 下一条新台词有身份，接话恢复正常。
  const fresh = sayIndex(pig, 'wake', 9, T0 + 2000)
  assert.equal(pig.dialogue.open.scene, 'wake')
  assert.equal(pig.dialogue.open.index, 9)
  assert.equal(replyToLine(pig, fresh.id, 0, T0 + 3000).ok, true)
  assert.equal(pig.pending.at(-1).text, REPLY_FOLLOWUPS['wake:9:0'].personalities.peppy)
})

test('存档清洗保留 open 身份，也保留旧 open 的兼容形状', () => {
  const pig = hatchEgg(T0)
  pig.dialogue.open = { id: 9, replies: [{ label: '好' }], scene: 'wake', index: 9 }
  ensureDialogue(pig)
  assert.deepEqual(pig.dialogue.open, { id: 9, replies: [{ label: '好', happiness: REPLY_HAPPINESS }], scene: 'wake', index: 9 })

  pig.dialogue.open = { id: 10, replies: [{ label: '好' }] }
  ensureDialogue(pig)
  assert.equal(pig.dialogue.open.scene, null)
  assert.equal(pig.dialogue.open.index, null)
})

test('存档迁移/JSON 往返后身份还在，接话照常', () => {
  const pig = hatchEgg(T0)
  pig.personality = 'peppy'
  pig.catchphrase = ''
  const original = sayIndex(pig, 'wake', 9)
  const revived = migrate(JSON.parse(JSON.stringify(pig)), T0 + 500)
  assert.equal(revived.dialogue.open.scene, 'wake')
  assert.equal(revived.dialogue.open.index, 9)
  assert.equal(replyToLine(revived, original.id, 0, T0 + 1000).ok, true)
  assert.equal(revived.pending.at(-1).text, REPLY_FOLLOWUPS['wake:9:0'].personalities.peppy)
})

test('迁移不清旧档：称呼、台词记忆和旧 open 都保留，缺身份时不猜接话', () => {
  const pig = hatchEgg(T0)
  pig.personality = 'peppy'
  pig.catchphrase = ''
  pig.dialogue.ownerName = '老主人'
  pig.dialogue.lastByScene = { pet: [1, 2] }
  pig.dialogue.open = { id: 55, replies: [{ label: '好', happiness: 3 }] }
  const loaded = migrate(JSON.parse(JSON.stringify(pig)), T0 + 1000)
  assert.equal(loaded.dialogue.ownerName, '老主人')
  assert.deepEqual(loaded.dialogue.lastByScene, { pet: [1, 2] })
  assert.equal(loaded.dialogue.open.scene, null)
  assert.equal(loaded.dialogue.open.index, null)
  const before = loaded.pending.length
  const happiness = loaded.happiness
  assert.deepEqual(replyToLine(loaded, 55, 0, T0 + 2000), { ok: true, reply: '好' })
  assert.equal(loaded.happiness, happiness + 3)
  assert.equal(loaded.pending.length, before, '旧 open 缺身份：不凭最近台词猜接话')
})

test('非法回复下标不发奖励、不接话，open 留着还能重试', () => {
  const pig = hatchEgg(T0)
  pig.personality = 'peppy'
  pig.catchphrase = ''
  const original = sayIndex(pig, 'wake', 9)
  const pending = pig.pending.length
  const happiness = pig.happiness
  for (const index of [-1, -0.5, 0.5, 2, 99, NaN, null, 'nope']) {
    assert.deepEqual(replyToLine(pig, original.id, /** @type {any} */ (index), T0 + 1000), { ok: false, reason: 'unknown' }, `index ${String(index)}`)
  }
  assert.equal(pig.dialogue.open.id, original.id)
  assert.equal(pig.pending.length, pending)
  assert.equal(pig.happiness, happiness)
  // 重试合法下标仍可用，并只发一次接话。
  assert.equal(replyToLine(pig, original.id, 0, T0 + 2000).ok, true)
  assert.equal(pig.pending.length, pending + 1)
  assert.equal(pig.happiness, happiness + REPLY_HAPPINESS)
  assert.deepEqual(pig.pending.at(-1).replies, [])
})

test('死亡状态优先：不处理回复、不接话', () => {
  const pig = hatchEgg(T0)
  pig.personality = 'peppy'
  pig.catchphrase = ''
  const original = sayIndex(pig, 'wake', 9)
  const pending = pig.pending.length
  pig.dead = true
  assert.deepEqual(replyToLine(pig, original.id, 0, T0 + 1000), { ok: false, reason: 'dead' })
  assert.equal(pig.pending.length, pending)
  assert.notEqual(pig.dialogue.open, null)
})
