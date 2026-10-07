// @ts-check
/**
 * 面板快照：把状态序列化成界面读的那一份形状。
 *
 * 只读取状态与数值表，不算业务规则（见 docs/CONVENTIONS.md）。
 * @module dsh-piggy/snapshot
 */
import { PACKAGE_VERSION } from './environment.js'
import { achievementsView, disabledParts, extensionsView } from './core.js'
import { ACTIONS, ACTION_ORDER, bodyWeightView, doctorFee, fishingView, profileView, jobFacts, JOBS, LIFE_STAGES, MAX, REVIVE_ITEM, SCHOOL_STAGES, SHOP, SUBJECTS, TRAITS, TRIPS, actionCooldownSeconds, activitySecondsLeft, adopt, ageDays, dexView, formStageView, formsView, awayBlockedReason, careView, courseView, currentIllness, dailyView, daysToNextStage, diaryView, dressView, formatWeight, pomodoroView, hasSoul, healthPercent, interestView, inventoryView, levelProgress, lifeStageFor, mood, reset, skinView, studyView, traitView } from './core.js'
import { CERTIFICATE_AFTER, DEFAULT_OWNER_NAME, INTERESTS, SIGN_IN_CYCLE, SEXES, jobChecklist, jobRequirement, rarityByKey, traitBonus } from './data.js'

/** 版本号只有一个来源：environment.js（它也是导出日志表头的那一份）。 */
export { PACKAGE_VERSION }

/** The stage the panel shows before there is a pig: the cardboard box. */

function boxStageView() {
  const box = LIFE_STAGES.find(stage => stage.key === 'box') ?? LIFE_STAGES[0]
  return { key: box.key, label: box.label, emoji: box.emoji, size: box.size, line: box.line }
}

/** 称呼与免打扰，给状态页的开关用。 */
function dialogueView(state) {
  const dialogue = state?.dialogue
  return {
    ownerName: typeof dialogue?.ownerName === 'string' ? dialogue.ownerName : DEFAULT_OWNER_NAME,
    quiet: dialogue?.quiet === true,
  }
}

/** 性别：男孩 ♂ / 女孩 ♀；还没拆开的纸盒没有。 */
function sexView(state) {
  const sex = SEXES[state.sex]
  return sex === undefined ? null : { key: sex.key, label: sex.label, symbol: sex.symbol }
}

/** "今天刚到家" / "养了 3 天" / "还没拆开" — how long the pig has been here, in words. */
function formatAge(days, state, nowMs) {
  if (state.hatched !== true) return '还没拆开'
  // A tombstone is not "newborn today". Once the pig is gone its clock stops,
  // and what matters is how long it had — not how long ago it hatched.
  if (state.dead === true) {
    const lived = Math.max(0, (state.diedAt ?? nowMs) - state.bornAt)
    return `活了 ${formatSpan(lived)}`
  }
  if (days < 1) return '今天刚到家'
  return `养了 ${Math.floor(days)} 天`
}

/** "18 小时" / "3 天" / "2 小时" — a duration in the largest sensible unit. */
function formatSpan(ms) {
  const hours = ms / 3_600_000
  if (hours < 1) return `${Math.max(1, Math.round(ms / 60000))} 分钟`
  if (hours < 48) return `${Math.round(hours)} 小时`
  return `${Math.round(hours / 24)} 天`
}

/** 0-100 through the current activity, for the scene's progress line. */
function activityProgress(activity, nowMs) {
  const span = activity.endsAt - activity.startedAt
  if (!Number.isFinite(span) || span <= 0) return 0
  return Math.max(0, Math.min(100, Math.round(((nowMs - activity.startedAt) / span) * 100)))
}

/** The runtime knows capability; the domain never opens extension modules. */
function achievementViews(store, state) {
  const installed = store.ext?.list(state) ?? []
  return achievementsView(state).map(item => {
    const source = installed.find(extension => extension.key === item.extension)
    return source?.eventVersion === 0 && item.availability === 'ready' ? { ...item, availability: 'update-required' } : item
  })
}

