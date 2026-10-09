// @ts-check
/** C6 玩家皮肤包：读取 ZIP、校验清单与 SVG，并安装到存档旁边。 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { inflateRawSync } from 'node:zlib'

import { REQUIRED_SKIN_SCENES, SKIN_SCENES, skinByKey } from '../data.js'

const MAX_ZIP = 2 * 1024 * 1024
const MAX_FILE = 96 * 1024
const KEY = /^[a-z0-9](?:[a-z0-9-]{0,22}[a-z0-9])?$/

export function parseSkinZip(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length > MAX_ZIP) throw new Error('ZIP 不能超过 2 MB')
  const eocd = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  if (eocd < 0 || eocd + 22 > buffer.length) throw new Error('不是完整的 ZIP 文件')
  const count = buffer.readUInt16LE(eocd + 10)
  let cursor = buffer.readUInt32LE(eocd + 16)
  if (count > 20) throw new Error('皮肤包文件太多')
  const files = new Map()
  for (let i = 0; i < count; i += 1) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) throw new Error('ZIP 目录损坏')
    const flags = buffer.readUInt16LE(cursor + 8)
    const method = buffer.readUInt16LE(cursor + 10)
    const size = buffer.readUInt32LE(cursor + 24)
    const nameLength = buffer.readUInt16LE(cursor + 28)
    const extraLength = buffer.readUInt16LE(cursor + 30)
    const commentLength = buffer.readUInt16LE(cursor + 32)
    const local = buffer.readUInt32LE(cursor + 42)
    const name = buffer.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8')
    if ((flags & 1) !== 0 || !/^(skin\.json|[a-z]+\.svg)$/.test(name)) throw new Error('ZIP 只能在根目录放 skin.json 和 SVG')
    if (size > MAX_FILE || ![0, 8].includes(method)) throw new Error(`${name} 太大或压缩方式不支持`)
    const localName = buffer.readUInt16LE(local + 26)
    const localExtra = buffer.readUInt16LE(local + 28)
    const start = local + 30 + localName + localExtra
    const packed = buffer.subarray(start, start + buffer.readUInt32LE(cursor + 20))
    const value = method === 0 ? packed : inflateRawSync(packed)
    if (value.length !== size || value.length > MAX_FILE) throw new Error(`${name} 解压大小异常`)
    files.set(name, value)
    cursor += 46 + nameLength + extraLength + commentLength
  }
  return files
}

export function validateSkinFiles(files) {
  const errors = []
  let manifest = null
  try { manifest = JSON.parse(files.get('skin.json')?.toString('utf8') ?? '') } catch { errors.push('skin.json 不是有效 JSON') }
  const key = typeof manifest?.key === 'string' ? manifest.key : ''
  if (!KEY.test(key)) errors.push('key 只能用小写字母、数字和短横线，最长 24 位')
  if (key === 'default' || skinByKey(key) !== null) errors.push('key 与内置皮肤重名')
  if (typeof manifest?.label !== 'string' || manifest.label.trim() === '') errors.push('缺少皮肤名称 label')
  const scenes = SKIN_SCENES.filter(scene => files.has(`${scene}.svg`))
  for (const scene of REQUIRED_SKIN_SCENES) if (!scenes.includes(scene)) errors.push(`缺少 ${scene}.svg`)
  for (const [name, body] of files) {
    if (!name.endsWith('.svg')) continue
    const svg = body.toString('utf8')
    if (!/<svg\b/i.test(svg) || !/viewBox\s*=\s*["']0\s+0\s+64\s+64["']/i.test(svg)) errors.push(`${name} 必须使用 viewBox="0 0 64 64"`)
    if (/<(?:script|image|text|use|style|foreignObject|linearGradient|radialGradient|filter)\b|<!DOCTYPE|<!ENTITY|\bon[a-z]+\s*=|\b(?:href|src)\s*=|url\s*\(/i.test(svg)) errors.push(`${name} 含有不允许的外链、文字、脚本或滤镜`)
  }
  if (errors.length > 0) return { ok: false, errors }
  return {
    ok: true,
    metadata: {
      key, label: manifest.label.trim().slice(0, 30), author: String(manifest.author ?? '玩家').slice(0, 30),
      description: String(manifest.description ?? '').slice(0, 100), emoji: String(manifest.emoji ?? '🎨').slice(0, 4),
      art: `custom-${key}`, scenes, custom: true,
    },
  }
}

export function installSkinPack(savePath, zip) {
  let files
  try { files = parseSkinZip(zip) } catch (error) {
    // 读到一半越界之类的底层错误，换成玩家看得懂的话（以前会直接显示英文的 offset out of range）。
    if (error instanceof RangeError) throw new Error('ZIP 文件损坏，请重新压缩后再导入')
    throw error
  }
  const checked = validateSkinFiles(files)
  if (!checked.ok || checked.metadata === undefined) return checked
  const metadata = checked.metadata
  const root = join(dirname(savePath), 'skins')
  mkdirSync(root, { recursive: true })
  for (const scene of metadata.scenes) {
    const target = join(root, `${metadata.art}${scene === 'idle' ? '' : '-' + scene}.svg`)
    const temp = target + '.tmp'
    writeFileSync(temp, files.get(`${scene}.svg`))
    renameSync(temp, target)
  }
  return checked
}

export function customSkinArt(savePath, name) {
  if (!/^custom-[a-z0-9-]{1,31}(?:-(?:eat|bathe|play|pet|relaxed|work|study|trip|fish|sleep))?\.svg$/.test(name)) return null
  const path = join(dirname(savePath), 'skins', name)
  return existsSync(path) ? readFileSync(path) : null
}
