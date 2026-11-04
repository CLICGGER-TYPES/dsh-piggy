// @ts-check
/**
 * 第三方素材包的安装前完整校验。纯内存：读 Map、返回摘要或错误，不写盘。
 * @module dsh-piggy/store/ext-asset-validate
 */
import {
  ACTION_FIELDS, ASSET_KEY, MAX_ACTION_MS, MAX_ACTIONS_PER_PACK, MAX_EXTENSION_PACK_BYTES,
  MAX_EXTENSION_PACK_FILES, MAX_FRAME_BYTES, MAX_PACK_BYTES, MAX_PACK_FILES, MAX_PACK_JSON_BYTES,
  MAX_SOUND_BYTES, MAX_SOUND_MS, MAX_SOUNDS_PER_PACK, PACK_ID, SOUND_FIELDS, SOUND_REF, TRIGGERS,
  assetPackBase, checkEligibility, checkFrameFiles, checkPathName, checkSynth, declaredAssetPacks, frameTiming, inRange,
  isAssetPackPath, isRecord, onlyFields, readJson,
} from './ext-asset-schema.js'

/**
 * @param {any} action
 * @param {Map<string, Buffer>} frames
 * @param {string} label
 * @param {string[]} problems
 * @returns {{ key: string, frames: number, bytes: number, sound: string|null, fallback: any } | null}
 */
function checkAction(action, frames, label, problems) {
  if (!onlyFields(action, ACTION_FIELDS, label, problems)) return null
  if (typeof action.key !== 'string' || !ASSET_KEY.test(action.key)) {
    problems.push(`${label}.key: 必须匹配 ${ASSET_KEY}`)
    return null
  }
  const at = `${label}(${action.key})`
  if (action.kind !== 'action') problems.push(`${at}.kind: 只能是 "action"`)
  if (action.frame !== undefined) problems.push(`${at}.frame: 不要手写取景/命中框；帧元数据由安装器计算`)
  if (action.source !== undefined) problems.push(`${at}.source: 第三方素材包只支持 frames 帧序列，不能引用第一方或外部图片`)
  if (action.motion !== undefined) problems.push(`${at}.motion: 第三方素材包只支持 frames 帧序列，不能引用第一方 CSS 动效`)
  if (action.frames === undefined) {
    problems.push(`${at}.frames: 第三方动作必须声明 fps 或 durationsMs`)
    return null
  }
  if (!Number.isInteger(action.durationMs) || action.durationMs <= 0 || action.durationMs > MAX_ACTION_MS) {
    problems.push(`${at}.durationMs: 必须是 1–${MAX_ACTION_MS} 的整数毫秒`)
  }
  const timing = frameTiming(action.frames, frames.size, at, problems)
  const checked = checkFrameFiles(frames, at, problems)
  if (timing !== null && checked !== null && Number.isInteger(action.durationMs) && action.durationMs !== timing.total) {
    problems.push(`${at}.durationMs: 是 ${action.durationMs}ms，但 ${checked.count} 帧总时长为 ${timing.total}ms`)
  }
  checkEligibility(action.eligibility, `${at}.eligibility`, problems)
  if (action.trigger !== undefined) {
    if (!onlyFields(action.trigger, new Set(['on']), `${at}.trigger`, problems)) {
      // 已记录字段错误
    } else if (!TRIGGERS.has(action.trigger.on)) {
      problems.push(`${at}.trigger.on: 只能是 ${[...TRIGGERS].join(' / ')}`)
    }
  }
  if (action.sound !== undefined && (typeof action.sound !== 'string' || !SOUND_REF.test(action.sound))) {
    problems.push(`${at}.sound: 必须是本扩展的音效 key 或 <sound-pack>/<key>`)
  }
  let fallback = null
  if (action.fallback !== undefined) {
    if (typeof action.fallback === 'string') {
      if (!ASSET_KEY.test(action.fallback)) problems.push(`${at}.fallback: 必须是同扩展的动作 key`)
      else fallback = action.fallback
    } else if (isRecord(action.fallback)) {
      onlyFields(action.fallback, new Set(['namespace', 'pack', 'key', 'revision']), `${at}.fallback`, problems)
      if (typeof action.fallback.pack !== 'string' || !PACK_ID.test(action.fallback.pack)) problems.push(`${at}.fallback.pack: 包名不对`)
      if (typeof action.fallback.key !== 'string' || !ASSET_KEY.test(action.fallback.key)) problems.push(`${at}.fallback.key: 动作 key 不对`)
      if (action.fallback.namespace !== undefined && typeof action.fallback.namespace !== 'string') problems.push(`${at}.fallback.namespace: 必须是字符串`)
      fallback = action.fallback
    } else {
      problems.push(`${at}.fallback: 必须是同扩展动作 key 或引用对象`)
    }
  }
  return { key: action.key, frames: checked?.count ?? 0, bytes: checked?.bytes ?? 0, sound: typeof action.sound === 'string' ? action.sound : null, fallback }
}

