// @ts-check
/**
 * dsh-piggy · render — every word the pig says.
 *
 * Pure string building: the command handlers, the HTTP actions, the tests and
 * the client bubble all read from here, so the pig's voice lives in exactly one
 * file.
 *
 * @module dsh-piggy/render
 */

import {
  ACTIONS,
  ACTION_ORDER,
  JOBS,
  MAX,
  REVIVE_ITEM,
  SCHOOL_STAGES,
  SHOP,
  SUBJECTS,
  TRAITS,
  TRAIT_ORDER,
  TRIPS,
  actionCooldownSeconds,
  activitySecondsLeft,
  bar,
  courseView,
  formatWeight,
  healthPercent,
  levelProgress,
  formStageView,
  mood,
  outingGrowth,
  traitView,
} from './core.js'
import { STUDY_GROWTH_PER_LESSON, illnessAt } from './data.js'

const RULE = '━━━━━━━━━━━━━━━━━━━━━━━━━━'

/** Which portrait face matches the mood. */
function face(currentMood) {
  switch (currentMood.key) {
    case 'sleepy': return { l: '˘', r: '˘', m: 'ω' }
    case 'hungry': return { l: '◕', r: '◕', m: 'o' }
    case 'dirty': return { l: 'ò', r: 'ó', m: '益' }
    case 'sick': return { l: '×', r: '×', m: '︿' }
    case 'dead': return { l: '×', r: '×', m: '︵' }
    case 'working': return { l: '•', r: '•', m: 'ω' }
    case 'happy': return { l: '^', r: '^', m: 'ω' }
    case 'lonely': return { l: '◕', r: '◕', m: '︵' }
    default: return { l: '◕', r: '◕', m: 'ω' }
  }
}

/** The pig, with a face that follows the mood. */
export function portrait(stage, currentMood) {
  if (stage.key === 'box') {
    return [
      '      🥚',
      '   ╭───────╮',
      '   │  〜〜  │',
      '   ╰───────╯',
    ]
  }
  const f = face(currentMood)
  const hat = currentMood.key === 'working' ? ' 💼' : currentMood.key === 'dead' ? ' 💀' : ''
  return [
    `      ${stage.emoji}${hat}`,
    '   ╭───────╮',
    `   │ ${f.l}   ${f.r} │`,
    `   │   ${f.m}   │`,
    '   ╰───────╯',
  ]
}

function xpLine(state) {
  const progress = levelProgress(state.xp)
  return progress.maxed
    ? `✨ 成长  ${Math.floor(state.xp)}   Lv.${progress.level}（满级）`
    : `✨ 成长  ${Math.floor(state.xp)}   Lv.${progress.level} · 还差 ${Math.ceil(progress.toNext)} 升级`
}

function statusLine(state, nowMs) {
  if (state.dead) return '💀 状态  已经走了 · 用 ' + REVIVE_ITEM.label + ' 可以救回来'
  if (state.activity !== null) {
    const left = activitySecondsLeft(state, nowMs)
    const kind = state.activity.kind === 'study' ? '上课' : state.activity.kind === 'trip' ? '旅行' : '打工'
    return `${state.activity.emoji} ${kind}  ${state.activity.label}中 · 还有 ${left} 秒`
  }
  const ill = state.illness === null ? null : illnessAt(state.illness.chain, state.illness.stage)
  if (ill !== null) return `🤒 生病  ${ill.name}（第 ${ill.stage}/4 期）· 需要「${ill.cure}」`
  return null
}

/** The three QQ Pet traits, as one line. */
function traitsLine(state) {
  const traits = traitView(state)
  return TRAIT_ORDER
    .map(key => `${TRAITS[key].emoji} ${TRAITS[key].label} ${traits[key]}`)
    .join('   ')
}

function memoriesBlock(state) {
  if (state.memories.length === 0) return []
  return ['', '🕘 最近', ...state.memories.slice(-4).map(line => `   ${line}`)]
}

