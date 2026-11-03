// @ts-check
/** OwnerDocument cloud transport. It stores complete owner archives and never imports over a live owner. */
import { createHash, randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'

import { STATE_VERSION } from '../core.js'
import { createOwnerDocumentArchiveImporter, exportOwnerDocumentArchive } from './owner-document-archive.js'
import { createGitSync } from './git-sync.js'
import { readZip } from './save-zip.js'
import { readWorkJson, writeWorkJson } from './work-files.js'

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
 *   baseHead?:string|null,
 *   now?:()=>number,git?:(args:string[],options:{cwd:string,sslVerify?:boolean,timeoutMs?:number})=>Promise<{stdout:string,stderr:string}>,
 *   gitBinary?:(args:string[],options:{cwd:string,sslVerify?:boolean,timeoutMs?:number})=>Promise<Buffer>}} options
 */
export function createOwnerCloudSync(options) {
  const now = options.now ?? Date.now
  const branch = options.branch ?? 'main'
  const directoryKey = createHash('sha256').update(`${options.remote}\0${branch}`).digest('hex').slice(0, 24)
  const baseStatePath = join(dirname(options.ownerDocumentPath), `.owner-cloud-base-${directoryKey}.json`)
  const remoteDigest = createHash('sha256').update(options.remote).digest('hex')
  let baseHead = options.baseHead ?? null

  function persistBaseHead(head) {
    if (!(head === null || /^[a-f0-9]{40,64}$/iu.test(head))) throw new Error('owner cloud base head is invalid')
    writeWorkJson(baseStatePath, { version: 1, ownerId: options.ownerId, remoteDigest, branch, remoteHead: head })
    baseHead = head
  }

  const savedBase = readWorkJson(baseStatePath)
  if (savedBase !== null) {
    if (Object.keys(savedBase).sort().join(',') !== 'branch,ownerId,remoteDigest,remoteHead,version' ||
        savedBase.version !== 1 || savedBase.ownerId !== options.ownerId || savedBase.remoteDigest !== remoteDigest ||
        savedBase.branch !== branch || !(savedBase.remoteHead === null ||
          (typeof savedBase.remoteHead === 'string' && /^[a-f0-9]{40,64}$/iu.test(savedBase.remoteHead)))) {
      throw new Error('owner cloud base state is invalid; evidence preserved')
    }
    // The local worktree may know about a successful push after the device marker
    // was last written. Its owner/remote binding is checked above, so prefer it.
    baseHead = savedBase.remoteHead
  } else if (options.baseHead !== undefined && options.baseHead !== null) {
    persistBaseHead(options.baseHead)
  }
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
    sameArchive: sameArchivePayload,
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
        if (direction === 'local-to-cloud') {
          const local = makeArchive()
          const remoteHead = await api.readRemoteHead(branch)
          if (remoteHead !== null) {
            const remote = await api.readBranchSave(branch)
            const remoteInfo = inspectArchive(remote.buffer, options.ownerDocumentPath, now)
            if (remoteInfo.ownerId !== options.ownerId) return { ok: false, reason: 'remote-owner-mismatch' }
            if (sameArchivePayload(remote.buffer, local.buffer)) {
              persistBaseHead(remoteHead)
              return { ok: true, alreadyCurrent: true, remoteHead }
            }
            return { ok: false, reason: 'remote-has-history' }
          }
          if (baseHead !== null) return { ok: false, reason: 'remote-branch-missing' }
          const pushed = await api.pushSnapshotFromHead(null)
          if (pushed.ok !== true || typeof pushed.remoteHead !== 'string') return pushed
          persistBaseHead(pushed.remoteHead)
          return { ok: true, created: true, remoteHead: pushed.remoteHead }
        }
        const remoteHead = await api.readRemoteHead(branch)
        if (remoteHead === null) return { ok: false, reason: 'remote-branch-empty' }
        const remote = await api.readBranchSave(branch)
        const preview = inspectArchive(remote.buffer, options.ownerDocumentPath, now)
        return {
          ok: true,
          archive: new Uint8Array(remote.buffer),
          ownerId: preview.ownerId,
          pigIds: preview.pigIds,
          summary: preview.summary,
          remoteHead,
        }
      })
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message : 'owner-cloud-first-sync-failed' }
    }
  }

  async function pushSnapshot() {
    try {
      return await sync.sequence(async api => {
        const expectedHead = baseHead
        if (expectedHead === null) return { ok: false, reason: 'first-sync-required' }
        const remoteHead = await api.readRemoteHead(branch)
        if (remoteHead === null) return { ok: false, reason: 'remote-branch-missing' }
        if (remoteHead !== expectedHead) {
          const remote = await api.readBranchSave(branch)
          const remoteInfo = inspectArchive(remote.buffer, options.ownerDocumentPath, now)
          if (remoteInfo.ownerId !== options.ownerId) return { ok: false, reason: 'remote-owner-mismatch' }
          const local = makeArchive()
          if (sameArchivePayload(remote.buffer, local.buffer)) {
            persistBaseHead(remoteHead)
            return { ok: true, alreadyCurrent: true, remoteHead }
          }
          return { ok: false, reason: 'remote-advanced', remoteHead }
        }
        const result = await api.pushSnapshotFromHead(expectedHead)
        if (result.ok === true && typeof result.remoteHead === 'string') persistBaseHead(result.remoteHead)
        return result
      })
    } catch (error) {
      return { ok: false, reason: 'push-failed', code: typeof error === 'object' && error !== null && 'code' in error
        ? String(error.code) : 'CLOUD_FAILED' }
    }
  }

  return Object.freeze({
    worktree: sync.worktree,
    firstSync,
    baseHead: () => baseHead,
    pushSnapshot,
    history: (targetBranch = branch) => sync.history(targetBranch),
    close: () => sync.close({ finalPush: false }),
    drain: () => sync.drain(),
  })
}
