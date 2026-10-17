// @ts-check
import { deflateRawSync, inflateRawSync } from 'node:zlib'

const table = new Uint32Array(256)
for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0 }
export function crc32(bytes) { let c = 0xffffffff; for (const b of bytes) c = table[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }

export function makeZip(entries) {
  const locals = [], central = []; let offset = 0
  for (const [name, data] of entries) {
    const filename = Buffer.from(name), raw = Buffer.from(data), packed = deflateRawSync(raw), crc = crc32(raw)
    const local = Buffer.alloc(30 + filename.length); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x800, 6); local.writeUInt16LE(8, 8); local.writeUInt32LE(crc, 14); local.writeUInt32LE(packed.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(filename.length, 26); filename.copy(local, 30)
    locals.push(local, packed)
    const dir = Buffer.alloc(46 + filename.length); dir.writeUInt32LE(0x02014b50); dir.writeUInt16LE(0x0314, 4); dir.writeUInt16LE(20, 6); dir.writeUInt16LE(0x800, 8); dir.writeUInt16LE(8, 10); dir.writeUInt32LE(crc, 16); dir.writeUInt32LE(packed.length, 20); dir.writeUInt32LE(raw.length, 24); dir.writeUInt16LE(filename.length, 28); dir.writeUInt32LE((0o100600 << 16) >>> 0, 38); dir.writeUInt32LE(offset, 42); filename.copy(dir, 46)
    central.push(dir); offset += local.length + packed.length
  }
  const centralBytes = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(centralBytes.length, 12); end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, centralBytes, end])
}

export function readZip(buffer, { maxBytes = 32 * 1024 * 1024, maxFiles = 512, maxFileBytes = 8 * 1024 * 1024 } = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length > maxBytes) throw new Error('存档 ZIP 太大或格式无效')
  const endAt = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  if (endAt < 0 || endAt + 22 > buffer.length) throw new Error('存档 ZIP 不完整')
  const commentLength = buffer.readUInt16LE(endAt + 20)
  if (endAt + 22 + commentLength !== buffer.length || buffer.readUInt16LE(endAt + 4) !== 0 || buffer.readUInt16LE(endAt + 6) !== 0 || buffer.readUInt16LE(endAt + 8) !== buffer.readUInt16LE(endAt + 10)) throw new Error('存档 ZIP 目录无效')
  const count = buffer.readUInt16LE(endAt + 10), dirSize = buffer.readUInt32LE(endAt + 12), dirAt = buffer.readUInt32LE(endAt + 16)
  if (count > maxFiles || dirAt + dirSize !== endAt) throw new Error('存档 ZIP 目录无效')
  const files = new Map(), regions = []; let cursor = dirAt, expanded = 0
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > endAt || buffer.readUInt32LE(cursor) !== 0x02014b50) throw new Error('存档 ZIP 目录损坏')
    const flags = buffer.readUInt16LE(cursor + 8), method = buffer.readUInt16LE(cursor + 10), crc = buffer.readUInt32LE(cursor + 16), packedSize = buffer.readUInt32LE(cursor + 20), size = buffer.readUInt32LE(cursor + 24)
    const nl = buffer.readUInt16LE(cursor + 28), el = buffer.readUInt16LE(cursor + 30), cl = buffer.readUInt16LE(cursor + 32), external = buffer.readUInt32LE(cursor + 38), localAt = buffer.readUInt32LE(cursor + 42)
    if (cursor + 46 + nl + el + cl > endAt) throw new Error('存档 ZIP 目录损坏')
    const name = buffer.subarray(cursor + 46, cursor + 46 + nl).toString('utf8')
    if ((flags & ~0x800) || ![0, 8].includes(method) || (external >>> 16 & 0o170000) === 0o120000 || buffer.readUInt16LE(cursor + 34) !== 0) throw new Error('存档 ZIP 含有不安全文件')
    if (!name || name.startsWith('/') || name.includes('\\') || name.split('/').some(part => part === '..' || part === '.' || part === '')) throw new Error('存档 ZIP 路径无效')
    if (Buffer.from(name, 'utf8').compare(buffer.subarray(cursor + 46, cursor + 46 + nl)) !== 0) throw new Error('存档 ZIP 文件名编码无效')
    if (size > maxFileBytes || packedSize > maxBytes || expanded + size > maxBytes) throw new Error('存档 ZIP 解压后太大')
    if (files.has(name) || localAt + 30 > dirAt || buffer.readUInt32LE(localAt) !== 0x04034b50) throw new Error('存档 ZIP 文件重复或损坏')
    const lnl = buffer.readUInt16LE(localAt + 26), lel = buffer.readUInt16LE(localAt + 28), start = localAt + 30 + lnl + lel
    if (start + packedSize > dirAt || buffer.subarray(localAt + 30, localAt + 30 + lnl).toString('utf8') !== name ||
      buffer.readUInt16LE(localAt + 6) !== flags || buffer.readUInt16LE(localAt + 8) !== method ||
      buffer.readUInt32LE(localAt + 14) !== crc || buffer.readUInt32LE(localAt + 18) !== packedSize || buffer.readUInt32LE(localAt + 22) !== size) throw new Error('存档 ZIP 文件损坏')
    const region = [localAt, start + packedSize]
    if (regions.some(([a, b]) => region[0] < b && region[1] > a)) throw new Error('存档 ZIP 文件数据重叠')
    regions.push(region)
    const packed = buffer.subarray(start, start + packedSize)
    let body
    try { body = method === 0 ? Buffer.from(packed) : inflateRawSync(packed, { maxOutputLength: maxFileBytes }) } catch { throw new Error('存档 ZIP 数据损坏') }
    if (body.length !== size || crc32(body) !== crc) throw new Error('存档 ZIP 校验失败')
    files.set(name, body); expanded += size; cursor += 46 + nl + el + cl
  }
  if (cursor !== dirAt + dirSize) throw new Error('存档 ZIP 目录长度异常')
  return files
}
