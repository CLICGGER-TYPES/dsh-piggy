// @ts-check
/** DSH 只负责宿主事件、服务注册和默认位置；游戏规则与持久化由运行时负责。 */
import { applyDefaultMode } from './default-mode.js'
import { applyOwnerDocumentOptIn } from './owner-document-mode.js'

export const name = 'dsh-piggy'
export const inject = []

export function apply(ctx, config = {}) {
  if (Object.hasOwn(config, 'ownerDocumentPath')) {
    if (typeof config.ownerDocumentPath !== 'string' || config.ownerDocumentPath.trim() === '') {
      throw new TypeError('ownerDocumentPath opt-in must be a non-empty explicit path')
    }
    return applyOwnerDocumentOptIn(ctx, config)
  }
  return applyDefaultMode(ctx, config)
}
