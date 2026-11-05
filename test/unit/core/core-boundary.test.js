// @ts-check
/**
 * packages/pet-core 是 DSH 插件和以后独立版共用的库，这里守住它的边界。
 *
 * 一旦领域层读了文件、碰了 DOM、自己取了时间或随机数，或者反过来依赖插件的
 * 组装层，它就没法原样搬进另一个宿主了 —— 这些测试当场拦下来。
 */
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const libraryRoot = new URL('../../../packages/pet-core/', import.meta.url)
const sourceRoot = new URL('src/', libraryRoot)

/** Every .js file below `dirUrl`. */
function jsFiles(dirUrl) {
  const out = []
  for (const entry of readdirSync(dirUrl, { withFileTypes: true })) {
    const child = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, dirUrl)
    if (entry.isDirectory()) out.push(...jsFiles(child))
    else if (entry.name.endsWith('.js')) out.push(child)
  }
  return out
}

const files = jsFiles(sourceRoot)
const relativeName = url => url.pathname.slice(sourceRoot.pathname.length)

/** Code with comments stripped, so prose about `Date.now()` is not an offence. */
const codeOf = url => readFileSync(url, 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

test('pet-core has no host-specific APIs: no IO, DOM, clock or randomness of its own', () => {
  const forbidden = [
    [/from ['"]node:/, 'node: import'],
    [/\brequire\(/, 'require()'],
    [/\bfetch\(/, 'fetch()'],
    [/\b(document|window|localStorage)\./, 'DOM / browser global'],
    [/\bprocess\./, 'process'],
    [/Date\.now\(\)/, 'Date.now()'],
    [/new Date\(\)/, 'new Date()'],
    [/Math\.random\(\)/, 'Math.random()'],
  ]
  const offenders = []
  for (const url of files) {
    const code = codeOf(url)
    for (const [pattern, label] of forbidden) {
      if (pattern.test(code)) offenders.push(`${relativeName(url)}: ${label}`)
    }
  }
  assert.deepEqual(offenders, [], 'the host passes time, randomness and IO in; the library never reaches out for them')
})

test('pet-core only imports from inside itself', () => {
  const rootPath = fileURLToPath(sourceRoot)
  const offenders = []
  for (const url of files) {
    for (const match of codeOf(url).matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) {
      const specifier = match[1]
      if (!specifier.startsWith('.')) {
        offenders.push(`${relativeName(url)}: bare import "${specifier}"`)
        continue
      }
      const target = fileURLToPath(new URL(specifier, url))
      if (!target.startsWith(rootPath)) offenders.push(`${relativeName(url)}: "${specifier}" leaves the package`)
    }
  }
  assert.deepEqual(offenders, [], 'pet-core must stay zero-dependency and never import the plugin shell')
})

test('the plugin barrels re-export the library unchanged', async () => {
  const library = await import('../../../packages/pet-core/src/index.js')
  const pluginCore = await import('../../../src/host/core.js')
  const pluginData = await import('../../../src/host/data.js')
  for (const [name, value] of Object.entries({ ...pluginCore, ...pluginData })) {
    assert.equal(library[name], value, `${name} must be the library's own binding`)
  }
})
