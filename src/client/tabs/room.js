// @ts-check
/**
 * 主屏「联机」：大厅（创建/加入）和房间状态。真正的草地场景在独立房间窗口里，
 * 面板只做入口和状态，避免把 368px 的面板撑成大厅。
 * @module dsh-piggy/client/tabs/room
 */
import { artSource } from '../art-path.js'
import { button, el } from '../dom.js'
import { roomBridge } from '../room-bridge.js'

/** @type {any} */
let cached = null
let fetchedAt = 0
let loading = false
let generation = 0
/** @type {any} */
let activeUi = null
let joinMode = false
let focusJoin = false
let busy = false
let notice = ''
let subscribed = false

function signature(value) {
  if (value === null || typeof value !== 'object') return ''
  const players = Array.isArray(value.players)
    ? value.players.map(player => [player.id, player.name, player.level, player.x, player.host,
      player.care?.satiety, player.care?.cleanliness, player.care?.happiness].join(':')).join(',')
    : ''
  return [value.inRoom, value.hosting, value.code, value.selfId, players].join('|')
}

function subscribe(bridge) {
  if (subscribed) return
  subscribed = true
  if (typeof bridge.onUpdate === 'function') {
    bridge.onUpdate(function (snapshot) {
      generation += 1
      const before = signature(cached)
      cached = snapshot
      fetchedAt = Date.now()
      if (signature(snapshot) !== before) activeUi?.renderContent?.()
    })
  }
  if (typeof bridge.onClosed === 'function') {
    bridge.onClosed(function (detail) {
      generation += 1
      cached = { ok: true, inRoom: false }
      fetchedAt = Date.now()
      notice = detail?.reason === 'host-left' || detail?.reason === 'room-closed'
        ? '房主关闭了房间'
        : detail?.reason === 'connection-lost' ? '和房间断开了' : ''
      activeUi?.renderContent?.()
    })
  }
}

function refresh(ui, bridge) {
  subscribe(bridge)
  if (loading) return
  if (cached !== null && Date.now() - fetchedAt < 3000) return
  loading = true
  const requestGeneration = generation
  Promise.resolve(bridge.status()).then(function (status) {
    loading = false
    fetchedAt = Date.now()
    if (requestGeneration !== generation) return
    const before = signature(cached)
    if (status !== null && typeof status === 'object') cached = status
    if (signature(cached) !== before) ui.renderContent()
  }).catch(function () {
    loading = false
    fetchedAt = Date.now()
  })
}

function actionOf(ui, key) {
  const action = ui.view?.actions?.[key] ?? {}
  const wait = Number(action.waitSeconds)
  return {
    ready: action.ready !== false,
    waitSeconds: Number.isFinite(wait) ? Math.max(0, Math.min(3600, Math.round(wait))) : 0,
    blocked: action.blocked === 'away' || action.blocked === 'hungry' ? action.blocked : null,
  }
}

function profileOf(ui) {
  const pig = ui.view?.pig
  const stage = pig?.stage
  let art = ''
  try {
    const source = artSource(stage?.art)
    art = source.startsWith('/dsh-piggy/art/') ? source.slice('/dsh-piggy/art/'.length) : ''
  } catch { art = '' }
  return {
    name: typeof pig?.name === 'string' ? pig.name : '小猪',
    level: Number(pig?.level?.level) || 1,
    stage: stage?.key ?? 'piglet',
    art,
    emoji: typeof stage?.emoji === 'string' ? stage.emoji : '🐖',
    size: Number.isFinite(Number(stage?.size)) && Number(stage?.size) > 0 ? Number(stage.size) / 60 : 1,
    label: stage?.label ?? '',
    mood: typeof pig?.mood === 'string' ? pig.mood : '',
    moodLabel: typeof pig?.moodLabel === 'string' ? pig.moodLabel : '',
    care: {
      satiety: Number(pig?.satiety) || 0,
      cleanliness: Number(pig?.cleanliness) || 0,
      happiness: Number(pig?.happiness) || 0,
    },
    actions: Object.fromEntries(['feed', 'bathe', 'play', 'pet'].map(key => [key, actionOf(ui, key)])),
    status: {
      level: pig?.level ?? null,
      health: Number(pig?.health) || 0,
      healthPercent: Number(pig?.healthPercent) || 0,
      maxHealth: Number(ui.view?.maxHealth) || 5,
      traits: pig?.traits ?? null,
      weight: typeof pig?.weight === 'string' ? pig.weight : '',
      bodyWeight: pig?.bodyWeight ?? null,
      mood: typeof pig?.mood === 'string' ? pig.mood : '',
      moodLabel: typeof pig?.moodLabel === 'string' ? pig.moodLabel : '',
      illness: pig?.illness ?? null,
    },
    card: {
      birthday: typeof ui.view?.profile?.birthday === 'string' ? ui.view.profile.birthday : '',
      zodiac: ui.view?.profile?.zodiac ?? null,
      personality: ui.view?.profile?.personality ?? null,
      catchphrase: typeof ui.view?.profile?.catchphrase === 'string' ? ui.view.profile.catchphrase : '',
      motto: typeof ui.view?.profile?.motto === 'string' ? ui.view.profile.motto : '',
      counts: ui.view?.profile?.counts ?? null,
    },
  }
}

