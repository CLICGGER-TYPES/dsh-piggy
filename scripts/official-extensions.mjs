// 把扩展目录（extensions/registry.json）里每个下载扩展当前版本的三个文件校验值，并进游戏自带的官方清单
// store/official-extensions.json。清单只增不减：以前发过的官方版本也一直认得（本地导入旧版也算官方）。
// 用法：node scripts/official-extensions.mjs        改完扩展、重算目录之后跑一次（test/ext-import.test.js 会检查有没有漏）
import { readFileSync, writeFileSync } from 'node:fs'

const registry = JSON.parse(readFileSync(new URL('../extensions/registry.json', import.meta.url), 'utf8'))
const file = new URL('../store/official-extensions.json', import.meta.url)
let official = {}
try { official = JSON.parse(readFileSync(file, 'utf8')) } catch {}
for (const entry of registry.extensions) {
  if (entry.builtin === true || !entry.files) continue
  official[entry.key] = official[entry.key] ?? {}
  official[entry.key][entry.version] = Object.fromEntries(Object.entries(entry.files).map(([name, spec]) => [name, spec.sha256]))
}
const sorted = Object.fromEntries(Object.keys(official).sort().map(key => [key, official[key]]))
writeFileSync(file, JSON.stringify(sorted, null, 2) + '\n')
console.log('official extensions:', Object.entries(sorted).map(([key, versions]) => key + '@' + Object.keys(versions).join('/')).join(' '))
