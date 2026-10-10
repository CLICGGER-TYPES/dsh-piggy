// @ts-check
/** Player PNG skin packs, with legacy sanitized SVG compatibility. */

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
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
    if ((flags & 1) !== 0 || !/^(skin\.json|[a-z]+\.(?:png|svg))$/.test(name)) throw new Error('ZIP 只能在根目录放 skin.json 和 PNG（兼容旧 SVG）')
    if (size > MAX_FILE || ![0, 8].includes(method)) throw new Error(`${name} 太大或压缩方式不支持`)
    const localName = buffer.readUInt16LE(local + 26)
    const localExtra = buffer.readUInt16LE(local + 28)
    const start = local + 30 + localName + localExtra
    const packed = buffer.subarray(start, start + buffer.readUInt32LE(cursor + 20))
    const value = method === 0 ? packed : inflateRawSync(packed, { maxOutputLength: MAX_FILE })
    if (value.length !== size || value.length > MAX_FILE) throw new Error(`${name} 解压大小异常`)
    files.set(name, value)
    cursor += 46 + nameLength + extraLength + commentLength
  }
  return files
}

function crc32(bytes) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function validPng(body) {
  if (body.length < 57 || body.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a'
    || body.readUInt32BE(8) !== 13 || body.subarray(12, 16).toString('ascii') !== 'IHDR') return false
  const width = body.readUInt32BE(16), height = body.readUInt32BE(20)
  if (width === 0 || height === 0 || width > 1024 || height > 1024) return false
  const type = body[25]
  if (![0, 2, 3, 4, 6].includes(type)) return false
  let at = 8, data = false, transparent = type === 4 || type === 6
  while (at + 12 <= body.length) {
    const size = body.readUInt32BE(at)
    if (size > body.length - at - 12) return false
    if (body.readUInt32BE(at + 8 + size) !== crc32(body.subarray(at + 4, at + 8 + size))) return false
    const chunk = body.subarray(at + 4, at + 8).toString('ascii')
    if (chunk === 'IDAT') data = true
    if (chunk === 'tRNS') transparent = true
    at += size + 12
    if (chunk === 'IEND') return size === 0 && at === body.length && data && transparent
  }
  return false
}

export function validateSkinFiles(files) {
  const errors = []
  let manifest = null
  try { manifest = JSON.parse(files.get('skin.json')?.toString('utf8') ?? '') } catch { errors.push('skin.json 不是有效 JSON') }
  const key = typeof manifest?.key === 'string' ? manifest.key : ''
  if (!KEY.test(key)) errors.push('key 只能用小写字母、数字和短横线，最长 24 位')
  if (key === 'default' || skinByKey(key) !== null) errors.push('key 与内置皮肤重名')
  if (typeof manifest?.label !== 'string' || manifest.label.trim() === '') errors.push('缺少皮肤名称 label')
  const scenes = SKIN_SCENES.filter(scene => files.has(`${scene}.png`) || files.has(`${scene}.svg`))
  for (const scene of REQUIRED_SKIN_SCENES) if (!scenes.includes(scene)) errors.push(`缺少 ${scene}.png（旧包也可用 ${scene}.svg）`)
  for (const scene of scenes) if (files.has(`${scene}.png`) && files.has(`${scene}.svg`)) errors.push(`${scene} 只能放 PNG 或 SVG 中的一种`)
  for (const [name, body] of files) {
    if (body.length > MAX_FILE) errors.push(`${name} 不能超过 96 KB`)
    if (name.endsWith('.png')) {
      if (!validPng(body)) errors.push(`${name} 必须是完整、带透明通道的 PNG，长边不超过 1024px`)
      continue
    }
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
    const ext = files.has(`${scene}.png`) ? 'png' : 'svg'
    const stem = `${metadata.art}${scene === 'idle' ? '' : '-' + scene}`
    const target = join(root, `${stem}.${ext}`)
    const temp = target + '.tmp'
    writeFileSync(temp, files.get(`${scene}.${ext}`))
    renameSync(temp, target)
    rmSync(join(root, `${stem}.${ext === 'png' ? 'svg' : 'png'}`), { force: true })
  }
  return checked
}

export function customSkinArt(savePath, name) {
  if (!/^custom-[a-z0-9-]{1,41}(?:\.(?:png|svg))?$/.test(name)) return null
  const stem = name.replace(/\.(?:png|svg)$/, '')
  const extensions = name.endsWith('.svg') ? ['svg', 'png'] : ['png', 'svg']
  for (const ext of extensions) {
    const path = join(dirname(savePath), 'skins', `${stem}.${ext}`)
    if (existsSync(path)) return readFileSync(path)
  }
  return null
}
