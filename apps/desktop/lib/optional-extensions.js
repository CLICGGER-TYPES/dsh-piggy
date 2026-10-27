// @ts-check
/** 安装器仅放置所选包；游戏 Worker 用现有导入路由安装，不直接改游戏存档。 */
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, lstatSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const KEYS = new Set(['farm', 'mine', 'blindbox', 'gacha', 'pig-puzzle'])
const HASH = /^[a-f0-9]{64}$/
const hash = bytes => createHash('sha256').update(bytes).digest('hex')

function readRegular(file) {
  if (!lstatSync(file).isFile()) throw new Error('installer extension input is not a regular file')
  return readFileSync(file)
}

function selection(directory) {
  const path = join(directory, 'selection.json')
  if (!existsSync(path)) return null
  const raw = readRegular(path)
  const picked = JSON.parse(raw.toString('utf8'))
  if (picked.version !== 1 || !Array.isArray(picked.keys) || picked.keys.length > KEYS.size
    || new Set(picked.keys).size !== picked.keys.length || picked.keys.some(key => !KEYS.has(key))) {
    throw new Error('invalid installer extension selection')
  }
  if (picked.keys.length === 0) return null
  const catalogRaw = readRegular(join(directory, 'catalog.json'))
  const catalog = JSON.parse(catalogRaw.toString('utf8'))
  if (catalog.version !== 1 || !Array.isArray(catalog.items)) throw new Error('invalid installer extension catalog')
  const items = new Map()
  for (const item of catalog.items) {
    if (!KEYS.has(item.key) || items.has(item.key) || !/^\d+\.\d+\.\d+$/.test(item.version)
      || item.file !== `ext-${item.key}-${item.version}.piggyext` || !HASH.test(item.sha256)) {
      throw new Error('invalid installer extension entry')
    }
    items.set(item.key, item)
  }
  if (picked.keys.some(key => !items.has(key))) throw new Error('selected extension missing from installer catalog')
  // 相同安装批次重启不补回用户主动删除的扩展；重新运行安装器写出新批次。
  const stat = lstatSync(path, { bigint: true })
  const batch = hash(Buffer.concat([raw, catalogRaw, Buffer.from(`${stat.mtimeNs}:${stat.ctimeNs}`)]))
  return { batch, entries: picked.keys.map(key => items.get(key)) }
}

function receipts(file, batch) {
  if (!existsSync(file)) return { version: 1, batch, done: [] }
  const value = JSON.parse(readRegular(file).toString('utf8'))
  if (value.version !== 1 || !HASH.test(value.batch) || !Array.isArray(value.done)
    || value.done.some(key => !KEYS.has(key)) || new Set(value.done).size !== value.done.length) {
    throw new Error('invalid installer extension receipt; preserved')
  }
  return value.batch === batch ? value : { version: 1, batch, done: [] }
}

function saveReceipts(file, value) {
  const temp = `${file}.${randomUUID()}.tmp`
  try {
    writeFileSync(temp, JSON.stringify(value) + '\n', { mode: 0o600, flag: 'wx' })
    renameSync(temp, file)
  } finally {
    try { unlinkSync(temp) } catch (error) { if (error?.code !== 'ENOENT') throw error }
  }
}

function payload(directory, item) {
  const bytes = readRegular(join(directory, item.file))
  if (hash(bytes) !== item.sha256) throw new Error('installer extension SHA256 mismatch')
  const body = bytes.toString('utf8')
  const packet = JSON.parse(body)
  const manifest = JSON.parse(packet.files?.['manifest.json'])
  if (packet.format !== 'dsh-piggy-extension' || packet.key !== item.key
    || manifest.key !== item.key || manifest.version !== item.version) throw new Error('installer extension identity mismatch')
  return Buffer.from(JSON.stringify({ bundle: body, confirm: false, snapshot: false }), 'utf8').toString('base64')
}

/** @param {{directory?:string,statePath:string,host:any,onSnapshot?:(text:string)=>void}} options */
export function createInstallerExtensions(options) {
  let prepared = false, picked = null, settled = false, flight = null
  let hatched = false
  let last = { ok: true, changed: false, deferred: false, installed: [], preserved: [], failures: [] }
  const receiptFile = join(dirname(options.statePath), 'installer-extensions.json')
  function record(message) {
    options.host.record?.('warn', 'installer-extensions', message)
  }
  async function install() {
    if (settled) return { ...last, changed: false }
    if (!prepared) {
      picked = options.directory ? selection(options.directory) : null
      if (!hatched && picked !== null && existsSync(options.statePath)) {
        const saved = JSON.parse(readFileSync(options.statePath, 'utf8'))
        hatched = saved !== null && typeof saved === 'object' && saved.hatched !== false
      }
      prepared = true
    }
    if (picked === null) { settled = true; return last }
    if (!hatched) return { ...last, deferred: true }
    const done = receipts(receiptFile, picked.batch)
    const result = { ok: true, changed: false, deferred: false,
      installed: /** @type {string[]} */ ([]), preserved: /** @type {string[]} */ ([]), failures: /** @type {any[]} */ ([]) }
    for (const item of picked.entries) {
      if (done.done.includes(item.key)) continue
      try {
        const manifest = join(dirname(options.statePath), 'extensions', item.key, 'manifest.json')
        if (existsSync(manifest)) result.preserved.push(item.key)
        else {
          const out = await options.host.handle('POST', '/dsh-piggy/extensions/import', payload(options.directory, item))
          const response = JSON.parse(String(out.body))
          if (out.status !== 200 || response.ok !== true || response.official !== true || response.key !== item.key) {
            throw new Error(`installer extension import rejected: ${response.reason ?? out.status}`)
          }
          if (Array.isArray(response.pending) && response.pending.length > 0) options.onSnapshot?.(String(out.body))
          result.changed = true
          result.installed.push(item.key)
        }
        done.done.push(item.key)
        saveReceipts(receiptFile, done)
      } catch (error) {
        result.ok = false
        result.failures.push({ key: item.key, reason: error instanceof Error ? error.message : String(error) })
        record(`optional extension ${item.key} was not completed: ${result.failures.at(-1).reason}`)
      }
    }
    settled = true
    last = result
    return result
  }
  function apply(observedHatched = undefined) {
    if (typeof observedHatched === 'boolean') hatched = observedHatched
    if (flight !== null) return flight
    flight = Promise.resolve().then(install).catch(error => {
      settled = true
      last = { ...last, ok: false, failures: [{ reason: error instanceof Error ? error.message : String(error) }] }
      record('installer extension preparation failed; input preserved')
      return last
    }).finally(() => { flight = null })
    return flight
  }
  return { apply }
}
