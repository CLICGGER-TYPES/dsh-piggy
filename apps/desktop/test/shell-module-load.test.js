// @ts-check
/**
 * 旧外壳拆分后的加载顺序守卫。
 *
 * index.html 必须先加载各模块（只注册工厂），最后才加载 loader.js 让回退时的
 * shell.js 能立即装配；顺序错了老游戏包会拿不到 __dshPiggyShell。
 */
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { test } from 'node:test'

const RENDERER = new URL('../renderer/', import.meta.url)
const SHELL_MODULES = ['shell-measure.js', 'shell-anchor.js', 'shell-room.js', 'shell-report.js', 'shell-tooltip.js', 'shell.js']

test('index.html 先加载旧外壳模块，再加载 loader', () => {
  const html = readFileSync(new URL('index.html', RENDERER), 'utf8')
  const sources = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(match => match[1])
  // shell.js 不在 index.html 里：只有 loader 判定要回退时才动态加载它。
  assert.deepEqual(sources, [...SHELL_MODULES.filter(name => name !== 'shell.js'), 'loader.js'])
})

test('旧外壳模块齐全，只有装配入口挂 __dshPiggyShell', () => {
  const files = readdirSync(RENDERER).filter(name => /^shell.*\.js$/.test(name)).sort()
  assert.deepEqual(files, [...SHELL_MODULES].sort())
  for (const name of SHELL_MODULES) {
    const source = readFileSync(new URL(name, RENDERER), 'utf8')
    assert.ok(source.startsWith('// @ts-check\n/**'), `${name} 要有 @ts-check 和中文文件头`)
    assert.match(source.slice(0, 600), /[\u4e00-\u9fff]/u, `${name} 文件头要用中文`)
    if (name === 'shell.js') assert.match(source, /w\.__dshPiggyShell = \{/)
    else assert.doesNotMatch(source, /w\.__dshPiggyShell = \{/)
  }
})
