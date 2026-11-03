// @ts-check
/**
 * 旧 store facade 的兼容入口。仅重导原有四个公共出口；内部 brand/helper 不外泄。
 * @module dsh-piggy/store/legacy-state
 */
export { isLegacyView, splitLegacyState, composeLegacyState } from './legacy-projection.js'
export { createLegacyStateAdapter } from './legacy-facade.js'
