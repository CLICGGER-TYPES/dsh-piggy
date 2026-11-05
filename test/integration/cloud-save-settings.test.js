import assert from 'node:assert/strict'
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { DEFAULT_CLOUD_SETTINGS, normalizeCloudSaveSettings, readCloudSaveSettings, writeCloudSaveSettings } from '../../runtime/cloud-save-settings.js'
import { testGitRemote } from '../../runtime/git-sync.js'
import { createGameRuntime } from '../../runtime/index.js'
import { hatchEgg } from '../../src/host/core.js'

const temp = () => mkdtempSync(join(tmpdir(), 'piggy-cloud-settings-'))

test('cloud settings default off, accept HTTPS/SSH repositories and reject embedded credentials', () => {
  assert.deepEqual(DEFAULT_CLOUD_SETTINGS, { version: 1, enabled: false, provider: 'github', remote: '', branch: 'main' })
  assert.deepEqual(normalizeCloudSaveSettings({ enabled: true, provider: 'github', remote: 'https://github.com/acme/pig.git', branch: 'main' }),
    { version: 1, enabled: true, provider: 'github', remote: 'https://github.com/acme/pig.git', branch: 'main' })
  assert.equal(normalizeCloudSaveSettings({ enabled: true, provider: 'github', remote: 'git@github.com:acme/pig.git', branch: 'release/v1' }).provider, 'github')
  assert.throws(() => normalizeCloudSaveSettings({ enabled: true, provider: 'github', remote: 'https://user:token@github.com/acme/pig.git', branch: 'main' }), /不能包含账号/)
  assert.throws(() => normalizeCloudSaveSettings({ enabled: true, provider: 'github', remote: 'https://gitee.com/acme/pig.git', branch: 'main' }), /github.com/)
  assert.throws(() => normalizeCloudSaveSettings({ enabled: true, provider: 'git', remote: 'https://git.example/acme/pig.git', branch: '../main' }), /分支名称无效/)
  assert.throws(() => normalizeCloudSaveSettings({ enabled: true, provider: 'git', remote: 'file:///tmp/pig.git', branch: 'main' }), /HTTPS 或 SSH/)
})

test('cloud settings persist atomically in a separate file; POSIX permissions are owner-only', () => {
  const root = temp()
  const file = join(root, 'user-data', 'cloud-save-settings.json')
  try {
    assert.equal(readCloudSaveSettings(file).missing, true)
    const config = writeCloudSaveSettings(file, { enabled: false, provider: 'gitee', remote: 'https://gitee.com/acme/pig.git', branch: 'main' })
    assert.deepEqual(readCloudSaveSettings(file).config, config)
    // Node exposes POSIX mode bits on POSIX hosts. On Windows, chmod/mode do not
    // express the inherited ACL on the userData directory, which this test does
    // not inspect.
    if (process.platform !== 'win32') {
      assert.equal(statSync(file).mode & 0o777, 0o600)
      chmodSync(file, 0o600)
    }
    assert.deepEqual(Object.keys(JSON.parse(readFileSync(file, 'utf8'))).sort(), ['branch', 'enabled', 'provider', 'remote', 'version'])
    assert.equal(existsSync(join(root, 'state.json')), false)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('connection probe only runs bounded read-only ls-remote and does not expose remote errors', async () => {
  const calls = []
  const remote = 'https://github.com/acme/private.git'
  const result = await testGitRemote({ remote, cwd: tmpdir(), timeoutMs: 150_000, git: async (args, options) => {
    calls.push({ args, options })
    return { stdout: 'ref\tHEAD', stderr: '' }
  } })
  assert.deepEqual(result, { ok: true })
  assert.deepEqual(calls[0].args, ['ls-remote', '--symref', remote, 'HEAD'])
  assert.equal(calls[0].options.timeoutMs, 120_000)
  const failed = await testGitRemote({ remote, cwd: tmpdir(), git: async () => { throw new Error(`fatal: ${remote}: denied`) } })
  assert.deepEqual(failed, { ok: false, reason: '无法连接，请检查地址和本机 Git 凭据配置' })
  assert.equal(JSON.stringify(failed).includes(remote), false)
})

test('disabling cloud sync drains without a final push and leaves the save bytes unchanged', async () => {
  const root = temp()
  const statePath = join(root, 'state.json')
  let runtime
  try {
    writeFileSync(statePath, JSON.stringify(hatchEgg(Date.now())))
    runtime = createGameRuntime({ statePath, cloudSave: {
      enabled: true, remote: join(root, 'not-a-real-remote.git'), branch: 'main', debounceMs: 60_000,
    } })
    const before = readFileSync(statePath)
    const applied = await runtime.configureCloudSave({
      enabled: false, provider: 'github', remote: '', branch: 'main', syncReady: false,
    })
    assert.equal(applied.ok, true)
    assert.deepEqual(readFileSync(statePath), before)
    assert.equal(existsSync(join(root, 'cloud-save')), false)
    const close = await runtime.dispose()
    runtime = null
    assert.equal(close.cloudPush, 'disabled')
  } finally {
    await runtime?.dispose().catch(() => {})
    rmSync(root, { recursive: true, force: true })
  }
})
