// @ts-check
/**
 * 运行环境说明：导出日志的表头，也是「我这一版到底是什么」的唯一答案。
 *
 * DSH 会在启动时组装客户端包，所以一个旧页面和一个旧进程看起来一模一样；
 * 没有版本号摆在眼前，「我这次改动到底生效没有」就只能靠猜。
 *
 * @module dsh-piggy/environment
 */
import { readFileSync } from 'node:fs'

import { STATE_VERSION } from './core.js'
import { CHANNEL } from './channel.js'

function readPackageVersion() {
  try {
    const parsed = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'))
    return typeof parsed.version === 'string' ? parsed.version : 'unknown'
  } catch (error) {
    console.warn(`[dsh-piggy] package version unavailable: ${error instanceof Error ? error.message : String(error)}`)
    return 'unknown'
  }
}

export const PACKAGE_VERSION = readPackageVersion()

/**
 * 导出日志的表头：出问题时第一时间要确认的那几件事（哪个版本、哪个渠道、什么环境）。
 * @param {Record<string, string|number|null|undefined>} [extra] 例如存档路径、桌面外壳版本
 * @returns {Record<string, string|number|null|undefined>}
 */
export function environmentNote(extra = {}) {
  return {
    游戏版本: PACKAGE_VERSION,
    发布渠道: CHANNEL.name,
    存档版本: STATE_VERSION,
    运行环境: `node ${process.version} · ${process.platform} ${process.arch}`,
    语言区域: Intl.DateTimeFormat().resolvedOptions().timeZone,
    ...extra,
  }
}
