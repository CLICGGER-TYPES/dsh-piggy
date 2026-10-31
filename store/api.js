// @ts-check
/**
 * store 的方法表：每个方法都转发给 core，并在成功后安排一次保存。
 *
 * 方法表单独成文件，是为了让 store.js 只剩"打开存档 + 节流写盘"这一件事
 * （见 docs/CONVENTIONS.md 的单一职责与函数长度条款）。
 *
 * 读路径和命令都经过 store.js 建立的应用上下文：目标猪、同主人资源引用、
 * 注入时钟和提交边界都在那里声明；这里不缓存 state，也不换用别的猪。
 *
 * @module dsh-piggy/store/api
 */
import {
  act as coreAct,
  touch as coreTouch,
  adopt as coreAdopt,
  ageFromNow as coreAgeFromNow,
  applyDevPatch as coreDevPatch,
  buy as coreBuy,
  callOffActivity as coreCallOff,
  decay,
  drainPending,
  feed as coreFeed,
  grantAll as coreGrantAll,
  hatch as coreHatch,
  hatchEgg,
  chat as coreChat,
  rename as coreRename,
  replyToLine as coreReplyToLine,
  openGift as coreOpenGift,
  writeDiaryIfNewDay as coreWriteDiary,
  startPomodoro as coreStartPomodoro,
  settlePomodoro as coreSettlePomodoro,
  abandonPomodoro as coreAbandonPomodoro,
  extensionOn as coreExtensionOn,
  setExtension as coreSetExtension,
  extensionsView as coreExtensionsView,
  SHOP as CORE_SHOP,
  recordOnline as coreRecordOnline,
  signIn as coreSignIn,
  reset as coreReset,
  seeDoctor as coreSeeDoctor,
  setCatchphrase as coreSetCatchphrase,
  setMotto as coreSetMotto,
  editProfile as coreEditProfile,
  crown as coreCrown,
  setOwnerName as coreSetOwnerName,
  setQuiet as coreSetQuiet,
  setOfflineFeed as coreSetOfflineFeed,
  sellSouvenir as coreSellSouvenir,
  setTimeScale as coreSetTimeScale,
  startInterest as coreStartInterest,
  startStudy as coreStartStudy,
  startTrip as coreStartTrip,
  startWork as coreStartWork,
  takeOff as coreTakeOff,
  useItem as coreUseItem,
  wearItem as coreWearItem,
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
  exchangeCurrency as coreExchange,
  skipFishingWait as coreSkipFishingWait,
  startAutoFishing as coreStartAutoFishing,
  selectSkin as coreSelectSkin,
  registerCustomSkin as coreRegisterCustomSkin,
  sayAfter as coreSayAfter,
} from '../core.js'
import { createCommandContext } from './command-context.js'
import { createApplicationContext } from './target-context.js'

/**
 * 只借用类型，不引入运行时依赖；上下文对象的具体形状由两个 store 模块导出。
 * @typedef {import('./target-context.js').ApplicationContext} ApplicationContext
 * @typedef {import('./command-context.js').CommandContext} CommandContext
 */

/**
 * @typedef {object} StoreControl
 * @property {string} filePath - where this pig is saved
 * @property {ApplicationContext} [application] - per-store application context (live owner/target)
 * @property {CommandContext} [commands] - command boundary bound to that context
 * @property {() => number} [now] - legacy createApi input: injectable clock
 * @property {() => object|null} [getState] - legacy createApi input: live state
 * @property {(next: object|null) => void} [setState] - legacy createApi input: replace state
 * @property {(fn: (state: object) => object) => object} [mutate] - legacy createApi input: commit
 * @property {() => void} scheduleSave - request a throttled write
 * @property {() => void} [settle] - F02 lifecycle replacement: settle achievements then save
 * @property {() => void} dispose - flush and stop the timer
 * @property {object} [journal] - 运行日志（设置 → 日志 → 导出）
 */

/**
 * Build the store's public methods.
 * @param {StoreControl} control
 * @returns {object} the store API
 */
