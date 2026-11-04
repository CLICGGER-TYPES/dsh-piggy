#!/usr/bin/env node
// @ts-check
/**
 * 从 `assets/actions` 下各包的 `pack.json` 生成 `src/client/packs.generated.js`。
 * 新增或修改动作后运行；`npm run build` 也会自动调用。
 */
import { writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildAssetPacks, buildSoundPacks } from './asset-packs.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
for (const [name, text] of [
  ['src/client/packs.generated.js', buildAssetPacks(root)],
  ['src/client/sounds.generated.js', buildSoundPacks(root)],
]) {
  const target = join(root, name)
  writeFileSync(target, text)
  console.log(`asset packs: wrote ${target} (${text.length} bytes)`)
}
