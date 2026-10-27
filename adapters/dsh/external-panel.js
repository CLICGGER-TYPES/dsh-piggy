// @ts-check
/**
 * 外部模式下面板与命令的代理。
 *
 * 客户端路径不变：宿主把 `/dsh-piggy/state|act|art|ext` 转到配对接口，返回形状
 * 和内嵌模式一致，额外附 `link`。动作/命令失败也返回最后快照 + ok:false。
 *
 * @module dsh-piggy/adapters/dsh/external-panel
 */

import { randomUUID } from 'node:crypto'

import { renderAbout } from '../../render.js'
import { createPairClient } from './external-client.js'
import { PAIR_ACTION_SET, PAIR_COMMAND_SET, commandVerb } from '../../runtime/pair-actions.js'

function textForLast(snapshot) {
  if (snapshot?.pig === undefined || snapshot.pig === null) return '桌宠现在连不上，也没有可显示的快照。'
  const pig = snapshot.pig
  return `${pig.name} · ${pig.stage?.label ?? ''} · Lv.${pig.levelInfo?.level ?? '?'} · 🪙${pig.coins ?? 0}`
}

/**
 * 一份真的面板快照？忙碌/失败的占位正文（{ok:false,reason}）没有 pig，
 * 不能拿来覆盖最后一次真实快照，否则断线时就没东西可显示了。
 */
function isSnapshot(view) {
  return view !== null && typeof view === 'object' && view.ok !== false && 'pig' in view
}

/**
 * 面板快照 → 紧凑摘要，和 /pair/info 的 mergeSummary 同形（名字/等级/金币/物品/徽章…）。
 * 设置卡片和连接选择页读的是这一份；不把整只猪塞进摘要里。不是快照就返回 null。
 * @param {any} view
 */
export function summarizeSnapshot(view) {
  if (!isSnapshot(view)) return null
  const pig = view.pig
  const hatched = view.hatched === true
  const dead = view.dead === true || pig?.dead === true
  const box = hatched !== true && dead !== true
  const body = {
    name: typeof pig?.name === 'string' ? pig.name : '',
    level: Number.isFinite(pig?.levelInfo?.level) ? pig.levelInfo.level : 1,
    days: Number.isFinite(pig?.ageDays) ? Math.floor(pig.ageDays) : 0,
    coins: Number.isFinite(pig?.coins) ? Math.trunc(pig.coins) : 0,
    items: 0,
    badges: 0,
    dead,
    hatched,
    box,
    kind: dead ? 'dead' : box ? 'box' : 'alive',
  }
  // 和 mergeSummary(null) 一致：没有存档时不是纸盒，是「没有猪」。
  if (pig === null || pig === undefined) return { ...body, name: '未孵化', level: 1, box: false, kind: 'none' }
  // 背包在面板里已经按真实的数量表给好了；默认玩具是 Infinity，按 0 算。
  const inventory = view.inventory !== null && typeof view.inventory === 'object' ? view.inventory : {}
  for (const key of Object.keys(inventory)) {
    const count = inventory[key]
    if (typeof count === 'number' && Number.isFinite(count) && count > 0) body.items += Math.trunc(count)
  }
  const achievements = Array.isArray(view.dex?.achievements) ? view.dex.achievements : []
  body.badges = achievements.filter(item => item?.acquired === true).length
  return body
}

