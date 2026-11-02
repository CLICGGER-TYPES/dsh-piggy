// @ts-check
/**
 * 居民资料、设置与日常互动命令。
 * createApi 负责唯一的公开对象与 context 校验；这里仅返回原签名方法。
 * @module dsh-piggy/store/api-profile
 */
import {
  chat as coreChat,
  setOfflineFeed as coreSetOfflineFeed,
  setQuiet as coreSetQuiet,
  setCatchphrase as coreSetCatchphrase,
  setMotto as coreSetMotto,
  editProfile as coreEditProfile,
  crown as coreCrown,
  setOwnerName as coreSetOwnerName,
  replyToLine as coreReplyToLine,
  signIn as coreSignIn,
  startPomodoro as coreStartPomodoro,
  abandonPomodoro as coreAbandonPomodoro,
  openGift as coreOpenGift,
  selectSkin as coreSelectSkin,
  registerCustomSkin as coreRegisterCustomSkin,
  sayAfter as coreSayAfter,
} from '../core.js'

/** @typedef {import('./api.js').ApiRuntime} ApiRuntime */

/** @param {ApiRuntime} runtime */
export function createApiProfile(runtime) {
  const { mutate, now } = runtime
  return {
    selectSkin: key => mutate(live => coreSayAfter(live, coreSelectSkin(live, key, now()), 'skin', now())),
    registerCustomSkin: metadata => mutate(live => coreRegisterCustomSkin(live, metadata, now())),
    /** The pig speaks up on its own: 'enter' after a while away, 'idle', or 'time'（按时间说的话）. */
    chat: reason => mutate(live => coreChat(live, reason === 'enter' || reason === 'time' ? reason : 'idle', now())),

    /** 免打扰 on or off. */
    setOfflineFeed: on => mutate(live => coreSetOfflineFeed(live, on)),
    setQuiet: on => mutate(live => coreSetQuiet(live, on)),

    /** The pig's catchphrase (居民卡). */
    setCatchphrase: text => mutate(live => coreSetCatchphrase(live, text)),

    /** The line on the pig's card (居民卡). */
    setMotto: text => mutate(live => coreSetMotto(live, text)),
    /** 居民卡：自由修改性格、生日。 */
    editProfile: change => mutate(live => coreEditProfile(live, change)),

    /** 加冕: the owner picks a form the pig qualifies for. */
    crown: formKey => mutate(live => coreCrown(live, now(), formKey || undefined)),

    /** What the pig calls its owner. */
    setOwnerName: name => mutate(live => coreSetOwnerName(live, name)),

    /** The owner answers the pig's latest line. */
    reply: (lineId, replyIndex) => mutate(live => coreReplyToLine(live, lineId, replyIndex, now())),

    /** 领今天的签到礼包。 */
    signIn: () => mutate(live => coreSignIn(live, now())),
    /** C2: 开一个番茄（15/25/45 分钟）／放弃当前这个。 */
    startPomodoro: minutes => mutate(live => coreStartPomodoro(live, Number(minutes), now())),
    abandonPomodoro: () => mutate(live => coreAbandonPomodoro(live, now())),

    /** 开一个攒着的在线礼包。 */
    openGift: () => mutate(live => coreOpenGift(live, now())),
  }
}
