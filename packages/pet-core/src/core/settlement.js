// @ts-check
/**
 * 时间推进：衰减、疾病、结算、死亡。
 *
 * 纯函数领域逻辑：时间由 nowMs 传入，不读写文件、不碰 DOM（见 docs/CONVENTIONS.md）。
 * @module dsh-piggy/core/settlement
 */

import { CERTIFICATE_AFTER, DEFAULT_TIME_SCALE, ILLNESS_ONSET, GRADUATION_GROWTH, GRADUATION_LESSONS, SICK_PAY_MULTIPLIER, STUDY_GROWTH_PER_LESSON, TRAITS, interestByKey, jobByKey, rarityByKey, schoolStageByKey, stageForNextLesson, subjectByKey, traitBonus, tripByKey } from '../data.js'
import { AWAY_DECAY_MULTIPLIER, AWAY_FLOOR, CLEANLINESS_DECAY_PER_MIN, DAY_MS, HAPPINESS_DECAY_PER_MIN, MAX_SETTLE_SPAN_MS, MAX_SETTLE_STEPS, MIN_SETTLE_STEP_MS, OFFLINE_GRACE_DAYS, SATIETY_DECAY_PER_MIN, SETTLE_STEP_MS } from './constants.js'
import { announce, clamp100, remember } from './effects.js'
import { growWithTime, grow, outingGrowth } from './growth.js'
import { describeDrops, graduationDrops, studyDrops, workDrops } from './drops.js'
import { advanceIllness, noteOuting, progressIllness, restAtHome, rollForIllness } from './illness.js'
import { say } from './lines.js'
import { rollerFor } from './random.js'
import { noteToday, writeDiaryIfNewDay } from './diary.js'
import { dayKeyFor, isUsableCursor, raiseSettledUpTo, settleFloorMs } from './clock.js'
import { recordDex } from './dex.js'
import { unlockCareerLook } from './skins.js'
import { reduceWorkWeight, settleWeight } from './weight.js'
import { finishAutoFishing } from './fishing.js'
import { settleAutoFishing } from './fishing-auto.js'
import { careOffline, emptyOfflineMeals, finishOfflineMeals, offlineSustainMs, settleStarvation } from './offline-feed.js'
import { ONLINE_GIFT, THRESHOLDS } from '../data.js'
import { earnCoins } from './economy.js'

export { currentIllness, die } from './illness.js'

// ---------------------------------------------------------------------------
// The clock: decay, activity settlement, illness progression
// ---------------------------------------------------------------------------

/**
 * 冻结（时钟没前进 / 还没追上已结算水位）时的日志，同一道下界只报一次：面板每 4 秒轮询一次
 * `decay()`，回拨造成的冻结却可以持续很多天，不挡一下会刷满日志。只压日志、不影响结算，写清
 * 「冻住、等真实时间追上水位」和两个时间戳，排障才看得出这条跳过路径（返工3 P2-C）。不加界面提示。
 */
let frozenAtFloorMs = null
function warnFrozen(state, floorMs, nowMs) {
  if (frozenAtFloorMs === floorMs) return
  frozenAtFloorMs = floorMs
  console.warn(`[dsh-piggy] settle frozen, pig stands still until the real clock catches up: floorMs=${floorMs} settledUpTo=${String(state.settledUpTo)} nowMs=${nowMs}`)
}

/**
 * Bring the pig up to `nowMs`, resolving everything that happened in between.
 *
 * The gap is cut into at most two stretches — away until the activity ends, then
 * home — each walked in SETTLE_STEP_MS steps, so a long absence plays out as it
 * would have live: a job ending at 18:56 is paid at 18:56, and a bar crossing a
 * threshold at 3 a.m. starts its sickness risk then, not when the panel is next
 * opened. Randomness comes from the pig's own seed (see random.js); pass `roll` to
 * pin the outcome, as the tests and dev mode do.
 *
 * @param {object} state
 * @param {number} nowMs
 * @param {{roll?: import('./random.js').Roll}} [options]
 */
