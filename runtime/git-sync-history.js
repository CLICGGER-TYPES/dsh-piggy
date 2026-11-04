// @ts-check
/**
 * 云存档 git 的只读历史与分支读取：远端 head、提交列表、分支里的存档，
 * 以及按提交/分支解析并交给运行时替换。
 *
 * 所有操作都经调用方传入的 exec/execBinary 和队列内 ensure()，本模块不建仓库、
 * 不提交、不推送，也不直接创建进程。传输编排在 git-sync.js。
 *
 * @module dsh-piggy/runtime/git-sync-history
 */
import { META_FILE, SAVE_FILE } from './git-sync-process.js'

/**
 * @param {object} input
 * @param {(args: string[]) => Promise<{ stdout: string, stderr: string }>} input.exec
 * @param {(args: string[]) => Promise<Buffer>} input.execBinary
 * @param {() => Promise<string>} input.ensure
 * @param {string} input.branch
 * @param {(name: string, bytes: Buffer) => Promise<{ files: Map<string, Buffer>, summary?: any }> | { files: Map<string, Buffer>, summary?: any }} input.parse
 * @param {(files: Map<string, Buffer>) => Promise<any>} input.importFiles
 */
export function createGitHistory({ exec, execBinary, ensure, branch, parse, importFiles }) {
  /** Return the exact remote branch head without updating the local worktree. */
  async function readRemoteHead(targetBranch = branch) {
    const name = String(targetBranch ?? '').trim()
    if (!/^[\w.\-/]+$/u.test(name)) throw new Error('git-sync: 分支名不合法')
    await ensure()
    const { stdout } = await exec(['ls-remote', '--heads', 'origin', name])
    const ref = `refs/heads/${name}`
    const line = stdout.split(/\r?\n/u).find(item => item.trim().split('\t')[1] === ref)
    if (line === undefined) return null
    const head = line.trim().split('\t')[0]
    if (!/^[a-f0-9]{40,64}$/iu.test(head)) throw new Error('git-sync: remote branch head is invalid')
    return head.toLowerCase()
  }

  /**
   * 读某一次提交里的存档（列表里选中哪条就读哪条）。
   * @param {{branch:string, hash:string}} target
   */
  async function readCommitSave({ branch: targetBranch, hash }) {
    const name = String(targetBranch ?? '').trim()
    const commit = String(hash ?? '').trim()
    if (!/^[\w.\-/]+$/u.test(name)) throw new Error('git-sync: 分支名不合法')
    if (!/^[0-9a-f]{7,40}$/u.test(commit)) throw new Error('git-sync: 提交号不合法')
    await ensure()
    await exec(['fetch', '-q', 'origin', name])
    const meta = JSON.parse(await exec(['show', `${commit}:${META_FILE}`]).then(r => r.stdout))
    const buffer = await execBinary(['show', `${commit}:${SAVE_FILE}`])
    return { meta, buffer }
  }

  /** 手动拉取指定提交。 */
  async function applyCommit(target) {
    const { meta, buffer } = await readCommitSave(target)
    const parsed = await parse(SAVE_FILE, buffer)
    const result = await importFiles(parsed.files)
    return { applied: true, meta, summary: parsed.summary, result }
  }

  /**
   * 设置页的存档列表：最后一次手动提交 + 最近 limit 次自动提交。
   * 只读当前分支的提交历史，不切工作树。
   */
  async function history(targetBranch = branch, limit = 10) {
    const name = String(targetBranch ?? '').trim()
    if (!/^[\w.\-/]+$/u.test(name)) throw new Error('git-sync: 分支名不合法')
    await ensure()
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
  async function listBranches() {
    await ensure()
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
  async function readBranchSave(targetBranch) {
    const name = String(targetBranch ?? '').trim()
    if (!/^[\w.\-/]+$/u.test(name)) throw new Error('git-sync: 分支名不合法')
    await ensure()
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
  async function applyBranch(targetBranch) {
    const { meta, buffer } = await readBranchSave(targetBranch)
    const parsed = await parse(SAVE_FILE, buffer)
    const result = await importFiles(parsed.files)
    return { applied: true, meta, summary: parsed.summary, result }
  }

  return {
    readRemoteHead,
    history,
    listBranches,
    readBranchSave,
    applyBranch,
    readCommitSave,
    applyCommit,
  }
}
