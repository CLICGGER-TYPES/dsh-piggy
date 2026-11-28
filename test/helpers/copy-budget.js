#!/usr/bin/env node
// @ts-check
/**
 * 文案预算：把左轮轮盘所有可渲染界面挂到假 DOM 上，逐条检查直接文本，
 * 单条中文字 ≤ 18。规则页是长文说明，单独排除；按钮、提示、空态、toast 都算。
 *
 * 用法：node test/helpers/copy-budget.js
 */
import { mountRoulette } from './roulette.js'

export const MAX_COPY_CJK = 18

const CJK = /[\u3400-\u9fff]/g
export const cjkCount = text => (String(text).match(CJK) ?? []).length

/** 假房间：够 online-pages 画出大厅各分支。 */
function fakeRoom(options = {}) {
  const players = options.players ?? [
    { id: 'host-1', name: '房主', host: true },
    { id: 'guest-1', name: '客人', host: false },
  ]
  return {
    hosting: options.hosting ?? true,
    selfId: options.selfId ?? 'host-1',
    snapshot: {
      ok: true, inRoom: true, hosting: options.hosting ?? true,
      authority: options.authority ?? 'host', selfId: options.selfId ?? 'host-1',
      code: 'PIG-7K2M', caps: ['game'], gameEvents: [], players,
    },
    status() { return Promise.resolve(this.snapshot) },
    onUpdate() {},
    onClosed() {},
    send() { return Promise.resolve({ ok: true, version: 1, eventId: 1 }) },
  }
}

/** @param {any} m */
function collect(m) {
  const rows = []
  m.dom.body.walk(node => {
    if (!node._text || !String(node._text).trim()) return
    for (let parent = node; parent; parent = parent.parentNode) {
      if (String(parent.className).split(/\s+/).includes('rt-rules')) return
    }
    const text = String(node._text).replace(/\s+/g, ' ').trim()
    if (cjkCount(text) === 0) return
    rows.push({ cls: String(node.className).split(/\s+/).slice(0, 2).join('.'), text, cjk: cjkCount(text) })
  })
  return rows
}

/** 收集所有能走到的左轮界面文案。 */
export async function collectCopy() {
  const all = []
  const add = (page, m) => {
    for (const row of collect(m)) all.push({ page, ...row })
  }

  add('table-setup', mountRoulette())

  const arming = mountRoulette()
  arming.click('data-op', 'settings-toggle')
  arming.click('data-op', 'load-5')
  arming.click('data-op', 'start')
  arming.click('data-op', 'load-random')
  add('table-arming', arming)

  const choice = mountRoulette()
  choice.click('data-op', 'settings-toggle')
  choice.click('data-op', 'load-5')
  choice.click('data-op', 'start')
  choice.click('data-op', 'load-random')
  choice.click('data-op', 'spin')
  choice.runTimers(1)
  add('table-choice', choice)

  const menu = mountRoulette()
  menu.click('data-op', 'more')
  add('menu', menu)
  menu.click('data-op', 'four-mode')
  add('menu-four-mode', menu)

  const confirm = mountRoulette()
  confirm.click('data-op', 'start')
  confirm.click('data-op', 'load-random')
  confirm.click('data-op', 'spin')
  confirm.runTimers(2)
  confirm.data.match.stage = 'choice'
  confirm.data.match.turn = 'you'
  confirm.sync()
  confirm.click('data-op', 'more')
  confirm.click('data-op', 'forfeit')
  add('forfeit-confirm', confirm)

  const over = mountRoulette()
  over.click('data-op', 'start')
  over.data.match.stage = 'matchOver'
  over.data.match.outcome = 'win'
  over.sync()
  add('table-result', over)

  // 联机大厅：无房间、超员、无权威、等人、房主设置、客人等待。
  const states = [
    { page: 'online-no-room', room: null },
    { page: 'online-over-two', room: fakeRoom({ players: [
      { id: 'host-1', name: '房主', host: true }, { id: 'guest-1', name: '客人' }, { id: 'guest-2', name: '第三人' },
    ] }) },
    { page: 'online-no-authority', room: fakeRoom({ hosting: false, authority: 'none' }) },
    { page: 'online-waiting', room: fakeRoom({ players: [{ id: 'host-1', name: '房主', host: true }] }) },
    { page: 'online-host', room: fakeRoom() },
  ]
  for (const state of states) {
    const m = mountRoulette()
    if (state.room) m.app.room = state.room
    m.click('data-op', 'more')
    m.click('data-op', 'friend-mode')
    await Promise.resolve()
    await Promise.resolve()
    add(state.page, m)
  }

  return all
}

/** @param {{cjk:number}[]} rows */
export function violationsOf(rows) {
  return rows.filter(row => row.cjk > MAX_COPY_CJK).sort((a, b) => b.cjk - a.cjk)
}

const invokedDirectly = process.argv[1] !== undefined
  && process.argv[1].endsWith('copy-budget.js')
if (invokedDirectly) {
  const rows = await collectCopy()
  const violations = violationsOf(rows)
  const longest = rows.slice().sort((a, b) => b.cjk - a.cjk || a.text.localeCompare(b.text)).slice(0, 8)
  console.log(JSON.stringify({ budget: MAX_COPY_CJK, checked: rows.length, violations: violations.length, worst: violations.slice(0, 10), longest }, null, 2))
}
