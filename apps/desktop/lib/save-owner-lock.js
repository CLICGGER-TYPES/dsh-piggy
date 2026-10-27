// @ts-check
/** 一份存档只允许一个运行时；存活的 PID 从不回收，崩溃留下的锁可在重启时恢复。 */
import { randomBytes } from 'node:crypto'
import { lstatSync, mkdirSync, readdirSync, readFileSync, renameSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs'

function removeEmptyLock(directory) {
  // 只移除空目录；竞争者已经发布的新标记不能被删除。
  try { rmdirSync(directory) } catch (error) {
    if (!['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes(error?.code)) throw error
  }
}

export function acquireGameLock(statePath) {
  const fixed = `${statePath}.runtime.lock`
  const nonce = randomBytes(16).toString('hex')
  const name = `${nonce}.json`
  const candidate = `${fixed}.${nonce}.tmp`
  mkdirSync(candidate, { recursive: false, mode: 0o700 })
  writeFileSync(`${candidate}/${name}`, JSON.stringify({ pid: process.pid, nonce }), { flag: 'wx', mode: 0o600 })
  let published = false
  try {
    for (let attempt = 0; attempt < 16; attempt++) {
      try { renameSync(candidate, fixed); published = true; break }
      catch (error) {
        if (!['EEXIST', 'ENOTEMPTY', 'EPERM', 'EACCES'].includes(error?.code)) throw error
        let names
        try {
          const stat = lstatSync(fixed)
          if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('invalid game lock; evidence preserved')
          names = readdirSync(fixed)
        } catch (readError) { if (readError?.code === 'ENOENT') continue; throw readError }
        // Windows 不能用 rename 覆盖空目录；旧 owner 删除后崩溃可留下这种锁。
        if (names.length === 0) { removeEmptyLock(fixed); continue }
        if (names.length !== 1 || !/^[a-f0-9]{32}\.json$/.test(names[0])) throw new Error('invalid game lock; evidence preserved')
        let owner
        try { owner = JSON.parse(readFileSync(`${fixed}/${names[0]}`, 'utf8')) }
        catch (readError) { if (readError?.code === 'ENOENT') continue; throw readError }
        if (!Number.isSafeInteger(owner.pid) || owner.pid <= 0 || owner.nonce !== names[0].slice(0, -5)) {
          throw new Error('invalid game lock owner; evidence preserved')
        }
        try { process.kill(owner.pid, 0); throw new Error('game save already has a live runtime') }
        catch (probeError) { if (probeError?.code !== 'ESRCH') throw probeError }
        // 随机文件名绑定旧所有者，迟到回收不能删除新所有者的标记。
        try { unlinkSync(`${fixed}/${names[0]}`) } catch (removeError) { if (removeError?.code !== 'ENOENT') throw removeError }
        removeEmptyLock(fixed)
      }
    }
    if (!published) throw new Error('game lock contention')
  } finally {
    if (!published) { unlinkSync(`${candidate}/${name}`); rmdirSync(candidate) }
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
