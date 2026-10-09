// @ts-check
/**
 * 生成一个版本的游戏包，挂到 GitHub Release 上给桌面版热更新用：
 *   game-<版本>.json.gz        gzip 过的 { files: { 相对路径: base64 } }（内容同 pack-game）
 *   game-<版本>.manifest.json  { version, stateVersion, minShell, shellVersion, sha256, size, parts? }
 * 整包超过 partLimit（默认 95MiB，留在 Gitee 单附件 100MiB 以内）就拆成 game-<版本>.part-01.gz、-02 …，
 * manifest.parts 记每卷名字、大小、sha256，不再写整包文件；外壳 0.6.3 起会逐卷下载拼回（lib/versions.js）。
 * 版本号取仓库根的 package.json；minShell 取本目录 package.json 的 piggy.minShell，
 * 也就是「这个游戏包至少要多新的安装包才能跑」。
 *
 * 用法：node scripts/release-game.mjs [输出目录，默认 dist-game]
 */
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'

import { packGame } from './pack-game.mjs'

/** Every file under `dir`, as forward-slash paths relative to it. */
function walk(dir, base = dir) {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full, base) : [relative(base, full).split(sep).join('/')]
  })
}

/** 单个附件的上限：Gitee 实测 100MiB，留 5MiB 余量。 */
export const PART_LIMIT = 95 * 1024 * 1024
/** 读得懂分卷游戏包的最低外壳版本。 */
export const PARTS_MIN_SHELL = '0.6.3'

/** Build the package and its manifest for the repo at `root`, into `out`. */
export async function releaseGame(root, out, minShell, shellVersion = null, partLimit = PART_LIMIT) {
  const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version
  const desktopVersion = shellVersion ?? JSON.parse(readFileSync(join(root, 'apps/desktop/package.json'), 'utf8')).version
  const { STATE_VERSION } = await import(pathToFileURL(join(root, 'packages/pet-core/src/core/constants.js')).href)
  const staging = mkdtempSync(join(tmpdir(), 'piggy-game-'))
  try {
    packGame(root, staging)
    const files = {}
    for (const rel of walk(staging)) files[rel] = readFileSync(join(staging, rel)).toString('base64')
    const pack = gzipSync(Buffer.from(JSON.stringify({ files })), { level: 9 })
    const manifest = {
      version, stateVersion: STATE_VERSION, minShell, shellVersion: desktopVersion,
      sha256: createHash('sha256').update(pack).digest('hex'), size: pack.length,
    }
    mkdirSync(out, { recursive: true })
    if (pack.length <= partLimit) {
      writeFileSync(join(out, `game-${version}.json.gz`), pack)
    } else {
      // 老外壳只认整包：分卷的版本它们看不到，所以把最低外壳抬到能读分卷的那一版。
      if (compareShell(manifest.minShell, PARTS_MIN_SHELL) < 0) manifest.minShell = PARTS_MIN_SHELL
      manifest.parts = []
      for (let at = 0, index = 1; at < pack.length; at += partLimit, index += 1) {
        const piece = pack.subarray(at, at + partLimit)
        const name = `game-${version}.part-${String(index).padStart(2, '0')}.gz`
        writeFileSync(join(out, name), piece)
        manifest.parts.push({ name, size: piece.length, sha256: createHash('sha256').update(piece).digest('hex') })
      }
    }
    writeFileSync(join(out, `game-${version}.manifest.json`), JSON.stringify(manifest, null, 2))
    return manifest
  } finally {
    rmSync(staging, { recursive: true, force: true })
  }
}

/** 只比 x.y.z 数字（这里不需要预发布号）。 */
function compareShell(a, b) {
  const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number)
  for (let i = 0; i < 3; i += 1) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0)
  return 0
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const here = dirname(fileURLToPath(import.meta.url))
  const desktop = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8'))
  const out = process.argv[2] ?? join(here, '..', 'dist-game')
  const manifest = await releaseGame(join(here, '..', '..', '..'), out, desktop.piggy.minShell, desktop.version)
  console.log(JSON.stringify(manifest))
}
