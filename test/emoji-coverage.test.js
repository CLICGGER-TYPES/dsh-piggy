// 网页版自带的 emoji 字体（assets/piggy-emoji.woff2）是按游戏里用到的 emoji 裁出来的子集。
// 加了新 emoji 忘了重新裁，网页上就会退回系统表情或者显示方框——这里把游戏源码里的 emoji 逐个对一遍。
// 漏了就跑：uv run --with fonttools --with brotli python tools/slim-emoji-font.py --web-out assets/piggy-emoji.woff2
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { brotliDecompressSync } from 'node:zlib'

const ROOT = new URL('..', import.meta.url).pathname
const SOURCES = ['src/client', 'packages/pet-core/src', 'store', 'extensions', 'data.js', 'core.js', 'snapshot.js']
// 跟 tools/slim-emoji-font.py 收字的范围一致；肤色修饰符不单独显示，不查。
const PICTO = /[\u{1F000}-\u{1FAFF}]/gu
const KNOWN_TAGS = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill']

/** 读 woff2 里 cmap 表覆盖的码位（cmap 在 woff2 里不做变换，解开 brotli 就是原表）。 */
function woff2Codepoints(buffer) {
  let at = 48
  const base128 = () => { let value = 0; for (let i = 0; i < 5; i += 1) { const byte = buffer[at++]; value = value * 128 + (byte & 0x7f); if ((byte & 0x80) === 0) return value } throw new Error('bad UIntBase128') }
  const tables = []
  for (let i = 0, count = buffer.readUInt16BE(12); i < count; i += 1) {
    const flags = buffer[at++]
    const tag = (flags & 0x3f) === 63 ? buffer.toString('latin1', at, (at += 4)) : KNOWN_TAGS[flags & 0x3f]
    const length = base128()
    const version = flags >> 6
    const transformed = tag === 'glyf' || tag === 'loca' ? version === 0 : version !== 0
    tables.push({ tag, length: transformed ? base128() : length })
  }
  const data = brotliDecompressSync(buffer.subarray(at, at + buffer.readUInt32BE(20)))
  let offset = 0
  for (const table of tables) { table.offset = offset; offset += table.length }
  const cmap = data.subarray(tables.find(table => table.tag === 'cmap').offset)
  const codes = new Set()
  for (let i = 0; i < cmap.readUInt16BE(2); i += 1) {
    const sub = cmap.subarray(cmap.readUInt32BE(4 + i * 8 + 4))
    if (sub.readUInt16BE(0) !== 12) continue
    for (let g = 0; g < sub.readUInt32BE(12); g += 1) {
      for (let c = sub.readUInt32BE(16 + g * 12); c <= sub.readUInt32BE(20 + g * 12); c += 1) codes.add(c)
    }
  }
  return codes
}

function sourceFiles(rel) {
  const path = join(ROOT, rel)
  if (statSync(path).isFile()) return [path]
  return readdirSync(path, { recursive: true }).map(name => join(path, String(name))).filter(file => /\.(js|json|mjs)$/.test(file) && statSync(file).isFile())
}

test('网页版 emoji 字体收全了游戏里用到的每个 emoji', () => {
  const codes = woff2Codepoints(readFileSync(join(ROOT, 'assets/piggy-emoji.woff2')))
  assert.ok(codes.size > 300, 'the font table must parse')
  const missing = new Map()
  for (const file of SOURCES.flatMap(sourceFiles)) {
    for (const [ch] of readFileSync(file, 'utf8').matchAll(PICTO)) {
      const code = ch.codePointAt(0)
      if (code >= 0x1f3fb && code <= 0x1f3ff) continue
      if (!codes.has(code)) missing.set(ch, file.slice(ROOT.length))
    }
  }
  assert.deepEqual([...missing].map(([ch, file]) => `${ch} ${file}`), [], '重新裁一遍字体，见文件开头')
})