export function createApi(control) {
  const { filePath, scheduleSave, settle, dispose, journal } = control
  if (control.application !== undefined || control.commands !== undefined) {
    if (control.application === undefined || control.commands === undefined) {
      throw new TypeError('createApi needs both application and commands')
    }
    // 新上下文是权威：显式传入任何一个旧控制字段（只有 undefined 占位不算）
    // 都拒绝，避免两套 provider 静默混用。纯旧调用仍走下面的兼容分支。
    if (control.now !== undefined || control.getState !== undefined || control.setState !== undefined || control.mutate !== undefined) {
      throw new TypeError('createApi refuses legacy now/getState/setState/mutate when application and commands are supplied')
    }
    if (control.commands.scope !== control.application.scope) {
      throw new Error('application and command context belong to different stores; refusing to mix targets')
    }
  }
  // createStore 注入每个运行时的上下文。旧字段只用于保持直接调用
  // createApi(control) 的兼容：它们用 live getter 建同一条边界，而不是绕过它。
  const application = control.application !== undefined
    ? control.application
    : createApplicationContext({
      getState: control.getState,
      setState: control.setState,
      now: control.now,
    })
  const commands = control.commands !== undefined
    ? control.commands
    : createCommandContext({ context: application, commit: control.mutate })
  const now = application.now
  // 读和写都留在上下文里；下面的别名让现有方法体保持原来的时钟顺序、
  // absent/null 行为和返回形状。
  const getState = () => commands.readFor(commands.scope)
  const setState = next => application.replaceState(next)
  // 公共 store.mutate 和旧 createApi 的 fn 历史上只收到一个 live state 参数。
  // 这里刻意包一层，绝不把 runFor 内部 execute 的第二个 commandScope 参数
  // 泄漏给公共回调或既有方法表；直接调用 commands.runFor 的内部 API 不受影响。
  /** @param {(state: object) => object} fn @returns {object} */
  const mutate = fn => commands.runFor(commands.scope, state => fn(state))
  // hatch/reset/adopt 先做 owner 资源+body 的整份替换，再由 settle 在一个
  // 事务里结算成就并排保存；旧 createApi 没有 settle 时退回 scheduleSave。
  const settleAndSave = settle ?? scheduleSave

  // 在线游标属于 owner runtime（旧入口为每个上下文一个），不是每个 API
  // 私有字段；它不写入存档，也不新增字段/计时器。

  return {
    /** The live state (null until an egg is laid). Exposed for rendering. */
    get state() { return getState() },

    /** 运行日志（设置 → 日志 → 导出）；没有就当作不记。 */
    journal,

    /** Where this pig is saved. */
    get filePath() { return filePath },

    /**
     * 跑一个改存档的函数（下载来的扩展用，见 store/ext-runtime.js）；抛错会回滚。
     * 回调仍然只收到一个 live state 参数，与旧的公共 store.mutate 相同。
     * @param {(state: object) => object} fn
     * @returns {object}
     */
    mutate: fn => mutate(fn),

    /** Digest one observed harness event; silently ignored before hatching. */
    feed(event) {
      const state = getState()
      if (state === null) return []
      try {
        const result = commands.runFor(commands.scope, live => ({ crossed: coreFeed(live, event, now()) }))
        if (Array.isArray(result?.crossed)) return result.crossed
        if (result?.reason === 'error') {
          console.warn(`[dsh-piggy] feed failed: event="${event}" reason="${result.message ?? 'error'}"`)
        }
        return []
      } catch (error) {
        console.warn(`[dsh-piggy] feed failed: event="${event}" reason="${error instanceof Error ? error.message : String(error)}"`)
        return []
      }
    },

    /** Fold wall-clock decay in (and resolve work/illness) then hand back state. */
    freshen() {
      const state = getState()
      if (state === null) return null
      try {
        const nowMs = now()
        const cursor = application.owner.onlineCursor
        const result = commands.runFor(commands.scope, live => {
          // 在线时长按真实时间累计（与调试页的时间倍率无关）；每次读状态就是
          // 一次「面板还在轮询」的证据。共享 owner 的 cursor 让 A/B 同一段
          // 真实时间只计一次；旧 createApi 上下文仍各自拥有等价游标。
          coreRecordOnline(live, cursor, nowMs)
          decay(live, nowMs)
          // 离线活动先按发生时间逐段结算、翻页；最后再归到当前游戏日。
          coreWriteDiary(live, nowMs)
          // 番茄钟到点就在下一次请求结算（关着面板也算），奖励与计数都在核心侧。
          // 番茄钟扩展关着就不结算（关的时候进行中的那一个已经放弃）。
          if (coreExtensionOn(live, 'pomodoro')) coreSettlePomodoro(live, nowMs)
          return { ok: true }
        })
        const failed = result !== null && typeof result === 'object' && result.ok === false
        if (!failed) {
          // Legacy createApi commits may return undefined/false even though the
          // callback ran; only a structured failure withholds the cursor.
          application.owner.onlineCursor = nowMs
        } else if (result.reason === 'error') {
          // Keep the stale-but-valid state, but say why it is stale.
          console.warn(`[dsh-piggy] decay failed: reason="${result.message ?? 'error'}"`)
        }
      } catch (error) {
        console.warn(`[dsh-piggy] decay failed: reason="${error instanceof Error ? error.message : String(error)}"`)
      }
      return getState()
    },

    /** Apply one care action with its cooldown, spending `itemKey` when given. */
    act: (action, itemKey) => mutate(live => coreAct(live, action, now(), itemKey)),

    /** 拿起/抛出/戳一下：只刷新活跃时间，不消耗物品、不加心情。 */
    touch: () => mutate(live => coreTouch(live, now())),

    /** Send the pig out to work. */
    startWork: (jobKey, short = false) => mutate(live => coreSayAfter(live, coreStartWork(live, jobKey, now(), short === true), 'workStart', now())),

    /** Send the pig to class. */
    startStudy: (subjectKey, stageKey) => mutate(live => coreSayAfter(live, coreStartStudy(live, subjectKey, stageKey, now()), 'studyStart', now())),

    /** Send the pig to an 兴趣课. */
    startInterest: interestKey => mutate(live => coreSayAfter(live, coreStartInterest(live, interestKey, now()), 'studyStart', now())),

    /** Debug: one of everything (consumables, 装扮, coins). */
    grantAll: () => mutate(live => coreGrantAll(live, now())),

    /** Send the pig travelling. */
    startTrip: tripKey => mutate(live => coreSayAfter(live, coreStartTrip(live, tripKey, now()), 'tripStart', now())),
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
    /** 扩展币 ↔ 金币（规则 1）。 */
    exchange: (key, direction, amount) => mutate(live => coreExchange(live, key, direction === 'fromGold' ? 'fromGold' : 'toGold', amount, now())),
    startAutoFishing: (minutes, bait) => mutate(live => coreStartAutoFishing(live, Number(minutes), now(), bait)),
    grantFish: key => mutate(live => ({ ok: coreGrantFish(live, key, now()) !== null })),
    skipFishingWait: () => mutate(live => coreSkipFishingWait(live, now())),
    selectSkin: key => mutate(live => coreSayAfter(live, coreSelectSkin(live, key, now()), 'skin', now())),
    registerCustomSkin: metadata => mutate(live => coreRegisterCustomSkin(live, metadata, now())),

    /** Bring the pig home early (work forfeits pay; study/trips are refunded). */
    callOffActivity: () => mutate(live => coreCallOff(live, now())),

    /** Back-compat alias. */
    callOffWork: () => mutate(live => coreCallOff(live, now())),

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
    wear: (itemKey, on) => mutate(live => (on ? coreWearItem(live, itemKey, now()) : coreTakeOff(live, itemKey, now()))),

    /** Open the box. Only works when there is no living pig yet. */
    hatch() {
      const state = getState()
      // A save that exists but is not hatched is a box — reset and adopt both
      // produce one. Refusing because `state !== null` left the box unopenable.
      if (state !== null && state.hatched === true) return false
      setState(state === null ? hatchEgg(now()) : coreHatch(state, now()))
      settleAndSave()
      return true
    },

    /** Change how fast the pig ages. */
    setTimeScale(scale) {
      const state = getState()
      if (state === null) return false
      return mutate(live => { coreSetTimeScale(live, scale, now()); return true }) === true
    },

    /** Put the age back on the real clock. */
    ageFromNow() {
      const state = getState()
      if (state === null) return false
      return mutate(live => { coreAgeFromNow(live, now()); return true }) === true
    },

    /** Developer mode: force the pig into any state. */
    dev(patch) {
      // Through mutate(): a patch that blows up halfway must not be written.
      return mutate(live => { coreDevPatch(live, patch, now()); return true }) === true
    },

    /** Start from a brand new box, living pig or not. */
    reset() {
      setState(coreReset(now()))
      settleAndSave()
      return true
    },

    /**
     * Start over with a fresh box, keeping the old pig's memories. Only offered
     * once a pig has died — you cannot throw a living one away.
     */
    adopt() {
      const state = getState()
      if (state === null) return false
      if (state.dead !== true) return false
      setState(coreAdopt(state, now()))
      settleAndSave()
      return true
    },

    /** Rename the pig; null when the name is unusable or the pig is absent. */
    rename(rawName) {
      const state = getState()
      if (state === null) return null
      try {
        const result = commands.runFor(
          commands.scope,
          live => ({ cleaned: coreRename(live, rawName, now()) }),
          { saveWhen: value => value.cleaned !== null },
        )
        if (typeof result?.cleaned === 'string') return result.cleaned
        if (result?.reason === 'error') {
          console.warn(`[dsh-piggy] rename failed: reason="${result.message ?? 'error'}"`)
        }
        return null
      } catch (error) {
        console.warn(`[dsh-piggy] rename failed: reason="${error instanceof Error ? error.message : String(error)}"`)
        return null
      }
    },

    /** Take the queued announcements (work done, got sick, got better…). */
    drainPending() {
      const state = getState()
      if (state === null) return []
      try {
        const result = commands.runFor(
          commands.scope,
          live => ({ events: drainPending(live) }),
          { saveWhen: value => value.events.length > 0 },
        )
        if (Array.isArray(result?.events)) return result.events
        if (result?.reason === 'error') {
          console.warn(`[dsh-piggy] drainPending failed: reason="${result.message ?? 'error'}"`)
        }
        return []
      } catch (error) {
        console.warn(`[dsh-piggy] drainPending failed: reason="${error instanceof Error ? error.message : String(error)}"`)
        return []
      }
    },

    /** Flush any pending write and stop the timer. Called on plugin unload. */
    dispose,
  }
}
