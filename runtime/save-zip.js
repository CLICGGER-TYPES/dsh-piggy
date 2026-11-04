// @ts-check
/**
 * 兼容入口：ZIP 实现已移到 store/zip.js，扩展安装在旧游戏包（没有 runtime/ 目录）里也能用。
 * @module dsh-piggy/runtime/save-zip
 */
export { crc32, makeZip, readZip } from '../store/zip.js'
