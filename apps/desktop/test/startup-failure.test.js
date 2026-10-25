import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { reportStartupFailure, startupFailureDialog } from '../lib/startup-failure.js'

test('startup failure is visible in a dialog that points at the log', () => {
  const options = startupFailureDialog({
    error: new Error('download failed'),
    logPath: 'C:\\Users\\pig\\AppData\\Roaming\\dsh-piggy\\piggy.log',
    version: '0.6.7',
    platform: 'win32',
  })
  assert.equal(options.type, 'error')
  assert.match(options.message, /猪没能出来/)
  assert.match(options.detail, /download failed/)
  assert.match(options.detail, /piggy\.log/)
  assert.match(options.detail, /0\.6\.7/)
})

test('the reporter keeps the log line and shows the same failure once', async () => {
  const logs = []
  const opened = []
  const error = new Error('host start failed')
  const options = await reportStartupFailure({
    dialog: { showMessageBoxSync: value => opened.push(value) },
    log: (...parts) => logs.push(parts.join(' ')),
    error,
    logPath: '/tmp/piggy.log',
    version: '0.6.7',
    platform: 'linux',
  })
  assert.equal(opened.length, 1)
  assert.equal(opened[0], options)
  assert.match(logs[0], /^startup failed /)
  assert.match(logs[0], /host start failed/)
  assert.match(logs[0], /startup-failure|Error/, 'the log keeps the stack, not just the message')
  assert.ok(logs.some(line => line.startsWith('startup failure shown ')))
})

test('a dialog that cannot open still leaves a log line', async () => {
  const logs = []
  await assert.doesNotReject(() => reportStartupFailure({
    dialog: { showMessageBoxSync: () => { throw new Error('no display') } },
    log: (...parts) => logs.push(parts.join(' ')),
    error: new Error('boom'),
    logPath: '/tmp/piggy.log',
    version: '0.6.7',
    platform: 'linux',
  }))
  assert.ok(logs.some(line => line.startsWith('startup failure dialog failed ')))
})

test('main.js reports startup failures visibly and logs page-load failures', () => {
  const source = readFileSync(new URL('../main.js', import.meta.url), 'utf8')
  assert.match(source, /\.catch\(async error => \{[\s\S]{0,300}?reportStartupFailure\(\{ dialog, log, error,/)
  assert.ok(!/\.catch\(error => \{ log\('startup failed', String\(error\)\); app\.quit\(\) \}\)/.test(source),
    'the old silent log-and-quit path must be gone')
  assert.match(source, /did-fail-load[\s\S]{0,900}reportStartupFailure/, 'a page that never loads must be visible, not just logged')
})

test('fatal log finishes before the modal dialog opens', async () => {
  const order = []
  let release
  const pending = reportStartupFailure({
    dialog: { showMessageBoxSync() { order.push('dialog') } },
    log: tag => tag === 'startup failed' ? new Promise(resolve => { release = () => { order.push('persisted'); resolve() } }) : undefined,
    error: new Error('boom'), logPath: '/unused/piggy.log', version: '0.6.7', platform: 'win32',
  })
  assert.deepEqual(order, [])
  release()
  await pending
  assert.deepEqual(order, ['persisted', 'dialog'])
})
