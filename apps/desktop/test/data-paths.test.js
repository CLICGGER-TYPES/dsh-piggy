// @ts-check
import assert from 'node:assert/strict'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { desktopDataPaths, configureDesktopData } from '../lib/data-paths.js'
import { migrateDesktopData } from '../lib/data-migration.js'
import { acquireGameLock } from '../../../runtime/owner-lock.js'

function setup(t) {
  const dir = mkdtempSync(join(tmpdir(), 'piggy-path-migration-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const userData = join(dir, 'piggy'), legacyUserData = join(dir, 'dsh-piggy-desktop')
  const old = join(legacyUserData, 'dsh-piggy')
  mkdirSync(userData); mkdirSync(join(old, 'extensions', 'farm'), { recursive: true })
  writeFileSync(join(old, 'state.json'), '{"version":15,"coins":731,"inventory":{"apple":4},"extData":{"farm":{"coins":99}}}')
  writeFileSync(join(old, 'state.json.v14-backup'), 'original backup')
  writeFileSync(join(old, 'extensions', 'farm', 'manifest.json'), '{"version":"4.1.6"}')
  writeFileSync(join(old, 'extensions', 'farm', 'client.js'), 'original extension')
  writeFileSync(join(legacyUserData, 'window.json'), '{"scale":2}')
  mkdirSync(join(legacyUserData, 'versions'))
  writeFileSync(join(legacyUserData, 'versions', 'active.json'), '{"active":null}')
  return { dir, userData, legacyUserData, old }
}
const read = file => readFileSync(file, 'utf8')

test('Windows, Linux and macOS default to one flat piggy data directory', () => {
  const win = desktopDataPaths({ platform: 'win32', home: 'C:\\Users\\pig', appData: 'C:\\Users\\pig\\AppData\\Roaming', legacyUserData: 'C:\\old', env: {}, argv: [] })
  assert.equal(win.userData, 'C:\\Users\\pig\\AppData\\Roaming\\piggy')
  assert.equal(win.statePath, 'C:\\Users\\pig\\AppData\\Roaming\\piggy\\state.json')
  for (const [platform, appData, expected] of [['linux', '/home/pig/.config', '/home/pig/.local/share/piggy'], ['darwin', '/Users/pig/Library/Application Support', '/Users/pig/Library/Application Support/piggy']]) {
    const result = desktopDataPaths({ platform, appData, home: '/home/pig', legacyUserData: '/old', env: {}, argv: [] })
    assert.equal(result.userData, expected)
    assert.equal(result.statePath, expected + '/state.json')
  }
})

test('Linux respects absolute XDG_DATA_HOME and ignores relative values', () => {
  const defaults = { platform: 'linux', home: '/home/pig', appData: '/home/pig/.config', legacyUserData: '/old', argv: [] }
  assert.equal(desktopDataPaths({ ...defaults, env: { XDG_DATA_HOME: '/data' } }).userData, '/data/piggy')
  assert.equal(desktopDataPaths({ ...defaults, env: { XDG_DATA_HOME: 'relative' } }).userData, '/home/pig/.local/share/piggy')
})

test('explicit profiles remain isolated, environment override takes precedence over CLI', () => {
  const defaults = { platform: 'linux', home: '/home/pig', appData: '/config', legacyUserData: '/real' }
  const explicit = desktopDataPaths({ ...defaults, env: { PIGGY_USERDATA: '/private' }, argv: ['--user-data-dir=/cli'] })
  assert.equal(explicit.userData, '/private'); assert.equal(explicit.legacyUserData, '/private')
  assert.equal(explicit.statePath, '/private/state.json')
  assert.equal(desktopDataPaths({ ...defaults, env: {}, argv: ['--user-data-dir', '/cli'] }).userData, '/cli')
  assert.equal(desktopDataPaths({ ...defaults, env: {}, argv: ['--user-data-dir=/cli'] }).userData, '/cli')
})

test('real migration preserves save, extensions, backups, settings and downloaded game selection', t => {
  const f = setup(t), original = read(join(f.old, 'state.json'))
  assert.equal(migrateDesktopData(f).migrated, true)
  assert.equal(read(join(f.userData, 'state.json')), original)
  assert.equal(read(join(f.old, 'state.json')), original, 'original save retained for rollback')
  assert.equal(read(join(f.userData, 'extensions/farm/client.js')), 'original extension')
  assert.equal(read(join(f.userData, 'state.json.v14-backup')), 'original backup')
  assert.equal(read(join(f.userData, 'window.json')), '{"scale":2}')
  assert.equal(read(join(f.userData, 'versions/active.json')), '{"active":null}')
  assert.equal(existsSync(join(f.userData, 'dsh-piggy')), false)
  assert.equal(existsSync(join(f.old, 'state.json.runtime.lock')), false)
  writeFileSync(join(f.userData, 'state.json'), 'new progress')
  assert.equal(migrateDesktopData(f).reason, 'existing-save')
  assert.equal(read(join(f.userData, 'state.json')), 'new progress')
})

test('legacy nested explicit profile is flattened in place; originals remain', t => {
  const f = setup(t)
  const paths = { userData: f.legacyUserData, legacyUserData: f.legacyUserData }
  assert.equal(migrateDesktopData(paths).migrated, true)
  assert.equal(read(join(f.legacyUserData, 'state.json')), read(join(f.old, 'state.json')))
  assert.equal(read(join(f.legacyUserData, 'window.json')), '{"scale":2}')
})

test('existing target pig or extension data is never overwritten or mixed', t => {
  const f = setup(t)
  mkdirSync(join(f.userData, 'extensions')); writeFileSync(join(f.userData, 'extensions', 'keep'), 'another pig')
  assert.throws(() => migrateDesktopData(f), /已有 extensions/)
  assert.equal(read(join(f.userData, 'extensions', 'keep')), 'another pig')
  assert.equal(existsSync(join(f.userData, 'state.json')), false)
})

test('a running old runtime prevents migration; after it closes migration works', t => {
  const f = setup(t), release = acquireGameLock(join(f.old, 'state.json'))
  try { assert.throws(() => migrateDesktopData(f), /旧版小猪仍在运行/); assert.equal(existsSync(join(f.userData, 'state.json')), false) }
  finally { release() }
  assert.equal(migrateDesktopData(f).migrated, true)
})

test('interrupted migration resumes already published files and does not overwrite conflicts', t => {
  const f = setup(t)
  migrateDesktopData(f)
  const record = JSON.parse(read(join(f.userData, 'data-migration.json')))
  const transfer = join(f.userData, '.data-migration-v1')
  mkdirSync(join(transfer, 'files'), { recursive: true })
  writeFileSync(join(transfer, 'plan.json'), JSON.stringify(record))
  const state = join(f.userData, 'state.json')
  cpSync(state, join(transfer, 'files', 'state.json')); rmSync(state)
  assert.equal(migrateDesktopData(f).migrated, true)
  assert.equal(read(state), read(join(f.old, 'state.json')))
  assert.equal(existsSync(transfer), false)
})

test('a changed old save after an interruption aborts instead of importing stale progress', t => {
  const f = setup(t); migrateDesktopData(f)
  const record = read(join(f.userData, 'data-migration.json')), transfer = join(f.userData, '.data-migration-v1')
  mkdirSync(join(transfer, 'files'), { recursive: true }); writeFileSync(join(transfer, 'plan.json'), record)
  writeFileSync(join(f.old, 'state.json'), 'newer legacy progress')
  assert.throws(() => migrateDesktopData(f), /中断后发生变化/)
  assert.equal(read(join(f.old, 'state.json')), 'newer legacy progress')
})

test('shell migration uses exactly the same save-owner lock implementation as the runtime', () => {
  assert.equal(read(new URL('../lib/save-owner-lock.js', import.meta.url)), read(new URL('../../../runtime/owner-lock.js', import.meta.url)))
})

test('both desktop entry points configure data before locking and migrate only after locking', () => {
  for (const relative of ['../main.js', '../stage/main.js']) {
    const source = read(new URL(relative, import.meta.url))
    assert.ok(source.includes('const statePath = () => dataPaths.statePath'))
    assert.ok(source.indexOf('configureDesktopData(app)') < source.indexOf('const gotLock'))
    const ready = source.indexOf('app.whenReady().then(async () => {')
    const guard = source.indexOf('if (needsX11 || !gotLock || quitting) return', ready)
    const migration = source.indexOf('migrateDesktopData(dataPaths)', ready)
    assert.ok(ready > 0 && guard > ready && migration > guard)
  }
})

test('unhatched legacy profile migrates once without blocking its next startup', t => {
  const f = setup(t); rmSync(join(f.old, 'state.json'))
  assert.equal(migrateDesktopData(f).migrated, true)
  assert.equal(migrateDesktopData(f).reason, 'already-migrated')
})

test('an unknown migration directory is preserved, rather than deleted as temporary data', t => {
  const f = setup(t), transfer = join(f.userData, '.data-migration-v1')
  mkdirSync(transfer); writeFileSync(join(transfer, 'keep'), 'evidence')
  assert.throws(() => migrateDesktopData(f), /缺少有效记录/)
  assert.equal(read(join(transfer, 'keep')), 'evidence')
  assert.equal(existsSync(join(f.userData, 'state.json')), false)
})

test('Electron commandLine override works even when the switch is absent from process.argv', t => {
  const f = setup(t), previous = process.env.PIGGY_USERDATA, selected = []
  delete process.env.PIGGY_USERDATA
  t.after(() => { if (previous === undefined) delete process.env.PIGGY_USERDATA; else process.env.PIGGY_USERDATA = previous })
  const paths = configureDesktopData({ getPath: () => f.legacyUserData,
    commandLine: { hasSwitch: () => true, getSwitchValue: () => f.userData },
    setPath: (...args) => selected.push(args) })
  assert.equal(paths.userData, f.userData)
  assert.equal(paths.legacyUserData, f.userData)
  assert.deepEqual(selected, [['userData', f.userData]])
})
