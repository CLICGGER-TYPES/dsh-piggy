// @ts-check
/**
 * 商店、背包与扩展资源命令。
 * createApi 负责唯一的公开对象与 context 校验；这里仅返回原签名方法。
 * @module dsh-piggy/store/api-inventory
 */
import {
  buy as coreBuy,
  extensionsView as coreExtensionsView,
  SHOP as CORE_SHOP,
  setExtension as coreSetExtension,
  extensionOn as coreExtensionOn,
  useItem as coreUseItem,
  seeDoctor as coreSeeDoctor,
  sellSouvenir as coreSellSouvenir,
  wearItem as coreWearItem,
  takeOff as coreTakeOff,
  exchangeCurrency as coreExchange,
  sayAfter as coreSayAfter,
} from '../core.js'

/** @typedef {import('./api.js').ApiRuntime} ApiRuntime */

/** @param {ApiRuntime} runtime */
export function createApiInventory(runtime) {
  const { getState, mutate, now } = runtime
  return {
    /** 扩展币 ↔ 金币（规则 1）。 */
    exchange: (key, direction, amount) => mutate(live => coreExchange(live, key, direction === 'fromGold' ? 'fromGold' : 'toGold', amount, now())),
    /** Buy one item into the backpack. */
    buy: itemKey => mutate(live => {
      // 关掉的扩展的商品（比如钓鱼关了的鱼饵）不卖。
      const kind = CORE_SHOP.find(item => item.key === itemKey)?.kind
      const owner = coreExtensionsView(live).find(extension => !extension.on && extension.shopKinds.includes(kind))
      return owner === undefined ? coreSayAfter(live, coreBuy(live, itemKey, now()), 'buy', now()) : { ok: false, reason: 'extension-off' }
    }),
    /** 扩展开关（存档里）。 */
    setExtension: (key, on) => mutate(live => coreSetExtension(live, key, on, now())),
    /** 某个扩展开没开（没有猪时按默认）。 */
    extensionOn: key => coreExtensionOn(getState(), key),

    /** Use one item from the backpack. */
    useItem: itemKey => mutate(live => coreUseItem(live, itemKey, now())),

    /** 看医生: pay to be cured without buying the medicine. */
    seeDoctor: () => mutate(live => coreSayAfter(live, coreSeeDoctor(live, now()), null, now())),
    sellSouvenir: souvenirKey => mutate(live => coreSellSouvenir(live, souvenirKey, now())),

    wear: (itemKey, on) => mutate(live => (on ? coreWearItem(live, itemKey, now()) : coreTakeOff(live, itemKey, now()))),
  }
}
