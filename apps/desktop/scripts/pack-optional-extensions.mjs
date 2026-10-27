// @ts-check
/**
 * 把五个官方扩展打成「随 Windows 安装包提供」的离线包（用户 2026-10-27：扩展随安装包，发夸克）。
 *
 * 输入只有源码树里的 `extensions/<key>/`：复用发布时的同一套 `extensionFiles` + `makeBundle`
 * （store/ext-import.js），所以安装器里的包和发行页上的 `.piggyext` 结构完全一致，
 * 游戏端能直接用现有本地导入/在线下载的 `parseBundle` 拆开。
 *
 * 产物（默认写到 apps/desktop/build/optional-extensions/）：
 * - `ext-<key>-<version>.piggyext` ×5（farm、mine、blindbox、gacha、pig-puzzle）
 * - `catalog.json`：`{ "version": 1, "items": [{ key, label, version, file, sha256 }] }`
 *   运行时按 key 找包、按 sha256 认包；sha256 是整包文件的哈希。
 * - `strings.json`：安装页文案，字段名一律英文（title/subtitle/keepNote/...），
 *   中文只出现在值里。NSIS 脚本本身保持 ASCII，避免 makensis 源码编码问题。
 * - `apps/desktop/build/optional-extensions.generated.nsh`：由 strings.json + catalog.json
 *   生成的 `!define` 列表（UTF-8 BOM），供 optional-extensions.nsh 使用。
 *
 * 用法：node apps/desktop/scripts/pack-optional-extensions.mjs [输出目录]
 * 只读扩展源码，不联网、不下载扩展、不碰已经打好的发行包。
 */
import { createHash } from 'node:crypto'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { makeBundle, parseBundle } from '../../../store/ext-import.js'
import { extensionFiles } from '../../../scripts/extension-files.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
/** `apps/desktop`。 */
export const DESKTOP_DIR = resolve(HERE, '..')
/** 源码树根（stage 拷贝保持同样结构，所以相对路径同样成立）。 */
export const REPO_ROOT = resolve(HERE, '..', '..', '..')

/** 安装页顺序，也是 catalog.items 的顺序。经典菜园（farm-classic）是手动导入变体，不在这里。 */
export const OPTIONAL_EXTENSIONS = [
  { key: 'farm', note: '种植、收获和农场；采用现有已审纸感版。' },
  { key: 'mine', note: '挖矿、宝藏和矿洞进度。' },
  { key: 'blindbox', note: '寻访、收藏与摆件。' },
  { key: 'gacha', note: '扭蛋收集玩法。' },
  { key: 'pig-puzzle', note: '随机棋盘与三次机会玩法。' },
]

/** 安装页固定五项（UI 2026-10-27 已确认）。 */
export const OPTIONAL_EXTENSION_COUNT = 5
export const CATALOG_VERSION = 1
export const STRINGS_VERSION = 1
export const OPTIONAL_DIR_NAME = 'optional-extensions'
export const CATALOG_FILE = 'catalog.json'
export const STRINGS_FILE = 'strings.json'
export const GENERATED_NSH = 'optional-extensions.generated.nsh'

/** 页面文案（英文字段名）：UI 样稿 /zyx/agents/codex/deliverables/piggy-review/windows-installer-20261027/index.html。 */
export const PAGE_STRINGS = {
  title: '选择附加扩展',
  subtitle: '可以只安装小猪，扩展以后仍能在游戏设置里添加。',
  keepNote: '只补缺少项；已有版本和进度保留，未勾选不删除。',
  builtinNote: '番茄钟和钓鱼为内置玩法，无需另选。',
  updateNote: '已有安装：只补缺少项，保留原版本和进度。',
}

const sha256 = buffer => createHash('sha256').update(buffer).digest('hex')

/**
 * 生成五个扩展包 + catalog.json + strings.json，并写出 NSIS 用的 generated.nsh。
 * @param {{ root?: string, outDir?: string, generatedDir?: string }} [options]
 */
