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

test('a failed update names the recovered version before relaunch', () => {
  const options = startupFailureDialog({ error: new Error('host start failed'), logPath: '/tmp/piggy.log', version: '0.6.8', platform: 'linux', recoveredVersion: '0.37.0' })
  assert.match(options.title, /恢复旧版本/)
  assert.match(options.message, /已恢复到 0\.37\.0/)
  assert.match(options.message, /重新启动/)
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

test('main.js routes startup, page-load and pre-visible renderer failures through update recovery', () => {
  const source = readFileSync(new URL('../main.js', import.meta.url), 'utf8')
  const windowManager = readFileSync(new URL('../lib/window-manager.js', import.meta.url), 'utf8')
  const petWindow = readFileSync(new URL('../lib/pet-window.js', import.meta.url), 'utf8')
  assert.match(source, /async function handleStartupFailure\(error\)[\s\S]{0,900}versions\.failStartup\(token\)/)
  const readyStart = source.indexOf('app.whenReady().then(async () => {')
  const readyEnd = source.indexOf('}).catch(handleStartupFailure)', readyStart) + '}).catch(handleStartupFailure)'.length
  assert.ok(readyStart >= 0 && readyEnd > readyStart, 'the production ready handler remains identifiable')
  const readyFlow = source.slice(readyStart, readyEnd)
  assert.match(readyFlow, /\.catch\(handleStartupFailure\)/)
  assert.match(readyFlow, /ownerArchiveSelectionStore\.commitPending\(\)/, 'owner selection commits only after startup setup completes')
  assert.match(source, /await restorePreviousOwnerSelectionAndRestart\(error\)/, 'a pending owner switch keeps its existing recovery path')
  assert.match(source, /await reportStartupFailure\(\{ dialog, log, error, logPath, version: app\.getVersion\(\), platform: process\.platform, recoveredVersion \}\)/)
  assert.ok(!/\.catch\(error => \{ log\('startup failed', String\(error\)\); app\.quit\(\) \}\)/.test(source),
    'the old silent log-and-quit path must be gone')
  assert.match(petWindow, /webContents\.on\('did-fail-load'/, 'the window owner must forward page-load failure events')
  assert.match(windowManager, /onDidFailLoad:[\s\S]{0,500}deps\.handleStartupFailure/, 'a page that never loads must enter the same recovery path')
  assert.match(windowManager, /await deps\.handleStartupFailure\(new Error\(pageCrashReason\(details\)\)\)/, 'a pre-visible renderer crash must enter the same recovery path')
  assert.match(source, /startupSetupComplete = true[\s\S]{0,240}confirmUpdateStartupIfReady\(\)/)
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