/** The full `/pig` card. */
export function renderStatus(state, nowMs) {
  const stage = formStageView(state, nowMs)
  const current = mood(state, nowMs)
  const special = statusLine(state, nowMs)
  const days = (nowMs - state.bornAt) / 86_400_000
  const age = state.hatched !== true ? '还没拆开' : (days < 1 ? '今天刚出生' : `${Math.floor(days)} 天大`)
  const lines = [
    `${stage.emoji} ${state.name}  ${stage.label} · ${age}   ${current.emoji} ${current.label}`,
    RULE,
    `🍚 饱食  ${bar(state.satiety)}  ${Math.round(state.satiety)}`,
    `❤️  心情  ${bar(state.happiness)}  ${Math.round(state.happiness)}`,
    `🫧 清洁  ${bar(state.cleanliness)}  ${Math.round(state.cleanliness)}`,
    `💚 健康  ${bar(healthPercent(state))}  ${state.health}/${MAX.health}`,
    `🪙 金币  ${state.coins}`,
    `⚖️  体重  ${formatWeight(state.weightG)}`,
    xpLine(state),
    traitsLine(state),
  ]
  if (special !== null) lines.push(RULE, special)
  lines.push(
    RULE,
    ...portrait(stage, current),
    `    「${stage.line}」`,
    RULE,
    '🍽  完成回合 +5 · 发消息 +2 · 工具调用 +3 · 报错也长肉',
    '👆  右下角的猪点着就能养：喂食 · 洗澡 · 玩耍 · 打工 · 商店',
  )
  return [...lines, ...memoriesBlock(state)].join('\n')
}

/** The hatching ceremony. */
export function renderHatch(state, nowMs) {
  const stage = formStageView(state, nowMs)
  return [
    '   纸盒打开了 ——',
    '',
    ...portrait(stage, mood(state, nowMs)),
    '',
    `✨ ${stage.emoji} ${state.name} 蹦了出来（${stage.label}）`,
    `   「${stage.line}」`,
    '',
    `初始盘缠：🪙 ${state.coins} 金币。`,
    '正常干活就能养活它；右下角的猪点一下就能喂食、洗澡、送去打工。',
  ].join('\n')
}

/** One care action's outcome card. */
export function renderAction(state, nowMs, action, crossed) {
  const spec = ACTIONS[action]
  if (spec === undefined) return '🐖 不认识这个动作。'
  const current = mood(state, nowMs)
  const lines = [
    `${state.name} ${spec.verb}`,
    '',
    ...portrait(formStageView(state, nowMs), current),
    '',
    `🍚 饱食  ${bar(state.satiety)}  ${Math.round(state.satiety)}`,
    `❤️  心情  ${bar(state.happiness)}  ${Math.round(state.happiness)}`,
    `🫧 清洁  ${bar(state.cleanliness)}  ${Math.round(state.cleanliness)}`,
  ]
  const wait = actionCooldownSeconds(state, action, nowMs)
  if (wait > 0) lines.push('', `（${wait} 秒后还能再来一次）`)
  return lines.join('\n')
}

/** The refusal card when a care action is still cooling down. */
export function renderTooSoon(state, nowMs, action) {
  const spec = ACTIONS[action]
  if (spec === undefined) return '🐖 不认识这个动作。'
  const wait = actionCooldownSeconds(state, action, nowMs)
  const hints = {
    feed: `${state.name} 摆摆手：刚吃过，肚子还圆着呢。`,
    bathe: `${state.name} 缩了缩：刚洗完，香着呢，别再冲水了。`,
    play: `${state.name} 喘着气：让我歇会儿，刚玩过。`,
    pet: `${state.name} 还没缓过来。`,
  }
  return [hints[action] ?? `${state.name} 现在不想动。`, '', `${wait} 秒后可以再${spec.label}。`].join('\n')
}

/** Sent the pig out to work. */
export function renderWorkReport(state, nowMs, job) {
  return [
    `${state.name} 背上小包出门了 ${job.emoji}`,
    '',
    `💼 工作    ${job.label}`,
    `⏱  时长    ${job.minutes} 分钟`,
    `🪙 报酬    ${job.coins} 金币`,
    `🍚 消耗    饱食 ${job.satiety} · 清洁 ${job.cleanliness}`,
    '',
    `预计 ${activitySecondsLeft(state, nowMs)} 秒后回来。这期间不能喂食洗澡 —— 它在外面忙着。`,
  ].join('\n')
}

