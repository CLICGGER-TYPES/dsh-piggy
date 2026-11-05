// @ts-check
/**
 * 发布渠道：GitHub（默认）。scripts/set-channel.mjs 把 channels/<渠道>.js 复制成
 * src/host/channel.js 和 apps/desktop/lib/channel.js，游戏和桌面外壳的更新、下载、
 * 在线扩展地址都从那里取。
 * @module dsh-piggy/channel
 */
export const CHANNEL = {
  name: 'github',
  repoPage: 'https://github.com/CLICGGER-TYPES/dsh-piggy',
  /** 发行版列表（新的在前），外壳用它找可下载的游戏包。 */
  releasesList: 'https://api.github.com/repos/CLICGGER-TYPES/dsh-piggy/releases?per_page=20',
  /** 最新正式版，DSH 插件模式的更新提示用。 */
  latestRelease: 'https://api.github.com/repos/CLICGGER-TYPES/dsh-piggy/releases/latest',
  releasesPage: 'https://github.com/CLICGGER-TYPES/dsh-piggy/releases',
  /** 发行版附件：<downloadBase>/<tag>/<文件名> */
  downloadBase: 'https://github.com/CLICGGER-TYPES/dsh-piggy/releases/download',
  /** 仓库文件（main 分支）：原始内容 / 网页查看 */
  rawBase: 'https://raw.githubusercontent.com/CLICGGER-TYPES/dsh-piggy/main',
  blobBase: 'https://github.com/CLICGGER-TYPES/dsh-piggy/blob/main',
  /** 在线扩展目录 */
  registry: 'https://raw.githubusercontent.com/CLICGGER-TYPES/dsh-piggy/main/extensions/registry.json',
}
