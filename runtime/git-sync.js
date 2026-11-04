// @ts-check
/**
 * 云存档的 git 传输层。
 *
 * 只做三件事：把整档写进一个独立的数据仓库、提交、推送/拉取。养成规则、打包与校验都不在这里：
 * 打包用 runtime/save-archive.js 的 archive()，解析用 parseSaveArchive()，替换交给调用方。
 *
 * 数据仓库布局（详见 docs/design/cloud-save-git.md）：
 *   save.zip    整档，和「设置 → 存档」导出的同一份
 *   meta.json   { schemaVersion, stateVersion, lastSeenAt, device, exportedAt }
 *
 * 为什么要单独一个仓库：存档含名字、称呼、回忆，必须私有；放在源码仓库里既污染历史也容易误公开。
 *
 * 子模块分工：进程执行/常量在 git-sync-process.js，提交节奏在 git-sync-commit.js，
 * 只读历史/分支在 git-sync-history.js；本文件保留公共导出和队列编排。
 */
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import { commitMessage } from './git-sync-commit.js'
import { createGitHistory } from './git-sync-history.js'
import {
  DEFAULT_GIT_TIMEOUT_MS, MAX_QUEUED_GIT_OPERATIONS, META_FILE, META_SCHEMA, SAVE_FILE,
  boundedTimeout, defaultGit, defaultGitBinary, safeGitDetail,
} from './git-sync-process.js'

export {
  DEFAULT_DEBOUNCE_MS, DEFAULT_GIT_TIMEOUT_MS, MAX_GIT_TIMEOUT_MS, MAX_QUEUED_GIT_OPERATIONS,
  META_FILE, META_SCHEMA, SAVE_FILE, defaultGit, defaultGitBinary, testGitRemote,
} from './git-sync-process.js'
export { commitMessage, shouldCommit } from './git-sync-commit.js'

/**
 * @param {object} options
 * @param {string} options.statePath 存档路径（用来推默认的数据仓库目录）
 * @param {string} [options.directory] 数据仓库工作树；默认存档目录旁的 cloud-save/
 * @param {string} options.remote 远端地址
 * @param {string} [options.branch]
 * @param {string} [options.device] 写进 meta.json 的设备名
 * @param {(name: string, bytes: Buffer) => Promise<{ files: Map<string, Buffer>, summary?: any }> | { files: Map<string, Buffer>, summary?: any }} options.parse
 * @param {(files: Map<string, Buffer>) => Promise<any>} options.importFiles 把解析出的文件交给运行时替换
 * @param {() => Promise<{ buffer: Buffer, stateVersion?: number, lastSeenAt?: number, level?: number, coins?: number }> | { buffer: Buffer, stateVersion?: number, lastSeenAt?: number, level?: number, coins?: number }} options.archive
 * @param {(previous:Buffer,next:Buffer)=>boolean} [options.sameArchive] Cloud formats with nondeterministic manifests may compare validated payloads.
 * @param {(args: string[], options: { cwd: string, sslVerify?: boolean, timeoutMs?: number }) => Promise<{ stdout: string, stderr: string }>} [options.git]
 * @param {(args: string[], options: { cwd: string, sslVerify?: boolean, timeoutMs?: number }) => Promise<Buffer>} [options.gitBinary]
 * @param {number} [options.gitTimeoutMs]
 * @param {number} [options.maxQueuedOperations]
 * @param {number | (() => number)} [options.now]
 * @param {boolean} [options.insecureSkipTlsVerify] 代理做 TLS 拦截时才开（默认关）
 */