export function snapshot(store, options = {}) {
  const drain = options.drain !== false
  const state = store.freshen()
  const nowMs = Date.now()

  if (state === null) {
    return {
      ok: true, hatched: false, dead: false, pig: null,
      actions: actionsFor(null, nowMs),
      jobs: jobsFor(null),
      subjects: subjectsFor(null),
      interests: interestsFor(null),
      stages: stagesFor(null),
      trips: tripsFor(null),
      shop: shopFor(null),
      extensions: extensionsView(null),
      dress: [],
      dex: { forms: [], skins: [], fish: [], items: [], souvenirs: [], achievements: achievementsView(null) },
      skins: { current: 'default', entries: [] },
      inventory: inventoryView({ inventory: {} }),
      activity: null, canGoOut: false, awayBlocked: 'absent',
      daily: { canSignIn: false, signInDay: 1, signInTotal: 0, cycle: SIGN_IN_CYCLE, unclaimed: 0, onlineMinutes: 0 },
      diary: [],
      pomodoro: null,
      fishing: { pending: null, bag: [], period: '', autoTrips: 0, autoLeft: 2 },
      // The box has a size of its own; the client must not hard-code it.
      boxStage: boxStageView(),
      pending: [],
      reviveItem: REVIVE_ITEM.key, maxHealth: MAX.health,
      version: PACKAGE_VERSION,
    }
  }

  const life = formStageView(state, nowMs)
  const current = mood(state, nowMs)
  const illness = currentIllness(state)
  const activity = state.activity
  const pending = Array.isArray(state.pending) ? state.pending.slice() : []
  if (drain && pending.length > 0) store.drainPending()

  const daysLeft = daysToNextStage(state, nowMs)

  const forms = formsView(state)
  return {
    ok: true,
    // The REAL flag, not "a save exists". A box produced by reset/adopt has a
    // save but is not hatched, and conflating the two made the box un-pokeable.
    hatched: state.hatched === true,
    dead: state.dead === true,
    boxStage: boxStageView(),
    dialogue: dialogueView(state),
    // B9: the villager card.
    profile: profileView(state, nowMs),
    // 加冕: every form and how close the pig is to it.
    forms,
    skins: skinView(state),
    dex: { ...dexView(state, forms, nowMs), achievements: achievementViews(store, state) },
    timeScale: Number.isFinite(state.timeScale) ? state.timeScale : 1,
    pig: {
      name: state.name,
      sex: sexView(state),
      // The body follows the level (B2); age is only how long it has been here.
      stage: { key: life.key, label: life.label, emoji: life.emoji, size: life.size, line: life.line, art: life.art ?? null, artScenes: life.artScenes ?? [], faded: life.faded === true, actionArt: life.actionArt === true, hides: life.hides ?? [] },
      ageDays: Number(ageDays(state, nowMs).toFixed(2)),
      ageLabel: formatAge(ageDays(state, nowMs), state, nowMs),
      // Marked beside the age so a forced age is never mistaken for real growth.
      ageForced: state.ageForced === true,
      daysToNextStage: daysLeft === null ? null : Number(daysLeft.toFixed(2)),
      soul: hasSoul(state, nowMs),
      mood: current.key,
      moodEmoji: current.emoji,
      moodLabel: current.label,
      satiety: Math.round(state.satiety),
      happiness: Math.round(state.happiness),
      cleanliness: Math.round(state.cleanliness),
      health: state.health,
      healthPercent: healthPercent(state),
      weight: formatWeight(state.weightG),
      bodyWeight: bodyWeightView(state, nowMs),
      xp: state.xp,
      levelInfo: levelProgress(state.xp),
      coins: state.coins,
      traits: traitView(state),
      courses: courseView(state),
      souvenirs: souvenirsFor(state),
      stageLine: life.line,
      illness: illness === null ? null : {
        name: illness.name, chain: illness.chain, stage: illness.stage,
        cure: illness.cure, cureKey: illness.cureKey, cureEmoji: illness.cureEmoji,
        doctorFee: doctorFee(state),
      },
      memories: state.memories.slice(-3),
    },
    actions: actionsFor(state, nowMs),
    jobs: jobsFor(state),
    subjects: subjectsFor(state),
    interests: interestsFor(state),
    // B4: every subject has its own stage now, but the panel keeps the stage
    // tabs the owner liked; a stage is "open" once any subject has reached it.
    stages: stagesFor(state),
    trips: tripsFor(state),
    // 关掉的扩展的商品从商店撤下（背包里已有的照常保留）。
    shop: shopFor(state).filter(item => !disabledParts(state).shopKinds.has(item.kind)),
    // 内置扩展 + 下载来的扩展（store.ext 由 routes.js 建，见 store/ext-runtime.js）。
    extensions: [...extensionsView(state), ...(store.ext?.list(state) ?? [])],
    extViews: store.ext?.views(state) ?? {},
    extShelves: store.ext?.shelves?.(state) ?? [],
    extDex: store.ext?.dex?.(state) ?? [],
    dress: dressView(state),
    inventory: inventoryView(state),
    care: careView(state),
    activity: activity === null ? null : {
      kind: activity.kind,
      key: activity.key,
      label: activity.label,
      emoji: activity.emoji,
      cost: activity.cost ?? 0,
      secondsLeft: activitySecondsLeft(state, nowMs),
      // How far along, so the panel can draw the pig actually getting on with it.
      progress: activityProgress(activity, nowMs),
    },
    canGoOut: awayBlockedReason(state) === null,
    daily: dailyView(state, nowMs),
    diary: diaryView(state),
    pomodoro: pomodoroView(state, nowMs),
    fishing: fishingView(state, nowMs),
    awayBlocked: awayBlockedReason(state),
    pending,
    reviveItem: REVIVE_ITEM.key,
    maxHealth: MAX.health,
    version: PACKAGE_VERSION,
  }
}

