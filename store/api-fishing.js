// @ts-check
/**
 * 钓鱼与自动钓鱼命令。
 * createApi 负责唯一的公开对象与 context 校验；这里仅返回原签名方法。
 * @module dsh-piggy/store/api-fishing
 */
import {
  castFishing as coreCastFishing,
  feedFish as coreFeedFish,
  grantFish as coreGrantFish,
  hookFishing as coreHookFishing,
  keepFish as coreKeepFish,
  resolveFishing as coreResolveFishing,
  sellFish as coreSellFish,
  buyRod as coreBuyRod,
  buyFishingAutomation as coreBuyFishingAutomation,
  collectAutoFish as coreCollectAutoFish,
  chooseSpot as coreChooseSpot,
  skipFishingWait as coreSkipFishingWait,
  startAutoFishing as coreStartAutoFishing,
} from '../src/host/core.js'

/** @typedef {import('./api.js').ApiRuntime} ApiRuntime */

/** @param {ApiRuntime} runtime */
export function createApiFishing(runtime) {
  const { mutate, now } = runtime
  return {
    castFishing: (power, bait) => mutate(live => coreCastFishing(live, Number(power), now(), undefined, bait)),
    hookFishing: () => mutate(live => coreHookFishing(live, now())),
    resolveFishing: success => mutate(live => coreResolveFishing(live, success === true, now())),
    keepFish: () => mutate(live => coreKeepFish(live, now())),
    feedFish: id => mutate(live => coreFeedFish(live, id, now())),
    sellFish: id => mutate(live => coreSellFish(live, id, now())),
    buyRod: () => mutate(live => coreBuyRod(live, now())),
    buyFishingAutomation: kind => mutate(live => coreBuyFishingAutomation(live, kind, now())),
    collectAutoFish: () => mutate(live => coreCollectAutoFish(live, now())),
    chooseSpot: key => mutate(live => coreChooseSpot(live, key, now())),
    startAutoFishing: (minutes, bait) => mutate(live => coreStartAutoFishing(live, Number(minutes), now(), bait)),
    grantFish: key => mutate(live => ({ ok: coreGrantFish(live, key, now()) !== null })),
    skipFishingWait: () => mutate(live => coreSkipFishingWait(live, now())),
  }
}
