// @ts-check
/** DSH 仍加载原来的单文件入口；桌面宿主直接使用同一界面挂载函数。 */
import { mountGame, desktop, createClientPlugin } from '../../src/client/index.js'

const game = { mount: mountGame, desktop }
;/** @type {any} */ (window).piggyGame = game
if (/** @type {any} */ (window).__ModuleLoader__) {
  /** @type {any} */ (window).__ModuleLoader__.load({ id: 'dsh-piggy', factory: createClientPlugin })
}
