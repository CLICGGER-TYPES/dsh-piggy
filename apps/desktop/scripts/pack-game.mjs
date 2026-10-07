// @ts-check
/**
 * 把插件里桌面版要用的那部分复制成 apps/desktop/game/：宿主（存档、结算、路由）、
 * 共享库、打好的 client.js 和立绘。安装包里带的就是这一份；热更新下载的游戏包也是
 * 同样的结构（见 scripts/release-game.mjs）。
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Everything the desktop host imports, plus what the page loads. */
export const GAME_FILES = [
  'package.json', 'core.js', 'data.js', 'store.js', 'store', 'routes.js', 'snapshot.js', 'environment.js',
  'packages/pet-core/package.json', 'packages/pet-core/src', 'client.js', 'assets', 'channel.js',
  // 小猪立绘改自 Noto Emoji（Apache 2.0）：许可要跟着素材一起分发
  'THIRD-PARTY.md', 'LICENSE-noto-emoji.txt',
]

/** Copy the game files from the repo root into `out`. */
export function packGame(root, out) {
  rmSync(out, { recursive: true, force: true })
  for (const entry of GAME_FILES) {
    const from = join(root, entry)
    if (!existsSync(from)) throw new Error(`missing ${entry}`)
    mkdirSync(dirname(join(out, entry)), { recursive: true })
    cpSync(from, join(out, entry), { recursive: true })
  }
  // Gitee 渠道：包里的 package.json 主页 / 仓库 / 问题反馈也换成 Gitee，包里不留 GitHub 地址。
  const channel = readFileSync(join(root, 'channel.js'), 'utf8')
  const repoPage = channel.match(/repoPage:\s*'([^']+)'/)?.[1]
  if (/name:\s*'gitee'/.test(channel) && repoPage) {
    const file = join(out, 'package.json')
    const pkg = JSON.parse(readFileSync(file, 'utf8'))
    pkg.homepage = repoPage
    pkg.repository = { type: 'git', url: 'git+' + repoPage + '.git' }
    pkg.bugs = { url: repoPage + '/issues' }
    writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n')
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const here = dirname(fileURLToPath(import.meta.url))
  const root = join(here, '..', '..', '..')
  packGame(root, join(here, '..', 'game'))
  console.log('game packed')
}
