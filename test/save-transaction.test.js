import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import { mkdtemp, readFile, rm, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'

import { commitSaveImport, recoverSaveImport, recoverSaveImportSync } from '../runtime/save-transaction.js'

async function setup() {
  const dir = await mkdtemp(path.join(tmpdir(), 'piggy-save-tx-'))
  const statePath = path.join(dir, 'state.json')
  await writeFile(statePath, '{"old":true}')
  await mkdir(path.join(dir, 'skins'))
  await writeFile(path.join(dir, 'skins', 'old.png'), 'old skin')
  await mkdir(path.join(dir, 'extensions'))
  await writeFile(path.join(dir, 'extensions', 'old.js'), 'old ext')
  await writeFile(path.join(dir, 'keep.txt'), 'keep')
  return { dir, statePath, done: () => rm(dir, { recursive: true, force: true }) }
}

const files = new Map([
  ['state.json', Buffer.from('{"new":true}')],
  ['skins/new.png', Buffer.from('new skin')],
  ['extensions/new.js', Buffer.from('new ext')],
  ['state.json.work-events/receipts.json', Buffer.from('{"receipts":[]}')],
])
const txPath = statePath => path.join(path.dirname(statePath), `.piggy-save-import-${createHash('sha256').update(path.resolve(statePath)).digest('hex').slice(0, 20)}`)
const journal = (statePath, fields) => JSON.stringify({ version: 1, statePath: path.resolve(statePath), ...fields })

test('writes backup first, replaces managed roots, and leaves neighboring user files alone', async () => {
  const { dir, statePath, done } = await setup()
  try {
    const result = await commitSaveImport({ statePath, files, backup: Buffer.from('full zip'), nowMs: 10 })
    assert.equal(await readFile(path.join(dir, 'backups', result.backupName), 'utf8'), 'full zip')
    assert.equal(await readFile(statePath, 'utf8'), '{"new":true}')
    assert.equal(await readFile(path.join(dir, 'skins', 'new.png'), 'utf8'), 'new skin')
    await assert.rejects(readFile(path.join(dir, 'skins', 'old.png')), { code: 'ENOENT' })
    assert.equal(await readFile(path.join(dir, 'keep.txt'), 'utf8'), 'keep')
  } finally { await done() }
})

test('backup write failure leaves the old save and managed directories untouched', async () => {
  const { dir, statePath, done } = await setup()
  const io = { ...fs, open: async (file, ...args) => {
    if (String(file).includes(`${path.sep}backups${path.sep}`)) throw new Error('injected backup failure')
    return fs.open(file, ...args)
  } }
  try {
    await assert.rejects(commitSaveImport({ statePath, files, backup: Buffer.from('zip'), io }), /injected backup failure/)
    assert.equal(await readFile(statePath, 'utf8'), '{"old":true}')
    assert.equal(await readFile(path.join(dir, 'skins', 'old.png'), 'utf8'), 'old skin')
  } finally { await done() }
})

test('transaction directory entry is synced before any managed root is removed', async () => {
  const { dir, statePath, done } = await setup()
  const roots = new Set([statePath, path.join(dir, 'skins'), path.join(dir, 'extensions'), `${statePath}.work-events`])
  let parentSynced = false, reachedRootMutation = false
  const io = { ...fs,
    mkdir: async (target, options) => {
      if (target === txPath(statePath) && options?.recursive === false) parentSynced = false
      return fs.mkdir(target, options)
    },
    open: async (file, ...args) => {
      const handle = await fs.open(file, ...args)
      return new Proxy(handle, { get(target, key) {
        if (key === 'sync' && file === dir) return async () => { parentSynced = true; return target.sync() }
        const value = Reflect.get(target, key, target)
        return typeof value === 'function' ? value.bind(target) : value
      } })
    },
    rm: async (target, options) => {
      if (roots.has(target)) { reachedRootMutation = true; assert.equal(parentSynced, true) }
      return fs.rm(target, options)
    },
  }
  try {
    await commitSaveImport({ statePath, files, backup: Buffer.from('zip'), io })
    assert.equal(reachedRootMutation, true)
  } finally { await done() }
})

test('rejects a symlinked backups directory without writing outside the save folder', async t => {
  if (process.platform === 'win32') return t.skip('symlink creation needs platform-specific privileges on Windows')
  const { dir, statePath, done } = await setup()
  const outside = path.join(dir, 'outside')
  try {
    await mkdir(outside)
    await fs.symlink(outside, path.join(dir, 'backups'))
    await assert.rejects(commitSaveImport({ statePath, files, backup: Buffer.from('zip') }), /备份目录无效/)
    assert.deepEqual(await fs.readdir(outside), [])
    assert.equal(await readFile(statePath, 'utf8'), '{"old":true}')
  } finally { await done() }
})

test('startup recovery rolls back a journaled transaction after only some roots were renamed', async () => {
  const { dir, statePath, done } = await setup()
  const tx = txPath(statePath)
  try {
    await mkdir(path.join(tx, 'old'), { recursive: true })
    await writeFile(path.join(tx, 'old', '0'), '{"old":true}')
    await mkdir(path.join(tx, 'old', '1'))
    await writeFile(path.join(tx, 'old', '1', 'old.png'), 'old skin')
    await mkdir(path.join(tx, 'old', '2'))
    await writeFile(path.join(tx, 'old', '2', 'old.js'), 'old ext')
    await mkdir(path.join(tx, 'old', '3'))
    await writeFile(path.join(dir, 'state.json'), '{"new":true}')
    await rm(path.join(dir, 'skins'), { recursive: true })
    await mkdir(path.join(dir, 'skins'))
    await writeFile(path.join(dir, 'skins', 'new.png'), 'partial new')
    await writeFile(path.join(tx, 'journal.json'), journal(statePath, { phase: 'applying', had: [true, true, true, false] }))

    assert.deepEqual(await recoverSaveImport(statePath), { recovered: true })
    assert.equal(await readFile(statePath, 'utf8'), '{"old":true}')
    assert.equal(await readFile(path.join(dir, 'skins', 'old.png'), 'utf8'), 'old skin')
    assert.equal(await readFile(path.join(dir, 'extensions', 'old.js'), 'utf8'), 'old ext')
    await assert.rejects(readFile(`${statePath}.work-events`), { code: 'ENOENT' })
  } finally { await done() }
})

test('sync startup recovery rolls back before callers can open the store', async () => {
  const { dir, statePath, done } = await setup()
  const tx = txPath(statePath)
  try {
    await mkdir(path.join(tx, 'old'), { recursive: true })
    await writeFile(path.join(tx, 'old', '0'), '{"old":true}')
    await mkdir(path.join(tx, 'old', '1'))
    await writeFile(path.join(tx, 'old', '1', 'old.png'), 'old skin')
    await mkdir(path.join(tx, 'old', '2'))
    await writeFile(path.join(tx, 'old', '2', 'old.js'), 'old ext')
    await writeFile(statePath, '{"new":true}')
    await writeFile(path.join(tx, 'journal.json'), journal(statePath, { phase: 'applying', had: [true, true, true, false] }))

    assert.deepEqual(recoverSaveImportSync(statePath), { recovered: true })
    assert.equal(await readFile(statePath, 'utf8'), '{"old":true}')
    assert.equal(await readFile(path.join(dir, 'skins', 'old.png'), 'utf8'), 'old skin')
    assert.equal(await readFile(path.join(dir, 'extensions', 'old.js'), 'utf8'), 'old ext')
  } finally { await done() }
})

test('malformed journal and missing rollback snapshot fail closed before changing files', async () => {
  for (const invalidJournal of [
    { version: 1, phase: 'applying', had: [1, true, true, false] },
    { version: 1, phase: 'unknown', had: [true, true, true, false] },
    { version: 1, phase: 'applying', had: [true, true, true, false] },
  ]) {
    const { dir, statePath, done } = await setup()
    const tx = txPath(statePath)
    try {
      await mkdir(tx, { recursive: true })
      if (invalidJournal.had.every(value => typeof value === 'boolean') && invalidJournal.phase === 'applying') {
        await mkdir(path.join(tx, 'old'), { recursive: true })
        await writeFile(path.join(tx, 'old', '0'), '{"old":true}')
        await mkdir(path.join(tx, 'old', '1'))
        await writeFile(path.join(tx, 'old', '1', 'old.png'), 'old skin')
        // old/2 is intentionally absent despite had[2] === true.
      }
      await writeFile(path.join(tx, 'journal.json'), journal(statePath, invalidJournal))
      assert.throws(() => recoverSaveImportSync(statePath), /日志格式无效|快照缺失/)
      await assert.rejects(recoverSaveImport(statePath), /日志格式无效|快照缺失/)
      assert.equal(await readFile(statePath, 'utf8'), '{"old":true}')
      assert.equal(await readFile(path.join(dir, 'skins', 'old.png'), 'utf8'), 'old skin')
    } finally { await done() }
  }
})

test('transaction directory and journal identity are bound to the exact state path', async () => {
  const { dir, statePath, done } = await setup()
  const otherPath = path.join(dir, 'other-profile.json')
  const tx = txPath(otherPath)
  try {
    await writeFile(otherPath, '{"other":true}')
    await mkdir(tx, { recursive: true })
    await writeFile(path.join(tx, 'journal.json'), journal(statePath, {
      phase: 'applying', had: [false, false, false, false],
    }))
    assert.deepEqual(await recoverSaveImport(statePath), { recovered: false })
    assert.throws(() => recoverSaveImportSync(otherPath), /日志格式无效/)
    assert.equal(await readFile(statePath, 'utf8'), '{"old":true}')
    assert.equal(await readFile(otherPath, 'utf8'), '{"other":true}')
  } finally { await done() }
})

test('rejects a symlinked rollback snapshot before touching any managed file', async t => {
  if (process.platform === 'win32') return t.skip('symlink creation needs platform-specific privileges on Windows')
  const { dir, statePath, done } = await setup()
  const tx = txPath(statePath)
  const outside = path.join(dir, 'outside')
  try {
    await mkdir(outside)
    await writeFile(path.join(outside, 'old.png'), 'outside')
    await mkdir(path.join(tx, 'old'), { recursive: true })
    await writeFile(path.join(tx, 'old', '0'), '{"old":true}')
    await fs.symlink(outside, path.join(tx, 'old', '1'))
    await writeFile(path.join(tx, 'journal.json'), journal(statePath, { phase: 'applying', had: [true, true, false, false] }))
    await assert.rejects(recoverSaveImport(statePath), /符号链接/)
    assert.throws(() => recoverSaveImportSync(statePath), /符号链接/)
    assert.equal(await readFile(statePath, 'utf8'), '{"old":true}')
    assert.equal(await readFile(path.join(dir, 'skins', 'old.png'), 'utf8'), 'old skin')
  } finally { await done() }
})

test('recovery can be retried after interruption while copying rollback snapshots', async () => {
  const { dir, statePath, done } = await setup()
  const tx = txPath(statePath)
  let failed = false
  const io = { ...fs, copyFile: async (...args) => {
    if (!failed) { failed = true; throw new Error('injected rollback interruption') }
    return fs.copyFile(...args)
  } }
  try {
    await mkdir(path.join(tx, 'old'), { recursive: true })
    await writeFile(path.join(tx, 'old', '0'), '{"old":true}')
    await mkdir(path.join(tx, 'old', '1'))
    await writeFile(path.join(tx, 'old', '1', 'old.png'), 'old skin')
    await mkdir(path.join(tx, 'old', '2'))
    await writeFile(path.join(tx, 'old', '2', 'old.js'), 'old ext')
    await writeFile(statePath, '{"new":true}')
    await writeFile(path.join(tx, 'journal.json'), journal(statePath, { phase: 'applying', had: [true, true, true, false] }))

    await assert.rejects(recoverSaveImport(statePath, { io }), /injected rollback interruption/)
    assert.ok(await fs.stat(path.join(tx, 'journal.json')), 'journal remains until rollback finishes')
    assert.deepEqual(await recoverSaveImport(statePath), { recovered: true })
    assert.equal(await readFile(statePath, 'utf8'), '{"old":true}')
    assert.equal(await readFile(path.join(dir, 'skins', 'old.png'), 'utf8'), 'old skin')
  } finally { await done() }
})

test('a failed install rolls back in-process and keeps the pre-import backup', async () => {
  const { dir, statePath, done } = await setup()
  let renameCount = 0
  let failed = false
  const io = { ...fs, rename: async (...args) => {
    renameCount += 1
    if (renameCount === 3 && !failed) { failed = true; throw new Error('injected install failure') }
    return fs.rename(...args)
  } }
  try {
    await assert.rejects(commitSaveImport({ statePath, files, backup: Buffer.from('zip'), io }), /injected install failure/)
    assert.equal(await readFile(statePath, 'utf8'), '{"old":true}')
    assert.equal(await readFile(path.join(dir, 'skins', 'old.png'), 'utf8'), 'old skin')
    assert.equal(await readFile(path.join(dir, 'keep.txt'), 'utf8'), 'keep')
    const backups = await fs.readdir(path.join(dir, 'backups'))
    assert.equal(backups.length, 1)
  } finally { await done() }
})

test('activate failure restores previous managed files while retaining the backup', async () => {
  const { dir, statePath, done } = await setup()
  let activated = false
  try {
    await assert.rejects(commitSaveImport({
      statePath, files, backup: Buffer.from('zip'),
      activate: async () => { activated = true; throw new Error('runtime reopen failed') },
    }), /runtime reopen failed/)
    assert.equal(activated, true)
    assert.equal(await readFile(statePath, 'utf8'), '{"old":true}')
    assert.equal(await readFile(path.join(dir, 'skins', 'old.png'), 'utf8'), 'old skin')
    assert.equal((await fs.readdir(path.join(dir, 'backups'))).length, 1)
  } finally { await done() }
})

test('post-commit journal-sync and cleanup failures report success and retain the imported save', async () => {
  for (const failure of ['committed-journal-sync', 'transaction-cleanup']) {
    const { dir, statePath, done } = await setup()
    const tx = txPath(statePath)
    let txSyncs = 0, failed = false
    const io = { ...fs,
      open: async (file, ...args) => {
        const handle = await fs.open(file, ...args)
        return new Proxy(handle, { get(target, key) {
          if (key === 'sync' && file === tx && failure === 'committed-journal-sync') return async () => {
            txSyncs += 1
            if (txSyncs === 4 && !failed) { failed = true; throw new Error('post-commit sync failed') }
            return target.sync()
          }
          const value = Reflect.get(target, key, target)
          return typeof value === 'function' ? value.bind(target) : value
        } })
      },
      rm: async (target, options) => {
        if (target === tx && failure === 'transaction-cleanup' && !failed) {
          failed = true; throw new Error('post-commit cleanup failed')
        }
        return fs.rm(target, options)
      },
    }
    try {
      const result = await commitSaveImport({ statePath, files, backup: Buffer.from('zip'), io })
      assert.equal(result.cleanupDeferred, true)
      assert.equal(await readFile(statePath, 'utf8'), '{"new":true}')
      assert.equal(JSON.parse(await readFile(path.join(tx, 'journal.json'), 'utf8')).phase, 'committed')
      assert.deepEqual(await recoverSaveImport(statePath), { recovered: false })
      assert.equal(await readFile(statePath, 'utf8'), '{"new":true}')
      await assert.rejects(fs.lstat(tx), { code: 'ENOENT' })
    } finally { await done() }
  }
})

test('rejects archive Windows ADS paths containing a colon', async () => {
  const { statePath, done } = await setup()
  try {
    await assert.rejects(commitSaveImport({
      statePath, files: new Map([['state.json', Buffer.from('{}')], ['skins/pig.png:secret', Buffer.from('x')]]),
      backup: Buffer.from('zip'),
    }), /路径无效/)
  } finally { await done() }
})

test('an arbitrary state basename must be a regular file before replacing managed roots', async () => {
  const s = await setup(), invalidPath = path.join(s.dir, 'custom-profile.dat')
  try {
    await mkdir(invalidPath)
    await writeFile(path.join(invalidPath, 'keep.txt'), 'directory is not a save')
    await assert.rejects(commitSaveImport({ statePath: invalidPath, files, backup: Buffer.from('backup') }), /路径类型无效/)
    assert.equal(await readFile(path.join(invalidPath, 'keep.txt'), 'utf8'), 'directory is not a save')
    assert.equal(await readFile(path.join(s.dir, 'skins', 'old.png'), 'utf8'), 'old skin')
    assert.equal(await readFile(path.join(s.dir, 'extensions', 'old.js'), 'utf8'), 'old ext')
  } finally { await s.done() }
})

test('snapshot files are flushed through writable handles required by Windows', async () => {
  const s = await setup()
  const io = Object.create(fs)
  io.open = async (file, flags, ...args) => {
    const handle = await fs.open(file, flags, ...args)
    const isFile = (await handle.stat()).isFile()
    return {
      writeFile: (...values) => handle.writeFile(...values),
      close: () => handle.close(),
      async sync() {
        if (isFile && flags === 'r') throw Object.assign(new Error('FlushFileBuffers requires write access'), { code: 'EPERM' })
        await handle.sync()
      },
    }
  }
  try {
    await commitSaveImport({ statePath: s.statePath, files, backup: Buffer.from('backup'), io })
    assert.deepEqual(JSON.parse(await readFile(s.statePath, 'utf8')), { new: true })
  } finally { await s.done() }
})

test('staged files and rollback snapshots are directory-synced before any managed root is replaced', async () => {
  const { dir, statePath, done } = await setup()
  const tx = txPath(statePath)
  const roots = new Set([statePath, path.join(dir, 'skins'), path.join(dir, 'extensions'), `${statePath}.work-events`])
  const synced = new Set()
  let checked = false
  const io = { ...fs,
    open: async (file, ...args) => {
      // Windows 上直接 open 目录会失败；用假句柄记录“确实调用了目录 fsync”，
      // 这样测试在 Linux/Windows 都验证同一段代码路径。
      const stat = await fs.lstat(file).catch(() => null)
      if (stat?.isDirectory()) return { sync: async () => { synced.add(String(file)) }, close: async () => {} }
      const handle = await fs.open(file, ...args)
      return new Proxy(handle, { get(target, key) {
        if (key === 'sync') return async () => { synced.add(String(file)); return target.sync() }
        const value = Reflect.get(target, key, target)
        return typeof value === 'function' ? value.bind(target) : value
      } })
    },
    rm: async (target, options) => {
      if (!checked && roots.has(target)) {
        checked = true
        for (const required of [path.join(tx, 'old'), path.join(tx, 'new'), path.join(tx, 'new', '2')]) {
          assert.equal(synced.has(required), true, `必须在替换存档前 fsync 目录 ${required}`)
        }
      }
      return fs.rm(target, options)
    },
  }
  const nested = new Map([...files, ['extensions/farm/server.js', Buffer.from('nested extension')]])
  try {
    await commitSaveImport({ statePath, files: nested, backup: Buffer.from('zip'), io })
    assert.equal(checked, true)
  } finally { await done() }
})

test('a state basename that collides with a managed directory is rejected before replacing files', async () => {
  for (const basename of ['skins', 'extensions', 'backups', 'Skins']) {
    const dir = await mkdtemp(path.join(tmpdir(), 'piggy-save-layout-'))
    const statePath = path.join(dir, basename)
    try {
      await writeFile(statePath, '{"old":true}')
      await assert.rejects(commitSaveImport({ statePath, files, backup: Buffer.from('zip') }), /重名|不能/)
      assert.equal(await readFile(statePath, 'utf8'), '{"old":true}', `${basename} 不能被替换`)
      if (basename !== 'backups') await assert.rejects(readFile(path.join(dir, 'backups')), { code: 'ENOENT' })
    } finally { await rm(dir, { recursive: true, force: true }) }
  }
})

test('recovery refuses a reserved state basename before touching the state file', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'piggy-save-layout-recover-'))
  const statePath = path.join(dir, 'skins')
  const tx = txPath(statePath)
  try {
    await writeFile(statePath, '{"old":true}')
    await mkdir(tx, { recursive: true })
    await writeFile(path.join(tx, 'journal.json'), journal(statePath, { phase: 'applying', had: [false, false, false, false] }))
    assert.throws(() => recoverSaveImportSync(statePath), /重名|不能/)
    await assert.rejects(recoverSaveImport(statePath), /重名|不能/)
    assert.equal(await readFile(statePath, 'utf8'), '{"old":true}')
    assert.equal(await readFile(path.join(tx, 'journal.json'), 'utf8'), journal(statePath, { phase: 'applying', had: [false, false, false, false] }))
  } finally { await rm(dir, { recursive: true, force: true }) }
})
