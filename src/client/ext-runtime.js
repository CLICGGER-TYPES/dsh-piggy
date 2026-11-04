// @ts-check
/**
 * 第三方动作与音效运行时的组合入口（M3 第四刀）。
 *
 * 两者各自维护 diff 生命周期，但都从同一份 `/state` extensions 同步，挂载
 * 销毁时也一起释放。拆成这个薄层是为了让 index.js 只记住一个句柄。
 * @module dsh-piggy/client/ext-runtime
 */
import { attachExtensionActions } from './ext-actions.js'
import { attachExtensionSounds } from './ext-sounds.js'

/**
 * @param {{
 *   ctx: any,
 *   pig: any,
 *   registry: import('./art-resources.js').ArtResourceRegistry,
 *   audio: { play: (key: string, options?: { soft?: boolean }) => any },
 *   target?: { addEventListener?: Function, removeEventListener?: Function } | null,
 *   fetch?: (url: string, init?: any) => Promise<any>,
 *   warn?: (message: string, error?: any) => void,
 * }} options
 */
export function attachExtensionRuntimes(options) {
  const actions = attachExtensionActions({
    ctx: options.ctx, pig: options.pig, registry: options.registry,
    target: options.target, fetch: options.fetch, warn: options.warn,
  })
  const sounds = attachExtensionSounds({
    ctx: options.ctx, audio: options.audio,
    target: options.target, fetch: options.fetch, warn: options.warn,
  })
  return {
    actions: actions,
    sounds: sounds,
    /** @param {any} extensions */
    sync: function (extensions) {
      actions.sync(extensions)
      sounds.sync(extensions)
    },
    dispose: function () {
      actions.dispose()
      sounds.dispose()
    },
  }
}
