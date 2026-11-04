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
import { ASSET_NAME, CODE_FILES, MAX_FILE_BYTES, assetNames, describeAssetList, describeFileTooBig, isAssetPackFile, isExtensionFile } from './ext-files.js'
import { MAX_FRAME_BYTES, MAX_SOUND_BYTES, validateAssetPackFiles } from './ext-asset-packs.js'
import { readZip } from './zip.js'

export const BUNDLE_FORMAT = 'dsh-piggy-extension'
export const BUNDLE_FILES = CODE_FILES
/** 每个文件最大多少（跟在线下载一样）。 */
export const BUNDLE_FILE_BYTES = MAX_FILE_BYTES
/** 整包合计上限：28MB 足够装下菜园 6.4MB 图片和 8MB 素材包，仍然挡得住把内存撑爆的包。 */
export const BUNDLE_BYTES = 28 * 1024 * 1024
/** 本地导入的扩展目录里留的标记文件。 */
export const LOCAL_MARK = 'local.json'
const KEY = /^[a-z0-9-]{2,24}$/

const sha256 = buffer => createHash('sha256').update(buffer).digest('hex')

/**
 * 把扩展的文件打成扩展包（发版脚本和测试用）：代码是原文，`assets/<名字>` 是图片内容，
 * `actions/`、`sounds/` 下的素材包文件也一起装进来。
 * @param {Record<string, string|Buffer>} files
 */
export function makeBundle(files) {
  const manifest = JSON.parse(String(files['manifest.json']))
  const images = Object.entries(files).filter(([name]) => name.startsWith('assets/'))
  const packs = Object.entries(files).filter(([name]) => name.startsWith('actions/') || name.startsWith('sounds/'))
  return JSON.stringify({
    format: BUNDLE_FORMAT, version: packs.length > 0 ? 3 : images.length > 0 ? 2 : 1, key: manifest.key,
    files: Object.fromEntries(BUNDLE_FILES.map(name => [name, String(files[name])])),
    ...(images.length > 0 ? { assets: Object.fromEntries(images.map(([name, body]) => [name.slice('assets/'.length), Buffer.from(body).toString('base64')])) } : {}),
    ...(packs.length > 0 ? { assetPacks: Object.fromEntries(packs.map(([name, body]) => [name, Buffer.from(body).toString('base64')])) } : {}),
  })
}

/**
 * 从已经拆开的文件表构造扩展包。JSON 和 ZIP 两条入口共用，确保 manifest、
 * 图片清单、素材包清单和路径白名单只校验一次。
 * @param {Map<string, Buffer>} files
 * @returns {{ ok: true, key: string, manifest: any, files: Map<string, Buffer>, hashes: Record<string, string>, assetPacks: { actions: any[], sounds: any[] } } | { ok: false, reason: string, message: string }}
 */
function fromFileMap(files) {
  const bad = message => ({ ok: /** @type {false} */ (false), reason: 'invalid-bundle', message })
  for (const name of CODE_FILES) {
    const body = files.get(name)
    if (body === undefined) return bad('扩展包里缺少 ' + name)
    if (body.length > BUNDLE_FILE_BYTES) return bad(name + ' 太大')
  }
  const manifestBytes = files.get('manifest.json')
  if (manifestBytes === undefined) return bad('扩展包里缺少 manifest.json')
  let manifest
  try { manifest = JSON.parse(manifestBytes.toString('utf8')) } catch { return bad('manifest.json 读不懂') }
  if (manifest === null || typeof manifest !== 'object' || typeof manifest.key !== 'string' || !KEY.test(manifest.key)) return bad('manifest.json 里的扩展名不对')
  for (const name of files.keys()) {
    if (!isExtensionFile(name)) return bad('扩展包里不允许的文件：' + name)
  }
  const declared = assetNames(manifest)
  if (declared === null) {
    const why = describeAssetList(manifest)
    return bad('manifest.json 里的图片清单不对' + (why === '' ? '' : '（' + why + '）'))
  }
  const actualAssets = [...files.keys()].filter(name => name.startsWith('assets/')).map(name => name.slice('assets/'.length))
  if (actualAssets.length !== declared.length || !declared.every(name => actualAssets.includes(name))) return bad('扩展包里的图片和 manifest 对不上')
  for (const name of declared) {
    if (!ASSET_NAME.test(name)) return bad('图片名不对：' + name)
    const body = files.get('assets/' + name)
    if (body === undefined) return bad('扩展包里的图片和 manifest 对不上')
    if (body.length > BUNDLE_FILE_BYTES) return bad(describeFileTooBig(name, body.length))
  }
  const packs = validateAssetPackFiles(manifest.key, files, manifest)
  if (packs.ok !== true) return bad('素材包校验失败：' + packs.message)
  for (const [name, body] of files) {
    if (isAssetPackFile(name)) {
      const frame = /^actions\/[^/]+\/[^/]+\/\d{2}\.(?:png|webp)$/.test(name)
      const sound = /^sounds\/[^/]+\/[^/]+\.(?:ogg|wav)$/.test(name)
      if (frame && body.length > MAX_FRAME_BYTES) return bad(describeFileTooBig(name, body.length, MAX_FRAME_BYTES))
      if (sound && body.length > MAX_SOUND_BYTES) return bad(describeFileTooBig(name, body.length, MAX_SOUND_BYTES))
    }
  }
  const hashes = Object.fromEntries([...files].map(([name, buffer]) => [name, sha256(buffer)]))
  return { ok: true, key: manifest.key, manifest, files, hashes, assetPacks: { actions: packs.actions, sounds: packs.sounds } }
}

