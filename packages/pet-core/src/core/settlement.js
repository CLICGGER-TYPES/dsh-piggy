// @ts-check
/**
 * 时间推进：衰减、疾病、结算、死亡。
 *
 * 纯函数领域逻辑：时间由 nowMs 传入，不读写文件、不碰 DOM（见 docs/CONVENTIONS.md）。
 * @module dsh-piggy/core/settlement
 */

import { CERTIFICATE_AFTER, DEFAULT_TIME_SCALE, ILLNESS_ONSET, GRADUATION_GROWTH, GRADUATION_LESSONS, SICK_AWAY_MULTIPLIER, SICK_PAY_MULTIPLIER, STUDY_GROWTH_PER_LESSON, TRAITS, illnessStageMs, interestByKey, jobByKey, rarityByKey, schoolStageByKey, stageForNextLesson, subjectByKey, traitBonus, tripByKey } from '../data.js'
import { AWAY_DECAY_MULTIPLIER, AWAY_FLOOR, CLEANLINESS_DECAY_PER_MIN, HAPPINESS_DECAY_PER_MIN, SATIETY_DECAY_PER_MIN, SETTLE_STEP_MS } from './constants.js'
import { announce, clamp100, remember } from './effects.js'
import { growWithTime, grow, outingGrowth } from './growth.js'
import { describeDrops, graduationDrops, studyDrops, workDrops } from './drops.js'
import { advanceIllness, noteOuting, restAtHome, rollForIllness } from './illness.js'
import { say } from './lines.js'
import { rollerFor } from './random.js'
import { noteToday, writeDiaryIfNewDay } from './diary.js'
import { dayKeyFor } from './clock.js'
import { recordDex } from './dex.js'
import { unlockCareerLook } from './skins.js'
import { reduceWorkWeight, settleWeight } from './weight.js'
import { finishAutoFishing } from './fishing.js'
import { earnCoins } from './economy.js'

export { currentIllness, die } from './illness.js'

// ---------------------------------------------------------------------------
// The clock: decay, activity settlement, illness progression
// ---------------------------------------------------------------------------

/**
 * Bring the pig up to `nowMs`, resolving everything that happened in between.
 *
 * The gap is cut into at most two stretches — away until the activity ends,
 * then home — and each stretch is walked in steps of SETTLE_STEP_MS. That is
 * what lets a long absence play out the way it would have live: a job that
 * ended at 18:56 is paid (and stamped) at 18:56, the evening after it is time
 * at home, and a bar that crosses a threshold at 3 a.m. starts its sickness
 * risk at 3 a.m. rather than at whatever moment the panel was next opened.
 *
 * Randomness comes from the pig's own seed (see random.js); pass `roll` to pin
 * the outcome, as the tests and dev mode do.
 *
 * @param {object} state
 * @param {number} nowMs
 * @param {{roll?: import('./random.js').Roll}} [options]
 */
export function decay(state, nowMs, options = {}) {
  const fromMs = state.lastSeenAt ?? nowMs
  state.lastSeenAt = nowMs
  // An unopened box is not a pet yet: it never gets hungry, dirty, sick or
  // older, and it cannot die while it waits to be poked open (#2).
  if (state.hatched !== true) return state
  if (!(nowMs > fromMs) || state.dead === true) return state
  const next = options.roll ?? rollerFor(state)
  if (typeof state.ageMs !== 'number' || !Number.isFinite(state.ageMs)) {
    // First tick after loading an old save: seed pig time from the birthday.
    state.ageMs = typeof state.bornAt === 'number' ? Math.max(0, fromMs - state.bornAt) : 0
  }

  // An old save may have no diary yet. Start at the last observed day so
  // events settled below cannot be credited to the day the panel reopened.
  rollDiaryAt(state, fromMs)

  let cursor = fromMs
  const activity = state.activity
  if (activity !== null && activity !== undefined) {
    const untilMs = Math.min(nowMs, Math.max(cursor, activity.endsAt))
    passTime(state, { fromMs: cursor, toMs: untilMs, away: true }, next)
    cursor = untilMs
    // Settle at the moment it ended, not at the moment someone looked.
    if (state.dead !== true && state.activity === activity && untilMs >= activity.endsAt) {
      finishActivity(state, untilMs, next)
    }
  }
  if (state.dead !== true) passTime(state, { fromMs: cursor, toMs: nowMs, away: false }, next)
  return state
}

/**
 * Walk one stretch, all of it either away or at home, in bounded steps.
 * @param {object} state
 * @param {{fromMs: number, toMs: number, away: boolean}} stretch
 * @param {import('./random.js').Roll} next
 */
function passTime(state, stretch, next) {
  let cursor = stretch.fromMs
  while (cursor < stretch.toMs && state.dead !== true) {
    const stepEnd = Math.min(stretch.toMs, cursor + SETTLE_STEP_MS)
    step(state, { elapsedMs: stepEnd - cursor, atMs: stepEnd, away: stretch.away }, next)
    cursor = stepEnd
  }
}

/**
 * One step of pig time: bars, sickness risk, illness, age.
 * @param {object} state
 * @param {{elapsedMs: number, atMs: number, away: boolean}} tick
 * @param {import('./random.js').Roll} next
 */
function step(state, tick, next) {
  const { elapsedMs, atMs, away } = tick
  rollDiaryAt(state, atMs)
  drainBars(state, elapsedMs / 60000, away)
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

/**
 * Illness advances on accumulated *effective* time, not wall clock: being out
 * and about while ill runs it at SICK_AWAY_MULTIPLIER, so a day of work costs
 * two days of illness and staying home is the cheap way to wait it out.
 */
function progressIllness(state, elapsedMs, where, next) {
  if (state.illness === null || state.illness === undefined) return
  const rate = where.away ? SICK_AWAY_MULTIPLIER : 1
  state.illness.progressMs = (state.illness.progressMs ?? 0) + elapsedMs * rate
  let guard = 0
  while (state.illness !== null && guard < 16) {
    // Each stage has its own length, so it has to be re-read after every step.
    const stageMs = illnessStageMs(state.illness.stage)
    if (state.illness.progressMs < stageMs) break
    // Carry the excess into the next stage rather than dropping it.
    const carried = state.illness.progressMs - stageMs
    advanceIllness(state, where.atMs, next)
    if (state.illness !== null) state.illness.progressMs = carried
    guard += 1
  }
}

/**
 * Pig time is elapsed real time times the scale. Age only counts days now —
 * the body follows the level — and the same pig time drives passive growth.
 */
function growOlder(state, elapsedMs, atMs) {
  const scale = Number.isFinite(state.timeScale) && state.timeScale > 0
    ? state.timeScale
    : DEFAULT_TIME_SCALE
  const pigMs = elapsedMs * scale
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
