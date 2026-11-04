// @ts-check
/**
 * 随机数：种子存在存档里，领域层自己推进。
 *
 * 领域层不许调用 Math.random()（见 test/unit/core/core-boundary.test.js）。可随机的玩法
 * （病自愈、以后的发病、掉落、礼包）一律从这里取数：种子是 `state.seed`，每取一次
 * 就往前推一步，所以同一份存档加同样的操作，结果永远一样 —— 可复现、可测试，
 * 也不需要把随机源一路穿过每个公开函数的签名。
 *
 * 需要指定结果的调用方（测试、调试页）可以直接给 `decay()` 传 `roll`。
 *
 * @module dsh-piggy/core/random
 */

/** @typedef {() => number} Roll 返回 [0, 1) 的一个数 */

const UINT32 = 0x1_0000_0000

/**
 * A seed for a pig that has none yet (fresh egg, older save).
 *
 * Derived from its birthday and name, so two different pigs start on different
 * sequences without the library having to read a clock or an entropy source.
 * @param {{bornAt?: unknown, name?: unknown}} state
 * @returns {number}
 */
export function seedFor(state) {
  let hash = 0x811c9dc5
  const text = `${typeof state.bornAt === 'number' ? state.bornAt : 0}|${typeof state.name === 'string' ? state.name : ''}`
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash >>> 0
}

/** Whether `value` is a usable stored seed (an unsigned 32-bit integer). */
export const isSeed = value => Number.isInteger(value) && value >= 0 && value < UINT32

/**
 * Draw the next number in [0, 1) from the pig's own sequence (mulberry32).
 * @param {{seed?: unknown, bornAt?: unknown, name?: unknown}} state - `seed` is advanced in place.
 * @returns {number}
 */
export function roll(state) {
  const current = isSeed(state.seed) ? /** @type {number} */ (state.seed) : seedFor(state)
  const next = (current + 0x6d2b79f5) >>> 0
  state.seed = next
  let mixed = next
  mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1)
  mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
  return ((mixed ^ (mixed >>> 14)) >>> 0) / UINT32
}

/**
 * A `Roll` bound to one pig — what the settlement loop hands down.
 * @param {object} state
 * @returns {Roll}
 */
export const rollerFor = state => () => roll(state)

/**
 * True with probability `chance`.
 * @param {Roll} next
 * @param {number} chance - 0..1; anything outside is clamped.
 */
export const chance = (next, chance) => chance > 0 && next() < Math.min(1, chance)

/**
 * One element of `list`, or null when it is empty.
 * @template T
 * @param {Roll} next
 * @param {ReadonlyArray<T>} list
 * @returns {T|null}
 */
export function pickOne(next, list) {
  if (list.length === 0) return null
  return list[Math.min(list.length - 1, Math.floor(next() * list.length))]
}
