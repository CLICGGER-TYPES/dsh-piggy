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
import { createApiActions } from './api-actions.js'
import { createApiFishing } from './api-fishing.js'
import { createApiInventory } from './api-inventory.js'
import { createApiLifecycle } from './api-lifecycle.js'
import { createApiProfile } from './api-profile.js'
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
 * 每个命令组接收的 live runtime；这里只传 getters/command boundaries，
 * 不把当前存档对象作为构造时快照。
 * @typedef {object} ApiRuntime
 * @property {ApplicationContext} application
 * @property {CommandContext} commands
 * @property {() => number} now
 * @property {() => object|null} getState
 * @property {(next: object|null) => void} setState
 * @property {(fn: (state: object) => object) => object} mutate
 * @property {() => void} settleAndSave
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

  const runtime = { application, commands, now, getState, setState, mutate, settleAndSave }
  const actions = createApiActions(runtime)
  const fishing = createApiFishing(runtime)
  const inventory = createApiInventory(runtime)
  const profile = createApiProfile(runtime)
  const lifecycle = createApiLifecycle(runtime)

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

    feed: actions.feed,
    freshen: actions.freshen,
    act: actions.act,
    guestCare: actions.guestCare,
    takeCareItem: actions.takeCareItem,
    refundCareItem: actions.refundCareItem,
    touch: actions.touch,
    startWork: actions.startWork,
    startStudy: actions.startStudy,
    startInterest: actions.startInterest,
    grantAll: actions.grantAll,
    startTrip: actions.startTrip,
    castFishing: fishing.castFishing,
    hookFishing: fishing.hookFishing,
    resolveFishing: fishing.resolveFishing,
    keepFish: fishing.keepFish,
    feedFish: fishing.feedFish,
    sellFish: fishing.sellFish,
    buyRod: fishing.buyRod,
    buyFishingAutomation: fishing.buyFishingAutomation,
    collectAutoFish: fishing.collectAutoFish,
    chooseSpot: fishing.chooseSpot,
    exchange: inventory.exchange,
    startAutoFishing: fishing.startAutoFishing,
    grantFish: fishing.grantFish,
    skipFishingWait: fishing.skipFishingWait,
    selectSkin: profile.selectSkin,
    registerCustomSkin: profile.registerCustomSkin,
    callOffActivity: actions.callOffActivity,
    callOffWork: actions.callOffWork,
    buy: inventory.buy,
    setExtension: inventory.setExtension,
    extensionOn: inventory.extensionOn,
    useItem: inventory.useItem,
    seeDoctor: inventory.seeDoctor,
    sellSouvenir: inventory.sellSouvenir,
    chat: profile.chat,
    setOfflineFeed: profile.setOfflineFeed,
    setQuiet: profile.setQuiet,
    setCatchphrase: profile.setCatchphrase,
    setMotto: profile.setMotto,
    editProfile: profile.editProfile,
    crown: profile.crown,
    setOwnerName: profile.setOwnerName,
    reply: profile.reply,
    signIn: profile.signIn,
    startPomodoro: profile.startPomodoro,
    abandonPomodoro: profile.abandonPomodoro,
    openGift: profile.openGift,
    wear: inventory.wear,
    hatch: lifecycle.hatch,
    setTimeScale: lifecycle.setTimeScale,
    ageFromNow: lifecycle.ageFromNow,
    dev: lifecycle.dev,
    reset: lifecycle.reset,
    adopt: lifecycle.adopt,
    rename: lifecycle.rename,
    drainPending: lifecycle.drainPending,

    /** Flush any pending write and stop the timer. Called on plugin unload. */
    dispose,
  }
}
