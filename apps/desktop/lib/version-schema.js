// @ts-check
/** 版本的存档兼容信息与最终保存的 schema；不执行游戏模块。 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const validSchema = value => Number.isSafeInteger(value) && value >= 0

/** 只读取已发布游戏的数字常量，不加载或执行旧游戏模块。 */
function readGameSchema(directory, label) {
  let source
  try { source = readFileSync(join(directory, 'packages/pet-core/src/core/constants.js'), 'utf8') }
  catch { throw new Error(`无法确认${label}的存档版本，不能回退`) }
  const declarations = [...source.matchAll(/^[\t ]*export[\t ]+const[\t ]+STATE_VERSION[\t ]*=[\t ]*(0|[1-9]\d*)[\t ]*;?[\t ]*(?:\/\/[^\r\n]*)?\r?$/gm)]
  const schema = declarations.length === 1 ? Number(declarations[0][1]) : null
  if (!validSchema(schema)) throw new Error(`${label}没有可识别的存档版本，不能回退`)
  return schema
}

/** @param {string} statePath */
export function readSaveVersion(statePath) {
  let saved
  try { saved = JSON.parse(readFileSync(statePath, 'utf8')) }
  catch (error) {
    if (error.code === 'ENOENT') return 0
    throw new Error(`无法确认当前存档版本，已取消切换（${error.message}）`)
  }
  if (!validSchema(saved?.version)) throw new Error('当前存档缺少有效版本，已取消切换')
  return saved.version
}

/** @param {{ root: string, temporaryDir?: string, bundledDir: string }} options */
export function createVersionSchemas(options) {
  const fileFor = version => join(options.root, `${version}.manifest.json`)

  function supported(version) {
    if (version === 'bundled') return readGameSchema(options.bundledDir, '安装包自带游戏')
    const message = `无法确认下载版本 v${version} 的存档兼容信息，请从版本列表重新安装该版本`
    let saved
    try { saved = JSON.parse(readFileSync(fileFor(version), 'utf8')) }
    catch (error) {
      if (error.code !== 'ENOENT') throw new Error(message)
      // 旧外壳没有保存清单；从同一版本的已有游戏文件补齐，不跳过存档兼容检查。
      const directory = join(options.root, version)
      let schema
      try {
        const installed = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'))
        if (installed.version !== version) throw new Error(message)
        schema = readGameSchema(directory, `下载版本 v${version}`)
      } catch { throw new Error(message) }
      record(version, schema)
      return schema
    }
    if (saved?.version !== version || !validSchema(saved?.stateVersion)) throw new Error(message)
    return saved.stateVersion
  }

  /** @param {string} version @param {number} stateVersion */
  function record(version, stateVersion) {
    mkdirSync(options.root, { recursive: true })
    const temporary = join(options.temporaryDir ?? options.root, `schema-${version}.json.tmp`)
    writeFileSync(temporary, JSON.stringify({ version, stateVersion }))
    renameSync(temporary, fileFor(version))
  }

  return { supported, record }
}