export function decay(state, nowMs, options = {}) {
  // 宿主自己把 nowMs 传坏了（NaN / 负数 / Infinity）时什么也别做：写进去会把游标变成坏值，
  // 而 NaN 会让后面每个比较都判假、猪永久冻住，比不结算更糟。只读，不动状态。
  if (!Number.isFinite(nowMs) || nowMs < 0) {
    console.warn(`[dsh-piggy] decay skipped, unusable nowMs: nowMs=${String(nowMs)}`)
    return state
  }
  // 坏游标（非数字 / 非有限 / 非正数）不能当作可信的「上次看到」：没有起点就按刚刚
  // 看过处理——把游标修到 nowMs，本次不补结算。否则 0 / -1 这类值会让时间差大到
  // passTime 按 SETTLE_STEP_MS 一步走几百万步（存档模糊测试 4.1）。
  if (!isUsableCursor(state.lastSeenAt)) {
    console.warn(`[dsh-piggy] unusable settle cursor, resetting to now: lastSeenAt=${String(state.lastSeenAt)} nowMs=${nowMs}`)
    state.lastSeenAt = nowMs
    raiseSettledUpTo(state, nowMs)
    return state
  }
  // 游标早于出生时刻（手改存档、跨机器拷贝）时把结算起点钳到出生：出生之前猪还不存在，
  // 不该补算那一段，更不该像旧版那样判成坏数据（会永久冻结，返工 P2-1）。出生时刻本身
  // 在将来（快机器上孵的猪、对表之后）时不抬，否则跨度变负、猪会冻到生日那天。
  const bornAtMs = Number.isFinite(state.bornAt) && state.bornAt <= nowMs ? state.bornAt : null
  const fromMs = bornAtMs === null ? state.lastSeenAt : Math.max(state.lastSeenAt, bornAtMs)
  // 时钟没前进（玩家把系统时间调回去了 / 游标在未来）：猪原地不动，保留游标，本次不结算。
  // 玩家调时间了就冻结，不自动恢复——等真实时间追上旧水位（settledUpTo）再接着走，
  // 错表那段本来就没真的流过（2026-10-14 用户拍板，取消了原来的「满一天认新时钟」出口）。
  if (!(nowMs > fromMs)) {
    // nowMs 恰好等于 fromMs 是「同一时刻被问了两次」（面板轮询后紧跟着一个动作），不是冻结。
    if (nowMs < fromMs) warnFrozen(state, fromMs, nowMs)
    return state
  }
  state.lastSeenAt = nowMs
  // 已结算水位（只增不减，见 clock.js）：时间要越过它才继续结算，同一段绝不结算两遍
  // （宁可少算）。水位在游标前面时（存档被手改 / 从更旧的一份拷来）这条是唯一保护。
  const floorMs = settleFloorMs(state, fromMs)
  if (nowMs <= floorMs) {
    warnFrozen(state, floorMs, nowMs)
    return state
  }
  // An unopened box is not a pet yet: it never gets hungry, dirty, sick or
  // older, and it cannot die while it waits to be poked open (#2).
  if (state.hatched !== true) return state
  if (state.dead === true) return state
  // 到这里才真的要结算，水位跟着推进（前面的跳过路径只在 lastSeenAt 上走）。承重条件：
  // 老存档 / 未孵化的盒子水位一直是 null，这行是它们把水位立起来的唯一一步；删了水位永远是
  // null，`settleFloorMs` 退化成按游标结算，游标一落后就会重复结算（返工3 P3-E，别当冗余删）。
  raiseSettledUpTo(state, nowMs)
  const next = options.roll ?? rollerFor(state)
  // 单次结算的推算上限：背包还能撑多久 + 10 天（见 offline-feed.js），再夹在 400 天的
  // 绝对上限内。超出的时间不逐步走——那正是「几百万步卡住面板」的来源（返工3 A2）。
  const sustainMs = offlineSustainMs(state)
  const horizonMs = Math.min(sustainMs + OFFLINE_GRACE_DAYS * DAY_MS, MAX_SETTLE_SPAN_MS)
  const settleFromMs = Math.max(floorMs, nowMs - horizonMs)
  // 少结算了就说一声，别让玩家只看到「年龄凭空少了」（P3-3）。
  if (nowMs - floorMs > horizonMs) {
    console.warn(`[dsh-piggy] settle span over the offline horizon, only the last ${horizonMs}ms is walked: floorMs=${floorMs} settleFromMs=${settleFromMs} nowMs=${nowMs}`)
  }
  const hadAge = Number.isFinite(state.ageMs)
  if (!hadAge) {
    // First tick after loading an old save: seed pig time from the birthday.
    state.ageMs = typeof state.bornAt === 'number' ? Math.max(0, settleFromMs - state.bornAt) : 0
  }
  // 被 horizon 截掉的头部（floorMs..settleFromMs）也要算进时间线：判定按完整跨度算「撑不住」
  // 多久，结算却只走截头那段，活着回来的猪会凭空少长几天（返工4 P2-1）。本段只补一次——日记
  // 游标一天一篇走到 settleFromMs、年龄在末尾按 timeScale 加回；不重跑步长 / 衰减 / 发病 / 进食。
  const headMs = Math.min(settleFromMs - floorMs, MAX_SETTLE_SPAN_MS - horizonMs)
  for (let at = settleFromMs - headMs; at < settleFromMs; at += DAY_MS) rollDiaryAt(state, at)
  rollDiaryAt(state, settleFromMs)

  const meals = nowMs - settleFromMs > ONLINE_GIFT.pollGapMaxMs && state.isOfflineFeedEnabled !== false
    ? emptyOfflineMeals() : null
  let cursor = settleFromMs
  const activity = state.activity
  if (activity !== null && activity !== undefined) {
    settleAutoFishing(state, activity, nowMs)
    const untilMs = Math.min(nowMs, Math.max(cursor, activity.endsAt))
    passTime(state, { fromMs: cursor, toMs: untilMs, away: true, meals }, next)
    cursor = untilMs
    // Settle at the moment it ended, not at the moment someone looked.
    if (state.dead !== true && state.activity === activity && untilMs >= activity.endsAt) {
      finishActivity(state, untilMs, next)
    }
  }
  if (state.dead !== true) passTime(state, { fromMs: cursor, toMs: nowMs, away: false, meals }, next)
  finishOfflineMeals(state, meals, nowMs)
  // 超过「背包能撑的」那一刻还有剩余时间：没东西撑着满 30 天就是死亡，否则生命垂危
  // （返工3 A2）。这段时间不逐步推算，正是为了不走上百万步。
  settleStarvation(state, nowMs, nowMs - floorMs - sustainMs)
  // 补回被截掉的头部年龄；死亡那档不加（停在 die() 那一刻），老存档上面刚按 settleFromMs 播种、
  // 本来就含这一段，也不加（返工4）。
  if (hadAge && state.dead !== true) state.ageMs += headMs * pigScale(state)
  return state
}