/**
 * @param {any} sound
 * @param {Buffer|undefined} body
 * @param {string} label
 * @param {string[]} problems
 * @returns {{ key: string, bytes: number, fallback: string|null } | null}
 */
function checkSound(sound, body, label, problems) {
  if (!onlyFields(sound, SOUND_FIELDS, label, problems)) return null
  if (typeof sound.key !== 'string' || !ASSET_KEY.test(sound.key)) {
    problems.push(`${label}.key: 必须匹配 ${ASSET_KEY}`)
    return null
  }
  const at = `${label}(${sound.key})`
  if (sound.file !== undefined && sound.synth !== undefined) problems.push(`${at}: file 与 synth 只能二选一`)
  if (sound.file === undefined && sound.synth === undefined) problems.push(`${at}: 需要 file 或 synth`)
  let bytes = 0
  if (sound.file !== undefined) {
    if (typeof sound.file !== 'string') {
      problems.push(`${at}.file: 必须是 <key>.ogg 或 <key>.wav`)
    } else {
      const expected = new RegExp('^' + sound.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\.(?:ogg|wav)$')
      if (!expected.test(sound.file)) problems.push(`${at}.file: 必须与 key 同名，并用 .ogg 或 .wav`)
      if (!Number.isInteger(sound.durationMs) || sound.durationMs < 20 || sound.durationMs > MAX_SOUND_MS) {
        problems.push(`${at}.durationMs: 文件音效必须写 20–${MAX_SOUND_MS} 的整数毫秒`)
      }
      if (body === undefined) {
        problems.push(`${at}.file: 找不到 ${sound.file}`)
      } else {
        bytes = body.length
        if (body.length > MAX_SOUND_BYTES) problems.push(`${at}.file: ${body.length} B，超过上限 ${MAX_SOUND_BYTES} B（建议 Opus ≤1.5s）`)
        const ext = sound.file.slice(sound.file.lastIndexOf('.') + 1)
        const ogg = body.subarray(0, 4).toString('ascii') === 'OggS'
        const wav = body.subarray(0, 4).toString('ascii') === 'RIFF' && body.subarray(8, 12).toString('ascii') === 'WAVE'
        if ((ext === 'ogg' && !ogg) || (ext === 'wav' && !wav)) problems.push(`${at}.file: 内容不是有效的 ${ext.toUpperCase()} 音频`)
      }
    }
  } else if (sound.synth !== undefined) {
    checkSynth(sound.synth, `${at}.synth`, problems)
  }
  if (sound.gain !== undefined) inRange(sound.gain, `${at}.gain`, 0, 1, problems)
  if (sound.debounceMs !== undefined) inRange(sound.debounceMs, `${at}.debounceMs`, 0, 2000, problems)
  if (sound.priority !== undefined) inRange(sound.priority, `${at}.priority`, 0, 100, problems)
  if (sound.maxVoices !== undefined) inRange(sound.maxVoices, `${at}.maxVoices`, 1, 2, problems)
  if (sound.loop !== undefined && typeof sound.loop !== 'boolean') problems.push(`${at}.loop: 必须是布尔值`)
  if (sound.codec !== undefined && typeof sound.codec !== 'string') problems.push(`${at}.codec: 必须是字符串`)
  let fallback = null
  if (sound.fallback !== undefined) {
    if (typeof sound.fallback !== 'string' || !/^(?:synth:)?[a-z][a-z0-9-]{0,47}$/.test(sound.fallback)) {
      problems.push(`${at}.fallback: 必须是本扩展音效 key 或 synth:<key>`)
    } else {
      fallback = sound.fallback
    }
  }
  return { key: sound.key, bytes, fallback }
}

/** @param {string} key @param {string} pack @param {number} entries @param {number} frames @param {number} files @param {number} bytes */
export function actionSummary(key, pack, entries, frames, files, bytes) {
  return {
    kind: 'actions', pack, namespace: 'ext-' + key, base: assetPackBase(key, 'actions', pack),
    entries, frames, files, bytes, available: true,
  }
}

/** @param {string} key @param {string} pack @param {number} entries @param {number} files @param {number} bytes */
export function soundSummary(key, pack, entries, files, bytes) {
  return {
    kind: 'sounds', pack, namespace: 'ext-' + key, base: assetPackBase(key, 'sounds', pack),
    entries, files, bytes, available: true,
  }
}

/** @param {string[]} problems */
function failed(problems) {
  return { ok: /** @type {false} */ (false), message: problems.join('；') }
}

/**
 * 安装前完整校验一个扩展的素材包。`files` 是相对扩展目录的路径 → 内容。
 * 成功时返回只读摘要（给扩展列表用）；失败时 message 可直接给用户看。
 * 不读硬盘、不写文件、不碰存档。
 * @param {string} key
 * @param {Map<string, Buffer>|Record<string, Buffer|string>} input
 * @param {any} [manifest]
 * @returns {{ ok: true, actions: any[], sounds: any[] } | { ok: false, message: string }}
 */
export function validateAssetPackFiles(key, input, manifest) {
  const files = input instanceof Map ? input : new Map(Object.entries(input))
  const problems = []
  const seen = new Map()
  for (const name of files.keys()) {
    if (!checkPathName(name, problems)) continue
    const lower = name.toLowerCase()
    if (seen.has(lower)) problems.push(`文件路径大小写冲突：${name} 与 ${seen.get(lower)}`)
    else seen.set(lower, name)
  }
  let manifestObj = manifest
  if (manifestObj === undefined) {
    const body = files.get('manifest.json')
    if (body === undefined) return failed(['扩展包缺少 manifest.json'])
    manifestObj = readJson(body, 'manifest.json', problems)
  }
  if (!isRecord(manifestObj) || manifestObj.key !== key) return failed([...problems, 'manifest.json 里的扩展名和安装目录对不上'])
  const declared = declaredAssetPacks(manifestObj)
  problems.push(...declared.problems)
  const declaredActions = new Set(declared.actions)
  const declaredSounds = new Set(declared.sounds)
  /** @type {Map<string, { packJson?: Buffer, frames: Map<string, Map<string, Buffer>> }>} */
  const actionGroups = new Map()
  /** @type {Map<string, { packJson?: Buffer, files: Map<string, Buffer> }>} */
  const soundGroups = new Map()
  for (const name of files.keys()) {
    if (!name.startsWith('actions/') && !name.startsWith('sounds/')) continue
    if (!isAssetPackPath(name)) {
      problems.push(`素材包里不允许的文件：${name}（只允许 pack.json、连续帧和 ogg/wav）`)
      continue
    }
    const [kind, pack, ...rest] = name.split('/')
    if (kind === 'actions') {
      if (!declaredActions.has(pack)) {
        problems.push(`未在 manifest.assetPacks.actions 声明的素材包：${pack}`)
        continue
      }
      /** @type {{ packJson?: Buffer, frames: Map<string, Map<string, Buffer>> }} */
      const group = actionGroups.get(pack) ?? { frames: new Map() }
      if (rest[0] === 'pack.json') group.packJson = /** @type {Buffer} */ (files.get(name))
      else {
        const action = rest[0]
        const map = group.frames.get(action) ?? new Map()
        map.set(rest[1], /** @type {Buffer} */ (files.get(name)))
        group.frames.set(action, map)
      }
      actionGroups.set(pack, group)
    } else {
      if (!declaredSounds.has(pack)) {
        problems.push(`未在 manifest.assetPacks.sounds 声明的素材包：${pack}`)
        continue
      }
      /** @type {{ packJson?: Buffer, files: Map<string, Buffer> }} */
      const group = soundGroups.get(pack) ?? { files: new Map() }
      if (rest[0] === 'pack.json') group.packJson = /** @type {Buffer} */ (files.get(name))
      else group.files.set(rest[0], /** @type {Buffer} */ (files.get(name)))
      soundGroups.set(pack, group)
    }
  }
  /** @type {any[]} */
  const actions = []
  /** @type {any[]} */
  const sounds = []
  const seenActionKeys = new Map()
  const seenSoundKeys = new Map()
  const actionKeys = new Map()
  for (const pack of declared.actions) {
    const group = actionGroups.get(pack)
    if (group === undefined || group.packJson === undefined) {
      problems.push(`manifest.assetPacks.actions 声明了 ${pack}，但扩展里没有 actions/${pack}/pack.json`)
      continue
    }
    if (group.packJson.length > MAX_PACK_JSON_BYTES) problems.push(`actions/${pack}/pack.json: ${group.packJson.length} B，超过 ${MAX_PACK_JSON_BYTES} B`)
    const packJson = readJson(group.packJson, `actions/${pack}/pack.json`, problems)
    if (!isRecord(packJson)) continue
    if (!onlyFields(packJson, new Set(['pack', 'revision', 'actions']), `actions/${pack}/pack.json`, problems)) continue
    if (packJson.pack !== undefined && packJson.pack !== pack) problems.push(`actions/${pack}/pack.json.pack: 写了就必须和目录名一致`)
    if (packJson.revision !== undefined && !(typeof packJson.revision === 'string' ? /^[A-Za-z0-9._-]{1,128}$/.test(packJson.revision) : Number.isInteger(packJson.revision) && packJson.revision >= 0)) {
      problems.push(`actions/${pack}/pack.json.revision: 必须是字符串或非负整数`)
    }
    if (!Array.isArray(packJson.actions) || packJson.actions.length === 0) {
      problems.push(`actions/${pack}/pack.json.actions: 至少要有一个动作`)
      continue
    }
    if (packJson.actions.length > MAX_ACTIONS_PER_PACK) problems.push(`actions/${pack}/pack.json.actions: 最多 ${MAX_ACTIONS_PER_PACK} 个动作`)
    const used = new Set()
    let packFrameFiles = 0
    let packBytes = group.packJson.length
    packJson.actions.forEach((/** @type {any} */ action, /** @type {number} */ index) => {
      const label = `actions/${pack}/pack.json actions[${index}]`
      if (isRecord(action) && typeof action.key === 'string') {
        const frameMap = group.frames.get(action.key)
        if (frameMap === undefined) {
          problems.push(`${label}.frames: 找不到帧目录 actions/${pack}/${action.key}`)
          return
        }
        used.add(action.key)
        const checked = checkAction(action, frameMap, label, problems)
        if (checked === null) return
        if (seenActionKeys.has(checked.key)) problems.push(`${label}.key: 动作 "${checked.key}" 在扩展里重复（${seenActionKeys.get(checked.key)}）`)
        seenActionKeys.set(checked.key, pack)
        if (!actionKeys.has(checked.key)) actionKeys.set(checked.key, [])
        actionKeys.get(checked.key).push(pack)
        if (isRecord(checked.fallback)) {
          if (checked.fallback.namespace !== undefined && checked.fallback.namespace !== 'ext-' + key) {
            problems.push(`${label}.fallback.namespace: 只能引用本扩展 ext-${key}`)
          }
          if (typeof checked.fallback.pack === 'string' && !declaredActions.has(checked.fallback.pack)) {
            problems.push(`${label}.fallback.pack: 引用了未声明的动作包 ${checked.fallback.pack}`)
          }
        }
        packFrameFiles += checked.frames
        packBytes += checked.bytes
        actions.push({ pack, key: checked.key, frames: checked.frames, bytes: checked.bytes })
      }
    })
    for (const action of group.frames.keys()) {
      if (!used.has(action)) problems.push(`actions/${pack}/${action}: 帧目录没有在 pack.json 里声明`)
    }
    const count = packFrameFiles + 1
    if (count > MAX_PACK_FILES) problems.push(`actions/${pack}: ${count} 个文件，超过上限 ${MAX_PACK_FILES}`)
    if (packBytes > MAX_PACK_BYTES) problems.push(`actions/${pack}: ${Math.round(packBytes / 1024)}KB，超过上限 6MB`)
  }
  for (const pack of declared.sounds) {
    const group = soundGroups.get(pack)
    if (group === undefined || group.packJson === undefined) {
      problems.push(`manifest.assetPacks.sounds 声明了 ${pack}，但扩展里没有 sounds/${pack}/pack.json`)
      continue
    }
    if (group.packJson.length > MAX_PACK_JSON_BYTES) problems.push(`sounds/${pack}/pack.json: ${group.packJson.length} B，超过 ${MAX_PACK_JSON_BYTES} B`)
    const packJson = readJson(group.packJson, `sounds/${pack}/pack.json`, problems)
    if (!isRecord(packJson)) continue
    if (!onlyFields(packJson, new Set(['pack', 'revision', 'sounds']), `sounds/${pack}/pack.json`, problems)) continue
    if (packJson.pack !== undefined && packJson.pack !== pack) problems.push(`sounds/${pack}/pack.json.pack: 写了就必须和目录名一致`)
    if (packJson.revision !== undefined && !(typeof packJson.revision === 'string' ? /^[A-Za-z0-9._-]{1,128}$/.test(packJson.revision) : Number.isInteger(packJson.revision) && packJson.revision >= 0)) {
      problems.push(`sounds/${pack}/pack.json.revision: 必须是字符串或非负整数`)
    }
    if (!Array.isArray(packJson.sounds) || packJson.sounds.length === 0) {
      problems.push(`sounds/${pack}/pack.json.sounds: 至少要有一个音效`)
      continue
    }
    if (packJson.sounds.length > MAX_SOUNDS_PER_PACK) problems.push(`sounds/${pack}/pack.json.sounds: 最多 ${MAX_SOUNDS_PER_PACK} 个音效`)
    const used = new Set()
    let packBytes = group.packJson.length
    packJson.sounds.forEach((/** @type {any} */ sound, /** @type {number} */ index) => {
      const label = `sounds/${pack}/pack.json sounds[${index}]`
      let body
      if (isRecord(sound) && typeof sound.key === 'string' && typeof sound.file === 'string') {
        body = group.files.get(sound.file)
        if (body !== undefined) used.add(sound.file)
      }
      const checked = checkSound(sound, body, label, problems)
      if (checked === null) return
      if (seenSoundKeys.has(checked.key)) problems.push(`${label}.key: 音效 "${checked.key}" 在扩展里重复（${seenSoundKeys.get(checked.key)}）`)
      seenSoundKeys.set(checked.key, pack)
      packBytes += checked.bytes
      sounds.push({ pack, key: checked.key, bytes: checked.bytes })
    })
    for (const name of group.files.keys()) {
      if (!used.has(name)) problems.push(`sounds/${pack}/${name}: 音频文件没有在 pack.json 里声明`)
    }
    const count = group.files.size + 1
    if (count > MAX_PACK_FILES) problems.push(`sounds/${pack}: ${count} 个文件，超过上限 ${MAX_PACK_FILES}`)
    if (packBytes > MAX_PACK_BYTES) problems.push(`sounds/${pack}: ${Math.round(packBytes / 1024)}KB，超过上限 6MB`)
  }
  for (const [keyName, packs] of actionKeys) {
    if (packs.length > 1) problems.push(`动作 key "${keyName}" 在多个包重复：${packs.join(', ')}`)
  }
  if (problems.length > 0) return failed(problems)
  const actionFiles = [...actionGroups.values()].reduce((sum, group) => sum
    + [...group.frames.values()].reduce((count, frames) => count + frames.size, 0) + 1, 0)
  const soundFiles = [...soundGroups.values()].reduce((sum, group) => sum + group.files.size + 1, 0)
  const totalFiles = actionFiles + soundFiles
  const totalBytes = actions.reduce((sum, item) => sum + item.bytes, 0)
    + sounds.reduce((sum, item) => sum + item.bytes, 0)
    + [...actionGroups.values()].reduce((sum, group) => sum + (group.packJson?.length ?? 0), 0)
    + [...soundGroups.values()].reduce((sum, group) => sum + (group.packJson?.length ?? 0), 0)
  if (totalFiles > MAX_EXTENSION_PACK_FILES) problems.push(`素材包共 ${totalFiles} 个文件，超过扩展上限 ${MAX_EXTENSION_PACK_FILES}`)
  if (totalBytes > MAX_EXTENSION_PACK_BYTES) problems.push(`素材包共 ${Math.round(totalBytes / 1024)}KB，超过扩展上限 8MB`)
  if (problems.length > 0) return failed(problems)
  return {
    ok: true,
    actions: actions.length === 0
      ? []
      : declared.actions.map(pack => {
        const list = actions.filter(item => item.pack === pack)
        const group = actionGroups.get(pack)
        return actionSummary(key, pack, list.length, list.reduce((sum, item) => sum + item.frames, 0),
          [...(group?.frames.values() ?? [])].reduce((count, frames) => count + frames.size, 0) + (group?.packJson === undefined ? 0 : 1),
          list.reduce((sum, item) => sum + item.bytes, 0) + (group?.packJson?.length ?? 0))
      }),
    sounds: sounds.length === 0
      ? []
      : declared.sounds.map(pack => {
        const list = sounds.filter(item => item.pack === pack)
        const group = soundGroups.get(pack)
        return soundSummary(key, pack, list.length, (group?.files.size ?? 0) + (group?.packJson === undefined ? 0 : 1),
          list.reduce((sum, item) => sum + item.bytes, 0) + (group?.packJson?.length ?? 0))
      }),
  }
}

