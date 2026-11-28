#!/usr/bin/env node
// @ts-check
/**
 * 静态布局门禁：把 tools/layout-audit.mjs 里的「文字内边距」和「控件间距」口径
 * 做成不依赖浏览器/桌面的 npm test 检查。完整审计仍要按 docs/guides/layout-audit.md
 * 连真实 CDP 页面跑；这里只守 CSS 里能静态发现的那部分。
 *
 * 规则（阈值见 tools/layout-metrics.mjs）：
 * - 带背景或边框的可点文本控件，如果自己声明了上下 padding，就必须 ≥ 6px；
 * - flex/grid 操作区声明 gap 时不能小于 4px。
 * 只检查明确写了上下 padding / gap 的规则；子规则只补横向 padding 的跳过，避免误伤继承。
 *
 * 用法：
 *   node tools/layout-lint.mjs              打印当前违例
 *   node tools/layout-lint.mjs --write-baseline  更新基线（要说明为什么新增）
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MIN_CONTROL_GAP, MIN_TEXT_PADDING } from './layout-metrics.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const baselinePath = join(root, 'tools/layout-baseline.json')

export const INTERACTIVE = /(?:btn|button|chip|pill|toggle|more|tab|item|mode|link|action)/
const GAP_CONTAINER = /(?:actions|chips|bar|list|row|controls|tabs|btns|setbar)/

/** 收集需要检查的 CSS 字符串所在文件。 */
export function cssFiles() {
  const files = []
  for (const name of readdirSync(join(root, 'src/client'))) {
    if (/^css-.*\.js$/.test(name)) files.push('src/client/' + name)
  }
  const extRoot = join(root, 'src/extensions')
  for (const key of readdirSync(extRoot)) {
    const file = join(extRoot, key, 'client/styles.js')
    try { readFileSync(file); files.push(relative(root, file).replace(/\\/g, '/')) } catch {}
  }
  return files.sort()
}

/** @param {string} value */
function px(value) {
  const match = String(value).trim().match(/^(-?\d+(?:\.\d+)?)px$/)
  return match ? Number(match[1]) : null
}

/** 拆 CSS 声明，返回 Map；同名取最后一个。 @param {string} body */
function declarations(body) {
  const map = new Map()
  for (const part of body.split(';')) {
    const at = part.indexOf(':')
    if (at < 0) continue
    const name = part.slice(0, at).trim().toLowerCase()
    const value = part.slice(at + 1).trim()
    if (name) map.set(name, value)
  }
  return map
}

/** padding 简写转四边；只有 1-4 个 px 才返回。 @param {string} value */
function paddingSides(value) {
  const parts = value.trim().split(/\s+/)
  if (parts.length < 1 || parts.length > 4) return null
  const nums = parts.map(px)
  if (nums.some(n => n === null)) return null
  if (parts.length === 1) return { top: nums[0], right: nums[0], bottom: nums[0], left: nums[0] }
  if (parts.length === 2) return { top: nums[0], right: nums[1], bottom: nums[0], left: nums[1] }
  if (parts.length === 3) return { top: nums[0], right: nums[1], bottom: nums[2], left: nums[1] }
  return { top: nums[0], right: nums[1], bottom: nums[2], left: nums[3] }
}

/** @param {Map<string,string>} decl */
function verticalPadding(decl) {
  const top = decl.get('padding-top')
  const bottom = decl.get('padding-bottom')
  if (top !== undefined || bottom !== undefined) {
    return { top: top === undefined ? null : px(top), bottom: bottom === undefined ? null : px(bottom) }
  }
  const shorthand = decl.get('padding')
  if (shorthand === undefined) return null
  const sides = paddingSides(shorthand)
  return sides === null ? null : { top: sides.top, bottom: sides.bottom }
}