/**
 * Walk one stretch, all of it either away or at home, in bounded steps.
 * @param {object} state
 * @param {{fromMs: number, toMs: number, away: boolean, meals?: object|null}} stretch
 * @param {import('./random.js').Roll} next
 */
function passTime(state, stretch, next) {
  let cursor = stretch.fromMs
  let steps = 0
  while (cursor < stretch.toMs && state.dead !== true) {
    // 步数守卫：正常路径最多 400 天 / 5 分钟 ≈ 11.5 万步，触发说明输入异常（步长被压到
    // 下限还走不完）。放弃剩余时间并记一条日志，不硬撑占住面板线程（P2-3 第 7 条）。
    if (steps >= MAX_SETTLE_STEPS) {
      console.warn(`[dsh-piggy] settle step guard hit, dropping the rest: fromMs=${stretch.fromMs} toMs=${stretch.toMs} steps=${steps} minStepMs=${MIN_SETTLE_STEP_MS}`)
      return
    }
    steps += 1
    careOffline(state, stretch.meals, cursor)
    const speed = stretch.away ? AWAY_DECAY_MULTIPLIER : 1
    const toHungerMs = (state.satiety - THRESHOLDS.hungry) / (SATIETY_DECAY_PER_MIN * speed) * 60000
    const span = stretch.meals && toHungerMs > 0 ? Math.min(SETTLE_STEP_MS, Math.max(MIN_SETTLE_STEP_MS, Math.ceil(toHungerMs))) : SETTLE_STEP_MS
    const stepEnd = Math.min(stretch.toMs, cursor + span)
    step(state, { elapsedMs: stepEnd - cursor, atMs: stepEnd, away: stretch.away, meals: stretch.meals }, next)
    cursor = stepEnd
  }
}

