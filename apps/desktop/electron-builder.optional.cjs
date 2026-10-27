// @ts-check
/** Full offline Windows installer; source checks are separate from builder configuration. */
const base = require("./package.json").build
const { verifyOptionalExtensions, INCLUDE } = require("./scripts/verify-optional-extensions.cjs")

const config = {
  ...base,
  // 完整渠道：Linux / macOS 照旧带游戏，Windows 安装包也带游戏（Gitee 瘦包由 electron-builder.gitee.cjs 负责）。
  win: { ...base.win, target: ['nsis'] },
  nsis: { ...base.nsis, include: INCLUDE },
  // Linux 上生成卸载器要走 Wine：用 electron-builder 官方 wine toolset，不碰系统 wine / 物理桌面。
  toolsets: { wine: '1.0.1' },
  beforePack: () => {
    verifyOptionalExtensions()
  },
}

module.exports = config
