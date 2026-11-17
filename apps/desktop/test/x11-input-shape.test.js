// @ts-check
/** niri/XWayland 输入区域：X11 协议编码与最小客户端。 */
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { test } from 'node:test'

import {
  createX11InputShape, encodeQueryExtension, encodeSetup, encodeShapeInput, parseDisplay, xidOf,
} from '../lib/x11-input-shape.js'

function setupReply(success = 1) {
  const buffer = Buffer.alloc(8)
  buffer.writeUInt8(success, 0)
  buffer.writeUInt16LE(0, 6)
  return buffer
}

function extensionReply(present = 1, major = 130) {
  const buffer = Buffer.alloc(32)
  buffer.writeUInt8(1, 0)
  buffer.writeUInt8(present, 8)
  buffer.writeUInt8(major, 9)
  return buffer
}

function fakeSocket() {
  const socket = new EventEmitter()
  socket.writes = []
  socket.destroyed = false
  socket.setNoDelay = () => {}
  socket.write = chunk => { socket.writes.push(Buffer.from(chunk)); return true }
  socket.destroy = () => { socket.destroyed = true }
  return socket
}

const fakeWindow = { getNativeWindowHandle: () => { const b = Buffer.alloc(4); b.writeUInt32LE(0x400004); return b } }

test('parseDisplay：只接受本地 X display', () => {
  assert.deepEqual(parseDisplay(':0')?.paths, ['/tmp/.X11-unix/X0', '\0/tmp/.X11-unix/X0'])
  assert.equal(parseDisplay('unix:1')?.number, 1)
  assert.equal(parseDisplay('localhost:2.0')?.number, 2)
  assert.equal(parseDisplay('otherhost:0'), null)
  assert.equal(parseDisplay('nonsense'), null)
})

test('encodeShapeInput：ShapeSet/ShapeInput/物理像素矩形', () => {
  const bytes = encodeShapeInput(0x400004, [{ x: 10, y: 20, width: 30, height: 40 }], 1.5, 130)
  assert.equal(bytes.readUInt8(0), 130)
  assert.equal(bytes.readUInt8(1), 1)
  assert.equal(bytes.readUInt8(4), 0, 'op = ShapeSet')
  assert.equal(bytes.readUInt8(5), 2, 'destKind = ShapeInput')
  assert.equal(bytes.readUInt32LE(8), 0x400004)
  assert.equal(bytes.readInt16LE(16), 15)
  assert.equal(bytes.readInt16LE(18), 30)
  assert.equal(bytes.readUInt16LE(20), 45)
  assert.equal(bytes.readUInt16LE(22), 60)
  assert.equal(bytes.readUInt16LE(2), bytes.length / 4)
  assert.deepEqual([...encodeShapeInput(0x1, [], 1).subarray(16, 24)], [0, 0, 0, 0, 1, 0, 1, 0])
})

test('xidOf / encodeSetup / encodeQueryExtension 的基本形状', () => {
  assert.equal(xidOf(fakeWindow), 0x400004)
  assert.equal(xidOf({ getNativeWindowHandle: () => Buffer.alloc(0) }), null)
  const setup = encodeSetup()
  assert.equal(setup.length, 12)
  assert.equal(setup.toString('ascii', 0, 1), 'l')
  assert.equal(setup.readUInt16LE(2), 11)
  const query = encodeQueryExtension('SHAPE')
  assert.equal(query.readUInt8(0), 98)
  assert.equal(query.readUInt16LE(4), 5)
  assert.equal(query.toString('ascii', 8, 13), 'SHAPE')
  assert.equal(query.length % 4, 0)
})

test('客户端：握手后按 SHAPE major opcode 写入输入区域', () => {
  const socket = fakeSocket()
  const logs = []
  const client = createX11InputShape({
    display: ':0', connect: () => socket, log: (...parts) => logs.push(parts.join(' ')),
  })
  assert.equal(client.enabled, true)
  assert.equal(client.set(fakeWindow, [{ x: 1, y: 2, width: 3, height: 4 }]), false)
  socket.emit('connect')
  assert.equal(socket.writes.length, 1, '先发 setup')
  socket.emit('data', setupReply())
  assert.equal(socket.writes.length, 2, 'setup 成功后查 SHAPE 扩展')
  socket.emit('data', extensionReply(1, 131))
  assert.equal(client.ready(), true)
  assert.equal(client.set(fakeWindow, [{ x: 1, y: 2, width: 3, height: 4 }], 2), true)
  const shape = socket.writes.at(-1)
  assert.equal(shape.readUInt8(0), 131)
  assert.equal(shape.readUInt8(5), 2)
  assert.equal(shape.readInt16LE(16), 2)
  assert.equal(shape.readUInt16LE(20), 6)
  client.close()
  assert.equal(socket.destroyed, true)
})

test('客户端：没有 SHAPE 扩展或 X11 拒绝连接时安全降级', () => {
  const socket = fakeSocket()
  const client = createX11InputShape({ display: ':0', connect: () => socket, log: () => {} })
  socket.emit('connect')
  socket.emit('data', setupReply())
  socket.emit('data', extensionReply(0, 0))
  assert.equal(client.failed(), true)
  assert.equal(client.set(fakeWindow, [{ x: 0, y: 0, width: 1, height: 1 }]), false)

  const loose = fakeSocket()
  const refused = createX11InputShape({ display: ':0', connect: () => loose, log: () => {} })
  loose.emit('connect')
  loose.emit('data', setupReply(0))
  assert.equal(refused.failed(), true)
})
