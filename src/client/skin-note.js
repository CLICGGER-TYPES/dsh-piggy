// @ts-check
/**
 * 胖体型换皮肤的一句说明：体重叠层只画在默认皮肤上，穿任何皮肤都会回到普通体型。
 * 体型数据来自快照的 pig.bodyWeight（见 packages/pet-core/src/core/weight.js）。
 *
 * @module dsh-piggy/client/skin-note
 */

export const CHUBBY_SKIN_NOTE = '穿皮肤会变普通体型，胖胖只有默认皮肤有'

/** 猪现在是圆润或胖胖（胖体型）吗？没孵化、去世或旧快照没有体型数据时都算不是。 */
export function isChubbyPig(view) {
  const body = view?.pig?.bodyWeight
  return body !== null && typeof body === 'object' && (body.class === 'round' || body.class === 'fat')
}

/** 换皮肤入口旁的那句说明；猪不胖时返回空串，调用方不渲染。 */
export function chubbySkinNote(view) {
  return isChubbyPig(view) ? CHUBBY_SKIN_NOTE : ''
}
