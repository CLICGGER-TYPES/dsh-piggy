// @ts-check
/**
 * 本地导入扩展（用户 2026-10-10：有些人下载不了 GitHub / Gitee 的附件）。
 *
 * - 导入的是「扩展包」`.piggyext`：一个 JSON，装着扩展的三个文件（manifest.json、server.js、client.js）的原文，
 *   带图片的扩展另有 `assets: { 名字: base64 }`（名单要和 manifest 的 assets 一致，见 store/ext-files.js）。
 *   发版时用 `node scripts/extension-bundle.mjs <key>` 生成，和三个文件一起传到发布页；也认直接选那三个文件（面板里拼成包再发）。
 * - **官方扩展**：所有文件的 sha256 跟游戏自带的官方清单（store/official-extensions.json，只增不减）对得上，直接装，跟在线下载的一样。
 * - **非官方**：先拒绝并说明（reason 'unofficial'），用户在面板里确认后带 confirm 再发一次才装；装好在目录里留一个 `local.json`，
 *   面板标「本地导入」，在线目录不再给它提示更新（免得官方版把它悄悄盖掉）。
 * @module dsh-piggy/store/ext-import
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { ASSET_NAME, CODE_FILES, MAX_ASSETS_BYTES, MAX_FILE_BYTES, assetNames } from './ext-files.js'

export const BUNDLE_FORMAT = 'dsh-piggy-extension'
export const BUNDLE_FILES = CODE_FILES
/** 每个文件最大多少（跟在线下载一样）。 */
export const BUNDLE_FILE_BYTES = MAX_FILE_BYTES
/** 整个扩展包最大多少：三个代码文件加上 base64 后的图片。 */
export const BUNDLE_BYTES = Math.ceil(MAX_FILE_BYTES * 3 * 2 + MAX_ASSETS_BYTES * 1.4)
/** 本地导入的扩展目录里留的标记文件。 */
export const LOCAL_MARK = 'local.json'
const KEY = /^[a-z0-9-]{2,24}$/

const sha256 = buffer => createHash('sha256').update(buffer).digest('hex')

/** 把扩展的文件打成扩展包（发版脚本和测试用）：代码是原文，`assets/<名字>` 是图片内容。 @param {Record<string, string|Buffer>} files */
export function makeBundle(files) {
  const manifest = JSON.parse(String(files['manifest.json']))
  const images = Object.entries(files).filter(([name]) => name.startsWith('assets/'))
  return JSON.stringify({
    format: BUNDLE_FORMAT, version: images.length > 0 ? 2 : 1, key: manifest.key,
    files: Object.fromEntries(BUNDLE_FILES.map(name => [name, String(files[name])])),
    ...(images.length > 0 ? { assets: Object.fromEntries(images.map(([name, body]) => [name.slice('assets/'.length), Buffer.from(body).toString('base64')])) } : {}),
  })
}

/**
 * 读扩展包。
 * @param {string} text
 * @returns {{ ok: true, key: string, manifest: any, files: Map<string, Buffer>, hashes: Record<string, string> } | { ok: false, reason: string, message: string }}
 */
export function parseBundle(text) {
  const bad = message => ({ ok: /** @type {false} */ (false), reason: 'invalid-bundle', message })
  let bundle
  try { bundle = JSON.parse(text) } catch { return bad('这不是扩展包') }
  if (bundle === null || typeof bundle !== 'object' || bundle.format !== BUNDLE_FORMAT || bundle.files === null || typeof bundle.files !== 'object') return bad('这不是扩展包')
  /** @type {Map<string, Buffer>} */
  const files = new Map()
  for (const name of BUNDLE_FILES) {
    if (typeof bundle.files[name] !== 'string') return bad('扩展包里缺少 ' + name)
    const buffer = Buffer.from(bundle.files[name], 'utf8')
    if (buffer.length > BUNDLE_FILE_BYTES) return bad(name + ' 太大')
    files.set(name, buffer)
  }
  let manifest
  try { manifest = JSON.parse(bundle.files['manifest.json']) } catch { return bad('manifest.json 读不懂') }
  if (manifest === null || typeof manifest !== 'object' || typeof manifest.key !== 'string' || !KEY.test(manifest.key)) return bad('manifest.json 里的扩展名不对')
  if (typeof bundle.key === 'string' && bundle.key !== manifest.key) return bad('扩展包名字和 manifest 对不上')
  const declared = assetNames(manifest)
  const images = bundle.assets !== null && typeof bundle.assets === 'object' ? bundle.assets : {}
  if (declared === null) return bad('manifest.json 里的图片清单不对')
  if (Object.keys(images).length !== declared.length || !declared.every(name => typeof images[name] === 'string')) return bad('扩展包里的图片和 manifest 对不上')
  let imageBytes = 0
  for (const name of declared) {
    if (!ASSET_NAME.test(name)) return bad('图片名不对：' + name)
    const buffer = Buffer.from(images[name], 'base64')
    if (buffer.length > BUNDLE_FILE_BYTES) return bad(name + ' 太大')
    imageBytes += buffer.length
    files.set('assets/' + name, buffer)
  }
  if (imageBytes > MAX_ASSETS_BYTES) return bad('图片合计太大')
  const hashes = Object.fromEntries([...files].map(([name, buffer]) => [name, sha256(buffer)]))
  return { ok: true, key: manifest.key, manifest, files, hashes }
}

/** 游戏自带的官方清单：{ 扩展名: { 版本: { 文件名: sha256 } } }。 */
export function officialList() {
  try { return JSON.parse(readFileSync(new URL('./official-extensions.json', import.meta.url), 'utf8')) } catch { return {} }
}

/**
 * 是不是官方扩展：所有文件（一个不多、一个不少）都对得上官方清单里某个版本，或者对得上在线目录里那一条。
 * @param {Record<string, string>} hashes @param {string} key @param {any} official @param {any[]} onlineEntries
 */
export function isOfficial(hashes, key, official, onlineEntries) {
  const names = Object.keys(hashes)
  const same = files => files !== null && typeof files === 'object' && Object.keys(files).length === names.length && names.every(name => {
    const expected = typeof files[name] === 'string' ? files[name] : files[name]?.sha256
    return typeof expected === 'string' && expected.toLowerCase() === hashes[name]
  })
  if (Object.values(official?.[key] ?? {}).some(same)) return true
  return onlineEntries.some(entry => entry?.key === key && same(entry.files))
}

/**
 * 导入流程（给 store/ext-runtime.js 用）：读包 → 查游戏版本 → 认官方 → 非官方要 confirm → 放好、加载、建数据。
 * @param {{ ready: () => boolean, gameVersion: string, versionAtLeast: (a: string, b: string) => boolean,
 *   online: (force: boolean) => Promise<{ entries: any[] }>, place: (key: string, files: Map<string, Buffer>, local: boolean) => Promise<any>, warn: (message: string) => void }} deps
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
    const result = await deps.place(bundle.key, bundle.files, !official)
    return { ...result, ...about, official }
  }
}
