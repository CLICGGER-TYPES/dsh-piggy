// @ts-check
/** 房间 IPC 的来源边界：联机牌桌（扩展大窗口）只能查状态、发游戏消息、离开和复制邀请。 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { registerRoomIpc } from '../lib/ipc/room.js'

test('扩展大窗口的联机权限：状态/游戏/离开/复制放行，建房/移动仍归面板和房间窗口', async () => {
  const handlers = new Map()
  const calls = []
  const manager = {
    status: () => ({ ok: true, inRoom: true, code: '7K2M', invite: '' }),
    host: () => { calls.push('host'); return { ok: true } },
    join: () => { calls.push('join'); return { ok: true } },
    move: () => { calls.push('move'); return { ok: true } },
    emote: () => ({ ok: true }),
    game: input => { calls.push(['game', input]); return { ok: true, version: 9, eventId: 4 } },
    leave: () => { calls.push('leave'); return { ok: true } },
  }
  registerRoomIpc({
    ipcMain: { handle: (channel, listener) => handlers.set(channel, listener) },
    fromPanelOnly: event => event?.panel === true,
    fromRoom: event => event?.room === true,
    fromExt: event => event?.ext === true,
    manager,
    roomWindow: { open: () => {} },
    clipboard: { writeText: text => calls.push(['copy', text]) },
  })
  const call = (channel, event, ...args) => handlers.get(`piggy:room:${channel}`)(event, ...args)
  const ext = { ext: true }

  assert.equal((await call('status', ext)).inRoom, true)
  assert.deepEqual(await call('game', ext, { seq: 1, ext: 'roulette', op: 'action', data: { op: 'arm' } }),
    { ok: true, version: 9, eventId: 4 })
  assert.deepEqual(calls[0], ['game', { seq: 1, ext: 'roulette', op: 'action', data: { op: 'arm' } }])
  assert.equal((await call('leave', ext)).ok, true)
  assert.deepEqual(await call('copy', ext), { ok: true, code: 'PIG-7K2M', invite: false })

  assert.deepEqual(await call('host', ext, {}, {}), { ok: false, reason: '来源不对' })
  assert.deepEqual(await call('join', ext, '7K2M', {}), { ok: false, reason: '来源不对' })
  assert.deepEqual(await call('move', ext, 0.5, 0.5, 1), { ok: false, reason: '来源不对' })
  assert.deepEqual(await call('game', { panel: true }, { seq: 1, ext: 'roulette', op: 'action', data: {} }),
    { ok: false, reason: '来源不对' })
  assert.deepEqual(calls, [
    ['game', { seq: 1, ext: 'roulette', op: 'action', data: { op: 'arm' } }],
    'leave',
    ['copy', 'PIG-7K2M'],
  ])
})
