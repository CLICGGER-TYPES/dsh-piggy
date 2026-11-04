// @ts-check
/**
 * 斜杠命令与拒绝话术。
 *
 * 只读取状态与数值表，不算业务规则（见 docs/CONVENTIONS.md）。
 * 实现在 src/host/；根目录 commands.js 只保留同名导出的兼容门面。
 * @module dsh-piggy/host/commands
 */

import { ACTIONS, JOBS, MAX, REVIVE_ITEM, SCHOOL_STAGES, SHOP, SUBJECTS, TRAITS, TRAIT_ORDER, TRIPS, buy, feed, hatch } from '../../core.js'
import { FORMS, INTERESTS, formByKey, jobByKey, stageForNextLesson } from '../../data.js'
import { renderAbout, renderAction, renderBuy, renderHatch, renderNoPig, renderStatus, renderStudyReport, renderTooSoon, renderTripReport, renderUse, renderWeigh, renderWorkRefusal, renderWorkReport } from '../../render.js'

const str = value => (typeof value === 'string' ? value : '')

export function performAction(store, action) {
  const state = store.freshen()
  if (state === null) return { kind: 'error', text: renderNoPig('pig') }
  const result = store.act(action)
  if (!result.ok) {
    if (result.reason === 'cooldown') return { kind: 'success', text: renderTooSoon(state, Date.now(), action) }
    if (result.reason === 'away') return { kind: 'success', text: renderWorkRefusal(state, `${state.name} 正在外面，回来再说。`) }
    if (result.reason === 'dead') return { kind: 'error', text: `${state.name} 已经走了…用 ${REVIVE_ITEM.label} 可以救回来。` }
    if (result.reason === 'absent') return { kind: 'error', text: renderNoPig('pig') }
    return { kind: 'error', text: `🐖 ${ACTIONS[action]?.label ?? action} 没做成。` }
  }
  return { kind: 'success', text: renderAction(store.freshen(), Date.now(), action, result.crossed) }
}

