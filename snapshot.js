// @ts-check
/**
 * 根目录兼容门面：实现已移到 src/host/snapshot.js。
 *
 * 旧调用方仍按根路径 import；保留同名再导出，避免一次性改几十处路径。
 * 新代码请直接引用 src/host/。
 * @module dsh-piggy/snapshot
 */
export * from './src/host/snapshot.js'
