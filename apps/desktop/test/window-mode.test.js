// @ts-check
/**
 * 打包入口与启动模式选择：纯函数契约 + builder files 的静态覆盖检查。
 * 不启动 Electron、不运行 electron-builder。
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import { DEFAULT_WINDOW_MODE, selectWindowMode } from '../lib/window-mode.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const APP = resolve(HERE, '..')
const pkg = JSON.parse(readFileSync(resolve(APP, 'package.json'), 'utf8'))
const files = pkg.build.files

const asPosix = path => path.split(sep).join('/')

/** electron-builder files 里本项目用到的两种形式：精确文件、`dir/**`。 */
function coveredByFiles(path) {
  return files.some(pattern => {
    if (pattern.endsWith('/**')) return path.startsWith(pattern.slice(0, -2))
    return path === pattern
  })
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name)
    if (entry.isDirectory()) walk(path, out)
    else out.push(path)
  }
  return out
}

/** 找出相对 import/import()/export from 的目标，并补上扩展名或 index。 */
function localImports(file) {
  const source = readFileSync(file, 'utf8')
  const found = []
  const pattern = /(?:from\s*|import\s*\(\s*|^\s*import\s+)['"](\.[^'"]+)['"]/gm
  for (const match of source.matchAll(pattern)) {
    const base = resolve(dirname(file), match[1])
    const target = [base, `${base}.js`, `${base}.cjs`, `${base}.json`, resolve(base, 'index.js')]
      .find(candidate => existsSync(candidate))
    if (target) found.push(target)
    else found.push(base)
  }
  return found
}

test('window mode: no args keeps the original split shell', () => {
  assert.equal(DEFAULT_WINDOW_MODE, 'split')
  assert.equal(selectWindowMode(), 'split')
  assert.equal(selectWindowMode([]), 'split')
  assert.equal(selectWindowMode(['.', '--enable-features=Piggy']), 'split')
})

test('window mode: explicit stage and bare --stage both select stage', () => {
  assert.equal(selectWindowMode(['--window-mode=stage']), 'stage')
  assert.equal(selectWindowMode(['.', '--stage']), 'stage')
  assert.equal(selectWindowMode(['--stage', '--stage']), 'stage')
})

test('window mode: explicit split falls back to the original entry', () => {
  assert.equal(selectWindowMode(['--window-mode=split']), 'split')
  assert.equal(selectWindowMode(['--stage', '--window-mode=split']), 'split')
})

test('window mode: explicit --window-mode beats bare --stage in either order', () => {
  assert.equal(selectWindowMode(['--window-mode=split', '--stage']), 'split')
  assert.equal(selectWindowMode(['--stage', '--window-mode=split']), 'split')
  assert.equal(selectWindowMode(['--window-mode=stage', '--stage']), 'stage')
})

test('window mode: the last explicit --window-mode wins', () => {
  assert.equal(selectWindowMode(['--window-mode=stage', '--window-mode=split']), 'split')
  assert.equal(selectWindowMode(['--window-mode=split', '--window-mode=stage']), 'stage')
})

test('window mode: substrings, plugin values and malformed switches are ignored', () => {
  for (const argv of [
    ['--window-mode=stage2'],
    ['--window-mode=Stage'],
    ['--window-mode'],
    ['--stage=1'],
    ['--stage-mode'],
    ['--my-stage'],
    ['--enable-features=stage'],
    ['x--window-mode=stage'],
    ['stage'],
  ]) {
    assert.equal(selectWindowMode(argv), 'split', JSON.stringify(argv))
  }
})

test('package main and start scripts use the same root launcher', () => {
  assert.equal(pkg.main, 'launcher.js')
  assert.equal(pkg.scripts.start, 'npm run pack-game && electron .')
  assert.equal(pkg.scripts['start:stage'], 'npm run pack-game && electron . --window-mode=stage')
  assert.ok(existsSync(resolve(APP, pkg.main)))
})

test('builder files cover the launcher, every stage file and its local imports', () => {
  for (const required of ['launcher.js', 'main.js', 'first-run.js', 'lib/**', 'stage/**']) {
    assert.ok(files.includes(required), `build.files 缺少 ${required}`)
  }
  assert.ok(coveredByFiles('lib/window-mode.js'), '新增纯 helper 未被 lib/** 覆盖')

  const stageFiles = walk(resolve(APP, 'stage'))
  assert.ok(stageFiles.some(file => file.endsWith(`${sep}main.js`)), 'stage/main.js 不存在')
  assert.ok(stageFiles.some(file => file.endsWith(`${sep}index.html`)), 'stage/index.html 不存在')

  for (const file of stageFiles) {
    const rel = asPosix(relative(APP, file))
    assert.ok(coveredByFiles(rel), `builder files 未覆盖 ${rel}`)
  }

  const runtimeFiles = walk(resolve(APP, 'stage')).filter(file => /\.(js|cjs|mjs)$/.test(file))
  for (const file of runtimeFiles) {
    for (const target of localImports(file)) {
      assert.ok(existsSync(target), `${asPosix(relative(APP, file))} 的相对引用不存在：${target}`)
      assert.ok(target.startsWith(APP + sep), `舞台入口引用了打包根目录之外的文件：${target}`)
      const rel = asPosix(relative(APP, target))
      assert.ok(coveredByFiles(rel), `builder files 未覆盖舞台依赖 ${rel}`)
    }
  }
})

test('the Gitee build inherits the same launcher and stage files', () => {
  const gitee = require('../electron-builder.gitee.cjs')
  for (const required of ['launcher.js', 'lib/**', 'stage/**']) {
    assert.ok(gitee.files.includes(required), `Gitee build.files 缺少 ${required}`)
  }
})
