// @ts-check
/**
 * 疾病链、药与发病 —— 静态数值表（零逻辑、零 IO，见 docs/CONVENTIONS.md）。
 *
 * 数字全部来自 docs/numbers/B3-illness.md（用户 2026-10-01 确认）。
 * 链与药名照 QQ 宠物怀旧服 State.js；头晕、皮肤两条是原版有药没接上的链，
 * 头晕缺的第 3 级补了「神经衰弱 · 噗噗神水」。
 *
 * @module dsh-piggy/data/illness
 */

/** 状态阈值：饿、脏、孤单（心情）。发病、成长、心情显示共用。 */
export const THRESHOLDS = Object.freeze({
  hungry: 25,
  dirty: 35,
  lonely: 35,
})

// ---------------------------------------------------------------------------
// Illness is measured in DAYS, not in minutes. A stage used to last 25 minutes
// and a cold killed the pig inside two hours unless you were watching.
// ---------------------------------------------------------------------------

/**
 * How long each stage lasts, in hours, indexed by stage - 1. Untreated, the
 * ladder runs 1 + 1.5 + 2 + 3 days.
 */
export const ILLNESS_STAGE_HOURS = Object.freeze([24, 36, 48, 72])

export const ILLNESS_STAGE_MINUTES = ILLNESS_STAGE_HOURS[0] * 60

/** Milliseconds one stage lasts. */
export const illnessStageMs = stage => (ILLNESS_STAGE_HOURS[stage - 1] ?? 24) * 3_600_000

/**
 * Chance an untreated illness shakes itself off when a stage would otherwise
 * pass, by stage. The last stage never does — it needs medicine or it is fatal.
 */
export const SELF_HEAL_CHANCE = Object.freeze([0.25, 0.12, 0.05, 0])

/** A sick pig works at half pay, so being ill has a cost without being a wall. */
export const SICK_PAY_MULTIPLIER = 0.5

/** Being out while ill runs the illness clock twice as fast. */
export const SICK_AWAY_MULTIPLIER = 2

export const SLEEPY_AFTER_MINUTES = 30

/** Away from home the pig burns through its bars faster. */
export const AWAY_MULTIPLIER = 1.8

/** Health left at each illness stage (1..4): 4, 3, 2, 1. */
export const STAGE_HEALTH = Object.freeze([4, 3, 2, 1])

// ---------------------------------------------------------------------------
// Medicine: one per illness stage, priced by how bad the stage is.
// ---------------------------------------------------------------------------

/** 1–4 级药的价格。 */
export const MEDICINE_PRICE_BY_TIER = Object.freeze([30, 70, 140, 260])

const medicine = (key, label, emoji, tier) =>
  Object.freeze({ key, label, emoji, tier, price: MEDICINE_PRICE_BY_TIER[tier - 1], kind: 'medicine' })

const stage = (name, cure) => Object.freeze({ name, cure })

/**
 * Five chains, four stages each. `cure` is the medicine item for that stage;
 * `cause` is what tends to bring the chain on (see ILLNESS_ONSET).
 */
export const ILLNESS_CHAINS = Object.freeze([
  Object.freeze({
    key: 'cold', name: '感冒', emoji: '🤧', cause: '饿',
    stages: Object.freeze([
      stage('感冒', medicine('banlangen', '板蓝根', '🌿', 1)),
      stage('发烧', medicine('tuishaoyao', '退烧药', '💊', 2)),
      stage('重感冒', medicine('yinqiaowan', '银翘丸', '🟤', 3)),
      stage('肺炎', medicine('jinse-xiaoyan', '金色消炎水', '🧪', 4)),
    ]),
  }),
  Object.freeze({
    key: 'cough', name: '咳嗽', emoji: '😷', cause: '脏',
    stages: Object.freeze([
      stage('咳嗽', medicine('pipa-syrup', '枇杷糖浆', '🍯', 1)),
      stage('支气管炎', medicine('gancaoji', '甘草剂', '🌾', 2)),
      stage('哮喘', medicine('dingchuanwan', '定喘丸', '⚪', 3)),
      stage('肺结核', medicine('tongfengsan', '通风散', '🫙', 4)),
    ]),
  }),
  Object.freeze({
    key: 'stomach', name: '肠胃', emoji: '🤢', cause: '吃撑',
    stages: Object.freeze([
      stage('肚子胀', medicine('xiaoshipian', '消食片', '💊', 1)),
      stage('胃炎', medicine('lanse-xiaoyan', '蓝色消炎水', '🧪', 2)),
      stage('胃溃疡', medicine('longdancao', '龙胆草', '🌱', 3)),
      stage('胃癌', medicine('xianrentang', '仙人汤', '🍵', 4)),
    ]),
  }),
  Object.freeze({
    key: 'dizzy', name: '头晕', emoji: '😵', cause: '心情差、连续打工上课',
    stages: Object.freeze([
      stage('头晕', medicine('qingliangyou', '清凉油', '🟢', 1)),
      stage('偏头痛', medicine('zhitongpian', '止痛片', '💊', 2)),
      stage('神经衰弱', medicine('pupu-shenshui', '噗噗神水', '🫧', 3)),
      stage('心力衰竭', medicine('heshouwu', '何首乌', '🥔', 4)),
    ]),
  }),
  Object.freeze({
    key: 'skin', name: '皮肤', emoji: '🩹', cause: '很脏',
    stages: Object.freeze([
      stage('瘙痒', medicine('runfulu', '润肤露', '🧴', 1)),
      stage('干裂', medicine('bohe-you', '薄荷油', '🍃', 2)),
      stage('溃疡', medicine('shengjigao', '生肌膏', '🩹', 3)),
      stage('感染', medicine('chashu-you', '茶树油', '🌳', 4)),
    ]),
  }),
])