function actionsFor(state, nowMs) {
  const out = {}
  for (const key of ACTION_ORDER) {
    const spec = ACTIONS[key]
    const wait = state === null ? 0 : actionCooldownSeconds(state, key, nowMs)
    const away = state !== null && !state.dead && state.activity !== null && key !== 'pet'
    out[key] = {
      label: spec.label,
      emoji: spec.emoji,
      ready: wait === 0 && !away && !(state?.dead === true),
      waitSeconds: wait,
      blocked: away ? 'away' : null,
    }
  }
  return out
}

function jobsFor(state) {
  const open = state !== null && awayBlockedReason(state) === null
  const traits = state?.traits ?? {}
  const facts = state === null ? { level: 1, lessons: {}, interests: {} } : jobFacts(state)
  return JOBS.map(job => {
    // Traits no longer gate a job (B4); they only scale its pay and shift.
    const points = state === null ? 0 : (traits[job.trait] ?? 0)
    const bonus = traitBonus(job.trait, points)
    // A locked job must say exactly what it wants, or the gate reads as a bug.
    const gate = jobRequirement(job, facts)
    const missing = gate === null ? [] : gate.missing.slice()
    return {
      key: job.key, label: job.label, emoji: job.emoji,
      trait: job.trait,
      traitLabel: TRAITS[job.trait].label,
      traitEmoji: TRAITS[job.trait].emoji,
      traitPoints: points,
      level: job.requires.level,
      minutes: Math.max(1, Math.round(job.minutes * bonus.minutes)),
      baseMinutes: job.minutes,
      coins: Math.round(job.coins * bonus.pay),
      baseCoins: job.coins,
      payPercent: Math.round((bonus.pay - 1) * 100),
      speedPercent: Math.round((1 - bonus.minutes) * 100),
      satiety: job.satiety,
      available: open,
      // `available` is "the pig is home"; `qualified` is "the pig has the schooling".
      qualified: gate === null ? true : gate.ok,
      missing,
      lockText: missing.map(entry => entry.text).join('、'),
      // The 详情 panel: every condition with a tick or a cross.
      requirements: jobChecklist(job, facts),
      cleanliness: job.cleanliness,
    }
  })
}

/**
 * 兴趣课：学习页里的一栏，随时能学，学完加三维；上满 CERTIFICATE_AFTER 次拿证（B4）。
 */
function interestsFor(state) {
  const open = state !== null && awayBlockedReason(state) === null
  const counts = state === null ? {} : interestView(state)
  return INTERESTS.map(entry => ({
    key: entry.key, label: entry.label, emoji: entry.emoji,
    trait: entry.trait, traitLabel: TRAITS[entry.trait].label, traitEmoji: TRAITS[entry.trait].emoji,
    minutes: entry.minutes, cost: entry.cost, gain: entry.gain, blurb: entry.blurb,
    times: counts[entry.key] ?? 0,
    certificate: entry.certificate,
    certificateAfter: CERTIFICATE_AFTER,
    certified: (counts[entry.key] ?? 0) >= CERTIFICATE_AFTER,
    available: open,
    affordable: state === null ? false : state.coins >= entry.cost,
  }))
}