/**
 * One step of pig time: bars, sickness risk, illness, age.
 * @param {object} state
 * @param {{elapsedMs: number, atMs: number, away: boolean, meals?: object|null}} tick
 * @param {import('./random.js').Roll} next
 */
function step(state, tick, next) {
  const { elapsedMs, atMs, away } = tick
  rollDiaryAt(state, atMs)
  drainBars(state, elapsedMs / 60000, away)
  careOffline(state, tick.meals, atMs)
  trackSicknessRisk(state, elapsedMs / 60000, away, atMs, next)
  progressIllness(state, elapsedMs, { away, atMs }, next)
  if (state.dead !== true) growOlder(state, elapsedMs, atMs)
}

/**
 * Time passing, with one floor: an activity may not empty a bar on its own.
 * A pig back from a day trip should be ravenous and filthy — a welcome-home
 * meal and bath — not sitting at zero before you can even react to it.
 * Going away never *raises* a bar either.
 */
function drainBars(state, minutes, away) {
  const speed = away ? AWAY_DECAY_MULTIPLIER : 1
  const drain = (value, perMinute) => {
    const lowered = value - minutes * perMinute * speed
    return away ? Math.max(lowered, Math.min(value, AWAY_FLOOR)) : lowered
  }
  state.satiety = clamp100(drain(state.satiety, SATIETY_DECAY_PER_MIN))
  state.happiness = clamp100(drain(state.happiness, HAPPINESS_DECAY_PER_MIN))
  state.cleanliness = clamp100(drain(state.cleanliness, CLEANLINESS_DECAY_PER_MIN))
}

/**
 * Illness only comes from being left at home. A pig that was out living its
 * life has not been neglected, and coming back sick every trip is not a game.
 * At home each condition adds its own hourly chance (see illness.js).
 */
function trackSicknessRisk(state, minutes, away, atMs, next) {
  if (away) return
  restAtHome(state, minutes)
  rollForIllness(state, { minutes, atMs }, next)
}

/** 猪时间 = 真实流逝 × timeScale（坏值当作 1）；它同时驱动被动成长。 */
const pigScale = state => Number.isFinite(state.timeScale) && state.timeScale > 0 ? state.timeScale : DEFAULT_TIME_SCALE

function growOlder(state, elapsedMs, atMs) {
  const pigMs = elapsedMs * pigScale(state)
  settleWeight(state, pigMs)
  state.ageMs += pigMs
  if (state.hatched === true) growWithTime(state, pigMs, atMs)
}

/**
 * @param {object} state
 * @param {number} nowMs
 * @param {import('./random.js').Roll} [next] - for drops; defaults to the pig's own seed.
 */
export function finishActivity(state, nowMs, next = rollerFor(state)) {
  const activity = state.activity
  state.activity = null
  if (activity === null) return
  rollDiaryAt(state, nowMs)
  state.lastActiveAt = nowMs
  if (activity.kind === 'work') finishWork(state, activity, nowMs, next)
  else if (activity.kind === 'study') finishStudy(state, activity, nowMs, next)
  else if (activity.kind === 'interest') finishInterest(state, activity, nowMs)
  else if (activity.kind === 'trip') finishTrip(state, activity, nowMs)
  else if (activity.kind === 'fishing') finishAutoFishing(state, activity, nowMs, next)
}

function rollDiaryAt(state, atMs) {
  if (state.diary?.today?.day !== dayKeyFor(atMs)) writeDiaryIfNewDay(state, atMs)
}

