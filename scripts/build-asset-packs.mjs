#!/usr/bin/env node
// @ts-check
/**
 * 从 `assets/actions` 下各包的 `pack.json` 生成 `src/client/packs.generated.js`。
 * 新增或修改动作后运行；`npm run build` 也会自动调用。
 */
import { writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildAssetPacks } from './asset-packs.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const path = join(root, 'src/client/packs.generated.js')
const text = buildAssetPacks(root)
writeFileSync(path, text)
console.log(`asset packs: wrote ${path} (${text.length} bytes)`)
