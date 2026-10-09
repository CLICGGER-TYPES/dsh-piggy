// @ts-check
/**
 * 第一次启动下载游戏失败时给用户看的话（lib/first-run.js）。纯函数，测试直接跑。
 * @module dsh-piggy-desktop/first-run-errors
 */

/** 把下载失败的原因说成人话（原文附在括号里，方便看日志排查）。 */
/** @param {unknown} message */
export function friendlyError(message) {
  const text = String(message)
  if (/404/.test(text)) return `下载页上还没有这个版本（${text}），过一会儿再试，或者去下载页看看`
  if (/net::ERR_|fetch failed|ENOTFOUND|ECONN|ETIMEDOUT|EAI_AGAIN/.test(text)) return `连不上下载地址（${text}），检查一下网络或代理`
  return text
}
