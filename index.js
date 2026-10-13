// @ts-check
/** 保持原 DSH 包入口；新宿主直接使用 dsh-piggy/runtime。 */
export { name, inject, apply } from './adapters/dsh/index.js'
export { dispatch, performAction } from './commands.js'
export { snapshot } from './snapshot.js'
export { JOBS, MAX, SCHOOL_STAGES, SHOP, SUBJECTS, TRAITS, TRAIT_ORDER, TRIPS, jobByKey } from './data.js'
