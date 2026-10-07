// @ts-check
/**
 * dsh-piggy · core — the pure pig model.
 *
 * No IO, no ctx, no clock of its own: every function takes the current time as
 * a parameter, so the whole game model is testable in isolation. Nothing here
 * schedules a timer — shifts, courses, trips, illness progression and decay are
 * all resolved lazily from timestamps, which is why the pig survives restarts
 * and why the tests never have to wait.
 *
 * Three ways the pig changes:
 *   - `feed()`  digests a *passive* harness event (a turn ended, a tool ran)
 *   - `act()`   applies a *deliberate* care action (feed it, bathe it, play)
 *   - `buy()` / `useItem()` / `start*()` drive the game loop
 *
 * Time away from the desk is one concept, not three: work, study and travel all
 * become a single `activity` record, so "is the pig home?" has exactly one
 * answer and `decay()` has exactly one place to settle it.
 *
 * @module dsh-piggy/core
 */

import {
  AWAY_MULTIPLIER,
  CARE_KIND,
  DEFAULT_TOY,
  GRAVE,
  LIFE_STAGES,
  SOUL,
  SOUL_AFTER_DAYS,
  ILLNESS_CHAINS,
  DAYS_PER_MONTH,
  DEFAULT_TIME_SCALE,
  LEVEL_TITLES,
  illnessStageMs,
  xpForLevel,
  traitBonus,
  SELF_HEAL_CHANCE,
  SICK_AWAY_MULTIPLIER,
  SICK_PAY_MULTIPLIER,
  JOBS,
  KIND_ORDER,
  MAX,
  REVIVE_ITEM,
  SCHOOL_STAGES,
  SHOP,
  SLEEPY_AFTER_MINUTES,
  SOUVENIR_RARITY,
  STAGE_HEALTH,
  SUBJECTS,
  THRESHOLDS,
  TRAITS,
  TRAIT_ORDER,
  TRIPS,
  illnessAt,
  interestByKey,
  INTERESTS,
  dressSlotByKey,
  itemByKey,
  jobByKey,
  jobRequirement,
  careItems,
  nextIllness,
  rarityByKey,
  schoolStageByKey,
  subjectByKey,
  tripByKey,
} from './data.js'

export { ACTIONS, ACTION_ORDER, STATE_VERSION } from './core/constants.js'
export { announce, drainPending } from './core/effects.js'
export { DEX_SECTIONS, dexView, emptyDex, ensureDex, recordDex } from './core/dex.js'
export { ageDays, ageMonths, dayKeyFor, daysToNextStage, hasSoul, levelFor, levelProgress, levelTitle, lifeStageFor, nextLifeStage } from './core/clock.js'
export { careFactor, grow, growFromRealWork, outingGrowth } from './core/growth.js'
export { hatch, hatchEgg, layEgg } from './core/egg.js'
export { adopt, ageFromNow, applyDevPatch, inherit, rename, reset, revive, setTimeScale } from './core/state.js'
export { migrate } from './core/migrate.js'
export { assignPersonality, ensureProfile, profileView, setCatchphrase, setMotto, zodiacFor } from './core/profile.js'
export { crown, formStageView, formsView, signContract } from './core/evolution.js'
export { chat, pickLine, replyToLine, say, sayAfter, setOwnerName, setQuiet } from './core/lines.js'
export { holidayFor, notePet, slotFor, timeTalkScene } from './core/talk.js'
export { canSignIn, dailyView, emptyDaily, ensureDaily, giftsWaiting, grantReward, openGift, pickGift, recordOnline, signIn } from './core/daily.js'
export { composeDiary, diaryView, emptyDiary, ensureDiary, noteToday, writeDiaryIfNewDay } from './core/diary.js'
export { currentIllness, decay } from './core/settlement.js'
export { finishActivity } from './core/settlement.js'
export { doctorFee, onsetRisks, seeDoctor } from './core/illness.js'
export { activitySecondsLeft, awayBlockedReason, callOffActivity, callOffWork, canStartActivity, canWork, workSecondsLeft } from './core/activity.js'
export { act, actionCooldownSeconds, actionReady, canFeed, careOptions, careView, feed, feedCooldownSeconds } from './core/care.js'
export { buy, canAfford, dressView, grantAll, inventoryView, takeOff, useItem, wearItem } from './core/inventory.js'
export { courseView, startStudy, studyView } from './core/school.js'
export { jobFacts } from './core/work.js'
export { interestView, startInterest } from './core/interests.js'
export { startWork } from './core/work.js'
export { sellSouvenir, startTrip } from './core/travel.js'
export { bar, formatWeight, healthPercent, mood, traitView } from './core/views.js'
export { JOBS, MAX, REVIVE_ITEM, SCHOOL_STAGES, SHOP, SUBJECTS, THRESHOLDS, TRAITS, TRAIT_ORDER, TRIPS } from './data.js'
export { GRAVE, LIFE_STAGES, MAX_LEVEL, SOUL, SOUL_AFTER_DAYS } from './data.js'
export { DIET } from './core/constants.js'
export { abandonPomodoro, awayFromPomodoro, emptyPomodoro, ensurePomodoro, pomodoroRunning, pomodoroView, rollPomodoroDay, settlePomodoro, startPomodoro } from './core/pomodoro.js'
export { bodyWeightClass, bodyWeightView, ensureBodyWeight, idealWeightG, reduceFishingWeight, reducePlayWeight, reduceWorkWeight, setBodyWeightClass, settleWeight, weightStageView } from './core/weight.js'
export { castFishing, emptyFishing, ensureFishing, feedFish, finishAutoFishing, fishingPeriod, fishingView, grantFish, hookFishing, keepFish, resolveFishing, sellFish, skipFishingWait, startAutoFishing } from './core/fishing.js'
export { FISH, fishByKey } from './data.js'
export { disabledParts, ensureExtensions, extensionInstalled, extensionOn, extensionsView, installExtension, removeExtension, setExtension } from './core/extensions.js'
export { EXTENSIONS, extensionByKey, extensionForAction } from './data.js'
export { SKINS, SKIN_SCENES, REQUIRED_SKIN_SCENES, skinByKey } from './data.js'
export { allSkins, ensureSkins, registerCustomSkin, selectSkin, skinStageView, skinView } from './core/skins.js'

export { ensureAchievements, settleAchievements, achievementsView } from './core/achievements.js'

export { validateExtensionEvent, recordExtensionEvent, resetExtensionEventBaselines } from './core/extension-events.js'
