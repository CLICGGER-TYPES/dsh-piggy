// @ts-check
/**
 * 切换发布渠道：node scripts/set-channel.mjs <github|gitee>
 * 把 channels/<渠道>.js 复制成 src/host/channel.js（游戏）和 apps/desktop/lib/channel.js（桌面外壳）。
 * 仓库里提交的永远是 github；打 Gitee 包的 CI 在构建前先切到 gitee。
 */
import { copyFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const name = process.argv[2]
const from = join(root, 'channels', `${name}.js`)
if (!name || !existsSync(from)) {
  console.error('usage: node scripts/set-channel.mjs <github|gitee>')
  process.exit(1)
}
for (const to of [join(root, 'src', 'host', 'channel.js'), join(root, 'apps', 'desktop', 'lib', 'channel.js')]) copyFileSync(from, to)
console.log('channel →', name)
