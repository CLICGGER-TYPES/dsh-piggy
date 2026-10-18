// @ts-check
/**
 * 松手速度：只看松手前最后一小段。
 *
 * 用户拖到目标后停住/减速再松手时，旧实现会把几百毫秒前的快速移动也算进平均速度，
 * 于是「只想移动」变成「抛出去」。这里要求：
 * - 最后一次指针移动必须在 idleMs 以内（停住就不算甩）；
 * - 只用 tailMs 内的采样算速度（减速后的慢速不会被之前的快速平均掉）。
 * @module dsh-piggy/client/feel/velocity
 */
import { FEEL } from './config.js'

/**
 * @param {{t:number,x:number,y:number}[]} samples 按时间从旧到新
 * @param {number} now performance.now()
 * @param {{tailMs?:number, idleMs?:number}} [options]
 */
export function recentVelocity(samples, now, options) {
  const tailMs = options?.tailMs ?? FEEL.throwTailMs
  const idleMs = options?.idleMs ?? FEEL.throwIdleMs
  if (!Array.isArray(samples) || samples.length < 2) return { vx: 0, vy: 0 }
  const last = samples[samples.length - 1]
  const previous = samples[samples.length - 2]
  if (!last || !previous || !Number.isFinite(last.t) || !Number.isFinite(previous.t)) return { vx: 0, vy: 0 }
  // 停住：最后一次移动已经过去太久，不能拿之前的快速移动来猜。
  if (now - last.t > idleMs) return { vx: 0, vy: 0 }
  // 最后一次移动的间隔太长（事件稀疏/断档），不猜速度。
  const dt = (last.t - previous.t) / 1000
  if (dt <= 0 || dt > tailMs / 1000) return { vx: 0, vy: 0 }
  // 用最后一段的真实位移：减速后的慢速不会被之前的快速平均掉。
  return { vx: (last.x - previous.x) / dt, vy: (last.y - previous.y) / dt }
}
