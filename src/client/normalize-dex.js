// @ts-check
/** 图鉴各分区（含成就）进入界面前的形状清洗。 */
import { arr, num, obj, str } from './values.js'

/** @param {any} raw @returns {Record<string, any[]>} */
export function normalizeDex(raw) {
  const source = obj(raw)
  /** @type {Record<string, any[]>} */
  const out = {}
  for (const section of ['forms', 'skins', 'fish', 'items', 'souvenirs', 'achievements']) {
    out[section] = arr(source[section]).map(function (value) {
      const entry = obj(value)
      return {
        key: str(entry.key, ''), label: str(entry.label, ''), emoji: str(entry.emoji, '📦'),
        art: str(entry.art, ''), description: str(entry.description, ''), hint: str(entry.hint, ''),
        kind: str(entry.kind, ''), kindLabel: str(entry.kindLabel, ''),
        acquired: entry.acquired === true,
        firstAt: typeof entry.firstAt === 'number' ? entry.firstAt : null,
        count: num(entry.count, 0), condition: str(entry.condition, ''),
        availability: ['ready', 'off', 'not-installed', 'update-required'].includes(entry.availability) ? entry.availability : 'ready',
        group: str(entry.group, ''), progress: Math.max(0, num(entry.progress, 0)), target: Math.max(1, num(entry.target, 1)), unit: str(entry.unit, ''), recovered: entry.recovered === true,
        maxSizeCm: typeof entry.maxSizeCm === 'number' ? entry.maxSizeCm : null,
        requirements: arr(entry.requirements).map(function (value) {
          const requirement = obj(value)
          return { key: str(requirement.key, ''), label: str(requirement.label, ''), have: num(requirement.have, 0), need: num(requirement.need, 0), met: requirement.met === true }
        }),
      }
    }).filter(entry => entry.key !== '')
  }
  return out
}
