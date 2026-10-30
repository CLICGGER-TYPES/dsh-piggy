// @ts-check
/** 云存档的 git 传输层：不联网，用本地 bare 仓库验证提交、推送与拉取判定。 */
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { promisify } from 'node:util'

import { META_FILE, SAVE_FILE, commitMessage, createGitSync, shouldCommit } from '../runtime/git-sync.js'

const run = promisify(execFile)

/** 在临时目录里建一个 bare 仓库当远端。 */
async function makeRemote(root) {
  const bare = join(root, 'remote.git')
  await run('git', ['init', '-q', '--bare', bare])
  return bare
}

/** 造一个只关心字节的假存档层。 */
function fakeSave(bytes, meta = {}) {
  const calls = { imported: /** @type {Map<string, Buffer> | null} */ (null) }
  return {
    calls,
    archive: async () => ({ buffer: Buffer.from(bytes), stateVersion: 15, lastSeenAt: meta.lastSeenAt ?? 1000, level: 5, coins: 18867 }),
    parse: async (name, buffer) => ({ files: new Map([[name, buffer]]), summary: { bytes: buffer.length } }),
    importFiles: async files => { calls.imported = files },
  }
}

test('shouldCommit 只在超过防抖且有变化时返回 true', () => {
  assert.equal(shouldCommit({ lastCommitAt: 0, now: 5 * 60 * 1000 }), false)
  assert.equal(shouldCommit({ lastCommitAt: 0, now: 10 * 60 * 1000 }), true)
  assert.equal(shouldCommit({ lastCommitAt: 0, now: 20 * 60 * 1000, dirty: false }), false)
  assert.equal(shouldCommit({ lastCommitAt: 0, now: 20 * 60 * 1000, debounceMs: 0 }), true)
})

test('commitMessage 是一行、带时间与数值', () => {
  const text = commitMessage({ lastSeenAt: new Date(2026, 9, 30, 9, 55).getTime(), level: 5, coins: 18867 })
  assert.equal(text, 'save: 2026-10-30T09:55 Lv.5 18867c')
  assert.ok(!text.includes('\n'))
})