function statusLine(ui) {
  const line = el('div', 'dp-room-status')
  line.appendChild(el('i', 'dp-room-dot'))
  line.appendChild(el('span', null, '同一局域网 · 和好友一起玩'))
  ui.content.appendChild(line)
}

function errorLine(ui, text) {
  if (text === '') return
  const row = el('div', 'dp-room-error', text)
  ui.content.appendChild(row)
}

function renderLobby(ui, bridge) {
  const hero = el('div', 'dp-room-hero')
  const banner = /** @type {HTMLImageElement} */ (el('img', 'dp-room-hero-art'))
  banner.src = '/dsh-piggy/art/room-lobby.png'
  banner.alt = ''
  banner.draggable = false
  const fallback = el('div', 'dp-room-pigs')
  ;['a', 'b', 'c'].forEach(function (tone) {
    const wrap = el('span', 'dp-room-pig dp-room-pig-' + tone, '🐖')
    fallback.appendChild(wrap)
  })
  fallback.hidden = true
  banner.addEventListener('error', function () {
    banner.hidden = true
    fallback.hidden = false
  })
  hero.appendChild(banner)
  hero.appendChild(fallback)
  hero.appendChild(el('p', 'dp-room-intro', '联机后，朋友的猪会直接出现在你的桌面上。'))
  ui.content.appendChild(hero)

  const actions = el('div', 'dp-room-actions')
  const create = button('dp-mini dp-room-create', { 'data-room-create': 'true' }, function () {
    if (busy) return
    busy = true
    notice = ''
    Promise.resolve(bridge.host(profileOf(ui))).then(function (result) {
      busy = false
      if (result?.ok === true) {
        generation += 1
        cached = result
        fetchedAt = Date.now()
        // 创建后先留在面板：让房主先复制房间码/邀请串，准备好再手动进房间。
      } else {
        notice = typeof result?.reason === 'string' ? result.reason : '创建房间失败'
      }
      ui.renderContent()
    }).catch(function () {
      busy = false
      notice = '创建房间失败'
      ui.renderContent()
    })
  })
  create.textContent = busy ? '正在创建…' : '创建房间'
  actions.appendChild(create)

  const joinToggle = button('dp-mini dp-mini-plain dp-room-join-toggle', { 'data-room-join-toggle': 'true' }, function () {
    joinMode = !joinMode
    focusJoin = joinMode
    notice = ''
    ui.renderContent()
  })
  joinToggle.textContent = joinMode ? '收起' : '加入房间'
  actions.appendChild(joinToggle)
  ui.content.appendChild(actions)

  if (joinMode) {
    const form = el('div', 'dp-room-form')
    const input = /** @type {HTMLInputElement} */ (el('input', 'dp-room-input'))
    input.type = 'text'
    input.maxLength = 512
    input.placeholder = '输入房间码，例如 7K2M'
    input.autocomplete = 'off'
    input.spellcheck = false
    input.setAttribute('data-room-input', 'true')
    form.appendChild(input)
    const submit = button('dp-mini dp-room-join', { 'data-room-join': 'true' }, function () {
      if (busy) return
      const text = input.value.trim()
      if (text === '') { notice = '先输入房间码'; ui.renderContent(); return }
      busy = true
      notice = ''
      Promise.resolve(bridge.join(text, profileOf(ui))).then(function (result) {
        busy = false
        if (result?.ok === true) {
          generation += 1
          cached = result
          fetchedAt = Date.now()
          joinMode = false
        } else {
          notice = typeof result?.reason === 'string' ? result.reason : '加入房间失败'
        }
        ui.renderContent()
      }).catch(function () {
        busy = false
        notice = '加入房间失败'
        ui.renderContent()
      })
    })
    submit.textContent = busy ? '加入中…' : '加入'
    form.appendChild(submit)
    ui.content.appendChild(form)
    ui.content.appendChild(el('p', 'dp-room-note', '也可以粘贴完整邀请串 piggy://…'))
    if (focusJoin) {
      focusJoin = false
      setTimeout(function () { try { input.focus() } catch { /* 面板可能已经关了 */ } }, 0)
    }
  }

  statusLine(ui)
  errorLine(ui, notice)
}

