// @ts-check
/** 兼容原 DSH 插件入口；宿主装配由适配器负责。 */
export { name, inject, apply } from './adapters/dsh/index.js'
export { dispatch, performAction } from './commands.js'
export { snapshot } from './snapshot.js'
export { JOBS, MAX, SCHOOL_STAGES, SHOP, SUBJECTS, TRAITS, TRAIT_ORDER, TRIPS, jobByKey } from './data.js'