export function finishInterest(state, activity, nowMs) {
  const interest = interestByKey(activity.key)
  if (interest === null) return
  // Straight into the same three traits the school ladder feeds.
  state.traits = { ...(state.traits ?? {}) }
  state.traits[interest.trait] = (state.traits[interest.trait] ?? 0) + interest.gain
  state.interests = { ...(state.interests ?? {}) }
  state.interests[interest.key] = (state.interests[interest.key] ?? 0) + 1
  const certified = state.interests[interest.key] === CERTIFICATE_AFTER
  state.satiety = clamp100(state.satiety - 4)
  state.happiness = clamp100(state.happiness + 3)
  state.stats.interests = (state.stats.interests ?? 0) + 1
  noteOuting(state)
  grow(state, STUDY_GROWTH_PER_LESSON, nowMs)
  remember(state, `${interest.emoji} 学完${interest.label}，${TRAITS[interest.trait].label} +${interest.gain}`, nowMs)
  announce(state, 'interest', `${state.name} 学会了${interest.label}，${TRAITS[interest.trait].label} +${interest.gain} ${interest.emoji}`, nowMs)
  noteToday(state, 'study')
  if (certified) {
    remember(state, `📜 拿到了${interest.certificate}`, nowMs)
    announce(state, 'certificate', `${state.name} 拿到了${interest.certificate} 📜`, nowMs)
  }
}

export function finishWork(state, activity, nowMs, next = rollerFor(state)) {
  const job = jobByKey(activity.key)
  // A shift started under an older job table is paid what it promised then
  // (the v11 upgrade stamps `legacyCoins` on it), even if the job is gone.
  if (job === null && !Number.isFinite(activity.legacyCoins)) return
  const base = job === null ? activity.legacyCoins : job.coins
  const trait = job === null ? null : job.trait
  // A sick pig still goes to work — that is the way out of the sick-and-broke
  // deadlock — but at half pay, so being ill costs money rather than being a wall.
  const sick = state.illness !== null
  const points = trait === null ? 0 : (state.traits?.[trait] ?? 0)
  const withTrait = trait === null ? base : base * traitBonus(trait, points).pay
  // 短班（SHORT_SHIFT_MINUTES）只拿这一班的几分之几：金币、饱食、清洁、成长都按比例。
  const share = Number.isFinite(activity.share) && activity.share > 0 && activity.share < 1 ? activity.share : 1
  const short = share < 1
  const paid = withTrait * share
  const coins = sick ? Math.max(1, Math.round(paid * SICK_PAY_MULTIPLIER)) : Math.max(1, Math.round(paid))
  earnCoins(state, coins, 'work', nowMs)
  if (job !== null) {
    state.satiety = clamp100(state.satiety + Math.round(job.satiety * share))
    state.cleanliness = clamp100(state.cleanliness + Math.round(job.cleanliness * share))
  }
  reduceWorkWeight(state, Math.max(0, (activity.endsAt - activity.startedAt) / 60_000))
  // 短班不算「完整一班」：不进打工次数（成就、形态条件看它），也不算连续出门（过劳生病看它）。
  if (short) state.stats.shortShifts = (state.stats.shortShifts ?? 0) + 1
  else state.stats.jobs += 1
  state.stats.coinsEarned += coins
  noteToday(state, 'work')
  noteToday(state, 'coinsEarned', coins)
  if (!short) noteOuting(state)
  grow(state, outingGrowth(job === null ? activity.minutes ?? 0 : job.minutes * share), nowMs)
  const brought = workDrops(state, coins, next, nowMs)
  const label = job === null ? activity.label : job.label
  const emoji = job === null ? activity.emoji : job.emoji
  const tag = sick ? '（带病上工，只有一半）' : (points > 0 && trait !== null ? `（${TRAITS[trait].label} ${points}）` : '')
  const extra = brought.length > 0 ? `，还带回了${describeDrops(brought)}` : ''
  remember(state, `${emoji} ${label}回来，赚了 ${coins} 金币${tag}${extra}`, nowMs)
  announce(state, 'work', sick
    ? `${state.name} 带病打工回来了，只赚到 ${coins} 金币 🤒${extra}`
    : `${state.name} 打工回来了！赚到 ${coins} 金币 💰${extra}`, nowMs)
  say(state, (state.outingStreak ?? 0) >= ILLNESS_ONSET.overworkStreak ? 'tired' : 'workDone', nowMs)
  const career = short ? null : unlockCareerLook(state, activity.key, nowMs)
  if (career !== null) {
    remember(state, `${career.emoji} 完成${label}工作，解锁了${career.label}外观`, nowMs)
    announce(state, 'career', `${state.name} 解锁了${career.label}！去换肤或图鉴看看 ${career.emoji}`, nowMs)
  }
}

/**
 * A lesson is over: one more on this subject's count. Crossing 9 / 20 / 40 / 95
 * is a graduation — three gifts, extra growth, and 「我没有留级」.
 */
