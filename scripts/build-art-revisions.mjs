// @ts-check
/** 从实际PNG生成内置图缓存版本；规则层只收到常量，不读取文件。 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

export function buildArtRevisions() {
  const entries = JSON.parse(readFileSync(new URL('../assets/pigs/manifest.json', import.meta.url), 'utf8'))
  const lines = ['// @ts-check', '// GENERATED FILE. Run npm run build after changing approved PNG artwork.',
    '/** @type {Readonly<Record<string, string>>} */', 'export const PIG_ART_REVISIONS = Object.freeze({']
  for (const entry of [...entries].sort((a, b) => a.key.localeCompare(b.key))) {
    const actual = createHash('sha256').update(readFileSync(new URL('../assets/' + entry.path, import.meta.url))).digest('hex')
    if (actual !== entry.sha256) throw new Error(`art manifest SHA256 mismatch: ${entry.key}`)
    lines.push(`  ${JSON.stringify(entry.key)}: ${JSON.stringify(actual.slice(0, 12))},`)
  }
  return [...lines, '})', ''].join('\n')
}
