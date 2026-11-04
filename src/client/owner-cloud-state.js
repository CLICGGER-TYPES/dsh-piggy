// @ts-check
/** Status/history normalization and failure copy shared by desktop and DSH. */
import { DSH_REASON_TEXT } from './owner-cloud-dsh.js'

/** Conflict codes are hints, not retryable transport failures. */
export const REASON_TEXT = Object.freeze({
  'remote-has-history': '云端这个分支已有其他完整档历史，不能直接上传覆盖；请换一个空分支，或改为从云端恢复。',
  'remote-owner-mismatch': '云端存档属于另一份完整档，不能与当前完整档混用。',
  'remote-branch-empty': '云端这个分支还没有完整档；可以先上传本机完整档。',
  'remote-advanced': '云端已经有更新的存档，本机没有覆盖它。请先在另一台设备完成同步后再试。',
  'first-sync-required': '这个完整档还没有首次同步记录；请先完成一次首次同步。',
})

/** @param {'desktop'|'dsh'} transport @param {string} reason @param {string} fallback */
export function friendlyReason(transport, reason, fallback) {
  if (reason === '') return fallback
  const dshText = transport === 'dsh' ? DSH_REASON_TEXT[reason] : undefined
  return dshText ?? REASON_TEXT[reason] ?? reason
}

/** A bridge failure carries a code plus human text; desktop hosts carry a reason code. */
export function describeFailure(transport, result, fallback) {
  const reason = typeof result?.reason === 'string' && result.reason !== '' ? result.reason : ''
  const code = typeof result?.code === 'string' ? result.code : ''
  const known = value => value !== '' && (Object.hasOwn(REASON_TEXT, value) || Object.hasOwn(DSH_REASON_TEXT, value))
  const key = known(reason) ? reason : (code !== '' ? code : reason)
  return {
    text: known(key) ? friendlyReason(transport, key, fallback) : (reason !== '' ? reason : fallback),
    code: key === '' ? null : key,
  }
}

export function normalizeStatus(result) {
  if (result === null || typeof result !== 'object' || result.available !== true) {
    return {
      available: false,
      ready: false,
      enabled: false,
      branch: 'main',
      code: typeof result?.code === 'string' ? result.code : null,
      reason: typeof result?.reason === 'string' ? result.reason : '',
    }
  }
  return {
    available: true,
    ready: result.ready === true,
    enabled: result.enabled === true,
    branch: typeof result.branch === 'string' && result.branch !== '' ? result.branch : 'main',
    code: typeof result.code === 'string' ? result.code : null,
    reason: typeof result.reason === 'string' ? result.reason : '',
  }
}

export function normalizeCommit(value) {
  if (value === null || typeof value !== 'object') return null
  return {
    hash: typeof value.hash === 'string' ? value.hash : '',
    at: typeof value.at === 'string' ? value.at : '',
    subject: typeof value.subject === 'string' ? value.subject : '',
    manual: value.manual === true,
  }
}
