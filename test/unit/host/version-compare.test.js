import assert from 'node:assert/strict'
import { test } from 'node:test'
import { compareVersions } from '../../../src/client/update-notice.js'
import { compareVersions as shellCompare } from '../../../apps/desktop/lib/versions.js'

test('预览版排在正式版前面：在用 0.27.3-rc.2 时 0.27.2 不算新，0.27.3 正式版算新', () => {
  for (const compare of [compareVersions, shellCompare]) {
    assert.ok(compare('0.27.3-rc.2', '0.27.2') > 0)
    assert.ok(compare('0.27.3', '0.27.3-rc.2') > 0)
    assert.ok(compare('0.27.3-rc.2', '0.27.3-rc.1') > 0)
    assert.ok(compare('0.27.3-rc.10', '0.27.3-rc.9') > 0)
    assert.equal(compare('v0.27.3', '0.27.3'), 0)
    assert.ok(compare('0.2.3', '0.1.2') > 0)
  }
})

test('更新页有刷新按钮；0.2.5 以前的外壳遇到预览版外壳改成去发布页下载', async () => {
  const { readFileSync } = await import('node:fs')
  const src = readFileSync(new URL('../../../src/client/tabs/update.js', import.meta.url), 'utf8')
  assert.match(src, /'data-update-refresh'/)
  assert.match(src, /shellRelease\.prerelease && compareVersions\(cur\.shell, '0\.2\.5'\) < 0\) mode = 'preview-manual'/)
})

test('外壳在预览版发布里时，更新器要打开 allowPrerelease', async () => {
  const { createShellUpdates } = await import('../../../apps/desktop/lib/shell-update.js')
  const seen = []
  const updater = {
    on() {}, allowPrerelease: false,
    async checkForUpdates() { seen.push(this.allowPrerelease); return { updateInfo: { version: '0.2.4' } } },
    async downloadUpdate() {},
  }
  const shell = createShellUpdates({ mode: 'automatic', currentVersion: '0.2.2', updater })
  assert.deepEqual(await shell.download('0.2.4', true), { ok: true, version: '0.2.4' })
  assert.deepEqual(seen, [true])
})
