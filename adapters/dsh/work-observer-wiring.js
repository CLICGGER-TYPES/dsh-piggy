// @ts-check
/**
 * DSH 宿主工作事件的统一接线。
 *
 * 内嵌模式和 OwnerDocument opt-in 模式都要把同样的四个宿主回调接到 observer；
 * 差别只在 accept 的运行时来源和 warn 前缀。抽成一处避免两套模式各抄一份后
 * 漏掉某个事件。
 */
import { randomUUID } from 'node:crypto'

import { createWorkObserver } from './work-observer.js'

/**
 * @param {{on:Function}} ctx
 * @param {{accept:(event:any) => any, warn:(message:string) => void}} deps
 */
export function registerDshWorkObserver(ctx, { accept, warn }) {
  // Host callbacks have no durable identity; keep each generated event ID stable across 503 retries.
  // The accept callback names the exact runtime generation whose session owns the save; a
  // replaced/disposed runtime refuses instead of falling back to another pig or file.
  const observer = createWorkObserver({ accept, source: 'dsh', producer: randomUUID(), warn })
  const observe = type => observer.observe(type)
  ctx.on('agent/inbox/claimed', () => observe('message'))
  ctx.on('agent/turn-stopping', () => observe('turn'))
  ctx.on('agent/error', () => observe('agentError'))
  ctx.on('tools/result', (exec, result) => observe(result?.isError === true ? 'toolError' : 'tool'))
  return observer
}
