// @ts-check
/** Desktop owner-archive operations; renderer receives summaries/tokens, never filesystem paths or IDs. */
import { randomUUID } from 'node:crypto'
import { lstatSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { saveArchive } from './save-export.js'

const MAX_ARCHIVE_BYTES = 128 * 1024 * 1024
const NAME_PATTERN = /^piggy-owner-save-\d{8}-\d{4}\.zip$/

function safeBytes(value) {
  if (value instanceof ArrayBuffer) return Buffer.from(value)
  if (value instanceof Uint8Array) return Buffer.from(value.buffer, value.byteOffset, value.byteLength)
  return null
}

function ownerSaveName(nowMs = Date.now()) {
  const date = new Date(nowMs), pad = value => String(value).padStart(2, '0')
  return `piggy-owner-save-${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}.zip`
}

/**
 * @param {{archiveRoot:string,downloadsDir:string,dialog:any,getWin:()=>any,getHost:()=>any,getGameDir:()=>string|null,
 *   getOwnerConfig:()=>any,isSupported:()=>boolean,selectionStore:any,lifecycle:any,writeFile:typeof import('node:fs/promises').writeFile,
 *   isQuitting:()=>boolean,log:(...parts:any[])=>any}} deps
 */
export function createOwnerArchiveManager(deps) {
  /** @type {Map<string, {importer:any,ownerDocumentPath:string,initialPigId:string,expires:number}>} */
  const previews = new Map()
  let loadedDir = ''
  let loadedApi = null

  async function apiFor(gameDir) {
    if (loadedApi !== null && loadedDir === gameDir) return loadedApi
    const runtimeUrl = pathToFileURL(join(gameDir, 'runtime/index.js')).href
    const runtime = await import(runtimeUrl)
    if (runtime.OWNER_ARCHIVE_RUNTIME_API_VERSION !== 1) throw new Error('当前游戏版本不支持完整存档功能')
    const archiveUrl = pathToFileURL(join(gameDir, 'runtime/owner-document-archive.js')).href
    const fileUrl = pathToFileURL(join(gameDir, 'runtime/owner-document-file.js')).href
    const archive = await import(archiveUrl)
    const files = await import(fileUrl)
    loadedDir = gameDir
    loadedApi = { archive, files }
    return loadedApi
  }

  function ensureArchiveRoot() {
    try { mkdirSync(deps.archiveRoot, { recursive: true, mode: 0o700 }) }
    catch { throw new Error('本机独立存档目录无法创建') }
    let stat
    try { stat = lstatSync(deps.archiveRoot) } catch { throw new Error('本机独立存档目录不可用') }
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('本机独立存档目录无效')
  }

  function status() {
    const gameDir = deps.getGameDir()
    const host = deps.getHost()
    const explicitTaskOwner = deps.getOwnerConfig()?.source === 'task'
    return {
      ok: true,
      available: gameDir !== null && host !== null && host !== undefined && deps.isSupported() && !explicitTaskOwner,
      mode: deps.getOwnerConfig() ? 'owner' : 'legacy',
      flatImportAllowed: !deps.getOwnerConfig(),
      ...(explicitTaskOwner ? { reason: '当前是隔离运行模式' } : {}),
    }
  }

  async function exportArchive() {
    if (deps.isQuitting()) return { ok: false, reason: '应用正在关闭' }
    const gameDir = deps.getGameDir(), host = deps.getHost()
    if (!status().available) return { ok: false, reason: '当前桌面游戏包不支持完整存档入口' }
    if (!gameDir || !host) return { ok: false, reason: '游戏运行时暂不可用' }
    try {
      const { archive } = await apiFor(gameDir)
      let built
      const ownerConfig = deps.getOwnerConfig()
      if (ownerConfig) {
        built = archive.exportOwnerDocumentArchive({ ownerDocumentPath: ownerConfig.ownerDocumentPath, ownerId: ownerConfig.ownerId })
      } else {
        const response = await host.handle('GET', '/dsh-piggy/save/export')
        if (response.status !== 200) throw new Error('当前存档暂时无法导出；原存档没有改变')
        const legacyBytes = safeBytes(response.body)
        if (legacyBytes === null || legacyBytes.length === 0) throw new Error('当前存档没有可导出的内容')
        built = archive.exportLegacySaveArchiveAsOwnerDocumentArchive({
          archiveBuffer: legacyBytes,
          ownerId: randomUUID(),
          pigId: randomUUID(),
        })
      }
      if (!Buffer.isBuffer(built?.buffer) || built.buffer.length === 0 || built.buffer.length > MAX_ARCHIVE_BYTES) {
        throw new Error('完整存档超过可导出大小上限')
      }
      const result = await saveArchive({
        dialog: deps.dialog,
        parentWindow: deps.getWin() ?? undefined,
        downloadsDir: deps.downloadsDir,
        name: ownerSaveName(),
        bytes: new Uint8Array(built.buffer),
        isClosing: deps.isQuitting,
        writeFile(path, bytes) {
          const writing = deps.writeFile(path, bytes)
          return writing
        },
      })
      return result.ok ? { ok: true, downloaded: false } : result
    } catch (error) {
      const raw = error instanceof Error ? error.message : ''
      const message = raw.startsWith('当前存档') || raw.startsWith('当前游戏版本')
        ? raw : '完整存档导出失败；原存档没有改变，请稍后重试'
      deps.log('owner archive export failed', message)
      return { ok: false, reason: message }
    }
  }

  async function previewArchive(value) {
    if (deps.isQuitting()) return { ok: false, reason: '应用正在关闭' }
    if (!status().available) return { ok: false, reason: '当前桌面游戏包不支持完整存档入口' }
    const bytes = safeBytes(value)
    if (bytes === null || bytes.length === 0 || bytes.length > MAX_ARCHIVE_BYTES) {
      return { ok: false, reason: '存档文件为空、格式不正确或超过大小上限' }
    }
    const gameDir = deps.getGameDir()
    if (!gameDir || !deps.getHost()) return { ok: false, reason: '游戏运行时暂不可用' }
    try {
      const { archive } = await apiFor(gameDir)
      ensureArchiveRoot()
      for (const entry of previews.values()) entry.importer.clear()
      previews.clear()
      const targetRoot = join(deps.archiveRoot, `archive-${randomUUID()}`)
      const ownerDocumentPath = join(targetRoot, 'owner-document.json')
      const importer = archive.createOwnerDocumentArchiveImporter({ ownerDocumentPath, allowLegacy: false })
      const preview = importer.preview(bytes)
      if (preview?.ok !== true || typeof preview.token !== 'string') {
        const reason = preview?.reason === '请选择完整存档 ZIP；单猪存档请使用当前小猪存档入口'
          ? preview.reason : '完整存档无法验证；请确认所选 ZIP 内容完整且未损坏'
        return { ok: false, reason }
      }
      previews.set(preview.token, { importer, ownerDocumentPath, initialPigId: preview.initialPigId, expires: Date.now() + 10 * 60 * 1000 })
      return {
        ok: true,
        token: preview.token,
        summary: preview.summary,
        warnings: preview.warnings,
        deviceSettings: 'excluded',
      }
    } catch (error) {
      const raw = error instanceof Error ? error.message : ''
      const message = raw.startsWith('当前游戏版本') || raw.startsWith('本机独立存档')
        ? raw : '完整存档无法预览；请确认文件格式与内容后重试'
      deps.log('owner archive preview failed', message)
      return { ok: false, reason: message }
    }
  }

  async function importAndSwitch(token, options = {}) {
    if (deps.isQuitting()) return { ok: false, reason: '应用正在关闭' }
    if (!status().available) return { ok: false, reason: '当前桌面游戏包不支持完整存档入口' }
    if (typeof token !== 'string' || token.length > 128) return { ok: false, reason: '存档预览已过期，请重新选择' }
    const entry = previews.get(token)
    if (!entry || entry.expires <= Date.now()) {
      previews.delete(token)
      return { ok: false, reason: '存档预览已过期，请重新选择' }
    }
    let imported
    try { imported = entry.importer.import(token, { acceptWarnings: options?.acceptWarnings === true }) }
    catch (error) { imported = { ok: false, reason: error instanceof Error ? error.message : '完整存档导入失败' } }
    if (imported?.ok !== true) return { ok: false, reason: '完整存档没有导入；当前存档未改变。请检查预览提示后重试' }
    previews.delete(token)
    const ownerDocumentPath = entry.ownerDocumentPath
    const gameDir = deps.getGameDir()
    try {
      if (!gameDir) throw new Error('当前游戏目录不可用；已建立的存档副本仍保留')
      const { files } = await apiFor(gameDir)
      const inspected = files.inspectOwnerDocumentFile(ownerDocumentPath)
      if (inspected.kind !== 'owner-document' || inspected.document.ownerId !== imported.ownerId ||
          !inspected.document.pigs.some(pig => pig.pigId === entry.initialPigId)) {
        throw new Error('新存档副本回读不匹配；已保留副本，当前存档未切换')
      }
      const current = deps.getOwnerConfig()
      if (current?.source === 'task') throw new Error('隔离运行模式不能更改本机存档选择；已保留副本')
      if (deps.selectionStore.read().pending !== null) throw new Error('已有存档切换需要先恢复；已保留新副本')
      const lifecycle = deps.lifecycle
      const action = lifecycle.reserveAction('owner-archive-switch')
      if (action === null) throw new Error('另一个操作正在进行；新副本已建立，当前存档未切换')
      try {
        await lifecycle.requireSavedGame()
        deps.selectionStore.stage({ ownerDocumentPath, ownerId: imported.ownerId, pigId: entry.initialPigId })
        setImmediate(() => {
          void lifecycle.restartGame().catch(async error => {
            try { deps.selectionStore.rollbackPending() } catch (rollbackError) {
              deps.log('owner archive selection rollback failed', rollbackError instanceof Error ? rollbackError.message : 'unknown error')
            }
            try { await lifecycle.recoverAction(error) }
            catch (recoveryError) { deps.log('owner archive restart recovery failed', recoveryError instanceof Error ? recoveryError.message : 'unknown error') }
          }).finally(() => lifecycle.releaseAction(action))
        })
        return { ok: true, restarting: true }
      } catch (error) {
        try { if (deps.selectionStore.read().pending !== null) deps.selectionStore.rollbackPending() } catch { /* keep the journal for startup recovery */ }
        if (lifecycle.hostClosed) {
          try { await lifecycle.recoverAction(error) } catch (recoveryError) { deps.log('owner archive recovery failed', recoveryError instanceof Error ? recoveryError.message : 'unknown error') }
        }
        lifecycle.releaseAction(action)
        throw error
      }
    } catch (error) {
      const raw = error instanceof Error ? error.message : ''
      const known = raw.startsWith('当前游戏目录') || raw.startsWith('当前桌面游戏包') || raw.startsWith('隔离运行模式') ||
        raw.startsWith('已有存档切换') || raw.startsWith('另一个操作') || raw.startsWith('新存档副本') || raw.startsWith('存档预览')
      const message = known ? raw : '副本已建立，但没有切换。当前存档保留；请稍后重试。'
      deps.log('owner archive switch refused', message)
      return { ok: false, imported: true, reason: message }
    }
  }

  function clear() {
    for (const entry of previews.values()) entry.importer.clear()
    previews.clear()
  }

  return Object.freeze({ status, exportArchive, previewArchive, importAndSwitch, clear })
}
