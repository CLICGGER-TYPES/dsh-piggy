// @ts-check
/**
 * 一份存档只允许一个运行时。锁目录里记录 pid + 进程身份（启动时间/可执行路径）；
 * 只靠 pid 存在会在 Windows PID 复用时把无关进程当成活运行时，导致插件永远起不来。
 *
 * 判活顺序：
 *   1. process.kill(pid, 0) 不存在（ESRCH）→ 过期；
 *   2. 锁里有身份且能取到对方身份 → 身份不符即过期；
 *   3. 拿不到身份（权限、平台不支持）→ 保守当活着，宁可让用户手工清锁也不双写。
 * 老格式锁（只有 pid/nonce）没有身份：按进程名/路径判断，明确不是 DSH/Electron/Node
 * 一类运行时才回收；名字像运行时或取不到名字时仍保守当活着。
 *
 * 过期锁不直接删：把旧 owner 标记 rename 到同目录的 `<lock>.stale-<时间戳>/` 留证。
 * 只移动那个 nonce 文件，不整体 rename 锁目录，避免和刚发布的新 owner 抢目录。
 */
import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { basename } from 'node:path'
import { lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, renameSync, rmdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs'

const NONCE_NAME = /^[a-f0-9]{32}\.json$/
const START_TOLERANCE_MS = 5000
const RUNTIME_NAME = /(dsh|electron|node|deepseek|piggy)/i

function removeEmptyLock(directory) {
  // 只移除空目录；竞争者已经发布的新标记不能被删除。
  try { rmdirSync(directory) } catch (error) {
    if (!['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes(error?.code)) throw error
  }
}

/** @param {string} code @param {string} message @param {Record<string, any>} [fields] */
function lockError(code, message, fields = {}) {
  const error = new Error(message)
  Object.assign(error, { code }, fields)
  return error
}

/** 结果统一成可比较的身份；缺字段留给调用方判断。 @param {any} raw */
function identityOf(raw) {
  if (raw === null || typeof raw !== 'object') return null
  const startedAt = Number(raw.startedAt)
  const execPath = typeof raw.execPath === 'string' ? raw.execPath : ''
  const name = typeof raw.name === 'string' ? raw.name : ''
  const token = typeof raw.token === 'string' ? raw.token : ''
  if (!Number.isFinite(startedAt) && execPath === '' && name === '' && token === '') return null
  return {
    ...(Number.isFinite(startedAt) ? { startedAt } : {}),
    ...(execPath === '' ? {} : { execPath }),
    ...(name === '' ? {} : { name }),
    ...(token === '' ? {} : { token }),
  }
}

function samePath(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || left === '' || right === '') return null
  const normal = value => process.platform === 'win32' ? value.toLowerCase() : value
  return normal(left) === normal(right)
}

/** 锁里记的身份 vs 进程现在真实身份。返回 live / reused / unknown。
 * 稳定字段（启动时间、可执行路径）优先；token 只在前两者都不可比较时辅助判活，
 * 且只在两边同源时比较。token 抖动/一侧缺失一律 unknown，不能据此回收活锁。
 */
function compareIdentity(expected, actual) {
  if (actual?.alive !== true) return 'reused'
  const owner = identityOf(expected)
  if (owner === null) {
    const label = `${actual.name ?? ''} ${actual.execPath ?? ''}`.trim()
    // 老锁没有身份：明确是无关进程才回收；认不出就当活着，数据安全优先。
    if (label === '') return 'unknown'
    return RUNTIME_NAME.test(label) ? 'live' : 'reused'
  }
  let stable = false
  if (owner.startedAt !== undefined && Number.isFinite(actual.startedAt)) {
    stable = true
    if (Math.abs(owner.startedAt - actual.startedAt) > START_TOLERANCE_MS) return 'reused'
  }
  const pathMatch = samePath(owner.execPath, actual.execPath)
  if (pathMatch !== null) {
    stable = true
    if (!pathMatch) return 'reused'
  }
  if (stable) return 'live'
  const ownerToken = owner.token ?? ''
  const actualToken = typeof actual.token === 'string' ? actual.token : ''
  if (ownerToken !== '' && actualToken !== '') {
    const source = token => token.split(':', 1)[0]
    if (source(ownerToken) !== source(actualToken)) return 'unknown'
    return ownerToken === actualToken ? 'live' : 'unknown'
  }
  return 'unknown'
}

/** BSD/macOS ps etime：0:42 / 12:34 / 1:02:03 / 3-04:05:06；解析失败返回 null。 */
export function parsePsEtime(text, now = Date.now()) {
  const match = /^(?:(\d+)-)?(?:(\d+):)?(\d+):(\d+)$/.exec(String(text).trim())
  if (match === null) return null
  const days = Number(match[1] ?? 0), hours = Number(match[2] ?? 0)
  const minutes = Number(match[3]), seconds = Number(match[4])
  if (![days, hours, minutes, seconds].every(Number.isFinite)) return null
  return now - ((days * 86400) + (hours * 3600) + (minutes * 60) + seconds) * 1000
}

/**
 * @typedef {{alive:boolean,name?:string,execPath?:string,startedAt?:number,token?:string}} ProcessProbe
 * Linux 从 /proc 取；macOS/Windows 用系统命令。取不到就只回报“活着”。
 * @param {number} pid @param {NodeJS.Platform} [platform] @param {{log?:(level:'warn',message:string,fields?:Record<string,any>)=>void}} [options] @returns {ProcessProbe}
 */
export function probeProcess(pid, platform = process.platform, options = {}) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return { alive: false }
  try {
    process.kill(pid, 0)
  } catch (error) {
    if (error?.code === 'ESRCH') return { alive: false }
    if (error?.code !== 'EPERM') throw error
  }
  try {
    if (platform === 'linux') {
      const stat = readFileSync(`/proc/${pid}/stat`, 'utf8')
      const end = stat.lastIndexOf(')')
      const fields = stat.slice(end + 2).split(' ')
      const startTicks = Number(fields[19])
      const boot = readFileSync('/proc/stat', 'utf8').match(/^btime (\d+)$/m)
      const bootSeconds = boot === null ? null : Number(boot[1])
      let execPath = ''
      try { execPath = readlinkSync(`/proc/${pid}/exe`) } catch { /* permission */ }
      return {
        alive: true,
        name: stat.slice(stat.indexOf('(') + 1, end),
        ...(execPath === '' ? {} : { execPath }),
        ...(Number.isFinite(startTicks) && Number.isFinite(bootSeconds)
          ? { startedAt: bootSeconds * 1000 + startTicks * 10, token: `linux:${bootSeconds}:${startTicks}` }
          : {}),
      }
    }
    if (platform === 'darwin') {
      const out = spawnSync('ps', ['-p', String(pid), '-o', 'etime=', '-o', 'comm='], { encoding: 'utf8', timeout: 2000 })
      const text = String(out.stdout ?? '').trim()
      const split = /^(\S+)\s+(.*)$/.exec(text)
      const startedAt = out.status === 0 && split !== null ? parsePsEtime(split[1]) : null
      if (startedAt !== null) return { alive: true, name: split[2], startedAt }
      options.log?.('warn', 'macOS ps etime 解析失败，运行时锁退化为 alive-only', { pid, output: text.slice(0, 120) })
      return { alive: true }
    }
    if (platform === 'win32') {
      const script = `$p=Get-Process -Id ${pid} -ErrorAction SilentlyContinue; if($p -eq $null){exit 3}; `
        + `[Console]::Out.Write($p.StartTime.ToUniversalTime().ToString('o')+'|'+$p.Path)`
      const out = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', timeout: 4000 })
      if (out.status === 0) {
        const [when, execPath] = String(out.stdout ?? '').trim().split('|')
        const startedAt = Date.parse(when)
        if (Number.isFinite(startedAt)) {
          return { alive: true, name: execPath ? basename(execPath) : '', ...(execPath ? { execPath } : {}), startedAt, ...(execPath ? { token: `win:${when}:${execPath}` } : {}) }
        }
      }
      return { alive: true }
    }
    return { alive: true }
  } catch {
    return { alive: true }
  }
}

/** 本进程身份；同一个进程只取一次。 */
function selfIdentity(probe, injected) {
  if (injected !== undefined) return identityOf(injected)
  const probed = probe(process.pid)
  const fromProbe = probed?.alive === true ? identityOf(probed) : null
  if (fromProbe !== null) return fromProbe
  return identityOf({
    startedAt: Date.now() - process.uptime() * 1000,
    execPath: process.execPath,
    name: basename(process.execPath),
  })
}

/** 把旧 owner 标记移到 `<lock>.stale-<ts>/`；返回是否成功交接。 */
function preserveStale(fixed, name, owner, options) {
  const now = options.now ?? (() => Date.now())
  const stale = `${fixed}.stale-${now()}`
  try { mkdirSync(stale, { recursive: false, mode: 0o700 }) } catch (error) {
    if (error?.code !== 'EEXIST') throw error
  }
  try {
    renameSync(`${fixed}/${name}`, `${stale}/${name}`)
  } catch (error) {
    // Windows 上旧文件可能被杀软/索引占用：复制一份证据后直接删标记，并写日志。
    if (error?.code === 'ENOENT') { removeEmptyLock(stale); return { moved: false, stale } }
    try {
      writeFileSync(`${stale}/${name}.copy`, JSON.stringify(owner), { flag: 'wx', mode: 0o600 })
      unlinkSync(`${fixed}/${name}`)
      options.log?.('warn', '旧锁 rename 失败，已复制证据后删除', { lockPath: fixed, name, code: error?.code ?? '', stale })
    } catch (fallback) {
      removeEmptyLock(stale)
      throw lockError('OWNER_LOCK_RECLAIM_FAILED', 'stale runtime lock could not be moved aside; evidence preserved', {
        lockPath: fixed, name, stalePath: stale, reason: fallback?.code ?? String(fallback),
      })
    }
  }
  removeEmptyLock(fixed)
  return { moved: true, stale }
}

/**
 * @param {string} statePath
 * @param {{
 *   probe?: (pid:number)=>ProcessProbe,
 *   identity?: object,
 *   now?: ()=>number,
 *   log?: (level:'info'|'warn'|'error', message:string, fields?:Record<string,any>)=>void,
 * }} [options]
 */
export function acquireGameLock(statePath, options = {}) {
  const fixed = `${statePath}.runtime.lock`
  const probe = options.probe ?? (pid => probeProcess(pid, process.platform, { log }))
  const now = options.now ?? (() => Date.now())
  const log = options.log ?? (() => {})
  const nonce = randomBytes(16).toString('hex')
  const name = `${nonce}.json`
  const candidate = `${fixed}.${nonce}.tmp`
  const identity = selfIdentity(probe, options.identity)
  mkdirSync(candidate, { recursive: false, mode: 0o700 })
  writeFileSync(`${candidate}/${name}`, JSON.stringify({ pid: process.pid, nonce, identity }), { flag: 'wx', mode: 0o600 })
  let published = false
  try {
    for (let attempt = 0; attempt < 16; attempt++) {
      try { renameSync(candidate, fixed); published = true; break }
      catch (error) {
        if (!['EEXIST', 'ENOTEMPTY', 'EPERM', 'EACCES'].includes(error?.code)) throw error
        let names
        try {
          const stat = lstatSync(fixed)
          if (!stat.isDirectory() || stat.isSymbolicLink()) throw lockError('OWNER_LOCK_INVALID', 'invalid game lock; evidence preserved', { lockPath: fixed })
          names = readdirSync(fixed)
        } catch (readError) { if (readError?.code === 'ENOENT') continue; throw readError }
        // Windows 不能用 rename 覆盖空目录；旧 owner 删除后崩溃可留下这种锁。
        if (names.length === 0) { removeEmptyLock(fixed); continue }
        if (names.length !== 1 || !NONCE_NAME.test(names[0])) {
          throw lockError('OWNER_LOCK_INVALID', 'invalid game lock; evidence preserved', { lockPath: fixed, names })
        }
        let owner
        try { owner = JSON.parse(readFileSync(`${fixed}/${names[0]}`, 'utf8')) }
        catch (readError) { if (readError?.code === 'ENOENT') continue; throw readError }
        if (!Number.isSafeInteger(owner.pid) || owner.pid <= 0 || owner.nonce !== names[0].slice(0, -5)) {
          throw lockError('OWNER_LOCK_INVALID', 'invalid game lock owner; evidence preserved', { lockPath: fixed, ownerPid: owner.pid })
        }
        const actual = probe(owner.pid)
        const decision = compareIdentity(owner.identity ?? null, actual)
        if (decision === 'live' || decision === 'unknown') {
          throw lockError('OWNER_LOCK_LIVE', 'game save already has a live runtime', {
            lockPath: fixed,
            ownerPid: owner.pid,
            processName: actual?.name ?? '',
            processPath: actual?.execPath ?? '',
            decision,
          })
        }
        const preserved = preserveStale(fixed, names[0], owner, { now, log })
        log('info', '回收过期运行时锁', {
          lockPath: fixed, ownerPid: owner.pid, processName: actual?.name ?? '', processPath: actual?.execPath ?? '',
          decision, stalePath: preserved.moved ? preserved.stale : 'marker-already-gone',
        })
        continue
      }
    }
    if (!published) throw lockError('OWNER_LOCK_CONTENTION', 'game lock contention', { lockPath: fixed })
  } finally {
    if (!published) {
      try { unlinkSync(`${candidate}/${name}`) } catch { /* already gone */ }
      try { rmdirSync(candidate) } catch { /* already gone */ }
    }
  }
  let released = false
  return () => {
    if (released) return
    // 上一次可能已经删除 owner，但 rmdir 失败；重试只碰自己的随机标记。
    try { unlinkSync(`${fixed}/${name}`) } catch (error) { if (error?.code !== 'ENOENT') throw error }
    removeEmptyLock(fixed)
    released = true
  }
}