/** Sent the pig to class. */
export function renderStudyReport(state, nowMs, subject, stage) {
  const level = courseView(state)[subject.key] ?? 0
  return [
    `${state.name} 背上书包去上课了 ${subject.emoji}`,
    '',
    `📚 课程    ${subject.label}（${stage.label}）`,
    `⏱  时长    ${stage.minutes} 分钟`,
    `🪙 学费    ${stage.tuition} 金币`,
    `📈 收获    ${TRAITS[subject.trait].label} +${stage.gain} · 成长 +${STUDY_GROWTH_PER_LESSON}`,
    `🍚 消耗    饱食 ${stage.satiety} · 心情 ${stage.happiness}`,
    '',
    `这是${subject.label}第 ${level + 1} 节。预计 ${activitySecondsLeft(state, nowMs)} 秒后下课。`,
  ].join('\n')
}

/** Sent the pig travelling. */
export function renderTripReport(state, nowMs, trip) {
  return [
    `${state.name} 拖着小行李箱出发了 ${trip.emoji}`,
    '',
    `🧳 目的地  ${trip.label}`,
    `⏱  时长    ${trip.minutes} 分钟`,
    `🪙 花费    ${trip.cost} 金币`,
    `❤️  心情    +${trip.happiness} · 成长 +${outingGrowth(trip.minutes)}`,
    `🍚 消耗    饱食 ${trip.satiety}`,
    '',
    `会带回一件纪念品。预计 ${activitySecondsLeft(state, nowMs)} 秒后回来。`,
  ].join('\n')
}

/** A refusal from the work path, with the reason spelled out. */
export function renderWorkRefusal(state, text) {
  return [
    `💼 出不了门`,
    '',
    text,
    '',
    `现在：${mood(state, Date.now()).emoji} ${mood(state, Date.now()).label} · 🍚 ${Math.round(state.satiety)} · 🪙 ${state.coins}`,
  ].join('\n')
}

/** Bought something. */
export function renderBuy(state, result, item) {
  if (result?.ok !== true) {
    if (result?.reason === 'poor') return `🪙 钱不够：${item.emoji} ${item.label} 要 ${item.price} 金币，你只有 ${state?.coins ?? 0}。`
    if (result?.reason === 'dead') return `${state?.name ?? '猪'} 已经走了…先救回来再买东西。`
    return `🐖 没能买下 ${item.label}。`
  }
  return [
    `🛒 买到了 ${item.emoji} ${item.label}（-${item.price} 金币）`,
    '',
    `🪙 余额    ${state.coins}`,
    `🎒 背包    ${item.label} ×${state.inventory?.[item.key] ?? 0}`,
    '',
    `用起来：/pig use ${item.key}`,
  ].join('\n')
}

/** Used something from the backpack. */
export function renderUse(state, result, item) {
  if (result?.ok !== true) {
    switch (result?.reason) {
      case 'empty': return `🎒 背包里没有 ${item.emoji} ${item.label}。先去 /pig shop 买。`
      case 'body-locked': return '胖瘦已经锁定，先使用初始药水解除锁定。'
      case 'body-unlocked': return '当前没有锁定胖瘦，不消耗初始药水。'
      case 'body-already-locked': return '当前胖瘦已经锁定，不重复消耗药水。'
      case 'body-already': return '已经是这个体型，不重复消耗药水。'
      case 'body-hidden': return '体型立绘只适用于普通形态和默认皮肤，换回后再使用。'
      case 'box': return '先孵化小猪，再使用体型药水。'
      case 'away': return '小猪正在活动，结束后再使用。'
      case 'not-sick': return `${state?.name ?? '猪'} 现在没生病，吃药没用。`
      case 'not-dead': return `${state?.name ?? '猪'} 活得好好的，用不上 ${REVIVE_ITEM.label}。`
      case 'dead': return `${state?.name ?? '猪'} 已经走了…只有 ${REVIVE_ITEM.label} 能救回来。`
      case 'wrong-medicine': {
        const need = result.needs
        return `💊 药不对症。${state?.name ?? '猪'} 现在需要的是「${need?.label ?? '别的药'}」。`
      }
      case 'working': return `${state?.name ?? '猪'} 在外面打工，回来再吃。`
      default: return `🐖 没能用上 ${item.label}。`
    }
  }
  const lines = [`${state.name} 用了 ${item.emoji} ${item.label}`]
  if (item.kind === 'body') lines.push('', item.useLabel)
  else if (item.kind === 'medicine') lines.push('', '💚 病好了！健康恢复满值。')
  else if (item.kind === 'revive') lines.push('', '✨ 回来了！等级、成长值和金币都还在。')
  else {
    lines.push(
      '',
      `🍚 饱食  ${bar(state.satiety)}  ${Math.round(state.satiety)}`,
      `❤️  心情  ${bar(state.happiness)}  ${Math.round(state.happiness)}`,
      `🫧 清洁  ${bar(state.cleanliness)}  ${Math.round(state.cleanliness)}`,
    )
  }
  return lines.join('\n')
}

