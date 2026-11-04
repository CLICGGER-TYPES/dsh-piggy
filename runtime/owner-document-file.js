// @ts-check
/**
 * 显式 owner document 文件层的公共门面：版本识别、revision CAS、排他锁和可恢复单文件事务。
 * 读取与校验在 owner-document-file-inspect.js，写入事务与迁移在 owner-document-file-transaction.js；
 * 依赖单向（transaction -> inspect），本文件只按原有名字再导出，导出与调用形状不变。
 * 本模块只供调用者显式使用，不接入 runtime/store/routes 启动。
 * @module dsh-piggy/runtime/owner-document-file
 */
export { inspectOwnerDocumentFile, readOwnerDocumentFile } from './owner-document-file-inspect.js'
export {
  migrateLegacyV15File,
  recoverOwnerDocumentTransaction,
  writeOwnerDocumentFile,
} from './owner-document-file-transaction.js'
