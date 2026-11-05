// @ts-check
/**
 * dsh-piggy · core —— 插件侧的入口，只做再导出。
 *
 * 领域模型本体在 packages/pet-core（`@dsh-piggy/core`），DSH 插件和以后的独立版
 * 共用同一份。这个文件是宿主侧的再导出入口；同目录代码用 `./core.js`，
 * 其他目录按实际深度引用 `src/host/core.js`。
 *
 * @module dsh-piggy/core
 */

export * from '../../packages/pet-core/src/core.js'
