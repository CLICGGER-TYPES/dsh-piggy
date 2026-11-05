// @ts-check
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { generateRoomCode, normalizeRoomCode } from '../lib/room-code.js'
import {
  ROOM_MAX_PLAYERS, normalizeEmote, normalizePosition, normalizeProfile, parseRoomInput, publicPlayer,
} from '../lib/room-protocol.js'
import { broadcastAddress, discoveryBroadcasts, discoveryProbe, discoveryReply } from '../lib/room-discovery.js'

test('房间码只用不易混淆的字符，并接受常见写法', () => {
  assert.equal(generateRoomCode(() => Buffer.from([0, 1, 31, 32])), '23Z2')
  assert.equal(generateRoomCode(() => Buffer.from([255, 254, 100, 60])), 'ZY6W')
  assert.equal(normalizeRoomCode('7k2m'), '7K2M')
  assert.equal(normalizeRoomCode('PIG-7K2M'), '7K2M')
  assert.equal(normalizeRoomCode(' pig 7k2m '), '7K2M')
  assert.equal(normalizeRoomCode('PIG-0000'), null)
  assert.equal(normalizeRoomCode('ABC'), null)
  assert.equal(normalizeRoomCode('ABCDE'), null)
  assert.equal(normalizeRoomCode(null), null)
  assert.ok(ROOM_MAX_PLAYERS >= 8)
})

test('玩家外观只保留房间需要的字段，并对长度/路径做边界检查', () => {
  const profile = normalizeProfile({
    name: '  猪猪   大王  ', level: 60, stage: 'piglet',
    art: 'pigs/base/piglet/idle.png?v=abc123', emoji: '🐖', size: 9, label: '小猪',
  })
  assert.deepEqual(profile, {
    name: '猪猪 大王', level: 60, stage: 'piglet',
    art: 'pigs/base/piglet/idle.png?v=abc123', emoji: '🐖', size: 1.6, label: '小猪',
  })
  assert.throws(() => normalizeProfile({ name: '   ', level: 1 }))
  assert.throws(() => normalizeProfile({ name: '猪', level: 0 }))
  assert.throws(() => normalizeProfile({ name: '猪', level: 1.5 }))
  assert.equal(normalizeProfile({ name: '猪', level: 1, art: '../../etc/passwd' }).art, '')
  assert.equal(normalizeProfile({ name: '猪', level: 1, art: 'custom-mine' }).art, 'custom-mine')
  assert.equal(normalizeProfile({ name: '猪', level: 1, stage: 'BAD STAGE' }).stage, 'piglet')
})

test('位置与表情只接受房间支持的取值', () => {
  assert.deepEqual(normalizePosition(-3, -1), { x: 0, facing: -1 })
  assert.deepEqual(normalizePosition(3, 1), { x: 1, facing: 1 })
  assert.deepEqual(normalizePosition(0.4567, 0), { x: 0.457, facing: 1 })
  assert.throws(() => normalizePosition(Number.NaN, 1))
  assert.equal(normalizeEmote('wave'), 'wave')
  assert.equal(normalizeEmote('pat'), 'pat')
  assert.equal(normalizeEmote('explode'), '')
})

test('加入输入支持房间码和完整邀请串，拒绝公网地址', () => {
  assert.deepEqual(parseRoomInput('7K2M'), { ok: true, code: '7K2M' })
  assert.equal(parseRoomInput('PIG-0000').ok, false)
  assert.deepEqual(parseRoomInput('piggy://192.168.1.20:53421#PIG-7K2M'),
    { ok: true, code: '7K2M', address: '192.168.1.20', port: 53421 })
  assert.equal(parseRoomInput('piggy://8.8.8.8:53421#PIG-7K2M').ok, false)
  assert.equal(parseRoomInput('piggy://192.168.1.20:99999#PIG-7K2M').ok, false)
})

test('房间广播地址按网卡子网计算，发现报文格式固定', () => {
  assert.equal(broadcastAddress('192.168.1.20', '255.255.255.0'), '192.168.1.255')
  assert.equal(broadcastAddress('10.1.2.3', '255.255.0.0'), '10.1.255.255')
  assert.equal(broadcastAddress('bad', '255.255.255.0'), null)
  assert.deepEqual(discoveryBroadcasts({
    lo: [{ address: '127.0.0.1', family: 'IPv4', internal: true, netmask: '255.0.0.0' }],
    wifi: [{ address: '192.168.1.20', family: 'IPv4', internal: false, netmask: '255.255.255.0' }],
    eth: [{ address: '10.0.0.5', family: 'IPv4', internal: false, netmask: '255.255.0.0' }],
    v6: [{ address: 'fe80::1', family: 'IPv6', internal: false, netmask: 'ffff::' }],
  }), ['192.168.1.255', '10.0.255.255'])
  assert.equal(discoveryProbe('7K2M'), 'PIGGYROOM/1 7K2M')
  assert.equal(discoveryReply(53421), 'PIGGYROOM/1 53421')
  assert.equal(discoveryReply(53421, '192.168.1.20'), 'PIGGYROOM/1 53421 192.168.1.20')
})

test('公开玩家视图不包含 token 或 clientId', () => {
  const view = publicPlayer({
    id: 'p1', clientId: 'private', token: 'secret', name: '猪猪', level: 9,
    stage: 'piglet', art: '', emoji: '🐖', size: 1, label: '', x: 0.5, facing: 1,
    emote: '', emoteTarget: null, emoteAt: 0, host: true,
  })
  assert.equal(view.id, 'p1')
  assert.equal(view.host, true)
  assert.equal('token' in view, false)
  assert.equal('clientId' in view, false)
})
