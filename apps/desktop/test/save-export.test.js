// @ts-check
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { MAX_ARCHIVE_BYTES, readPostBody, saveArchive } from '../lib/save-export.js'
import { startBackgroundHost } from '../lib/background-host.js'

const NAME = 'piggy-save-20261017-2030.zip'
const ZIP_BYTES = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0xff, 0x00, 0x81, 0x0a])
const ROOT = fileURLToPath(new URL('../../..', import.meta.url))

function setup(picked = { canceled: false, filePath: '/downloads/piggy.zip' }) {
  const calls = [], writes = []
  const dialog = { async showSaveDialog(parent, options) { calls.push({ parent, options }); return picked } }
  return { calls, writes, dialog, writeFile(path, bytes) { writes.push({ path, bytes: Buffer.from(bytes) }) } }
}

test('POST request body remains byte-exact, including invalid UTF-8 ZIP bytes', async () => {
  const request = new Request('http://piggy/dsh-piggy/save/preview', { method: 'POST', body: ZIP_BYTES })
  const body = await readPostBody(request)
  assert.ok(Buffer.isBuffer(body))
  assert.deepEqual(body, Buffer.from(ZIP_BYTES))
  assert.deepEqual([...body], [0x50, 0x4b, 0x03, 0x04, 0xff, 0x00, 0x81, 0x0a])
})

test('the actual runtime worker round-trips an exported ZIP through preview and import as bytes', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'piggy-save-worker-'))
  let host
  try {
    host = await startBackgroundHost(ROOT, join(directory, 'state.json'))
    await host.handle('POST', '/dsh-piggy/act', Buffer.from(JSON.stringify({ action: 'hatch' })))
    const exported = await host.handle('GET', '/dsh-piggy/save/export')
    assert.equal(exported.status, 200)
    assert.equal(exported.headers['content-type'], 'application/zip')
    const zip = Buffer.from(exported.body)
    assert.deepEqual([...zip.subarray(0, 4)], [0x50, 0x4b, 0x03, 0x04])

    const body = await readPostBody(new Request('http://piggy/dsh-piggy/save/preview', {
      method: 'POST', headers: { 'content-type': 'application/octet-stream' }, body: zip,
    }))
    const preview = await host.handle('POST', '/dsh-piggy/save/preview', body)
    assert.equal(preview.status, 200)
    const summary = JSON.parse(preview.body)
    assert.equal(summary.ok, true)
    assert.equal(typeof summary.summary.name, 'string')
    assert.ok(summary.summary.name.length > 0)

    const imported = await host.handle('POST', '/dsh-piggy/save/import', Buffer.from(JSON.stringify({ token: summary.token })))
    assert.equal(imported.status, 200)
    assert.equal(JSON.parse(imported.body).ok, true)
    const after = await host.handle('GET', '/dsh-piggy/state')
    assert.equal(JSON.parse(after.body).hatched, true)
  } finally {
    await host?.dispose()
    rmSync(directory, { recursive: true, force: true })
  }
})

test('saveArchive opens only a ZIP save dialog and writes the selected destination bytes', async () => {
  const f = setup()
  const result = await saveArchive({ dialog: f.dialog, parentWindow: 'panel', downloadsDir: '/downloads', name: NAME, bytes: ZIP_BYTES, writeFile: f.writeFile })
  assert.deepEqual(result, { ok: true })
  assert.equal(f.calls.length, 1)
  assert.equal(f.calls[0].parent, 'panel')
  assert.equal(f.calls[0].options.defaultPath, join('/downloads', NAME))
  assert.deepEqual(f.calls[0].options.filters, [{ name: '小猪存档', extensions: ['zip'] }])
  assert.equal(f.writes[0].path, '/downloads/piggy.zip')
  assert.deepEqual(f.writes[0].bytes, Buffer.from(ZIP_BYTES))
})

test('save cancellation and unsafe requests never write files or expose a path argument', async () => {
  const canceled = setup({ canceled: true })
  assert.deepEqual(await saveArchive({ dialog: canceled.dialog, downloadsDir: '/downloads', name: NAME, bytes: ZIP_BYTES, writeFile: canceled.writeFile }), { ok: false, canceled: true })
  assert.equal(canceled.writes.length, 0)

  const badName = setup()
  for (const name of ['../piggy-save-20261017-2030.zip', 'C:\\piggy-save-20261017-2030.zip', 'other.zip', 'piggy-save-20261017-2030.zip/../x']) {
    const result = await saveArchive({ dialog: badName.dialog, downloadsDir: '/downloads', name, bytes: ZIP_BYTES, writeFile: badName.writeFile })
    assert.equal(result.ok, false, `accepted unsafe name ${name}`)
  }
  assert.equal(badName.calls.length, 0)
  assert.equal(badName.writes.length, 0)

  class OversizedBytes extends Uint8Array { get byteLength() { return MAX_ARCHIVE_BYTES + 1 } }
  const oversized = setup()
  assert.equal((await saveArchive({ dialog: oversized.dialog, downloadsDir: '/downloads', name: NAME, bytes: new OversizedBytes(1), writeFile: oversized.writeFile })).ok, false)
  assert.equal(oversized.calls.length, 0)
  assert.equal((await saveArchive({ dialog: oversized.dialog, downloadsDir: '/downloads', name: NAME, bytes: new ArrayBuffer(4), writeFile: oversized.writeFile })).ok, false)
})

test('dialog and disk errors return a clear failure without reporting success', async () => {
  const dialogFailure = { async showSaveDialog() { throw new Error('dialog unavailable') } }
  assert.deepEqual(await saveArchive({ dialog: dialogFailure, downloadsDir: '/downloads', name: NAME, bytes: ZIP_BYTES }), { ok: false, reason: 'dialog unavailable' })
  const f = setup()
  const result = await saveArchive({ dialog: f.dialog, downloadsDir: '/downloads', name: NAME, bytes: ZIP_BYTES, writeFile() { throw new Error('disk full') } })
  assert.deepEqual(result, { ok: false, reason: 'disk full' })

  const wrongExtension = setup({ canceled: false, filePath: '/downloads/save.txt' })
  assert.equal((await saveArchive({ dialog: wrongExtension.dialog, downloadsDir: '/downloads', name: NAME, bytes: ZIP_BYTES, writeFile: wrongExtension.writeFile })).ok, false)
  assert.equal(wrongExtension.writes.length, 0)
})

test('IPC save handler validates the page source before exposing the native dialog', () => {
  const source = readFileSync(new URL('../main.js', import.meta.url), 'utf8')
  const handler = source.slice(source.indexOf("ipcMain.handle('piggy:save-archive'"), source.indexOf("ipcMain.handle('piggy:open'"))
  assert.match(handler, /if\s*\(!fromPage\(event\)\)\s*return\s*\{\s*ok:\s*false/)
  assert.match(handler, /return saveArchive\(/)
  assert.doesNotMatch(handler, /payload\?\.path|payload\.path/)
})
