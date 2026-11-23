// @ts-check
/** 锁失败时运行时还没建好，必须先把 pid/身份/锁路径写进日志，不能只 console.warn。 */
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { createGameRuntime } from '../../../runtime/index.js'
import { probeProcess } from '../../../runtime/owner-lock.js'

test('运行时锁失败会写 journal，带 pid/进程名/锁路径', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'piggy-lock-journal-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const statePath = join(dir, 'state.json')
  const fixed = `${statePath}.runtime.lock`
  const nonce = 'd'.repeat(32)
  const self = probeProcess(process.pid)
  mkdirSync(fixed)
  writeFileSync(join(fixed, `${nonce}.json`), JSON.stringify({
    pid: process.pid, nonce,
    identity: { name: self.name, token: self.token, startedAt: self.startedAt, execPath: self.execPath },
  }))
  assert.throws(() => createGameRuntime({ statePath }), error => error.code === 'OWNER_LOCK_LIVE')
  await new Promise(resolve => setTimeout(resolve, 100))
  const log = readFileSync(join(dir, 'logs', 'dsh-piggy.log'), 'utf8')
  assert.match(log, /运行时锁获取失败/)
  assert.match(log, new RegExp(`"ownerPid":${process.pid}`))
  assert.match(log, /state\.json\.runtime\.lock/)
})
