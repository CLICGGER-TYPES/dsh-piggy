// @ts-check
const { createHash } = require('node:crypto')
const { existsSync, readFileSync } = require('node:fs')
const { join } = require('node:path')


const BUILD_DIR = join(__dirname, '..', 'build')
const OPTIONAL_DIR = join(BUILD_DIR, 'optional-extensions')
const INCLUDE = join(BUILD_DIR, 'optional-extensions.nsh')
const GENERATED = join(BUILD_DIR, 'optional-extensions.generated.nsh')
const CATALOG = join(OPTIONAL_DIR, 'catalog.json')
const STRINGS = join(OPTIONAL_DIR, 'strings.json')
/** 安装页顺序；farm-classic 是手动导入变体，不在安装器里。 */
const KEYS = ['farm', 'mine', 'blindbox', 'gacha', 'pig-puzzle']

const sha256 = buffer => createHash('sha256').update(buffer).digest('hex')
const fail = message => {
  throw new Error(`optional extensions are not ready: ${message}\n` +
    'run `node scripts/pack-optional-extensions.mjs` in apps/desktop before packaging')
}

/**
 * 打包前校验产物：五个包、目录、页面字符串和生成的 NSIS define 必须互相对得上，包哈希必须和目录一致。
 * @param {{ dir?: string, generated?: string, include?: string }} [paths]
 */
function verifyOptionalExtensions(paths = {}) {
  const dir = paths.dir ?? OPTIONAL_DIR
  const generated = paths.generated ?? GENERATED
  const include = paths.include ?? INCLUDE
  const catalogPath = join(dir, 'catalog.json')

  if (!existsSync(include)) fail(`missing NSIS include ${include}`)
  if (!existsSync(generated)) fail(`missing generated NSIS defines ${generated}`)
  if (!existsSync(catalogPath)) fail(`missing ${catalogPath}`)

  let catalog
  try {
    catalog = JSON.parse(readFileSync(catalogPath, 'utf8'))
  } catch (error) {
    fail(`catalog.json is not valid JSON (${error instanceof Error ? error.message : String(error)})`)
  }
  if (catalog === null || typeof catalog !== 'object' || catalog.version !== 1) fail('catalog.json version must be 1')
  if (!Array.isArray(catalog.items) || catalog.items.length !== KEYS.length) {
    fail(`catalog.json must list exactly ${KEYS.length} items`)
  }
  catalog.items.forEach((item, index) => {
    if (item === null || typeof item !== 'object') fail(`catalog item ${index} is not an object`)
    if (item.key !== KEYS[index]) fail(`catalog item ${index} must be "${KEYS[index]}", got "${String(item.key)}"`)
    for (const field of ['label', 'version', 'file', 'sha256']) {
      if (typeof item[field] !== 'string' || item[field] === '') fail(`catalog item ${item.key} is missing ${field}`)
    }
    if (!/^[0-9a-f]{64}$/.test(item.sha256)) fail(`catalog item ${item.key} has a malformed sha256`)
    if (!/^ext-[a-z0-9-]+-[^\\/]+\.piggyext$/.test(item.file)) fail(`catalog item ${item.key} has an unexpected file name`)
    const file = join(dir, item.file)
    if (!existsSync(file)) fail(`missing extension bundle ${file}`)
    const actual = sha256(readFileSync(file))
    if (actual !== item.sha256) fail(`${item.file} sha256 changed after packing (catalog ${item.sha256}, file ${actual})`)
  })

  let strings
  try {
    strings = JSON.parse(readFileSync(join(dir, 'strings.json'), 'utf8'))
  } catch (error) {
    fail(`strings.json is missing or invalid (${error instanceof Error ? error.message : String(error)})`)
  }
  if (strings.version !== 1) fail('strings.json version must be 1')
  for (const field of ['title', 'subtitle', 'keepNote', 'builtinNote', 'updateNote']) {
    if (typeof strings[field] !== 'string' || strings[field] === '') fail(`strings.json is missing ${field}`)
  }
  if (!Array.isArray(strings.items) || strings.items.length !== catalog.items.length) fail('strings.json items must match catalog.json')
  strings.items.forEach((item, index) => {
    const expected = catalog.items[index]
    for (const field of ['key', 'label', 'version', 'file']) {
      if (item[field] !== expected[field]) fail(`strings.json item ${index} ${field} does not match catalog.json`)
    }
  })

  const nsh = readFileSync(generated, 'utf8')
  if (!nsh.startsWith('\uFEFF')) fail(`${generated} must be UTF-8 with BOM for makensis`)
  if (!nsh.includes(`!define OPTEXT_ITEM_COUNT ${catalog.items.length}`)) fail('generated NSIS item count is stale')
  catalog.items.forEach((item, index) => {
    for (const [field, define] of [['file', 'FILE'], ['label', 'LABEL'], ['key', 'KEY']]) {
      if (!nsh.includes(`!define OPTEXT_${index}_${define} `)) fail(`generated NSIS is missing item ${index} ${field}`)
    }
  })
  for (const item of catalog.items) {
    if (!nsh.includes(item.file)) fail(`generated NSIS does not mention ${item.file}`)
  }

  return catalog
}


module.exports = { verifyOptionalExtensions, KEYS, INCLUDE }