/** Chain index by key. */
export const CHAIN_INDEX = Object.freeze(Object.fromEntries(ILLNESS_CHAINS.map((chain, index) => [chain.key, index])))

/** 百草丹：任何病、任何一级都能治。 */
export const CURE_ALL = Object.freeze({ key: 'baicaodan', label: '百草丹', emoji: '🌿', price: 500, kind: 'medicine', cureAll: true })

/** Every medicine on the shelf: the twenty stage cures, then 百草丹. */
export const MEDICINES = Object.freeze([
  ...ILLNESS_CHAINS.flatMap(chain => chain.stages.map(entry => entry.cure)),
  CURE_ALL,
])

/** 还魂丹：复活，并治好所有病。 */
export const REVIVE_ITEM = Object.freeze({ key: 'soul', label: '还魂丹', emoji: '✨', price: 800, kind: 'revive' })

/** 看医生：不用自己买药，按对症药价的这个倍数收费直接治好。 */
export const DOCTOR_MARKUP = 1.5

// ---------------------------------------------------------------------------
// Falling ill: a chance each hour at home, not a certainty.
// ---------------------------------------------------------------------------

/**
 * 2026-10-01 用户要求病得慢一点：饿、脏各从 8%/h 降到 3%/h
 * （又饿又脏时中位数约 4 小时 → 约 11 小时）。
 */
export const ILLNESS_ONSET = Object.freeze({
  /** Even a well-kept pig: about one small illness every three weeks. */
  basePerHour: 0.002,
  /** Hungry (satiety < THRESHOLDS.hungry) → 感冒. */
  hungryPerHour: 0.03,
  /** Dirty (cleanliness < THRESHOLDS.dirty) → 咳嗽; below veryDirty → 皮肤. */
  dirtyPerHour: 0.03,
  veryDirty: 15,
  /** Mood below sadBelow → 头晕. */
  sadBelow: 30,
  sadPerHour: 0.05,
  /** This many outings in a row with no rest between → 头晕. */
  overworkStreak: 3,
  overworkPerHour: 0.05,
  /** Minutes at home that count as a rest and reset the streak. */
  restMinutes: 60,
  /** Feeding a pig already at overfullAt satiety → 肠胃, with this chance.
   *  G2（用户 2026-10-05 确认）：已经 100% 还硬喂才可能胀气，概率 25% → 15%。 */
  overfullAt: 100,
  overfeedChance: 0.15,
})

/**
 * The illness at `chainIndex`/`stageNumber`, with its cure spelled out.
 * @returns {{chain: string, chainKey: string, stage: number, name: string, cure: string, cureKey: string, cureEmoji: string, curePrice: number, health: number}|null}
 */
export function illnessAt(chainIndex, stageNumber) {
  const chain = ILLNESS_CHAINS[chainIndex]
  if (chain === undefined) return null
  const entry = chain.stages[stageNumber - 1]
  if (entry === undefined) return null
  return {
    chain: chain.name,
    chainKey: chain.key,
    stage: stageNumber,
    name: entry.name,
    cure: entry.cure.label,
    cureKey: entry.cure.key,
    cureEmoji: entry.cure.emoji,
    curePrice: entry.cure.price,
    health: STAGE_HEALTH[stageNumber - 1],
  }
}

export const nextIllness = (chainIndex, stageNumber) => illnessAt(chainIndex, stageNumber + 1)
