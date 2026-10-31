// @ts-check
/**
 * 存档字段归属的唯一声明表：同一主人的共有资源、每猪本体、格式元数据，
 * 以及本切片明确保持不裁决的旧扩展/未知数据。
 *
 * 这张表只回答“这个路径归谁”，不复述 core 的合并策略。`MERGE_RULES` 的
 * sum/max/union 仍只是合并时如何组合值，不能反推共享或每猪归属。
 *
 * `extData` 中除 `extData.farm` 外的键属于**旧扩展不透明命名空间**：只在
 * 主人文档里保留一份，绝不按猪复制，也不声称它们已经是共享家当。未来由
 * 扩展 manifest 显式声明归属后再迁移；本切片不猜。
 *
 * @module dsh-piggy/store/state-ownership
 */

/**
 * 同一主人共用的已确认路径。列表是完整声明（不是 F01 的非穷尽子集），
 * 但仍是**已裁决子集**：未列出的字段进入 legacy-opaque，而不是自动归猪。
 */
export const OWNER_RESOURCE_PATHS = Object.freeze([
  'coins',
  'wallets',
  'inventory',
  'dress',
  'customSkins',
  'dex',
  'souvenirs',
  'achievements',
  'daily',
  'extensions',
  'extensionsRemoved',
  'extData.farm',
  'economy.totals',
  'economy.days',
  'fishing.bag',
  'fishing.seq',
  'fishing.autoDay',
  'fishing.autoTrips',
  'fishing.rod',
  'fishing.spots',
  'fishing.automation',
])

/**
 * 每猪独立的本体/选择/当前活动/成长路径。`economy` 与 `fishing` 是混合对象，
 * 只把其中已确认的子路径放进来；不能把整个容器复制给每只猪。
 */
export const PIG_BODY_PATHS = Object.freeze([
  'name',
  'bornAt',
  'hatched',
  'dead',
  'diedAt',
  'stage',
  'form',
  'skin',
  'bodyWeight',
  'ageMs',
  'timeScale',
  'ageForced',
  'xp',
  'weightG',
  'satiety',
  'happiness',
  'cleanliness',
  'health',
  'criticalDoctorVisits',
  'worn',
  'traits',
  'lessons',
  'interests',
  'illness',
  'activity',
  'outingStreak',
  'restMinutes',
  'lastFedAt',
  'lastActiveAt',
  'lastSeenAt',
  'settledUpTo',
  'cooldowns',
  'pending',
  'pendingSeq',
  'dialogue',
  'memories',
  'stats',
  'diary',
  'pomodoro',
  'personality',
  'catchphrase',
  'motto',
  'birthday',
  'profileEdits',
  'isOfflineFeedEnabled',
  'realWorkGrowth',
  'seed',
  'economy.fatigue',
  'fishing.pending',
  'fishing.spot',
])

/**
 * 旧存档里未裁决的数据：保留在原主人文档中一次，不按猪复制。
 * 这是显式的不透明命名空间，不是“未列入主人清单就归猪”的补集。
 */
export const LEGACY_OPAQUE_PATHS = Object.freeze([
  'extData.* except extData.farm',
  'unknown top-level fields',
  'unknown economy.* subpaths',
  'unknown fishing.* subpaths',
])

/** 持久化格式元数据；既不是主人资源，也不是猪本体。 */
export const FORMAT_PATHS = Object.freeze(['version'])

/**
 * 混合容器的逐字段归属。代码只读这张表；新增路径必须在这里显式登记，
 * 否则会落到 legacy-opaque，而不是被猜成主人或猪。
 */
export const MIXED_CONTAINER_RULES = Object.freeze({
  economy: Object.freeze({
    owner: Object.freeze(['totals', 'days']),
    pig: Object.freeze(['fatigue']),
    materializeKnownKeys: true,
  }),
  fishing: Object.freeze({
    owner: Object.freeze(['bag', 'seq', 'autoDay', 'autoTrips', 'rod', 'spots', 'automation']),
    pig: Object.freeze(['pending', 'spot']),
    materializeKnownKeys: true,
  }),
  // `extData` is the legacy extension namespace: only `farm` is a confirmed
  // owner resource. Other keys stay in the owner legacy-opaque bucket, are
  // never cloned per pig, and are not claimed as shared gameplay state.
  extData: Object.freeze({
    owner: Object.freeze(['farm']),
    pig: Object.freeze([]),
    // Do not materialize `farm` when there is no farm data: Object.keys(extData)
    // is how the save/archive layer lists installed extension data.
    materializeKnownKeys: false,
  }),
})

export const MIXED_CONTAINER_KEYS = Object.freeze(Object.keys(MIXED_CONTAINER_RULES))

function topLevelPaths(paths) {
  const out = []
  for (const path of paths) {
    const key = path.split('.')[0]
    if (!out.includes(key)) out.push(key)
  }
  return out
}

/** 纯主人顶层键（不含 economy/fishing 混合容器，含 extData 旧命名空间容器）。 */
export const OWNER_TOP_LEVEL_KEYS = Object.freeze(
  topLevelPaths(OWNER_RESOURCE_PATHS).filter(key => !MIXED_CONTAINER_KEYS.includes(key)),
)

/** 纯猪顶层键（不含 economy/fishing 混合容器）。 */
export const PIG_TOP_LEVEL_KEYS = Object.freeze(
  topLevelPaths(PIG_BODY_PATHS).filter(key => !MIXED_CONTAINER_KEYS.includes(key)),
)

const OWNER_TOP_LEVEL = new Set(OWNER_TOP_LEVEL_KEYS)
const PIG_TOP_LEVEL = new Set(PIG_TOP_LEVEL_KEYS)
const FORMAT_KEYS = new Set(FORMAT_PATHS)
const MIXED_KEYS = new Set(MIXED_CONTAINER_KEYS)

/** @param {string} key */
export const isOwnerTopLevel = key => OWNER_TOP_LEVEL.has(key)
/** @param {string} key */
export const isPigTopLevel = key => PIG_TOP_LEVEL.has(key)
/** @param {string} key */
export const isFormatKey = key => FORMAT_KEYS.has(key)
/** @param {string} key */
export const isMixedContainer = key => MIXED_KEYS.has(key)