/**
 * The stage tabs for the study page. `from`/`upTo` bound the lesson numbers a
 * stage covers; it is open once some subject has finished the stage below.
 */
function stagesFor(state) {
  const taken = state === null ? {} : courseView(state)
  const best = Math.max(0, ...Object.values(taken))
  let from = 0
  return SCHOOL_STAGES.map(stage => {
    const entry = {
      key: stage.key, label: stage.label, emoji: stage.emoji,
      minutes: stage.minutes, tuition: stage.tuition, gain: stage.gain,
      from, upTo: Number.isFinite(stage.upTo) ? stage.upTo : null,
      unlocked: best >= from,
      subjects: SUBJECTS.map(subject => subject.key),
      progress: best >= from ? null : { done: best, need: from, label: `任意一门课念完第 ${from} 节` },
    }
    from = Number.isFinite(stage.upTo) ? stage.upTo : from
    return entry
  })
}

/** The nine subjects with their lesson counts and what the next lesson is (B4). */
function subjectsFor(state) {
  const open = state !== null && awayBlockedReason(state) === null
  return studyView(state ?? {}).map(subject => ({
    ...subject,
    // Older panels read `level` as "times studied".
    level: subject.lessons,
    available: open,
    affordable: state === null ? false : state.coins >= subject.tuition,
  }))
}

function tripsFor(state) {
  const open = state !== null && awayBlockedReason(state) === null
  return TRIPS.map(trip => {
    // The rarest souvenir a destination can give, so the far trips advertise
    // what they are actually worth.
    const tiers = trip.souvenirs.map(entry => rarityByKey(entry.rarity))
    const best = tiers.reduce((a, b) => (b.price > a.price ? b : a), tiers[0])
    return {
      key: trip.key, label: trip.label, emoji: trip.emoji,
      minutes: trip.minutes, cost: trip.cost, happiness: trip.happiness,
      souvenirCount: trip.souvenirs.length,
      bestRarity: best.label,
      bestRarityEmoji: best.emoji,
      available: open,
      affordable: state === null ? false : state.coins >= trip.cost,
    }
  })
}

/** The collection, with each souvenir's rarity spelled out and priced. */
function souvenirsFor(state) {
  const list = Array.isArray(state?.souvenirs) ? state.souvenirs : []
  return list.map(entry => {
    const tier = rarityByKey(entry.rarity)
    return {
      key: entry.key,
      emoji: typeof entry.emoji === 'string' && entry.emoji !== '' ? entry.emoji : '🎁',
      label: typeof entry.label === 'string' && entry.label !== '' ? entry.label : entry.key,
      rarity: tier.key, rarityLabel: tier.label, rarityEmoji: tier.emoji, price: tier.price,
      story: typeof entry.story === 'string' ? entry.story : '',
      from: typeof entry.from === 'string' ? entry.from : null,
      fromLabel: typeof entry.fromLabel === 'string' ? entry.fromLabel : '',
    }
  })
}

function shopFor(state) {
  const neededCure = state === null ? null : (currentIllness(state)?.cureKey ?? null)
  const dress = new Map((state === null ? [] : dressView(state)).map(item => [item.key, item]))
  return SHOP.map(item => {
    // 家当 shows "already yours" or the level it waits for; the consumables
    // keep their price-and-count treatment.
    const owned = dress.get(item.key)?.owned === true
    const unlocked = item.kind === 'dress' ? dress.get(item.key)?.unlocked !== false : true
    return {
      key: item.key, label: item.label, emoji: item.emoji,
      price: item.price, kind: item.kind, tier: item.tier ?? null,
      level: item.level ?? null,
      owned,
      worn: dress.get(item.key)?.worn === true,
      unlocked,
      blurb: item.blurb ?? '',
      useLabel: item.useLabel ?? '使用',
      affordable: state === null ? false : state.coins >= item.price,
      // The one cure the pig needs right now (B3: a medicine per illness stage).
      needed: neededCure !== null && item.key === neededCure,
      cureAll: item.cureAll === true,
    }
  })
}

// ---------------------------------------------------------------------------
// Slash command (the fallback path)
// ---------------------------------------------------------------------------
