// @ts-check
/**
 * 本地导入扩展（用户 2026-10-10：有些人下载不了 GitHub / Gitee 的附件）。
 *
 * - 导入的是「扩展包」`.piggyext`：一个 JSON，装着扩展的三个文件（manifest.json、server.js、client.js）的原文。
 *   发版时用 `node scripts/extension-bundle.mjs <key>` 生成，和三个文件一起传到发布页；也认直接选那三个文件（面板里拼成包再发）。
 * - **官方扩展**：三个文件的 sha256 跟游戏自带的官方清单（store/official-extensions.json，只增不减）对得上，直接装，跟在线下载的一样。
 * - **非官方**：先拒绝并说明（reason 'unofficial'），用户在面板里确认后带 confirm 再发一次才装；装好在目录里留一个 `local.json`，
 *   面板标「本地导入」，在线目录不再给它提示更新（免得官方版把它悄悄盖掉）。
 * @module dsh-piggy/store/ext-import
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

export const BUNDLE_FORMAT = 'dsh-piggy-extension'
export const BUNDLE_FILES = Object.freeze(['manifest.json', 'server.js', 'client.js'])
/** 每个文件最大多少（跟在线下载一样）。 */
export const BUNDLE_FILE_BYTES = 512 * 1024
/** 本地导入的扩展目录里留的标记文件。 */
export const LOCAL_MARK = 'local.json'
const KEY = /^[a-z0-9-]{2,24}$/

const sha256 = buffer => createHash('sha256').update(buffer).digest('hex')

/** 把三个文件的原文打成扩展包（发版脚本和测试用）。 @param {Record<string, string>} files */
export function makeBundle(files) {
  const manifest = JSON.parse(files['manifest.json'])
  return JSON.stringify({ format: BUNDLE_FORMAT, version: 1, key: manifest.key, files: Object.fromEntries(BUNDLE_FILES.map(name => [name, files[name]])) })
}

/**
 * 读扩展包。
 * @param {string} text
 * @returns {{ ok: true, key: string, manifest: any, buffers: Buffer[], hashes: Record<string, string> } | { ok: false, reason: string, message: string }}
 */
export function parseBundle(text) {
  const bad = message => ({ ok: /** @type {false} */ (false), reason: 'invalid-bundle', message })
  let bundle
  try { bundle = JSON.parse(text) } catch { return bad('这不是扩展包') }
  if (bundle === null || typeof bundle !== 'object' || bundle.format !== BUNDLE_FORMAT || bundle.files === null || typeof bundle.files !== 'object') return bad('这不是扩展包')
  const buffers = []
  for (const name of BUNDLE_FILES) {
    if (typeof bundle.files[name] !== 'string') return bad('扩展包里缺少 ' + name)
    const buffer = Buffer.from(bundle.files[name], 'utf8')
    if (buffer.length > BUNDLE_FILE_BYTES) return bad(name + ' 太大')
    buffers.push(buffer)
  }
  let manifest
  try { manifest = JSON.parse(bundle.files['manifest.json']) } catch { return bad('manifest.json 读不懂') }
  if (manifest === null || typeof manifest !== 'object' || typeof manifest.key !== 'string' || !KEY.test(manifest.key)) return bad('manifest.json 里的扩展名不对')
  if (typeof bundle.key === 'string' && bundle.key !== manifest.key) return bad('扩展包名字和 manifest 对不上')
  const hashes = Object.fromEntries(BUNDLE_FILES.map((name, index) => [name, sha256(buffers[index])]))
  return { ok: true, key: manifest.key, manifest, buffers, hashes }
}

/** 游戏自带的官方清单：{ 扩展名: { 版本: { 文件名: sha256 } } }。 */
export function officialList() {
  try { return JSON.parse(readFileSync(new URL('./official-extensions.json', import.meta.url), 'utf8')) } catch { return {} }
}

/**
 * 是不是官方扩展：三个文件都对得上官方清单里某个版本，或者对得上在线目录里那一条。
 * @param {Record<string, string>} hashes @param {string} key @param {any} official @param {any[]} onlineEntries
 */
export function isOfficial(hashes, key, official, onlineEntries) {
  const same = files => files !== null && typeof files === 'object' && BUNDLE_FILES.every(name => {
    const expected = typeof files[name] === 'string' ? files[name] : files[name]?.sha256
    return typeof expected === 'string' && expected.toLowerCase() === hashes[name]
  })
  if (Object.values(official?.[key] ?? {}).some(same)) return true
  return onlineEntries.some(entry => entry?.key === key && same(entry.files))
}

/**
 * 导入流程（给 store/ext-runtime.js 用）：读包 → 查游戏版本 → 认官方 → 非官方要 confirm → 放好、加载、建数据。
 * @param {{ ready: () => boolean, gameVersion: string, versionAtLeast: (a: string, b: string) => boolean,
 *   online: (force: boolean) => Promise<{ entries: any[] }>, place: (key: string, buffers: Buffer[], local: boolean) => Promise<any>, warn: (message: string) => void }} deps
 */
export function makeImporter(deps) {
  return async function importBundle(text, confirm) {
    if (!deps.ready()) return { ok: false, reason: 'absent' }
    const bundle = parseBundle(text)
    if (!bundle.ok) return bundle
    const { manifest } = bundle
    const about = { key: bundle.key, label: String(manifest.label ?? bundle.key), version: String(manifest.version ?? '') }
    if (typeof manifest.minGame === 'string' && !deps.versionAtLeast(deps.gameVersion, manifest.minGame)) return { ok: false, reason: 'game-too-old', need: manifest.minGame, ...about }
    const official = isOfficial(bundle.hashes, bundle.key, officialList(), (await deps.online(false)).entries)
    if (!official && confirm !== true) return { ok: false, reason: 'unofficial', ...about }
    deps.warn(`extension imported from file: key="${bundle.key}" version="${about.version}" official=${official}`)
    const result = await deps.place(bundle.key, bundle.buffers, !official)
    return { ...result, ...about, official }
  }
}
