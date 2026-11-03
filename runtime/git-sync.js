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
 */
import { execFile } from 'node:child_process'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)

/** 数据仓库里两个固定文件名。 */
export const SAVE_FILE = 'save.zip'
export const META_FILE = 'meta.json'

/** meta.json 的当前结构版本；改字段时加。 */
export const META_SCHEMA = 1

/** 运行中两次提交之间至少隔这么久（默认 10 分钟，见设计稿 §5）。 */
export const DEFAULT_DEBOUNCE_MS = 10 * 60 * 1000

/** Network Git must not keep shutdown or the plugin process alive indefinitely. */
export const DEFAULT_GIT_TIMEOUT_MS = 30_000
export const MAX_GIT_TIMEOUT_MS = 120_000
export const MAX_QUEUED_GIT_OPERATIONS = 8

function boundedTimeout(value) {
  return Number.isFinite(value) && value > 0 ? Math.min(value, MAX_GIT_TIMEOUT_MS) : DEFAULT_GIT_TIMEOUT_MS
}

function safeGitDetail(error) {
  const raw = `${error?.stderr ?? ''}\n${error?.stdout ?? ''}\n${error?.message ?? ''}`
  const safe = raw
    .replace(/(?:https?|ssh|git):\/\/[^\s'"<>]+/giu, '[remote]')
    .replace(/\b[^\s/@:]+@[^\s/:]+:[^\s]+/gu, '[remote]')
    .trim()
    .split(/\r?\n/u)
    .filter(Boolean)
  return safe.find(line => /^(?:fatal|error|remote):/iu.test(line)) ?? safe.at(-1) ?? 'unknown Git error'
}

function gitFailure(error, command, timeoutMs) {
  const timedOut = error?.killed === true || error?.signal === 'SIGKILL' || error?.code === 'ETIMEDOUT'
  if (error?.code === 'ENOENT') return Object.assign(new Error('git is not installed or not available on PATH'), { code: 'GIT_MISSING' })
  return Object.assign(new Error(timedOut
    ? `git ${command} timed out after ${timeoutMs} ms`
    : `git ${command} failed: ${safeGitDetail(error)}`), { code: timedOut ? 'GIT_TIMEOUT' : 'GIT_FAILED' })
}

/**
 * Read-only remote probe used by the settings screen. It never calls ensure(),
 * initializes a repository, changes an origin, or reads/writes a save archive.
 * @param {{remote:string,cwd:string,git?:(args:string[],options:{cwd:string,sslVerify?:boolean,timeoutMs?:number})=>Promise<{stdout:string,stderr:string}>,timeoutMs?:number}} input
 */
export async function testGitRemote({ remote, cwd, git = defaultGit, timeoutMs = 15_000 }) {
  try {
    await git(['ls-remote', '--symref', remote, 'HEAD'], { cwd, timeoutMs: boundedTimeout(timeoutMs) })
    return { ok: true }
  } catch (error) {
    const code = /** @type {any} */ (error)?.code
    const reason = code === 'GIT_TIMEOUT' ? '连接超时' : code === 'GIT_MISSING' ? '当前环境没有可用的 Git' : '无法连接，请检查地址和本机 Git 凭据配置'
    return { ok: false, reason }
  }
}

/**
 * 默认的 git 执行器：不读交互式输入，避免在无人值守时卡住。
 * @param {string[]} args
 * @param {{ cwd: string, sslVerify?: boolean, timeoutMs?: number }} options
 */
export async function defaultGit(args, { cwd, sslVerify = true, timeoutMs: requestedTimeoutMs = DEFAULT_GIT_TIMEOUT_MS }) {
  const timeoutMs = boundedTimeout(requestedTimeoutMs)
  const full = sslVerify ? ['-c', 'user.name=dsh-piggy', '-c', 'user.email=dsh-piggy@localhost', ...args]
    : ['-c', 'user.name=dsh-piggy', '-c', 'user.email=dsh-piggy@localhost', '-c', 'http.sslVerify=false', ...args]
  try {
    const result = await run('git', full, { cwd, windowsHide: true, timeout: timeoutMs, killSignal: 'SIGKILL',
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' } })
    return { stdout: result.stdout, stderr: result.stderr }
  } catch (error) { throw gitFailure(error, args[0] ?? 'command', timeoutMs) }
}

/**
 * 取二进制（`git show <ref>:save.zip`）用的执行器；文本执行器会按 utf8 解码，不能拿来读 zip。
 * @param {string[]} args
 * @param {{ cwd: string, sslVerify?: boolean, timeoutMs?: number }} options
 * @returns {Promise<Buffer>}
 */
export async function defaultGitBinary(args, { cwd, sslVerify = true, timeoutMs: requestedTimeoutMs = DEFAULT_GIT_TIMEOUT_MS }) {
  const timeoutMs = boundedTimeout(requestedTimeoutMs)
  const full = sslVerify ? ['-c', 'user.name=dsh-piggy', '-c', 'user.email=dsh-piggy@localhost', ...args]
    : ['-c', 'user.name=dsh-piggy', '-c', 'user.email=dsh-piggy@localhost', '-c', 'http.sslVerify=false', ...args]
  try {
    const result = await run('git', full, {
      cwd, windowsHide: true, encoding: 'buffer', maxBuffer: 64 * 1024 * 1024,
      timeout: timeoutMs, killSignal: 'SIGKILL',
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' },
    })
    return /** @type {Buffer} */ (result.stdout)
  } catch (error) { throw gitFailure(error, args[0] ?? 'command', timeoutMs) }
}

/**
 * 现在该不该提交。纯函数，单测直接算边界。
 * @param {{ lastCommitAt?: number, now: number, debounceMs?: number, dirty?: boolean }} input
 */
export function shouldCommit({ lastCommitAt = 0, now, debounceMs = DEFAULT_DEBOUNCE_MS, dirty = true }) {
  if (!dirty) return false
  return now - lastCommitAt >= debounceMs
}

/**
 * 提交信息：一行，方便 git log 扫。
 * @param {{lastSeenAt?: number | null, level?: number | null, coins?: number | null}} meta
 * @param {boolean} [manual]
 */
export function commitMessage({ lastSeenAt, level, coins }, manual = false) {
  const at = new Date(lastSeenAt || Date.now())
  const pad = value => String(value).padStart(2, '0')
  const iso = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`
  const lv = typeof level === 'number' && Number.isFinite(level) ? `Lv.${level}` : 'Lv.?'
  const money = typeof coins === 'number' && Number.isFinite(coins) ? `${coins}c` : '?c'
  return `${manual ? 'save-manual' : 'save'}: ${iso} ${lv} ${money}`
}

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

  /** Return the exact remote branch head without updating the local worktree. */
  async function readRemoteHeadUnlocked(targetBranch = branch) {
    const name = String(targetBranch ?? '').trim()
    if (!/^[\w.\-/]+$/u.test(name)) throw new Error('git-sync: 分支名不合法')
    await ensureUnlocked()
    const { stdout } = await exec(['ls-remote', '--heads', 'origin', name])
    const ref = `refs/heads/${name}`
    const line = stdout.split(/\r?\n/u).find(item => item.trim().split('\t')[1] === ref)
    if (line === undefined) return null
    const head = line.trim().split('\t')[0]
    if (!/^[a-f0-9]{40,64}$/iu.test(head)) throw new Error('git-sync: remote branch head is invalid')
    return head.toLowerCase()
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
    const actualHead = await readRemoteHeadUnlocked(branch)
    if (actualHead !== expectedHead) return { ok: false, reason: 'remote-advanced', remoteHead: actualHead }

    if (actualHead !== null) {
      await exec(['fetch', '-q', 'origin', branch])
      const fetchedHead = (await exec(['rev-parse', '--verify', `refs/remotes/origin/${branch}`])).stdout.trim().toLowerCase()
      if (fetchedHead !== actualHead) return { ok: false, reason: 'remote-advanced', remoteHead: fetchedHead }
      let localHead = null
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
    }

    const meta = await writeSnapshotUnlocked(false)
    const committed = await commitUnlocked(meta, false)
    if (committed === null) return { ok: true, remoteHead: actualHead, alreadyCurrent: true }
    try { await pushUnlocked() }
    catch (error) {
      const latest = await readRemoteHeadUnlocked(branch).catch(() => actualHead)
      if (latest !== actualHead) return { ok: false, reason: 'remote-advanced', remoteHead: latest }
      throw error
    }
    const remoteHead = await readRemoteHeadUnlocked(branch)
    if (remoteHead === null) return { ok: false, reason: 'remote-branch-missing', remoteHead: null }
    return { ok: true, remoteHead, committed: true }
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

  /**
   * 设置页的存档列表：最后一次手动提交 + 最近 limit 次自动提交。
   * 只读当前分支的提交历史，不切工作树。
   */
  /**
   * 读某一次提交里的存档（列表里选中哪条就读哪条）。
   * @param {{branch:string, hash:string}} target
   */
  async function readCommitSaveUnlocked({ branch: targetBranch, hash }) {
    const name = String(targetBranch ?? '').trim()
    const commit = String(hash ?? '').trim()
    if (!/^[\w.\-/]+$/u.test(name)) throw new Error('git-sync: 分支名不合法')
    if (!/^[0-9a-f]{7,40}$/u.test(commit)) throw new Error('git-sync: 提交号不合法')
    await ensureUnlocked()
    await exec(['fetch', '-q', 'origin', name])
    const meta = JSON.parse(await exec(['show', `${commit}:${META_FILE}`]).then(r => r.stdout))
    const buffer = await execBinary(['show', `${commit}:${SAVE_FILE}`])
    return { meta, buffer }
  }

  /** 手动拉取指定提交。 */
  async function applyCommitUnlocked(target) {
    const { meta, buffer } = await readCommitSaveUnlocked(target)
    const parsed = await parse(SAVE_FILE, buffer)
    const result = await importFiles(parsed.files)
    return { applied: true, meta, summary: parsed.summary, result }
  }
  async function historyUnlocked(targetBranch = branch, limit = 10) {
    const name = String(targetBranch ?? '').trim()
    if (!/^[\w.\-/]+$/u.test(name)) throw new Error('git-sync: 分支名不合法')
    await ensureUnlocked()
    await exec(['fetch', '-q', 'origin', name])
    const { stdout } = await exec(['log', `origin/${name}`, '--format=%H%x09%cI%x09%s', '-n', '80'])
    const items = []
    for (const line of stdout.split(/\r?\n/u)) {
      if (line.trim() === '') continue
      const [hash, at, subject] = line.split('\t')
      if (!subject) continue
      const manual = subject.startsWith('save-manual:')
      if (manual || subject.startsWith('save:')) items.push({ hash, at, subject, manual })
    }
    return {
      manual: items.find(item => item.manual) ?? null,
      auto: items.filter(item => !item.manual).slice(0, limit),
    }
  }
  /** 远端有哪些存档分支（设置页下拉框用）。 */
  async function listBranchesUnlocked() {
    await ensureUnlocked()
    const { stdout } = await exec(['ls-remote', '--heads', 'origin'])
    return stdout
      .split(/\r?\n/u)
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => line.split('\t')[1] ?? '')
      .filter(ref => ref.startsWith('refs/heads/'))
      .map(ref => ref.slice('refs/heads/'.length))
      .sort()
  }

  /**
   * 直接把某个远端分支的存档读出来（不切分支、不动工作树）。
   * 设置页的「从云端拉取」选哪个分支就读哪个。
   * @param {string} targetBranch
   */
  async function readBranchSaveUnlocked(targetBranch) {
    const name = String(targetBranch ?? '').trim()
    if (!/^[\w.\-/]+$/u.test(name)) throw new Error('git-sync: 分支名不合法')
    await ensureUnlocked()
    await exec(['fetch', '-q', 'origin', name])
    const metaRaw = await exec(['show', `origin/${name}:${META_FILE}`]).then(r => r.stdout)
    const meta = JSON.parse(metaRaw)
    const buffer = await execBinary(['show', `origin/${name}:${SAVE_FILE}`])
    return { meta, buffer }
  }

  /**
   * 手动拉取：读分支 → 解析 → 交给运行时替换。不判断新旧，用户点的就是要覆盖。
   * @param {string} targetBranch
   */
  async function applyBranchUnlocked(targetBranch) {
    const { meta, buffer } = await readBranchSaveUnlocked(targetBranch)
    const parsed = await parse(SAVE_FILE, buffer)
    const result = await importFiles(parsed.files)
    return { applied: true, meta, summary: parsed.summary, result }
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
    listBranches: listBranchesUnlocked,
    readBranchSave: readBranchSaveUnlocked,
    readRemoteHead: readRemoteHeadUnlocked,
    pushSnapshotFromHead: pushSnapshotFromHeadUnlocked,
    applyBranch: applyBranchUnlocked,
    history: historyUnlocked,
    readCommitSave: readCommitSaveUnlocked,
    applyCommit: applyCommitUnlocked,
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
    listBranches: enqueueMethod(listBranchesUnlocked),
    readBranchSave: enqueueMethod(readBranchSaveUnlocked),
    readRemoteHead: enqueueMethod(readRemoteHeadUnlocked),
    pushSnapshotFromHead: enqueueMethod(pushSnapshotFromHeadUnlocked),
    applyBranch: enqueueMethod(applyBranchUnlocked),
    history: enqueueMethod(historyUnlocked),
    readCommitSave: enqueueMethod(readCommitSaveUnlocked),
    applyCommit: enqueueMethod(applyCommitUnlocked),
    sequence,
    drain: () => queueTail,
    close,
  }
}
