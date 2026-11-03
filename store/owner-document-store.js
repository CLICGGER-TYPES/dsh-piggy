// @ts-check
/** 为一个已注册 PigTarget 生成旧 createApi 形状的 owner-document Store facade。 */
import { createStore } from '../store.js'
import { composeLegacyState, splitLegacyState } from './legacy-projection.js'

/**
 * @param {{filePath:string, owner:import('./owner-resources.js').OwnerAuthority,
 *   target:import('./owner-resources.js').PigTarget, now?:()=>number, journal?:object,
 *   persist:(target:import('./owner-resources.js').PigTarget)=>void,
 *   persistence:object}} options
 */
export function createOwnerDocumentStore(options) {
  const now = options.now ?? (() => Date.now())
  return createStore(options.filePath, {
    now,
    journal: options.journal,
    ownerAuthority: options.owner,
    pigTarget: options.target,
    persistence: options.persistence,
    persistOwnerDocument: options.persist,
    readState(target) {
      const live = target.state
      return live === null ? null : composeLegacyState(splitLegacyState(live))
    },
    replaceState(target, next) {
      if (next === null || typeof next !== 'object' || Array.isArray(next)) {
        throw new TypeError('owner target replacement needs a complete legacy state object')
      }
      const parts = splitLegacyState(next)
      const previousBody = target.body === null ? null : structuredClone(target.body)
      if (previousBody === null) throw new Error('owner target body is absent')
      // Legacy hatch/reset/adopt still produce a full flat state. In an owner
      // document only the selected target body may be replaced; shared resources,
      // owner opaque fields and document format stay with the owner authority.
      options.owner.replacePigBody(target, parts.body)
      return () => options.owner.replacePigBody(target, previousBody)
    },
  })
}