function renderRoom(ui, bridge, status) {
  const card = el('div', 'dp-room-card')
  const top = el('div', 'dp-room-card-top')
  top.appendChild(el('b', 'dp-room-card-title', status.hosting ? '你的房间' : '已加入房间'))
  top.appendChild(el('span', 'dp-room-card-hosting', status.hosting ? '房主' : '客人'))
  card.appendChild(top)

  const codeRow = el('div', 'dp-room-code-row')
  const code = el('span', 'dp-room-code', 'PIG-' + status.code)
  codeRow.appendChild(code)
  const copy = button('dp-mini dp-mini-plain dp-room-copy', { 'data-room-copy': 'true' }, function () {
    Promise.resolve(bridge.copy()).then(function (result) {
      notice = result?.ok === true ? '房间码已复制' : '复制失败'
      ui.renderContent()
    }).catch(function () {
      notice = '复制失败'
      ui.renderContent()
    })
  })
  copy.textContent = '复制'
  codeRow.appendChild(copy)
  card.appendChild(codeRow)
  card.appendChild(el('p', 'dp-room-hint', '同一局域网的朋友输入这个房间码就能加入'))

  const players = Array.isArray(status.players) ? status.players : []
  const list = el('div', 'dp-room-players')
  players.slice(0, 6).forEach(function (player) {
    const row = el('div', 'dp-room-player')
    row.appendChild(el('span', 'dp-room-player-dot'))
    row.appendChild(el('span', 'dp-room-player-name', player.name + ' Lv.' + player.level))
    if (player.id === status.selfId) row.appendChild(el('span', 'dp-room-player-tag', '你'))
    else if (player.host === true) row.appendChild(el('span', 'dp-room-player-tag host', '房主'))
    list.appendChild(row)
  })
  if (players.length > 6) list.appendChild(el('div', 'dp-room-player more', '+ ' + (players.length - 6) + ' 只猪'))
  card.appendChild(list)
  ui.content.appendChild(card)

  const actions = el('div', 'dp-room-actions')
  const leave = button('dp-mini dp-mini-plain', { 'data-room-leave': 'true' }, function () {
    if (busy) return
    busy = true
    Promise.resolve(bridge.leave()).then(function () {
      busy = false
      generation += 1
      cached = { ok: true, inRoom: false }
      fetchedAt = Date.now()
      notice = ''
      ui.renderContent()
    }).catch(function () {
      busy = false
      notice = '离开房间失败'
      ui.renderContent()
    })
  })
  leave.textContent = '离开房间'
  actions.appendChild(leave)
  ui.content.appendChild(actions)
  ui.content.appendChild(el('p', 'dp-room-note', '朋友的猪会待在你的桌面上；离开联机会一起收起'))
  errorLine(ui, notice)
}

export function renderRoomTab(ui) {
  activeUi = ui
  const bridge = roomBridge()
  if (bridge === null) {
    ui.content.appendChild(el('div', 'dp-room-error', '联机需要桌面版 0.6.8 以上；网页版暂不支持。'))
    return
  }
  refresh(ui, bridge)
  if (cached !== null && cached.inRoom === true) renderRoom(ui, bridge, cached)
  else renderLobby(ui, bridge)
}
