// @ts-check
/** 游戏版本文件：解包到准备目录，以及逐文件比较已有目录。 */
import { lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, normalize, relative, sep } from 'node:path'
import { gunzipSync } from 'node:zlib'

/** @param {Buffer} pack @param {string} staging */
export function unpackVersionFiles(pack, staging) {
  const files = JSON.parse(gunzipSync(pack).toString('utf8')).files
  if (files === null || typeof files !== 'object' || typeof files['package.json'] !== 'string') throw new Error('游戏包里少东西，没换')
  const preparedFiles = []
  for (const [rel, base64] of Object.entries(files)) {
    const file = normalize(join(staging, rel))
    if (!file.startsWith(staging + sep)) throw new Error('游戏包里有可疑路径，没换')
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, Buffer.from(String(base64), 'base64'))
    preparedFiles.push(relative(staging, file))
  }
  return preparedFiles
}

/**
 * 缺文件、多文件、链接或字节不同都不能复用。
 * @param {{ staging: string, files: string[] }} entry
 * @param {string} target
 */
export function matchesPreparedFiles(entry, target) {
  const remaining = new Set(entry.files)
  function compareDirectory(directory, prefix = '') {
    for (const file of readdirSync(directory, { withFileTypes: true })) {
      const rel = join(prefix, file.name)
      if (file.isDirectory()) {
        if (!compareDirectory(join(directory, file.name), rel)) return false
      } else {
        if (!file.isFile() || !remaining.delete(rel)) return false
        if (!readFileSync(join(entry.staging, rel)).equals(readFileSync(join(target, rel)))) return false
      }
    }
    return true
  }
  return lstatSync(target).isDirectory() && compareDirectory(target) && remaining.size === 0
}