export function dispatch(store, commandName, rawInput) {
  const trimmed = rawInput.trim()
  const [sub, ...rest] = trimmed === '' ? [''] : trimmed.split(/\s+/)
  const argument = rest.join(' ')
  const state = store.freshen()
  const nowMs = Date.now()
  const verb = sub.toLowerCase()

  switch (verb) {
    case '':
    case 'status': {
      if (state === null) return { kind: 'success', text: renderNoPig(commandName) }
      return { kind: 'success', text: renderStatus(state, nowMs) }
    }
    case 'hatch': {
      if (store.hatch()) return { kind: 'success', text: renderHatch(store.state, nowMs) }
      const existing = store.freshen()
      return { kind: 'success', text: `这里已经住着 ${existing.name} 了 🐖\n\n${renderStatus(existing, nowMs)}` }
    }
    case 'feed':
    case 'bathe':
    case 'play':
    case 'pet':
    case 'mo':
      return performAction(store, verb === 'mo' ? 'pet' : verb)

    case 'work': {
      if (state === null) return { kind: 'error', text: renderNoPig(commandName) }
      const key = argument.trim() === '' ? 'odd' : argument.trim()
      const job = JOBS.find(j => j.key === key || j.label === key)
      if (job === undefined) return { kind: 'error', text: `没有「${key}」这份工作。/${commandName} work 看有哪些。` }
      const result = store.startWork(job.key)
      if (!result.ok) return { kind: 'success', text: renderWorkRefusal(state, refusalText(result, state)) }
      return { kind: 'success', text: renderWorkReport(store.freshen(), Date.now(), job) }
    }

    case 'study': {
      if (state === null) return { kind: 'error', text: renderNoPig(commandName) }
      // B4: a subject's stage follows from its lesson count, so only the subject is named.
      const [subjectArg = ''] = argument.trim().split(/\s+/)
      const subject = SUBJECTS.find(s => s.key === subjectArg || s.label === subjectArg)
      if (subject === undefined) {
        return { kind: 'error', text: `用法：/${commandName} study <科目>\n科目：${SUBJECTS.map(s => s.label).join(' · ')}` }
      }
      const stage = stageForNextLesson(state.lessons?.[subject.key] ?? 0)
      const result = store.startStudy(subject.key)
      if (!result.ok) return { kind: 'success', text: renderWorkRefusal(state, refusalText(result, state)) }
      return { kind: 'success', text: renderStudyReport(store.freshen(), Date.now(), subject, stage) }
    }

    case 'trip':
    case 'travel': {
      if (state === null) return { kind: 'error', text: renderNoPig(commandName) }
      const key = argument.trim() === '' ? 'suburb' : argument.trim()
      const trip = TRIPS.find(t => t.key === key || t.label === key)
      if (trip === undefined) return { kind: 'error', text: `没有「${key}」这个目的地。/${commandName} trip 看有哪些。` }
      const result = store.startTrip(trip.key)
      if (!result.ok) return { kind: 'success', text: renderWorkRefusal(state, refusalText(result, state)) }
      return { kind: 'success', text: renderTripReport(store.freshen(), Date.now(), trip) }
    }

    case 'calloff': {
      const result = store.callOffActivity()
      if (!result.ok) return { kind: 'success', text: `${state?.name ?? '猪'} 没在外面。` }
      return {
        kind: 'success',
        text: result.refunded > 0
          ? `${state.name} 提前回来了，退回 ${result.refunded} 金币。`
          : `${state.name} 提前回来了，这趟白跑。`,
      }
    }

    case 'shop': {
      const lines = SHOP.map(item => `  ${item.emoji} ${item.label}  ${item.price} 金币`).join('\n')
      return { kind: 'success', text: `🛒 商店（你有 ${state?.coins ?? 0} 金币）\n${lines}\n\n买：/${commandName} buy <物品>` }
    }
    case 'buy': {
      if (state === null) return { kind: 'error', text: renderNoPig(commandName) }
      const item = SHOP.find(i => i.key === argument.trim() || i.label === argument.trim())
      if (item === undefined) return { kind: 'error', text: `没有「${argument}」这样东西。/${commandName} shop 看货架。` }
      return { kind: 'success', text: renderBuy(store.freshen(), store.buy(item.key), item) }
    }
    case 'use': {
      if (state === null) return { kind: 'error', text: renderNoPig(commandName) }
      const item = SHOP.find(i => i.key === argument.trim() || i.label === argument.trim())
      if (item === undefined) return { kind: 'error', text: `没有「${argument}」这样东西。` }
      return { kind: 'success', text: renderUse(store.freshen(), store.useItem(item.key), item) }
    }
    case 'interest': {
      if (state === null) return { kind: 'error', text: renderNoPig(commandName) }
      const interest = INTERESTS.find(i => i.key === argument.trim() || i.label === argument.trim())
      if (interest === undefined) {
        const names = INTERESTS.map(i => `${i.label}(${i.key})`).join(' · ')
        return { kind: 'error', text: `没有「${argument}」这门兴趣课。可选：${names}` }
      }
      const result = store.startInterest(interest.key)
      if (!result.ok) return { kind: 'error', text: refusalText(result, state) }
      return { kind: 'success', text: `${state.name} 去上${interest.label}课了，${interest.minutes} 分钟后回来。` }
    }
    case 'sell': {
      if (state === null) return { kind: 'error', text: renderNoPig(commandName) }
      const wanted = argument.trim()
      const owned = state.souvenirs.find(entry => entry.key === wanted || entry.label === wanted)
      if (owned === undefined) return { kind: 'error', text: `收藏里没有「${wanted}」。` }
      const result = store.sellSouvenir(owned.key)
      if (!result.ok) return { kind: 'error', text: refusalText(result, state) }
      return { kind: 'success', text: `卖掉了「${result.sold.label}」，得到 ${result.sold.price} 金币。` }
    }
    case 'wear': {
      if (state === null) return { kind: 'error', text: renderNoPig(commandName) }
      const [wanted, mode] = argument.trim().split(/\s+/)
      const item = SHOP.find(i => i.kind === 'dress' && (i.key === wanted || i.label === wanted))
      if (item === undefined) return { kind: 'error', text: `没有「${wanted}」这件家当。` }
      const on = mode !== 'off' && mode !== '脱'
      const result = store.wear(item.key, on)
      if (!result.ok) return { kind: 'error', text: refusalText(result, state) }
      return { kind: 'success', text: `${state.name} ${on ? '穿上' : '脱下'}了「${item.label}」。` }
    }
    case 'adopt': {
      if (state === null) return { kind: 'error', text: renderNoPig(commandName) }
      if (!store.adopt()) return { kind: 'error', text: `${state.name} 还在，不能领养新的 —— 只有墓碑之后才能。` }
      return { kind: 'success', text: '门口放了一个新纸盒 📦 用它继续吧。' }
    }
    case 'reply': {
      if (state === null) return { kind: 'error', text: renderNoPig(commandName) }
      const open = state.dialogue?.open ?? null
      if (open === null) return { kind: 'error', text: `${state.name} 现在没在说话。` }
      const index = Number.parseInt(argument.trim(), 10)
      if (!Number.isInteger(index) || index < 1) {
        const labels = open.replies.map((reply, i) => `${i + 1}=${reply.label}`).join(' · ')
        return { kind: 'error', text: `用法：/${commandName} reply <序号>（${labels}）` }
      }
      const result = store.reply(open.id, index - 1)
      if (!result.ok) return { kind: 'error', text: refusalText(result, state) }
      return { kind: 'success', text: `你说「${result.reply}」，${state.name} 很开心。` }
    }
    case 'weigh': {
      if (state === null) return { kind: 'error', text: renderNoPig(commandName) }
      return { kind: 'success', text: renderWeigh(state, nowMs) }
    }
    case 'name': {
      if (state === null) return { kind: 'error', text: renderNoPig(commandName) }
      const cleaned = store.rename(argument)
      if (cleaned === null) return { kind: 'error', text: `用法：/${commandName} name <名字>（16 字以内）` }
      return { kind: 'success', text: `从今天起，它叫「${cleaned}」🐖` }
    }
    case 'crown': {
      if (state === null) return { kind: 'error', text: renderNoPig(commandName) }
      const wanted = argument === '' ? undefined : (FORMS.find(form => form.label === argument || form.key === argument)?.key ?? argument)
      const result = store.crown(wanted)
      if (result.ok) return { kind: 'success', text: `${formByKey(result.form)?.emoji ?? '👑'} ${state.name} 现在是${formByKey(result.form)?.label ?? ''}了。\n` + renderStatus(store.freshen(), nowMs) }
      if (result.reason === 'already') return { kind: 'success', text: `${state.name} 已经是${formByKey(result.form)?.label ?? '这个形态'}了。` }
      if (result.reason === 'needs-item') return { kind: 'error', text: '背包里没有王冠，去商店「✨ 晋升」货架买一顶再加冕。' }
      if (result.reason === 'coronation-ineligible') {
        const rows = result.missing.map(row => `${row.label} ${row.have}/${row.need}`).join(' · ')
        return { kind: 'error', text: `还差一点：${rows}` }
      }
      if (result.reason === 'unknown') return { kind: 'error', text: `没有这种形态。可选：${FORMS.map(form => form.label).join(' · ')}` }
      return { kind: 'error', text: refusalText(result, state) }
    }
    case 'about':
    case 'help':
      return { kind: 'success', text: renderAbout(commandName) }
    default:
      return {
        kind: 'error',
        text: `不认识「${sub}」。可用：/${commandName} · hatch · adopt · feed · bathe · play · pet · study · interest · work · trip · calloff · shop · buy · use · sell · wear · crown · weigh · name · reply · about`,
      }
  }
}