export function createGitSync(options) {
  const {
    statePath, directory, remote, branch = 'main', device = '',
    parse, importFiles, archive, sameArchive = (previous, next) => previous.equals(next),
    git = defaultGit,
    gitBinary = defaultGitBinary,
    now = Date.now,
    insecureSkipTlsVerify = false,
    gitTimeoutMs = DEFAULT_GIT_TIMEOUT_MS,
    maxQueuedOperations = MAX_QUEUED_GIT_OPERATIONS,
  } = options
  if (typeof archive !== 'function') throw new Error('git-sync: 需要 archive()')
  if (typeof parse !== 'function') throw new Error('git-sync: 需要 parse()')
  if (typeof importFiles !== 'function') throw new Error('git-sync: 需要 importFiles()')

  const worktree = directory ?? join(dirname(statePath), 'cloud-save')
  const at = () => (typeof now === 'function' ? now() : now)
  const gitOptions = { cwd: worktree, sslVerify: !insecureSkipTlsVerify, timeoutMs: boundedTimeout(gitTimeoutMs) }
  const exec = args => git(args, gitOptions)
  const execBinary = args => gitBinary(args, gitOptions)
  let accepting = true
  let queueTail = Promise.resolve()
  let queued = 0
  let closePromise = null
  const queueLimit = Number.isInteger(maxQueuedOperations) && maxQueuedOperations > 0
    ? Math.min(maxQueuedOperations, MAX_QUEUED_GIT_OPERATIONS) : MAX_QUEUED_GIT_OPERATIONS

  function serialize(operation, allowClosing = false) {
    if (!accepting && !allowClosing) return Promise.reject(new Error('cloud Git queue is closing'))
    if (queued >= queueLimit) return Promise.reject(new Error('cloud Git queue is full'))
    queued += 1
    const result = queueTail.then(operation)
    const settled = result.finally(() => { queued -= 1 })
    queueTail = settled.then(() => undefined, () => undefined)
    return settled
  }

  async function exists(target) {
    try { await access(target); return true } catch { return false }
  }

  /** 建仓库、挂远端；已经有了就只补远端。 */
  async function ensureUnlocked() {
    await mkdir(worktree, { recursive: true })
    if (!(await exists(join(worktree, '.git')))) {
      await exec(['init', '-q', '-b', branch])
    }
    const remotes = (await exec(['remote'])).stdout.split(/\r?\n/u).filter(Boolean)
    if (!remotes.includes('origin')) await exec(['remote', 'add', 'origin', remote])
    else await exec(['remote', 'set-url', 'origin', remote])
    return worktree
  }

  const historyOps = createGitHistory({
    exec, execBinary, ensure: ensureUnlocked, branch, parse, importFiles,
  })

  async function readMetaUnlocked() {
    try {
      return JSON.parse(await readFile(join(worktree, META_FILE), 'utf8'))
    } catch {
      return null
    }
  }

  /** 把当前存档写成 save.zip + meta.json（不提交）。 */
  async function writeSnapshotUnlocked(force = false) {
    const snapshot = await archive()
    if (!Buffer.isBuffer(snapshot?.buffer)) throw new Error('git-sync: archive() 没有返回 buffer')
    // 存档字节没变就不重写：否则 meta 的 exportedAt 每次都变，定时推送会把历史灌满空提交。
    const previous = force ? null : await readFile(join(worktree, SAVE_FILE)).catch(() => null)
    if (previous !== null && sameArchive(previous, snapshot.buffer)) {
      const current = await readMetaUnlocked()
      if (current !== null) return current
    }
    await writeFile(join(worktree, SAVE_FILE), snapshot.buffer)
    const meta = {
      schemaVersion: META_SCHEMA,
      stateVersion: snapshot.stateVersion ?? null,
      lastSeenAt: snapshot.lastSeenAt ?? at(),
      level: snapshot.level ?? null,
      coins: snapshot.coins ?? null,
      device: String(device ?? ''),
      exportedAt: at(),
    }
    await writeFile(join(worktree, META_FILE), JSON.stringify(meta, null, 2) + '\n')
    return meta
  }

  /** 有没有东西要提交。 */
  async function dirtyUnlocked() {
    const { stdout } = await exec(['status', '--porcelain'])
    return stdout.trim() !== ''
  }

  /** 提交（没有变化就返回 null）。 */
  async function commitUnlocked(meta, manual = false) {
    if (!(await dirtyUnlocked())) return null
    await exec(['add', '-A'])
    const message = meta === undefined || meta === null
      ? commitMessage({ lastSeenAt: at() }, manual)
      : commitMessage(meta, manual)
    const { stdout } = await exec(['commit', '-q', '-m', message])
    return { message, stdout }
  }

  async function pushUnlocked() {
    await exec(['push', '-q', 'origin', branch])
  }

  /**
   * Create a normal fast-forward commit only if the remote head is still the caller's acknowledged base.
   * Unlike pushSnapshotUnlocked this path never resets the local branch to a newer remote head.
   * @param {string|null} expectedHead
   */
  async function pushSnapshotFromHeadUnlocked(expectedHead) {
    if (!(expectedHead === null || /^[a-f0-9]{40,64}$/iu.test(expectedHead))) {
      throw new Error('git-sync: expected remote head is invalid')
    }
    await ensureUnlocked()
    const actualHead = await historyOps.readRemoteHead(branch)
    if (actualHead !== expectedHead) return { ok: false, reason: 'remote-advanced', remoteHead: actualHead }

    let localHead = null
    if (actualHead !== null) {
      await exec(['fetch', '-q', 'origin', branch])
      const fetchedHead = (await exec(['rev-parse', '--verify', `refs/remotes/origin/${branch}`])).stdout.trim().toLowerCase()
      if (fetchedHead !== actualHead) return { ok: false, reason: 'remote-advanced', remoteHead: fetchedHead }
      try { localHead = (await exec(['rev-parse', '--verify', 'HEAD'])).stdout.trim() }
      catch (error) {
        if (!/needed a single revision|unknown revision|bad revision/i.test(safeGitDetail(error))) throw error
      }
      if (!localHead) {
        await exec(['checkout', '-q', '-B', branch, `origin/${branch}`])
      } else {
        try { await exec(['merge-base', '--is-ancestor', actualHead, 'HEAD']) }
        catch { return { ok: false, reason: 'local-history-conflict', remoteHead: actualHead } }
      }
    } else {
      try { localHead = (await exec(['rev-parse', '--verify', 'HEAD'])).stdout.trim().toLowerCase() }
      catch (error) {
        if (!/needed a single revision|unknown revision|bad revision/i.test(safeGitDetail(error))) throw error
      }
    }

    const meta = await writeSnapshotUnlocked(false)
    const committed = await commitUnlocked(meta, false)
    localHead = (await exec(['rev-parse', '--verify', 'HEAD'])).stdout.trim().toLowerCase()
    if (committed === null && localHead === actualHead) {
      return { ok: true, remoteHead: actualHead, alreadyCurrent: true }
    }
    try { await pushUnlocked() }
    catch (error) {
      const latest = await historyOps.readRemoteHead(branch).catch(() => actualHead)
      if (latest !== actualHead) return { ok: false, reason: 'remote-advanced', remoteHead: latest }
      throw error
    }
    const remoteHead = await historyOps.readRemoteHead(branch)
    if (remoteHead === null) return { ok: false, reason: 'remote-branch-missing', remoteHead: null }
    if (remoteHead !== localHead) return { ok: false, reason: 'remote-advanced', remoteHead }
    return { ok: true, remoteHead: localHead, committed: committed !== null, pushed: true }
  }

  /** 拉取；没有远端分支时当作成功（第一次初始化）。 */
  async function pullUnlocked() {
    try {
      await exec(['pull', '-q', '--ff-only', 'origin', branch])
      return { ok: true }
    } catch (error) {
      const text = safeGitDetail(error)
      if (/couldn't find remote ref|no such ref|does not appear to be a git repository/i.test(text)) {
        return { ok: true, empty: true }
      }
      return { ok: false, message: text || 'pull failed' }
    }
  }

  /**
   * 拉取并判断要不要导入。
   * @param {number} [localLastSeenAt] 本地存档的 lastSeenAt，用来判断新旧
   */
  async function pullIfNewerUnlocked(localLastSeenAt) {
    await ensureUnlocked()
    const pulled = await pullUnlocked()
    if (!pulled.ok) return { applied: false, reason: 'pull-failed', message: pulled.message }
    const meta = await readMetaUnlocked()
    if (meta === null) return { applied: false, reason: 'no-remote-save' }
    if (!(Number(meta.lastSeenAt) > Number(localLastSeenAt ?? 0))) {
      return { applied: false, reason: 'not-newer', meta }
    }
    const buffer = await readFile(join(worktree, SAVE_FILE))
    const parsed = await parse(SAVE_FILE, buffer)
    await importFiles(parsed.files)
    return { applied: true, meta, summary: parsed.summary }
  }

  /** 导出 + 提交 + 推送；失败只回错误，不抛到调用方。 */
  async function pushSnapshotUnlocked(options = {}) {
    await ensureUnlocked()
    // 远端可能已经有历史（别的机器推过，或本地工作树是新建的）：先 fetch，再把本地
    // 提交「接」到远端最新提交之上，避免 unrelated histories / non-fast-forward。
    try {
      await exec(['fetch', '-q', 'origin', branch])
      await exec(['reset', '--soft', `origin/${branch}`])
    } catch (error) {
      if (!/couldn't find remote ref|no such ref|does not appear to be a git repository/i.test(safeGitDetail(error))) throw error
      // 远端尚无分支时允许首次推送；网络、权限、TLS、超时等错误不能被当作空仓库。
    }
    const meta = await writeSnapshotUnlocked(options.manual === true)
    const committed = await commitUnlocked(meta, options.manual === true)
    await pushUnlocked()
    return { meta, committed }
  }

  const sequenceApi = Object.freeze({
    ensure: ensureUnlocked,
    readMeta: readMetaUnlocked,
    writeSnapshot: writeSnapshotUnlocked,
    dirty: dirtyUnlocked,
    commit: commitUnlocked,
    push: pushUnlocked,
    pull: pullUnlocked,
    pullIfNewer: pullIfNewerUnlocked,
    pushSnapshot: pushSnapshotUnlocked,
    listBranches: historyOps.listBranches,
    readBranchSave: historyOps.readBranchSave,
    readRemoteHead: historyOps.readRemoteHead,
    pushSnapshotFromHead: pushSnapshotFromHeadUnlocked,
    applyBranch: historyOps.applyBranch,
    history: historyOps.history,
    readCommitSave: historyOps.readCommitSave,
    applyCommit: historyOps.applyCommit,
  })

  const enqueueMethod = method => (...args) => serialize(() => method(...args))
  function sequence(operation) {
    if (typeof operation !== 'function') return Promise.reject(new TypeError('cloud Git sequence requires a callback'))
    return serialize(() => operation(sequenceApi))
  }

  function close({ finalPush = false } = {}) {
    if (closePromise !== null) return closePromise
    accepting = false
    closePromise = (async () => {
      await queueTail
      if (finalPush) await serialize(() => pushSnapshotUnlocked(), true)
      return { drained: true, finalPush }
    })()
    return closePromise
  }

  return {
    worktree,
    ensure: enqueueMethod(ensureUnlocked),
    readMeta: enqueueMethod(readMetaUnlocked),
    writeSnapshot: enqueueMethod(writeSnapshotUnlocked),
    dirty: enqueueMethod(dirtyUnlocked),
    commit: enqueueMethod(commitUnlocked),
    push: enqueueMethod(pushUnlocked),
    pull: enqueueMethod(pullUnlocked),
    pullIfNewer: enqueueMethod(pullIfNewerUnlocked),
    pushSnapshot: enqueueMethod(pushSnapshotUnlocked),
    listBranches: enqueueMethod(historyOps.listBranches),
    readBranchSave: enqueueMethod(historyOps.readBranchSave),
    readRemoteHead: enqueueMethod(historyOps.readRemoteHead),
    pushSnapshotFromHead: enqueueMethod(pushSnapshotFromHeadUnlocked),
    applyBranch: enqueueMethod(historyOps.applyBranch),
    history: enqueueMethod(historyOps.history),
    readCommitSave: enqueueMethod(historyOps.readCommitSave),
    applyCommit: enqueueMethod(historyOps.applyCommit),
    sequence,
    drain: () => queueTail,
    close,
  }
}