export function createExternalPanel(options) {
  const client = createPairClient({ fetch: options.fetch, endpoint: options.endpoint })
  const last = () => options.lastSnapshot()
  const setLast = snapshot => options.setSnapshot(snapshot)

  function link() {
    const status = options.status()
    const snapshot = last()
    return {
      state: status.connection, lastAt: status.lastAt, queued: status.queued,
      merged: status.pigState === 'merged',
      dead: snapshot?.dead === true || snapshot?.pig?.dead === true || status.target?.summary?.dead === true,
    }
  }

  function failed(reason) {
    if (reason === 'disconnected' || reason === 'unauthorized') options.markUnavailable?.(reason)
    return { ...(last() ?? { ok: false }), ok: false, reason, link: link() }
  }

  async function withPair(request) {
    let response = await request()
    if (response.status === 401) {
      options.refreshEndpoints?.()
      response = await request()
    }
    return response
  }

  const noteSummary = snapshot => {
    const summary = summarizeSnapshot(snapshot)
    if (summary !== null) options.noteSummary?.(summary)
  }

  return {
    link,
    async state() {
      try {
        const response = await withPair(() => client.state())
        if (response.status !== 200 || response.json === null) return failed(response.status === 401 ? 'unauthorized' : 'desktop-busy')
        // 桌面在合并/导入的 exclusive 里会给一份没有快照的占位正文：不作数，保留最后一次真实快照。
        if (!isSnapshot(response.json)) {
          const reason = typeof response.json.reason === 'string' && response.json.reason !== '' ? response.json.reason : 'desktop-busy'
          return failed(reason)
        }
        setLast(response.json)
        noteSummary(response.json)
        options.markSeen?.()
        return { ...response.json, link: link() }
      } catch { return failed('disconnected') }
    },
    async act(body) {
      if (!PAIR_ACTION_SET.has(String(body?.action ?? ''))) return { ...(last() ?? { ok: false }), ok: false, reason: 'action-not-allowed', link: link() }
      const requestId = typeof body?.requestId === 'string' && body.requestId !== '' ? body.requestId : randomUUID()
      const payload = { ...body, clientId: options.clientId(), requestId }
      try {
        const response = await withPair(() => client.act(payload))
        if (response.status !== 200 || response.json === null) return failed(response.status === 401 ? 'unauthorized' : 'desktop-busy')
        if (response.json.ok === false) return { ...(last() ?? response.json), ok: false, reason: response.json.reason ?? 'desktop-busy', link: link() }
        if (!isSnapshot(response.json)) return failed('bad-response')
        setLast(response.json)
        noteSummary(response.json)
        options.markSeen?.()
        return { ...response.json, link: link() }
      } catch { return failed('disconnected') }
    },
    async command(input) {
      const verb = commandVerb(input)
      if (verb === 'help' || verb === 'about' || verb === '') {
        return { ok: true, kind: 'success', text: renderAbout('pig') }
      }
      if (verb === 'external') {
        const status = options.status()
        const target = status.target === null ? '桌面版' : `${status.target.appVersion ?? ''}`
        return { ok: true, kind: 'success', text: `外部桌宠：${status.connection}（${target}）\n工作事件排队 ${status.queued} 条。` }
      }
      if (!PAIR_COMMAND_SET.has(verb)) {
        return { ok: true, kind: 'success', text: renderAbout('pig') }
      }
      if (verb === 'status' && link().state !== 'connected') {
        return { ok: true, kind: 'success', text: `${textForLast(last())}\n（桌面版没连上，显示的是最后一次快照；工作事件在排队）` }
      }
      try {
        const requestId = randomUUID()
        const response = await withPair(() => client.command({ clientId: options.clientId(), requestId, input }))
        if (response.status !== 200 || response.json === null || response.json.ok === false) {
          const reason = response.json?.reason ?? (response.status === 401 ? 'unauthorized' : 'disconnected')
          failed(reason)
          return { ok: false, kind: 'error', text: `桌宠没开，工作事件已排队；打开桌面版后再试。动作没有执行。（${reason}）` }
        }
        options.markSeen?.()
        return { ok: true, kind: response.json.kind ?? 'success', text: String(response.json.text ?? '') }
      } catch {
        failed('disconnected')
        return { ok: false, kind: 'error', text: '桌宠没开，工作事件已排队；打开桌面版后再试。动作没有执行。' }
      }
    },
    async art(name) {
      // DSH 侧第一道白名单：只允许快照会出现的立绘名、反馈图、自定义皮肤和动作帧。
      const allowed = /^[a-z][a-z0-9-]{0,63}(?:\.(?:svg|png))?$/.test(name) ||
        /^custom-[a-z0-9-]{1,41}(?:\.(?:png|svg))?$/.test(name) ||
        /^feedback\/[a-z][a-z0-9-]{0,63}\.png$/.test(name) ||
        name === 'animations/piglet-pet/reference.webp' || name === 'animations/pet-hand/hand.webp'
      if (!allowed) return null
      try {
        const response = await withPair(() => client.art(name))
        if (response.status !== 200) return null
        return { body: response.buffer, type: response.headers['content-type'] ?? 'application/octet-stream' }
      } catch { return null }
    },
    async ext(path) {
      if (!/^[a-z0-9-]{2,24}\/(?:client\.js|assets\/[a-z0-9][a-z0-9-]{0,47}\.(?:webp|png))$/.test(path)) return null
      try {
        const response = await withPair(() => client.ext(path))
        if (response.status !== 200) return null
        return { body: response.buffer, type: response.headers['content-type'] ?? 'application/octet-stream' }
      } catch { return null }
    },
    online() {
      // 外部模式不代理在线扩展目录：只显示已安装扩展和开关，隐藏下载按钮。
      return { entries: [], external: true, disabled: true }
    },
  }
}
