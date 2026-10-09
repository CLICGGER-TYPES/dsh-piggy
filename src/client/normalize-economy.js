// @ts-check
/** 调试页「经济」用的账本（宿主 core/economy.js 的 economyView）；老宿主没有就是 null。 */
import { arr, num, obj, str } from './values.js'

export function normalizeEconomy(raw) {
  if (raw === null || typeof raw !== 'object') return null
  const source = obj(raw)
  return {
    sources: arr(source.sources).map(function (value) {
      const entry = obj(value)
      return { source: str(entry.source, 'other'), label: typeof entry.label === 'string' ? entry.label : null, in: num(entry.in, 0), out: num(entry.out, 0) }
    }),
    days: arr(source.days).map(function (value) {
      const day = obj(value)
      return { day: str(day.day, ''), in: num(day.in, 0), out: num(day.out, 0) }
    }),
  }
}