/** The scales. */
export function renderWeigh(state, nowMs) {
  const stage = formStageView(state, nowMs)
  const kilos = state.weightG / 1000
  let verdict = '还算苗条，继续保持'
  if (kilos >= 40) verdict = '这已经是一头正经的猪了'
  else if (kilos >= 15) verdict = '抱起来有点费劲'
  else if (kilos >= 6) verdict = '手感很好，沉甸甸的'
  else if (kilos >= 3) verdict = '圆润，但还能抱得动'
  return [
    `⚖️  ${state.name} 站上了秤`,
    '',
    `        ${stage.emoji}`,
    `     ${formatWeight(state.weightG)}`,
    '',
    `   「${verdict}」`,
  ].join('\n')
}

/** `/pig about`. */
export function renderAbout(commandName) {
  const actions = ACTION_ORDER.map(key => `  ${ACTIONS[key].emoji} ${ACTIONS[key].label}`).join(' · ')
  const jobs = JOBS.map(job => `  ${job.emoji} ${job.label}（Lv.${job.requires.level} · ${job.minutes} 分钟 · ${job.coins} 金币）`).join('\n')
  const courses = SUBJECTS.map(s => `${s.emoji}${s.label}`).join(' ')
  const stages = SCHOOL_STAGES.map(s => `  ${s.label}${Number.isFinite(s.upTo) ? `（到第 ${s.upTo} 节）` : ''}：${s.minutes} 分钟 · 学费 ${s.tuition} · +${s.gain}`).join('\n')
  const trips = TRIPS.map(t => `  ${t.emoji} ${t.label}（${t.minutes} 分钟 · ${t.cost} 金币）`).join('\n')
  const shop = SHOP.map(item => `  ${item.emoji} ${item.label}  ${String(item.price).padStart(3)} 金币`).join('\n')
  return [
    '🐖 dsh-piggy —— 一只住在 DSH 里的猪',
    RULE,
    '最省事的用法：点右下角的 🐖，面板上六个图标点着用。',
    '  ① 状态  ② 学习  ③ 打工  ④ 商店  ⑤ 旅行  ⑥ 背包',
    RULE,
    `照顾：${actions}`,
    '',
    '📚 学习（九门课各算各的课时，课时决定能干什么工作）：',
    `  ${courses}`,
    stages,
    '',
    '💼 打工（出门赚钱）：',
    jobs,
    '',
    '🧳 旅行（带回纪念品）：',
    trips,
    '',
    '🛒 商店：',
    shop,
    '',
    '🤒 生病：饿着或脏着太久会得病，健康上限 5。必须对症下药；',
    `      健康归零就没了，用 ${REVIVE_ITEM.label} 救回来（保留等级、金币和收藏）。`,
    RULE,
    '命令（不想点鼠标时才用）：',
    `/${commandName} · hatch · feed · bathe · play · pet`,
    `/${commandName} study <科目> <小学|大学|研究生>`,
    `/${commandName} work <odd|site|office> · trip <suburb|mountain|sea|abroad> · calloff`,
    `/${commandName} shop · buy <物品> · use <物品>`,
    `/${commandName} crown [形态]（长成后加冕）· weigh · name <名字> · about`,
    RULE,
    '它不调用模型、不注入上下文、不花一个 token。',
    '存档在 $DSH_HOME/dsh-piggy/state.json。',
  ].join('\n')
}

/** The empty-house prompt. */
export function renderNoPig(commandName) {
  return `这里还没有猪。/${commandName} hatch 孵一只 🥚 —— 它会吃你之后的真实工作长大。`
}