export function finishStudy(state, activity, nowMs, next = rollerFor(state)) {
  const subject = subjectByKey(activity.key)
  if (subject === null) return
  const taken = state.lessons?.[subject.key] ?? 0
  // The stage is the one the lesson was booked at, so a table change mid-lesson
  // cannot change what it pays.
  const stage = schoolStageByKey(activity.stage) ?? stageForNextLesson(taken)
  state.lessons = { ...(state.lessons ?? {}), [subject.key]: taken + 1 }
  state.traits = { ...(state.traits ?? {}) }
  state.traits[subject.trait] = (state.traits[subject.trait] ?? 0) + stage.gain
  if (subject.secondary !== null && stage.secondaryGain > 0) {
    state.traits[subject.secondary] = (state.traits[subject.secondary] ?? 0) + stage.secondaryGain
  }
  state.satiety = clamp100(state.satiety + stage.satiety)
  state.happiness = clamp100(state.happiness + stage.happiness)
  state.stats.courses += 1
  state.stats.lessons += 1
  noteOuting(state)
  grow(state, STUDY_GROWTH_PER_LESSON, nowMs)
  const gains = `${TRAITS[subject.trait].label} +${stage.gain}`
    + (subject.secondary !== null && stage.secondaryGain > 0 ? `、${TRAITS[subject.secondary].label} +${stage.secondaryGain}` : '')
  if (GRADUATION_LESSONS.includes(taken + 1)) {
    const gifts = graduationDrops(state, next, nowMs)
    grow(state, GRADUATION_GROWTH, nowMs)
    state.stats.graduations = (state.stats.graduations ?? 0) + 1
    remember(state, `🎓 ${subject.label}${stage.label}毕业（第 ${taken + 1} 节）`, nowMs)
    announce(state, 'graduate', `${state.name} ${subject.label}${stage.label}毕业啦 🎓 ${gains}，带回${describeDrops(gifts)}`, nowMs)
    noteToday(state, 'graduate')
    say(state, 'graduate', nowMs)
    return
  }
  const brought = studyDrops(state, next, nowMs)
  const extra = brought.length > 0 ? `，还带回了${describeDrops(brought)}` : ''
  remember(state, `${subject.emoji} 上完${subject.label}第 ${taken + 1} 节，${gains}`, nowMs)
  announce(state, 'study', `${state.name} 上完${subject.label}第 ${taken + 1} 节，${gains} 📚${extra}`, nowMs)
  noteToday(state, 'study')
  say(state, (state.outingStreak ?? 0) >= ILLNESS_ONSET.overworkStreak ? 'tired' : 'study', nowMs)
}

export function finishTrip(state, activity, nowMs) {
  const trip = tripByKey(activity.key)
  if (trip === null) return
  // Deterministic souvenir rotation keeps the mechanic testable without RNG —
  // and the rarity is a property of the souvenir, so "far trips are worth more"
  // is a fact about the table rather than a dice roll.
  const pick = trip.souvenirs[state.stats.trips % trip.souvenirs.length]
  const tier = rarityByKey(pick.rarity)
  recordDex(state, 'souvenirs', pick.key, nowMs)
  state.souvenirs = [...(state.souvenirs ?? []), {
    key: pick.key, emoji: pick.emoji, label: pick.label,
    rarity: pick.rarity, story: pick.story,
    from: trip.key, fromLabel: trip.label,
    gotAt: nowMs,
  }]
  state.happiness = clamp100(state.happiness + trip.happiness)
  state.satiety = clamp100(state.satiety + trip.satiety)
  state.stats.trips += 1
  grow(state, outingGrowth(trip.minutes), nowMs)
  remember(state, `${trip.emoji} ${trip.label}回来，带回「${pick.label}」${tier.emoji}`, nowMs)
  announce(state, 'trip', `${state.name} 从${trip.label}回来了，带回「${pick.label}」${tier.emoji}🧳`, nowMs)
  noteToday(state, 'trip')
  noteToday(state, 'souvenirs')
  say(state, 'tripBack', nowMs)
}

export { advanceIllness, catchIllness } from './illness.js'

// ---------------------------------------------------------------------------
// Effects and level crossings
// ---------------------------------------------------------------------------
