// @ts-check
// 设置页的存档/代理按钮统一复用面板现有的 dp-mini，不另造一套视觉。
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const read = name => readFile(new URL('../src/client/' + name, import.meta.url), 'utf8')

test('存档的导出/导入使用 dp-mini，和其他设置动作同一个样式', async () => {
  const source = await read('save-transfer.js')
  assert.match(source, /button\('dp-mini', \{ 'data-save-trigger': 'export' \}/)
  assert.match(source, /button\('dp-mini', \{ 'data-save-trigger': 'import' \}/)
})

test('代理三个按钮不再覆盖 dp-mini 的圆角/阴影/颜色，只保留右对齐', async () => {
  const source = await read('css-tabs.js')
  assert.doesNotMatch(source, /\.dp-proxy-actions \.dp-mini\{/)
  assert.doesNotMatch(source, /\.dp-proxy-actions \.dp-proxy-(save|test)\{/)
  assert.match(source, /\.dp-proxy-actions \.dp-proxy-clear\{margin-left:auto\}/)
})
