// @ts-check
/**
 * 旧 state facade 的内部品牌。projection 与 adapter 必须共享这个 Symbol 实例。
 * 不从 legacy-state 兼容入口重导，避免把内部标记变成公共 API。
 * @module dsh-piggy/store/legacy-view-brand
 */
export const LEGACY_VIEW = Symbol('dsh-piggy-legacy-view')
