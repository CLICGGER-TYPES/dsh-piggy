// @ts-check
/**
 * 素材总表（docs/ASSETS.md，2026-10-09）：assets/ 里每个文件都要能对上「登记」里的一条通配，
 * 每条登记也至少对上一个文件。新增、删除素材忘了改总表，这里会红。
 */
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const ASSETS = join(ROOT, 'assets')

/** @param {string} dir @returns {string[]} */
function walk(dir) {
  return readdirSync(dir).flatMap(name => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [relative(ASSETS, full).split(sep).join('/')]
  })
}

/** `*` 只匹配同一层里的任意字符。 @param {string} glob */
const toRegExp = glob => new RegExp('^' + glob.split('*').map(part => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*') + '$')

test('every file under assets/ is registered in docs/ASSETS.md, and every registration matches a file', () => {
  const doc = readFileSync(join(ROOT, 'docs', 'ASSETS.md'), 'utf8')
  const block = doc.match(/```assets\n([\s\S]*?)```/)
  assert.ok(block, 'docs/ASSETS.md must keep its ```assets registration block')
  const globs = block[1].split('\n').map(line => line.trim()).filter(Boolean)
  const files = walk(ASSETS)
  const unregistered = files.filter(file => !globs.some(glob => toRegExp(glob).test(file)))
  assert.deepEqual(unregistered, [], '新增素材要登记到 docs/ASSETS.md 底部（并写清类别、出处）')
  const stale = globs.filter(glob => !files.some(file => toRegExp(glob).test(file)))
  assert.deepEqual(stale, [], '登记了但 assets/ 里已经没有对应文件，删掉这条或补回文件')
})