test('pushSnapshot 提交并推送到 bare 远端', async () => {
  const root = await mkdtemp(join(tmpdir(), 'piggy-git-'))
  try {
    const bare = await makeRemote(root)
    const save = fakeSave('zip-a')
    const sync = createGitSync({
      statePath: join(root, 'state.json'),
      directory: join(root, 'work-a'),
      remote: bare,
      device: 'unit-test',
      archive: save.archive,
      parse: save.parse,
      importFiles: save.importFiles,
    })
    const result = await sync.pushSnapshot()
    assert.equal(result.meta.device, 'unit-test')
    assert.equal(result.meta.stateVersion, 15)
    assert.ok(result.committed !== null)

    const log = await run('git', ['--git-dir', bare, 'log', '--format=%s', '-1', 'main'])
    assert.match(log.stdout.trim(), /^save: \d{4}-\d{2}-\d{2}T\d{2}:\d{2} Lv\.5 18867c$/)

    const files = await run('git', ['--git-dir', bare, 'show', '--name-only', '--format=', 'main'])
    const names = files.stdout.split('\n').map(line => line.trim()).filter(Boolean)
    assert.deepEqual(names.sort(), [META_FILE, SAVE_FILE].sort())

    const meta = JSON.parse(await run('git', ['--git-dir', bare, 'show', `main:${META_FILE}`]).then(r => r.stdout))
    assert.equal(meta.schemaVersion, 1)
    assert.equal(meta.lastSeenAt, 1000)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('pullIfNewer 只在远端更新时导入', async () => {
  const root = await mkdtemp(join(tmpdir(), 'piggy-git-'))
  try {
    const bare = await makeRemote(root)
    const push = createGitSync({
      statePath: join(root, 'state.json'),
      directory: join(root, 'work-a'),
      remote: bare,
      archive: fakeSave('zip-a', { lastSeenAt: 2000 }).archive,
      parse: fakeSave('zip-a').parse,
      importFiles: fakeSave('zip-a').importFiles,
    })
    await push.pushSnapshot()

    const saveB = fakeSave('zip-b', { lastSeenAt: 1000 })
    const pull = createGitSync({
      statePath: join(root, 'state.json'),
      directory: join(root, 'work-b'),
      remote: bare,
      archive: saveB.archive,
      parse: saveB.parse,
      importFiles: saveB.importFiles,
    })

    const older = await pull.pullIfNewer(5000)
    assert.equal(older.applied, false)
    assert.equal(older.reason, 'not-newer')
    assert.equal(saveB.calls.imported, null)

    const newer = await pull.pullIfNewer(500)
    assert.equal(newer.applied, true)
    assert.ok(saveB.calls.imported instanceof Map)
    assert.equal(saveB.calls.imported.get(SAVE_FILE)?.toString(), 'zip-a')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('没有远端存档时拉取不报错', async () => {
  const root = await mkdtemp(join(tmpdir(), 'piggy-git-'))
  try {
    const bare = await makeRemote(root)
    const save = fakeSave('zip-a')
    const sync = createGitSync({
      statePath: join(root, 'state.json'),
      directory: join(root, 'work-empty'),
      remote: bare,
      archive: save.archive,
      parse: save.parse,
      importFiles: save.importFiles,
    })
    const result = await sync.pullIfNewer(0)
    assert.equal(result.applied, false)
    assert.equal(result.reason, 'no-remote-save')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('listBranches 列出远端分支，applyBranch 读指定分支的存档', async () => {
  const root = await mkdtemp(join(tmpdir(), 'piggy-git-'))
  try {
    const bare = await makeRemote(root)
    const mainSave = fakeSave('zip-main', { lastSeenAt: 3000 })
    const main = createGitSync({
      statePath: join(root, 'state.json'), directory: join(root, 'work-main'), remote: bare, branch: 'main',
      archive: mainSave.archive, parse: mainSave.parse, importFiles: mainSave.importFiles,
    })
    await main.pushSnapshot()

    const altSave = fakeSave('zip-alt', { lastSeenAt: 4000 })
    const alt = createGitSync({
      statePath: join(root, 'state.json'), directory: join(root, 'work-alt'), remote: bare, branch: 'alt',
      archive: altSave.archive, parse: altSave.parse, importFiles: altSave.importFiles,
    })
    await alt.pushSnapshot()

    const branches = await main.listBranches()
    assert.deepEqual(branches, ['alt', 'main'])

    const target = fakeSave('unused', { lastSeenAt: 0 })
    const reader = createGitSync({
      statePath: join(root, 'state.json'), directory: join(root, 'work-read'), remote: bare, branch: 'main',
      archive: target.archive, parse: target.parse, importFiles: target.importFiles,
    })
    const applied = await reader.applyBranch('alt')
    assert.equal(applied.applied, true)
    assert.equal(applied.meta.lastSeenAt, 4000)
    assert.equal(target.calls.imported?.get(SAVE_FILE)?.toString(), 'zip-alt')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
test('history 返回最后一次手动提交与最近十次自动提交', async () => {
  const root = await mkdtemp(join(tmpdir(), 'piggy-git-'))
  try {
    const bare = await makeRemote(root)
    let bytes = 'zip-0'
    let seen = 5000
    const sync = createGitSync({
      statePath: join(root, 'state.json'), directory: join(root, 'work-h'), remote: bare, branch: 'main',
      archive: async () => ({ buffer: Buffer.from(bytes), stateVersion: 15, lastSeenAt: seen, level: 5, coins: 1 }),
      parse: async (name, buffer) => ({ files: new Map([[name, buffer]]) }),
      importFiles: async () => {},
    })
    await sync.pushSnapshot()
    await sync.pushSnapshot()
    assert.equal((await sync.history('main')).auto.length, 1, '内容没变不应产生新提交')
    for (let index = 0; index < 3; index += 1) { bytes = 'zip-' + (index + 1); seen += 1000; await sync.pushSnapshot() }
    await sync.pushSnapshot({ manual: true })

    const list = await sync.history('main')
    assert.ok(list.manual)
    assert.match(list.manual.subject, /^save-manual:/)
    assert.equal(list.auto.length, 4)
    assert.ok(list.auto.every(item => item.subject.startsWith('save:')))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})