// @ts-check
/** OwnerDocument cloud transport. It stores complete owner archives and never imports over a live owner. */
import { createHash, randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'

import { STATE_VERSION } from '../core.js'
import { createOwnerDocumentArchiveImporter, exportOwnerDocumentArchive } from './owner-document-archive.js'
import { createGitSync } from './git-sync.js'
import { readZip } from './save-zip.js'

/** @param {Buffer} buffer @param {string} ownerDocumentPath @param {() => number} now */
function inspectArchive(buffer, ownerDocumentPath, now) {
  const destination = join(dirname(ownerDocumentPath), `.owner-cloud-preview-${randomUUID()}`, 'owner-document.json')
  const importer = createOwnerDocumentArchiveImporter({ ownerDocumentPath: destination, allowLegacy: false, now })
  try {
    const preview = importer.preview(buffer)
    if (preview.ok !== true) throw new Error('cloud branch does not contain a valid complete owner archive')
    return preview
  } finally { importer.clear() }
}

/** The owner archive manifest records its creation time; compare its payload, not that timestamp. @param {Buffer} left @param {Buffer} right */
function sameArchivePayload(left, right) {
  const a = readZip(left), b = readZip(right)
  const namesA = [...a.keys()].filter(name => name !== 'owner-archive.json').sort()
  const namesB = [...b.keys()].filter(name => name !== 'owner-archive.json').sort()
  return namesA.length === namesB.length && namesA.every((name, index) => name === namesB[index] && a.get(name)?.equals(b.get(name)))
}

/**
 * A Git queue around the existing complete OwnerDocument archive format.
 * First sync is explicit: local-to-cloud creates only an empty branch, while
 * cloud-to-local returns validated bytes for the desktop's copy-and-switch flow.
 * @param {{ownerDocumentPath:string,ownerId:string,remote:string,branch?:string,provider?:string,device?:string,
 *   now?:()=>number,git?:(args:string[],options:{cwd:string,sslVerify?:boolean,timeoutMs?:number})=>Promise<{stdout:string,stderr:string}>,
 *   gitBinary?:(args:string[],options:{cwd:string,sslVerify?:boolean,timeoutMs?:number})=>Promise<Buffer>}} options
 */
export function createOwnerCloudSync(options) {
  const now = options.now ?? Date.now
  const branch = options.branch ?? 'main'
  const directoryKey = createHash('sha256').update(`${options.remote}\0${branch}`).digest('hex').slice(0, 24)
  const makeArchive = () => {
    const built = exportOwnerDocumentArchive({ ownerDocumentPath: options.ownerDocumentPath, ownerId: options.ownerId, nowMs: now() })
    const preview = inspectArchive(built.buffer, options.ownerDocumentPath, now)
    return {
      buffer: built.buffer,
      name: built.name,
      summary: preview.summary,
      stateVersion: STATE_VERSION,
      lastSeenAt: now(),
      level: null,
      coins: preview.summary.shared.coins,
    }
  }
  const sync = createGitSync({
    statePath: options.ownerDocumentPath,
    directory: join(dirname(options.ownerDocumentPath), `.owner-cloud-${directoryKey}`),
    remote: options.remote,
    branch,
    device: options.device ?? '',
    ...(options.git === undefined ? {} : { git: options.git }),
    ...(options.gitBinary === undefined ? {} : { gitBinary: options.gitBinary }),
    archive: makeArchive,
    parse(_name, buffer) {
      const preview = inspectArchive(buffer, options.ownerDocumentPath, now)
      return { files: new Map([['owner-document-archive.zip', buffer]]), summary: preview.summary }
    },
    importFiles: async () => { throw new Error('cloud restore must create a new owner copy and switch explicitly') },
  })

  async function firstSync(direction) {
    if (direction !== 'local-to-cloud' && direction !== 'cloud-to-local') {
      return { ok: false, reason: 'first-sync-direction-required' }
    }
    try {
      return await sync.sequence(async api => {
        await api.ensure()
        const branches = await api.listBranches()
        if (direction === 'local-to-cloud') {
          const local = makeArchive()
          if (branches.includes(branch)) {
            const remote = await api.readBranchSave(branch)
            const remoteInfo = inspectArchive(remote.buffer, options.ownerDocumentPath, now)
            if (remoteInfo.ownerId !== options.ownerId) return { ok: false, reason: 'remote-owner-mismatch' }
            if (sameArchivePayload(remote.buffer, local.buffer)) return { ok: true, alreadyCurrent: true }
            return { ok: false, reason: 'remote-has-history' }
          }
          // Do not use pushSnapshot here: its legacy fast-forward preparation can
          // adopt a branch that appeared after the empty-branch check. A plain push
          // fails safely if another writer creates this branch concurrently.
          const meta = await api.writeSnapshot(true)
          await api.commit(meta, true)
          await api.push()
          return { ok: true, created: true }
        }
        if (!branches.includes(branch)) return { ok: false, reason: 'remote-branch-empty' }
        const remote = await api.readBranchSave(branch)
        const preview = inspectArchive(remote.buffer, options.ownerDocumentPath, now)
        return {
          ok: true,
          archive: new Uint8Array(remote.buffer),
          ownerId: preview.ownerId,
          pigIds: preview.pigIds,
          summary: preview.summary,
        }
      })
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message : 'owner-cloud-first-sync-failed' }
    }
  }

  return Object.freeze({
    worktree: sync.worktree,
    firstSync,
    pushSnapshot: () => sync.pushSnapshot(),
    history: (targetBranch = branch) => sync.history(targetBranch),
    close: options => sync.close(options),
    drain: () => sync.drain(),
  })
}
