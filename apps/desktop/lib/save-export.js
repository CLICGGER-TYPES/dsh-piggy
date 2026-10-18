// @ts-check
import { writeFile as writeArchive } from 'node:fs/promises'
import { extname, join } from 'node:path'

export const MAX_ARCHIVE_BYTES = 128 * 1024 * 1024
const SAVE_NAME = /^piggy-save-\d{8}-\d{4}\.zip$/

/** Transfer a Fetch request body without UTF-8 decoding or copying the ZIP in main. */
export async function readPostBody(request) {
  return request.arrayBuffer()
}

/** Show the system save dialog and write a complete backup to the chosen file. */
export async function saveArchive({ dialog, parentWindow, downloadsDir, name, bytes, writeFile = writeArchive, isClosing = () => false }) {
  if (typeof name !== 'string' || !SAVE_NAME.test(name)) return { ok: false, reason: '存档文件名不安全' }
  if (!(bytes instanceof Uint8Array)) return { ok: false, reason: '存档数据格式不正确' }
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_ARCHIVE_BYTES) return { ok: false, reason: '存档大小无效或超过 128 MiB' }
  try {
    const picked = await dialog.showSaveDialog(parentWindow, {
      title: '导出存档',
      defaultPath: join(downloadsDir, name),
      filters: [{ name: '小猪存档', extensions: ['zip'] }],
    })
    if (isClosing() || picked?.canceled === true || typeof picked?.filePath !== 'string' || picked.filePath === '') return { ok: false, canceled: true }
    if (extname(picked.filePath).toLowerCase() !== '.zip') return { ok: false, reason: '请使用 .zip 文件名保存存档' }
    await writeFile(picked.filePath, Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength))
    return { ok: true }
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) }
  }
}
