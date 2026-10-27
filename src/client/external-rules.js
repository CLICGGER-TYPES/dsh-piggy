// @ts-check
/**
 * 外部桌宠的纯规则：卡片文案、两猪可选动作、强制终结后果、身份选择默认值与校验。
 *
 * 这里不碰 DOM、不发请求，只按设计 4.1-4.12 和附录 B 把后端给的形状翻成界面能用的判断。
 * 规则都以用户已确认的最终稿为准，不在这里另立新规。
 * @module dsh-piggy/client/external-rules
 */

/**
 * 合并时名字上限。设计稿写 1-16，但当前 v15 的 PET_NAME_MAX 是 5，
 * 后端合并按 5 校验（external-ambiguities.md 第 1 条）；界面跟当前代码，
 * 否则会造出普通改名改不了的名字。root 若改回 16，这里和 PET_NAME_MAX 一起改。
 */
export const NAME_MAX = 5

/** 数字按千分位显示；不用 toLocaleString，免得测试机语言不同结果不同。 */
export function formatNumber(value) {
  const text = String(Math.trunc(Number(value) || 0))
  return text.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
/** 猪的一行摘要。缺字段就少写一段，不编数字。 */
export function summaryLine(summary) {
  if (summary === null || summary === undefined || summary.exists !== true) return '还没有猪'
  if (summary.state === 'box' || (summary.hatched !== true && summary.dead !== true && summary.box)) return '纸盒（还没拆）'
  if (summary.dead) return '已离开'
  const parts = [summary.name === '' ? '未命名' : summary.name]
  if (summary.level > 0) parts.push('Lv.' + summary.level)
  if (summary.days > 0) parts.push(summary.days + ' 天')
  parts.push('🪙' + formatNumber(summary.coins))
  parts.push('🎒' + summary.items)
  parts.push('🏅' + summary.badges)
  return parts.join(' · ')
}
/** 一只猪是活的、纸盒、墓碑、没有，还是读不出来。 */
export function pigKind(summary) {
  if (summary === null || summary === undefined) return 'unknown'
  if (summary.exists !== true) return 'none'
  if (summary.dead === true) return 'dead'
  if (summary.hatched === true) return 'alive'
  if (summary.box === true || summary.state === 'box') return 'box'
  return 'unknown'
}

/**
 * 4.3 的表：两边的猪怎么处理。unknown 一律不合并，宁可让用户先升级/重试。
 * @returns {{canConnect: boolean, canMerge: boolean, mergeLabel: string, note: string, warn: string}}
 */
export function mergeOptions(target, local) {
  const t = pigKind(target)
  const s = pigKind(local)
  const none = { canConnect: true, canMerge: false, mergeLabel: '合并', note: '', warn: '' }
  if (t === 'unknown' || s === 'unknown') return { ...none, note: '读不到两边小猪的状态；先更新两端再试' }
  if (t === 'alive' && s === 'alive') return { ...none, canMerge: true, mergeLabel: '合并' }
  if (t === 'alive' && s === 'dead') return { ...none, canMerge: true, note: '内嵌猪已经离开；合并后以桌宠为准，内嵌猪的物品和徽章保留' }
  if (t === 'alive' && s === 'box') return { ...none, note: '内嵌猪还没拆盒，想合并的话先拆盒' }
  if (t === 'alive' && s === 'none') return { ...none, note: 'DSH 里还没有猪，没有可合并的数据' }
  if ((t === 'box' || t === 'none') && s === 'alive') {
    return { ...none, canMerge: true, mergeLabel: '搬到桌宠', note: t === 'none' ? '桌面还没有存档，只搬内嵌猪过去，不补初始金币' : '桌宠的纸盒初始金币也会加进来' }
  }
  if (t === 'dead' && s === 'alive') return { ...none, canMerge: true, note: '桌面上的猪已经离开；合并后以内嵌猪为准，桌宠的物品和徽章保留' }
  if (t === 'dead' && (s === 'dead' || s === 'box' || s === 'none')) {
    return { ...none, note: '两只小猪都已经离开；请先在桌面版复活/领养，或使用存档导入' }
  }
  if ((t === 'box' || t === 'none') && (s === 'box' || s === 'none')) {
    return { ...none, note: '两边都还没拆盒；先连接，或先在任意一边拆盒' }
  }
  if ((t === 'box' || t === 'none') && s === 'dead') {
    return { ...none, note: '合并至少需要一只活着且已孵化的小猪' }
  }
  return none
}
/** 4.1 顶部标签：「桌面猪 · 已连接」等。 */
export function linkLabel(link) {
  if (link === null || link === undefined) return ''
  if (link.dead === true) return '桌面猪 · 已离开'
  if (link.state === 'merging') return '桌面猪 · 正在合并'
  if (link.state === 'connected') return link.merged === true ? '桌面猪 · 已连接（已合并）' : '桌面猪 · 已连接'
  if (link.state === 'connecting') return '桌面猪 · 正在连接'
  return '桌面猪 · 连接中断'
}
/** 顶栏那一刻的时间；只用来解释「最后更新」，不假装是实时数据。 */
export function clockText(timestamp) {
  if (typeof timestamp !== 'number' || !isFinite(timestamp) || timestamp <= 0) return ''
  const date = new Date(timestamp)
  const pad = value => String(value).padStart(2, '0')
  return pad(date.getHours()) + ':' + pad(date.getMinutes())
}

/** 4.9 断线提示条：最后更新、正在重连、队列条数。 */
export function linkNote(link) {
  if (link === null || link === undefined) return ''
  const parts = []
  const at = clockText(link.lastAt)
  if (at !== '') parts.push('最后更新 ' + at)
  if (link.state === 'reconnecting') parts.push('正在重连')
  else if (link.state === 'disconnected') parts.push('正在重连')
  else if (link.state === 'connecting') parts.push('正在连接')
  if (link.queued > 0) parts.push('工作事件在排队（' + link.queued + ' 条）')
  return parts.length === 0 ? '桌面版没开，动作没有执行。' : parts.join(' · ') + '。'
}

/**
 * 4.4 每种进行中活动强制终结后的结果与二次确认文案。
 * 数字（学费、旅费、鱼饵）用后端实际值，后端没给就不写死。
 * @param {{kind: string, finished: boolean, refund: number, bait: number, phase: string}} blocker
 */
export function blockerCopy(blocker) {
  const money = blocker.refund > 0 ? blocker.refund + ' 金币' : '学费/旅费'
  const bait = blocker.bait > 0 ? String(blocker.bait) : 'N'
  switch (blocker.kind) {
    case 'work':
      return blocker.finished
        ? { done: true, title: '这班已经到点，按完成结算后继续。' }
        : { done: false, title: '这班还没做完，提前回来拿不到工资，也不算一次打工。其他状态不变。' }
    case 'study':
    case 'interest':
      return blocker.finished
        ? { done: true, title: '这节课已经到点，按完成结算后继续。' }
        : { done: false, title: '这节课提前结束，' + money + '退回；这节课不算次数，也不加属性。' }
    case 'trip':
      return blocker.finished
        ? { done: true, title: '这次旅行已经到点，按完成结算后继续。' }
        : { done: false, title: '这次旅行提前结束，' + money + '退回；纪念品和旅行记录都不会有。' }
    case 'fishing-auto':
      return blocker.finished
        ? { done: true, title: '自动钓鱼已经到点，先收竿结算，再继续合并。' }
        : { done: false, title: '提前收竿，退回 ' + bait + ' 个鱼饵；这次不会钓到鱼。' }
    case 'pomodoro':
      return blocker.finished
        ? { done: true, title: '已经到点，按完成结算后继续。' }
        : { done: false, title: '还没到点，拿不到专注奖励，今天完成数也不加；免打扰会恢复。' }
    case 'fishing-manual':
      if (blocker.phase === 'caught') return { done: true, title: '先把这条鱼收进鱼篓，再继续合并。' }
      return { done: false, title: '收竿放弃？鱼会跑掉，抛竿用掉的 1 个鱼饵不退，图鉴和次数都不加。' }
    case 'activity':
      // 契约只给「activity」+ 名字，不细分打工/上课/旅行；这里不编具体后果，只说明会提前结束。
      return blocker.finished
        ? { done: true, title: '这项活动已经到点，先按完成结算再继续。' }
        : { done: false, title: '这项活动还没结束；强制终结会提前收尾，报酬和次数按结束时的实际结果算。' }
    default:
      return { done: false, title: '桌面版/DSH 版本不支持这种状态，请先更新或去对应端处理' }
  }
}

/** 哪些活动可以强制终结；未知瞬态不猜、不硬清。 */
export function canForce(blocker) {
  return ['work', 'study', 'interest', 'trip', 'fishing-auto', 'pomodoro', 'fishing-manual', 'activity'].includes(blocker.kind)
}

/** 预览请求失败/被挡时给人看的话。 */
export function reasonText(reason) {
  const table = {
    'not-connected': '桌面版没连上，先重新连接',
    'connect-failed': '没能连上，内嵌猪没有切换',
    'invalid-choices': '选择里有不合法的字段，请回到预览改选',
    'desktop-busy': '桌面版正忙，请稍后再试',
    disconnected: '桌面版没开，先重新连接',
    'external-disabled': '桌面版没开「允许 DSH 联动」',
    'pair-unavailable': '桌面版只开了工作接口，请在桌面设置里允许 DSH 联动',
    'version-mismatch': '两边的版本对不上，先更新到同一版',
    'rule-version': '合并规则版本不同，先更新到同一版',
    'no-pig': '至少需要一只活着且已孵化的小猪',
    'blocked-activity': '两边还有进行中的活动，先结束',
    expired: '预览已经过期，请重新预览',
    'preview-missing': '预览已经不在桌面版上，请重新预览',
    'runtime-changed': '桌面版重载过，请重新预览',
    changed: '预览后桌面猪有新的操作，请重新预览',
    'merge-busy': '桌面版正在处理另一次合并',
    'backup-failed': '备份失败，没有改动任何存档',
    declined: '桌面版拒绝了这次合并',
    'tx-failed': '合并失败，已恢复合并前的桌宠；内嵌猪原样保留',
    'retire-failed': '桌宠已合并，但内嵌猪退役没完成',
    'cleanup-failed': '旧合并备份没清理掉，不影响这次合并',
    'merge-unknown': '正在确认合并结果，请不要操作',
    'no-merge': '没有可撤销的合并',
    'unsupported': '桌面版/DSH 版本不支持这个操作',
    // 契约里的失败码（external-contract.md 第 2、6 节）
    'preview-expired': '预览已经过期，请重新预览',
    'unknown-preview': '预览已被替换或取消，请重新预览',
    'unknown-source-fields': '内嵌存档有当前版本不认识的字段，请先选丢弃或中止',
    'unknown-source-aborted': '因为你选择中止，这次合并没有执行',
    'version-too-new': '桌面版存档版本更高，先更新 DSH',
    'rules-too-new': '合并规则版本不同，先更新到同一版',
    'source-backup-failed': 'DSH 本地备份失败，没有改动任何存档',
    'no-backup': '找不到可用的合并备份',
    'bad-token': '预览令牌对不上，请重新预览',
    'source-paused': '内嵌猪已暂存，先切回内嵌猪再终结这项活动',
    'queue-not-empty': '工作事件还在队列里，先选择等待送达或丢弃',
    'state-changed': '暂存期间内嵌存档被改过，确认后才能切回',
    'already-merged': '内嵌猪已经合并退役，只能只恢复内嵌猪或撤销合并',
    'no-source-pig': 'DSH 里还没有可合并的猪',
    'preview-failed': '桌面版没能生成预览，请重新检测',
    'missing-marker': '找不到桌面版的发现文件，请确认桌面版已打开联动',
    'not-active': '这次合并不是最近一次，不能撤销',
    'restore-failed': '恢复内嵌猪失败，退役标记会保留',
    partial: '部分撤销：只恢复了一边',
    'radio': '',
  }
  const key = typeof reason === 'string' ? reason : ''
  return table[key] ?? (key.startsWith('pair-') ? '桌面版配对接口连不上，先确认联动已打开' : reason.startsWith('work-') ? '桌面版工作接口连不上，先确认联动已打开' : '操作没完成（' + key + '）')
}

/** 身份组默认值：基础身份方；偏好默认桌面方。 */
export function defaultChoices(preview) {
  const find = key => preview.choices.find(entry => entry.key === key) ?? null
  const pickOf = (key, fallback) => {
    const entry = find(key)
    return entry !== null && (entry.default === 'source' || entry.default === 'target') ? entry.default : fallback
  }
  const namePick = pickOf('name', 'target')
  const lookPick = pickOf('look', 'target')
  const personalityPick = pickOf('personality', 'target')
  const prefPick = pickOf('preferences', 'target')
  const nameEntry = find('name')
  const nameValue = nameEntry !== null && typeof nameEntry.value === 'string'
    ? nameEntry.value
    : (namePick === 'source' ? preview.source.name : preview.target.name)
  const initial = (key, side) => {
    const entry = find(key)
    if (entry === null || !isPlainObject(entry.value)) return null
    const valueSide = entry.value.side === 'source' ? 'source' : 'target'
    return valueSide === side ? entry.value : null
  }
  const lookValue = initial('look', lookPick) ?? {}
  const personValue = initial('personality', personalityPick) ?? {}
  const prefValue = initial('preferences', prefPick) ?? {}
  const conflicts = {}
  const hasUnknown = (preview.conflicts ?? []).some(conflict => conflict.key === 'unknownSource')
  for (const conflict of preview.conflicts ?? []) {
    if (conflict.level === 'warning' || conflict.key === 'unknownSource' || conflict.key === '') continue
    conflicts[conflict.key] = conflict.default === 'source' ? 'source' : 'target'
  }
  return {
    name: { pick: namePick, value: nameValue },
    look: {
      pick: lookPick,
      form: typeof lookValue.form === 'string' ? lookValue.form : '',
      skin: typeof lookValue.skin === 'string' ? lookValue.skin : '',
      worn: Array.isArray(lookValue.worn) ? lookValue.worn.filter(value => typeof value === 'string') : [],
      wornText: Array.isArray(lookValue.worn) ? lookValue.worn.join(',') : '',
    },
    personality: {
      pick: personalityPick,
      personality: typeof personValue.personality === 'string' ? personValue.personality : '',
      catchphrase: typeof personValue.catchphrase === 'string' ? personValue.catchphrase : '',
      motto: typeof personValue.motto === 'string' ? personValue.motto : '',
      birthday: birthdayText(personValue.birthday),
    },
    preferences: {
      pick: prefPick,
      ownerName: typeof prefValue.ownerName === 'string' ? prefValue.ownerName : '',
      quiet: prefValue.quiet === true,
      isOfflineFeedEnabled: prefValue.isOfflineFeedEnabled !== false,
      timeScale: typeof prefValue.timeScale === 'number' ? prefValue.timeScale : 1,
      spot: typeof prefValue.spot === 'string' ? prefValue.spot : '',
    },
    conflicts,
    unknownSource: hasUnknown ? null : undefined,
    duplicate: null,
  }
}

const isPlainObject = value => typeof value === 'object' && value !== null && !Array.isArray(value)
function birthdayText(value) {
  if (typeof value === 'string') return value
  if (isPlainObject(value) && value.month > 0 && value.day > 0) return value.month + '/' + value.day
  return ''
}

/** 把某一边的值读出来，供「改…」初始化和校验。 */
export function sideValues(preview, side) {
  const source = preview.sides?.[side] ?? {}
  return {
    name: typeof source.name === 'string' ? source.name : '',
    form: typeof source.form === 'string' ? source.form : '',
    skin: typeof source.skin === 'string' ? source.skin : '',
    worn: Array.isArray(source.worn) ? source.worn.filter(value => typeof value === 'string') : [],
    personality: typeof source.personality === 'string' ? source.personality : '',
    catchphrase: typeof source.catchphrase === 'string' ? source.catchphrase : '',
    motto: typeof source.motto === 'string' ? source.motto : '',
    birthday: typeof source.birthday === 'string' ? source.birthday : '',
    ownerName: typeof source.ownerName === 'string' ? source.ownerName : '',
    quiet: source.quiet === true,
    isOfflineFeedEnabled: source.isOfflineFeedEnabled !== false,
    timeScale: typeof source.timeScale === 'number' ? source.timeScale : 1,
    spot: typeof source.spot === 'string' ? source.spot : (typeof source.fishing === 'object' && source.fishing !== null ? String(source.fishing.spot ?? '') : ''),
    known: Object.keys(source).length > 0,
  }
}

/** 预览这一边有没有具体值；契约暂时只给默认边（见 notes）。 */
export function sideKnown(preview, side) {
  return Object.keys(preview.sides?.[side] ?? {}).length > 0
}

const cleanText = value => (typeof value === 'string' ? value.trim() : '')

/** 预览里的选择是否合法。返回字段级错误，界面据此标红并禁用提交。 */
export function validateChoices(preview, choices) {
  const errors = {}
  const name = cleanText(choices.name.value)
  if (choices.name.pick === 'custom') {
    if (name.length === 0) errors.name = '名字不能为空'
    else if (name.length > NAME_MAX) errors.name = '名字最多 ' + NAME_MAX + ' 个字符'
  }
  if (choices.look.pick === 'custom') {
    const forms = optionKeys(preview.editors?.look?.form)
    const skins = optionKeys(preview.editors?.look?.skin)
    const worn = optionKeys(preview.editors?.look?.worn)
    if (forms.length > 0 && choices.look.form !== '' && !forms.includes(choices.look.form)) errors.look = '这个形态不在合并后的图鉴里'
    else if (skins.length > 0 && choices.look.skin !== '' && !skins.includes(choices.look.skin)) errors.look = '这个皮肤不在合并后的皮肤表里'
    else if (worn.length > 0 && choices.look.worn.some(key => !worn.includes(key))) errors.look = '穿戴里有合并后没有的东西'
  }
  if (choices.personality.pick === 'custom') {
    const people = optionKeys(preview.editors?.personality?.personality)
    const phrase = cleanText(choices.personality.catchphrase)
    const motto = cleanText(choices.personality.motto)
    if (cleanText(choices.personality.personality) === '') errors.personality = '请选一个性格'
    else if (people.length > 0 && !people.includes(choices.personality.personality)) errors.personality = '这个性格不可用'
    else if (phrase.length < 1 || phrase.length > 6) errors.personality = '口头禅要 1-6 个字'
    else if (motto.length < 1 || motto.length > 24) errors.personality = '签名要 1-24 个字'
    else if (choices.personality.birthday.trim() !== '' && !validBirthday(choices.personality.birthday)) errors.personality = '生日格式不对（月/日）'
  }
  if (choices.preferences.pick === 'custom') {
    const spots = optionKeys(preview.editors?.preferences?.spot)
    if (cleanText(choices.preferences.ownerName).length < 1 || cleanText(choices.preferences.ownerName).length > 12) errors.preferences = '称呼要 1-12 个字'
    else if (!(choices.preferences.timeScale > 0 && choices.preferences.timeScale <= 365)) errors.preferences = '时间倍率要大于 0 且不超过 365'
    else if (spots.length > 0 && choices.preferences.spot !== '' && !spots.includes(choices.preferences.spot)) errors.preferences = '这个钓点还没解锁'
  }
  if (preview.duplicate !== null && choices.duplicate === null) errors.duplicate = '这两只猪可能是同一份存档的副本，请先选一项'
  if (choices.unknownSource === null) errors.unknownSource = '内嵌存档有当前版本不认识的字段，请先选丢弃或中止'
  return { ok: Object.keys(errors).length === 0, errors }
}

function optionKeys(list) {
  if (!Array.isArray(list)) return []
  return list.map(entry => (typeof entry === 'string' ? entry : entry !== null && typeof entry === 'object' ? String(entry.key ?? '') : '')).filter(Boolean)
}

/** 生日接受 M/D 或 MMDD；空字符串按「不改」通过。 */
function validBirthday(value) {
  const text = cleanText(value)
  if (text === '') return true
  const match = /^(\d{1,2})\s*[\/.-]\s*(\d{1,2})$/.exec(text)
  if (match === null) return false
  const month = Number(match[1])
  const day = Number(match[2])
  return month >= 1 && month <= 12 && day >= 1 && day <= 31
}

/**
 * 提交给宿主的 choices（契约第 4 节）：选边只带 side，选「自己改」才带编辑值。
 * 生日转成 {month,day}，扩展冲突键从 ext:<key> 还原成 <key>。
 */
export function choicesPayload(choices) {
  const payload = {
    name: choices.name.pick === 'custom'
      ? { side: 'custom', value: cleanText(choices.name.value) }
      : { side: choices.name.pick },
    look: choices.look.pick === 'custom'
      ? { side: 'custom', form: choices.look.form === '' ? null : choices.look.form, skin: choices.look.skin === '' ? 'default' : choices.look.skin, worn: choices.look.worn.slice(0) }
      : { side: choices.look.pick },
    personality: choices.personality.pick === 'custom'
      ? {
          side: 'custom',
          personality: cleanText(choices.personality.personality),
          catchphrase: cleanText(choices.personality.catchphrase),
          motto: cleanText(choices.personality.motto),
          birthday: parseBirthday(choices.personality.birthday),
        }
      : { side: choices.personality.pick },
    preferences: choices.preferences.pick === 'custom'
      ? {
          side: 'custom',
          ownerName: cleanText(choices.preferences.ownerName),
          quiet: choices.preferences.quiet === true,
          isOfflineFeedEnabled: choices.preferences.isOfflineFeedEnabled !== false,
          timeScale: choices.preferences.timeScale,
          spot: cleanText(choices.preferences.spot),
        }
      : { side: choices.preferences.pick },
    extensions: {},
  }
  for (const [key, value] of Object.entries(choices.conflicts)) {
    if (value !== 'target' && value !== 'source') continue
    payload.extensions[key.startsWith('ext:') ? key.slice(4) : key] = value
  }
  if (typeof choices.unknownSource === 'string') payload.unknownSource = choices.unknownSource
  if (choices.duplicate !== null) payload.duplicate = choices.duplicate
  return payload
}

function parseBirthday(value) {
  const text = cleanText(value)
  if (text === '') return null
  const match = /^(\d{1,2})\s*[\/.-]\s*(\d{1,2})$/.exec(text)
  if (match === null) return null
  return { month: Number(match[1]), day: Number(match[2]) }
}
