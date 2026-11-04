// @ts-check
/**
 * 根目录兼容门面：实现已移到 src/host/routes.js。
 *
 * 旧调用方（runtime、adapters、桌面版、工具和测试）仍按根路径 import；
 * 保留同名再导出，避免一次性改几十处路径。新代码请直接引用 src/host/。
 * @module dsh-piggy/routes
 */
export * from './src/host/routes.js'