/**
 * 读扩展包。支持两种输入：
 * - 现有 `.piggyext` JSON（代码 + base64 图片 + base64 素材包）
 * - 直接选择的手工 ZIP（根目录放 manifest.json/server.js/client.js 和素材目录）
 * ZIP 先经过 store/zip 的路径、符号链接、CRC、重叠和大小检查，再走同一套文件表校验。
 * @param {string|Buffer} input
 * @returns {{ ok: true, key: string, manifest: any, files: Map<string, Buffer>, hashes: Record<string, string>, assetPacks: { actions: any[], sounds: any[] } } | { ok: false, reason: string, message: string }}
 */
export function parseBundle(input) {
  const bad = message => ({ ok: /** @type {false} */ (false), reason: 'invalid-bundle', message })
  /** @type {string|undefined} */
  let text
  if (Buffer.isBuffer(input)) {
    if (input.length > BUNDLE_BYTES) return bad('扩展包太大')
    if (input.length >= 4 && input[0] === 0x50 && input[1] === 0x4b && (input[2] === 0x03 || input[2] === 0x05)) {
      /** @type {Map<string, Buffer>} */
      let archive
      try {
        archive = readZip(input, {
          maxBytes: BUNDLE_BYTES,
          maxFiles: 1024,
          maxFileBytes: MAX_FILE_BYTES,
          allowDirectories: true,
        })
      } catch (error) {
        return bad('扩展包 ZIP 无效：' + (error instanceof Error ? error.message : String(error)).replaceAll('存档', '扩展包'))
      }
      for (const name of archive.keys()) {
        if (!isExtensionFile(name)) return bad('扩展包里不允许的文件：' + name)
      }
      return fromFileMap(archive)
    }
    text = input.toString('utf8')
  } else {
    if (typeof input !== 'string') return bad('这不是扩展包')
    text = input
    if (Buffer.byteLength(text, 'utf8') > BUNDLE_BYTES) return bad('扩展包太大')
  }
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
  if (declared === null) {
    const why = describeAssetList(manifest)
    return bad('manifest.json 里的图片清单不对' + (why === '' ? '' : '（' + why + '）'))
  }
  if (Object.keys(images).length !== declared.length || !declared.every(name => typeof images[name] === 'string')) return bad('扩展包里的图片和 manifest 对不上')
  for (const name of declared) {
    if (!ASSET_NAME.test(name)) return bad('图片名不对：' + name)
    const buffer = Buffer.from(images[name], 'base64')
    if (buffer.length > BUNDLE_FILE_BYTES) return bad(describeFileTooBig(name, buffer.length))
    files.set('assets/' + name, buffer)
  }
  const packs = bundle.assetPacks !== null && typeof bundle.assetPacks === 'object' ? bundle.assetPacks : {}
  for (const [name, body] of Object.entries(packs)) {
    if (!isAssetPackFile(name)) return bad('扩展包里的素材包路径不允许：' + name)
    if (typeof body !== 'string') return bad('素材包文件内容不可读：' + name)
    const buffer = Buffer.from(body, 'base64')
    if (buffer.length > MAX_FRAME_BYTES && /\.(?:png|webp)$/.test(name)) return bad(describeFileTooBig(name, buffer.length, MAX_FRAME_BYTES))
    if (buffer.length > MAX_SOUND_BYTES && /\.(?:ogg|wav)$/.test(name)) return bad(describeFileTooBig(name, buffer.length, MAX_SOUND_BYTES))
    files.set(name, buffer)
  }
  return fromFileMap(files)
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
  /** @param {string|Buffer} input @param {boolean} [confirm] */
  return async function importBundle(input, confirm) {
    if (!deps.ready()) return { ok: false, reason: 'absent' }
    const bundle = parseBundle(input)
    if (!bundle.ok) return bundle
    const { manifest } = bundle
    const about = { key: bundle.key, label: String(manifest.label ?? bundle.key), version: String(manifest.version ?? '') }
    if (typeof manifest.minGame === 'string' && !deps.versionAtLeast(deps.gameVersion, manifest.minGame)) return { ok: false, reason: 'game-too-old', need: manifest.minGame, ...about }
    const known = officialList()
    const official = isOfficial(bundle.hashes, bundle.key, known, [])
      || isOfficial(bundle.hashes, bundle.key, known, (await deps.online(false)).entries)
    if (!official && confirm !== true) return { ok: false, reason: 'unofficial', ...about }
    deps.warn(`extension imported from file: key="${bundle.key}" version="${about.version}" official=${official}`)
    const result = await deps.place(bundle.key, bundle.files, !official)
    return { ...result, ...about, official }
  }
}
