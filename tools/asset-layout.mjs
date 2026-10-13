// @ts-check
// 从扩展成品读真实像素尺寸；审计不能把CSS盒子的比例当素材比例，也不能依赖工作区原稿路径。
import { readFileSync } from 'node:fs'

/** @param {Buffer} data @returns {[number, number]} */
export function imageSize(data) {
  if (data.subarray(1, 4).toString() === 'PNG') return [data.readUInt32BE(16), data.readUInt32BE(20)]
  if (data.toString('ascii', 0, 4) !== 'RIFF' || data.toString('ascii', 8, 12) !== 'WEBP') throw new Error('不支持的图片头')
  for (let offset = 12; offset + 8 <= data.length;) {
    const kind = data.toString('ascii', offset, offset + 4), size = data.readUInt32LE(offset + 4), start = offset + 8
    if (kind === 'VP8X') return [1 + data.readUIntLE(start + 4, 3), 1 + data.readUIntLE(start + 7, 3)]
    if (kind === 'VP8L') {
      const bits = data.readUInt32LE(start + 1)
      return [1 + (bits & 0x3fff), 1 + ((bits >>> 14) & 0x3fff)]
    }
    if (kind === 'VP8 ') return [data.readUInt16LE(start + 6) & 0x3fff, data.readUInt16LE(start + 8) & 0x3fff]
    offset = start + size + (size % 2)
  }
  throw new Error('WebP缺少尺寸块')
}

/** @returns {Record<string, any>} */
export function readAssetLayout() {
  const manifest = JSON.parse(readFileSync(new URL('../extensions/farm/manifest.json', import.meta.url), 'utf8'))
  return Object.fromEntries(manifest.assets.map(name => {
    const size = imageSize(readFileSync(new URL('../extensions/farm/assets/' + name, import.meta.url)))
    return [name, { ...manifest.assetLayout?.[name], size }]
  }))
}