function refusalText(result, state) {
  switch (result.reason) {
    case 'dead': return `${state.name} 已经走了…`
    case 'away': return `${state.name} 已经在外面了。`
    case 'sick': return `${state.name} 病着，不能出门 —— 先治好它。`
    case 'hungry': return `${state.name} 太饿了，先喂点东西。`
    case 'poor': return `钱不够，需要 ${result.price} 金币，你只有 ${state.coins}。`
    case 'underqualified': {
      const want = (result.missing ?? []).map(entry => `${entry.emoji} ${entry.label} ${entry.need}（现在 ${entry.have}）`).join('、')
      return `这份工作还轮不到它 —— 需要 ${want}。去「学习」上课就能涨。`
    }
    case 'wrong-stage':
      return `${result.stage}没有「${result.subject}」这门课 —— 换个学段，或者换一门课。`
    case 'locked': {
      const need = result.need
      return need === null || need === undefined
        ? '这一级还没解锁 —— 先把上一级的课念完。'
        : `要先念完${need.label}（${need.done}/${need.need}）。`
    }
    case 'box': return '先把纸盒拆开。'
    case 'needs-contract': return `${state.name} 要变成${formByKey(result.form)?.label ?? '恶魔猪'}得签约，去「商店」的晋升货架买恶魔契约。`
    case 'not-owned': return `${state.name} 还没有这件东西。`
    case 'owned': return `${state.name} 已经有这件了。`
    case 'low-level': return `等级不够（要 Lv.${result.need}，现在 Lv.${result.have}）。`
    case 'stale-line': return `${state.name} 已经在说下一句了。`
    case 'unknown': return '没有这个选项。'
    default: return '现在没法出门。'
  }
}

export { jobByKey, MAX, SHOP, JOBS, SUBJECTS, SCHOOL_STAGES, TRIPS, TRAITS, TRAIT_ORDER }

/**
 * Register the `/pig` fallback command. The GUI is the primary path; this is
 * what still works when the panel cannot mount.
 * @param {object} ctx - plugin context
 * @param {object} store - the pig store
 * @param {string} commandName - validated command name
 */
export function registerSlashCommand(ctx, store, commandName) {
  ctx.inject(['commands'], (commandCtx) => {
    commandCtx.commands.register({
      name: commandName,
      description: 'your pig 🐖: status · study · work · shop · travel · bag',
      input: { hint: '[hatch|feed|bathe|play|pet|study <科目>|work <job>|trip <目的地>|shop|buy|use|weigh|about]' },
      handler: invocation => {
        try {
          return dispatch(store, commandName, String(invocation.rawInput ?? ''))
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error)
          return { kind: 'error', text: `🐖 猪摔了一跤：${detail}` }
        }
      },
    })
  })
}