/** @param {Map<string,string>} decl */
function hasSurface(decl) {
  const background = (decl.get('background') ?? decl.get('background-color') ?? '').trim()
  if (background && !/^(transparent|none)$/i.test(background)) return true
  const border = decl.get('border') ?? ''
  if (border && !/^(0|none)\b/i.test(border.trim())) return true
  for (const side of ['border-top', 'border-left']) {
    const value = decl.get(side)
    if (value && (px(value.split(/\s+/)[0]) ?? 0) > 0) return true
  }
  return false
}

/** @param {string} text @param {string} file */
function rulesOf(text, file) {
  const rules = []
  const re = /'((?:[^'\\]|\\.)*\{[^}]*\})'/g
  let match
  while ((match = re.exec(text)) !== null) {
    const body = match[1]
    const brace = body.indexOf('{')
    const selector = body.slice(0, brace).trim()
    if (!selector || selector.startsWith('@')) continue
    const decl = declarations(body.slice(brace + 1, body.lastIndexOf('}')))
    rules.push({ file, selector, decl })
  }
  return rules
}

/** 对一段与 styles.js 同格式的 CSS 字符串做检查（测试也用它验证判据生效）。 */
export function lintCssText(text, file = 'inline') {
  const violations = []
  for (const { selector, decl } of rulesOf(text, file)) {
    const interactive = (decl.get('cursor') ?? '').trim() === 'pointer' || INTERACTIVE.test(selector)
    if (interactive && hasSurface(decl)) {
      const padding = verticalPadding(decl)
      if (padding !== null && padding.top !== null && padding.top < MIN_TEXT_PADDING) {
        violations.push({ file, selector, metric: 'padding-top', value: padding.top, minimum: MIN_TEXT_PADDING })
      }
      if (padding !== null && padding.bottom !== null && padding.bottom < MIN_TEXT_PADDING) {
        violations.push({ file, selector, metric: 'padding-bottom', value: padding.bottom, minimum: MIN_TEXT_PADDING })
      }
    }
    const display = (decl.get('display') ?? '').trim()
    if (/^(flex|inline-flex|grid|inline-grid)$/.test(display) && GAP_CONTAINER.test(selector) && decl.has('gap')) {
      const value = px(decl.get('gap'))
      if (value !== null && value < MIN_CONTROL_GAP) {
        violations.push({ file, selector, metric: 'gap', value, minimum: MIN_CONTROL_GAP })
      }
    }
  }
  return violations
}

export function lintLayout() {
  const violations = []
  for (const file of cssFiles()) {
    violations.push(...lintCssText(readFileSync(join(root, file), 'utf8'), file))
  }
  const key = item => item.file + '|' + item.selector + '|' + item.metric
  return violations.sort((a, b) => key(a).localeCompare(key(b)))
}

export function readBaseline() {
  try {
    return JSON.parse(readFileSync(baselinePath, 'utf8'))
  } catch {
    return { generatedAt: '', violations: [] }
  }
}

/** @param {ReturnType<typeof lintLayout>} violations */
export function baselineOf(violations) {
  return {
    generatedAt: new Date().toISOString().slice(0, 10),
    thresholds: { MIN_TEXT_PADDING, MIN_CONTROL_GAP },
    count: violations.length,
    violations: violations.map(item => ({ file: item.file, selector: item.selector, metric: item.metric, value: item.value })),
  }
}

const invokedDirectly = process.argv[1] !== undefined
  && fileURLToPath(import.meta.url) === process.argv[1]
if (invokedDirectly) {
  const violations = lintLayout()
  if (process.argv.includes('--write-baseline')) {
    writeFileSync(baselinePath, JSON.stringify(baselineOf(violations), null, 2) + '\n')
    console.log('layout-lint: 写入基线 ' + violations.length + ' 条 -> tools/layout-baseline.json')
  } else {
    const byMetric = violations.reduce((acc, item) => { acc[item.metric] = (acc[item.metric] ?? 0) + 1; return acc }, {})
    console.log(JSON.stringify({ count: violations.length, byMetric, violations }, null, 2))
  }
}
