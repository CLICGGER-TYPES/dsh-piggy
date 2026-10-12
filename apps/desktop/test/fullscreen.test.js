import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PassThrough } from 'node:stream'
import { test } from 'node:test'
import {
  createFullscreenWatch, encodePowerShell, fullscreenMode, parseActiveWindow, parseProbeLine,
  parseWindowRect, parseWindowState, shouldHide, windowsProbeScript,
} from '../lib/fullscreen.js'

const tempDir = () => mkdtempSync(join(tmpdir(), 'pig-fullscreen-'))

test('fullscreen preference defaults to hide and only hides for the pig screen', () => {
  assert.equal(fullscreenMode(undefined), 'hide')
  assert.equal(fullscreenMode('show'), 'show')
  assert.equal(fullscreenMode('weird'), 'hide')
  assert.equal(shouldHide('hide', { fullscreen: true, samePigScreen: true }), true)
  assert.equal(shouldHide('hide', { fullscreen: true, samePigScreen: false }), false)
  assert.equal(shouldHide('hide', { fullscreen: false, samePigScreen: true }), false)
  assert.equal(shouldHide('show', { fullscreen: true, samePigScreen: true }), false)
  assert.equal(shouldHide('hide', null), false)
})

test('windows probe script embeds only numeric ids and a literal C# here-string', () => {
  const script = windowsProbeScript(4321, '987654')
  assert.match(script, /\$parent = 4321/)
  assert.match(script, /\[Int64\]987654/)
  assert.match(script, /Add-Type -TypeDefinition @'\n/)
  assert.match(script, /\n'@\n/)
  assert.match(windowsProbeScript(1, '1; Remove-Item x'), /\[Int64\]0\n/)
  assert.equal(Buffer.from(encodePowerShell('ab'), 'base64').toString('utf16le'), 'ab')
  assert.deepEqual(parseProbeLine('{"fullscreen":true,"samePigScreen":false,"state":3,"cls":"Chrome_WidgetWin_1"}'),
    { fullscreen: true, samePigScreen: false, state: 3, cls: 'Chrome_WidgetWin_1' })
  assert.equal(parseProbeLine('Exception: nope'), null)
})

test('x11 output parsing', () => {
  assert.equal(parseActiveWindow('_NET_ACTIVE_WINDOW(WINDOW): window id # 0x3a00007'), '0x3a00007')
  assert.equal(parseActiveWindow('_NET_ACTIVE_WINDOW(WINDOW): window id # 0x0'), null)
  assert.deepEqual(parseWindowState('_NET_WM_STATE(ATOM) = _NET_WM_STATE_FULLSCREEN, _NET_WM_STATE_FOCUSED\n_NET_WM_PID(CARDINAL) = 812'), { fullscreen: true, pid: 812 })
  assert.deepEqual(parseWindowState('_NET_WM_STATE(ATOM) = \n'), { fullscreen: false, pid: 0 })
  assert.deepEqual(parseWindowRect('  Absolute upper-left X:  1920\n  Absolute upper-left Y:  0\n  Width: 1920\n  Height: 1080\n'), { x: 1920, y: 0, width: 1920, height: 1080 })
  assert.equal(parseWindowRect('garbage'), null)
})

test('preference persists across restarts', () => {
  const dir = tempDir()
  try {
    const path = join(dir, 'fullscreen.json')
    const watch = createFullscreenWatch({ path, platform: 'darwin', selfPid: 1, pigHwnd: () => '0', pigDisplayBounds: () => null, onProbe: () => {} })
    assert.equal(watch.get().mode, 'hide')
    assert.equal(watch.set('nonsense').ok, false)
    assert.equal(watch.set('show').ok, true)
    assert.deepEqual(JSON.parse(readFileSync(path, 'utf8')), { mode: 'show' })
    const again = createFullscreenWatch({ path, platform: 'darwin', selfPid: 1, pigHwnd: () => '0', pigDisplayBounds: () => null, onProbe: () => {} })
    assert.equal(again.mode(), 'show')
    assert.equal(again.get().supported, true)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

function fakeChild() {
  const child = new EventEmitter()
  child.stdout = new PassThrough()
  child.stderr = new PassThrough()
  child.kill = () => { child.killed = true }
  return child
}

test('windows: probe lines reach the shell; a PowerShell that never answers marks it unsupported', async () => {
  const dir = tempDir()
  try {
    const probes = []
    let spawned = null
    const watch = createFullscreenWatch({
      path: join(dir, 'f.json'), platform: 'win32', selfPid: 77, pigHwnd: () => '12345', pigDisplayBounds: () => null,
      onProbe: probe => probes.push(probe), spawn: (file, args, options) => { spawned = { file, args, options, child: fakeChild() }; return spawned.child },
    })
    watch.start()
    assert.equal(spawned.file, 'powershell.exe')
    assert.equal(spawned.options.windowsHide, true)
    assert.match(Buffer.from(spawned.args.at(-1), 'base64').toString('utf16le'), /\$parent = 77/)
    assert.equal(watch.get().checking, true)
    spawned.child.stdout.write('{"fullscreen":true,"samePigScreen":true,"state":2,"cls":"Chrome_WidgetWin_1"}\n{"fullsc')
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(probes.length, 1)
    assert.equal(probes[0].fullscreen, true)
    assert.equal(watch.get().supported, true)
    watch.stop()
    assert.equal(spawned.child.killed, true)

    const blocked = createFullscreenWatch({
      path: join(dir, 'g.json'), platform: 'win32', selfPid: 77, pigHwnd: () => '0', pigDisplayBounds: () => null,
      onProbe: probe => probes.push(probe), spawn: () => { spawned = { child: fakeChild() }; return spawned.child },
    })
    blocked.start()
    spawned.child.stderr.write('AuthorizationManager check failed.\n')
    await new Promise(resolve => setImmediate(resolve))
    spawned.child.emit('exit', 1)
    assert.equal(blocked.get().supported, false)
    assert.match(blocked.get().reason, /AuthorizationManager/)
    assert.equal(probes.at(-1), null)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('linux: fullscreen window from another process on the pig screen is reported; missing xprop is unsupported', async () => {
  const dir = tempDir()
  try {
    const outputs = {
      'xprop -root _NET_ACTIVE_WINDOW': '_NET_ACTIVE_WINDOW(WINDOW): window id # 0x400001',
      'xprop -id 0x400001 _NET_WM_STATE _NET_WM_PID': '_NET_WM_STATE(ATOM) = _NET_WM_STATE_FULLSCREEN\n_NET_WM_PID(CARDINAL) = 900',
      'xwininfo -id 0x400001': 'Absolute upper-left X: 0\nAbsolute upper-left Y: 0\nWidth: 1920\nHeight: 1080',
    }
    const probes = []
    const watch = createFullscreenWatch({
      path: join(dir, 'f.json'), platform: 'linux', selfPid: 5, pigHwnd: () => '0',
      pigDisplayBounds: () => ({ x: 0, y: 0, width: 1920, height: 1080 }), onProbe: probe => probes.push(probe),
      execFile: (file, args, options, done) => { const out = outputs[[file, ...args].join(' ')]; done(out === undefined ? new Error('x') : null, out ?? '') },
    })
    watch.start()
    for (let i = 0; i < 5 && probes.length === 0; i++) await new Promise(resolve => setImmediate(resolve))
    watch.stop()
    assert.deepEqual(probes[0], { fullscreen: true, samePigScreen: true })

    const none = createFullscreenWatch({
      path: join(dir, 'g.json'), platform: 'linux', selfPid: 5, pigHwnd: () => '0', pigDisplayBounds: () => null,
      onProbe: probe => probes.push(probe), execFile: (file, args, options, done) => done(new Error('ENOENT'), ''),
    })
    none.start()
    for (let i = 0; i < 5 && none.get().checking; i++) await new Promise(resolve => setImmediate(resolve))
    none.stop()
    assert.equal(none.get().supported, false)
    assert.match(none.get().reason, /xprop/)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