export function buildOptionalExtensions(options = {}) {
  const root = options.root ?? REPO_ROOT
  const outDir = options.outDir ?? join(DESKTOP_DIR, 'build', OPTIONAL_DIR_NAME)
  const generatedDir = options.generatedDir ?? join(DESKTOP_DIR, 'build')
  const extensionsRoot = pathToFileURL(join(root, 'extensions') + '/')

  if (OPTIONAL_EXTENSIONS.length !== OPTIONAL_EXTENSION_COUNT) {
    throw new Error(`安装页固定 ${OPTIONAL_EXTENSION_COUNT} 项，配置里有 ${OPTIONAL_EXTENSIONS.length} 项`)
  }

  rmSync(outDir, { recursive: true, force: true })
  mkdirSync(outDir, { recursive: true })

  /** @type {Array<{ key: string, label: string, version: string, file: string, sha256: string }>} */
  const items = []
  for (const spec of OPTIONAL_EXTENSIONS) {
    const files = extensionFiles(spec.key, extensionsRoot)
    const manifest = JSON.parse(String(files['manifest.json']))
    if (manifest.key !== spec.key) throw new Error(`${spec.key}: manifest.key 是 ${String(manifest.key)}`)
    if (typeof manifest.label !== 'string' || manifest.label === '') throw new Error(`${spec.key}: manifest.label 缺失`)
    if (typeof manifest.version !== 'string' || manifest.version === '') throw new Error(`${spec.key}: manifest.version 缺失`)
    const bundle = makeBundle(files)
    // 自检：安装器里的包必须是游戏端能拆开的同一种包。
    const parsed = parseBundle(bundle)
    if (!parsed.ok) throw new Error(`${spec.key}: 生成的扩展包读不出来（${parsed.message}）`)
    const file = `ext-${spec.key}-${manifest.version}.piggyext`
    const buffer = Buffer.from(bundle, 'utf8')
    writeFileSync(join(outDir, file), buffer)
    items.push({ key: spec.key, label: manifest.label, version: manifest.version, file, sha256: sha256(buffer) })
  }

  const catalog = { version: CATALOG_VERSION, items }
  writeFileSync(join(outDir, CATALOG_FILE), JSON.stringify(catalog, null, 2) + '\n')

  const strings = renderStrings(items)
  writeFileSync(join(outDir, STRINGS_FILE), JSON.stringify(strings, null, 2) + '\n')

  mkdirSync(generatedDir, { recursive: true })
  const generatedPath = join(generatedDir, GENERATED_NSH)
  writeFileSync(generatedPath, renderNsis(strings, catalog, join(outDir, CATALOG_FILE)))

  return {
    outDir,
    generatedPath,
    catalogPath: join(outDir, CATALOG_FILE),
    stringsPath: join(outDir, STRINGS_FILE),
    catalog,
    strings,
    files: items.map(item => join(outDir, item.file)),
  }
}

/** 安装页文案（英文字段）+ 每项 label/note/file/version；中文只在值里。 */
export function renderStrings(items) {
  return {
    version: STRINGS_VERSION,
    title: PAGE_STRINGS.title,
    subtitle: PAGE_STRINGS.subtitle,
    keepNote: PAGE_STRINGS.keepNote,
    builtinNote: PAGE_STRINGS.builtinNote,
    updateNote: PAGE_STRINGS.updateNote,
    items: items.map(item => {
      const spec = OPTIONAL_EXTENSIONS.find(entry => entry.key === item.key)
      if (spec === undefined) throw new Error(`strings: 未知扩展 ${item.key}`)
      return { key: item.key, label: item.label, note: spec.note, file: item.file, version: item.version }
    }),
  }
}

/** NSIS 双引号字符串里的转义：$ 会展开变量、" 会截断字符串、换行会截断语句。 */
export function nsisString(value) {
  return '"' + String(value).replace(/\r\n|\r|\n/g, ' ').replace(/\$/g, '$$$$').replace(/"/g, '$\\"') + '"'
}

/**
 * 生成 `optional-extensions.generated.nsh`：只有 !define，没有逻辑；文件带 UTF-8 BOM。
 * @param {ReturnType<typeof renderStrings>} strings
 * @param {{ version: number, items: Array<{ key: string, file: string }> }} catalog
 * @param {string} [catalogPath] 仅用于注释里的来源说明
 */
export function renderNsis(strings, catalog, catalogPath = '') {
  const lines = [
    '; Generated by apps/desktop/scripts/pack-optional-extensions.mjs. Do not edit.',
    '; User-visible strings live in strings.json (English field names); this file is UTF-8 with BOM.',
    catalogPath === '' ? '' : `; catalog: ${catalogPath}`,
    `; catalog version ${catalog.version}, items ${catalog.items.length}`,
    '',
    `!define OPTEXT_ITEM_COUNT ${strings.items.length}`,
    `!define OPTEXT_TITLE ${nsisString(strings.title)}`,
    `!define OPTEXT_SUBTITLE ${nsisString(strings.subtitle)}`,
    `!define OPTEXT_NOTE_KEEP ${nsisString(strings.keepNote)}`,
    `!define OPTEXT_NOTE_BUILTIN ${nsisString(strings.builtinNote)}`,
    `!define OPTEXT_NOTE_UPDATE ${nsisString(strings.updateNote)}`,
    '',
  ]
  strings.items.forEach((item, index) => {
    lines.push(
      `!define OPTEXT_${index}_KEY ${nsisString(item.key)}`,
      `!define OPTEXT_${index}_LABEL ${nsisString(item.label)}`,
      `!define OPTEXT_${index}_NOTE ${nsisString(item.note)}`,
      `!define OPTEXT_${index}_FILE ${nsisString(item.file)}`,
      '',
    )
  })
  return '\uFEFF' + lines.join('\n')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const outDir = process.argv[2] === undefined ? undefined : resolve(process.argv[2])
  const result = buildOptionalExtensions({ outDir })
  for (const item of result.catalog.items) {
    console.log(`${item.key}\t${item.version}\t${item.file}\t${item.sha256}`)
  }
  console.log(result.catalogPath)
  console.log(result.stringsPath)
  console.log(result.generatedPath)
}
