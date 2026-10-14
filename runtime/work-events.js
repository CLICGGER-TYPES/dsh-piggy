// @ts-check
/** 工作事件协议只携带来源、稳定身份和时间，不接收工作正文。 */
export const WORK_EVENT_VERSION = 1
export const WORK_EVENT_TYPES = Object.freeze(['message', 'turn', 'tool', 'toolError', 'agentError'])
export const WORK_EVENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

/** @typedef {{version:1,source:string,id:string,type:'message'|'turn'|'tool'|'toolError'|'agentError',at:number}} WorkEvent */

export function workError(message, status = 400) {
  return Object.assign(new Error(message), { status })
}

/** @param {unknown} value @param {number} [nowMs] @returns {asserts value is WorkEvent} */
export function validateWorkEvent(value, nowMs) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw workError('invalid work event')
  const event = /** @type {Record<string, any>} */ (value)
  if (Object.keys(event).sort().join(',') !== 'at,id,source,type,version' || event.version !== 1 ||
      typeof event.source !== 'string' || !/^[a-z][a-z0-9.-]{0,63}$/.test(event.source) ||
      typeof event.id !== 'string' || !/^[a-zA-Z0-9_.:/-]{1,160}$/.test(event.id) ||
      !WORK_EVENT_TYPES.includes(event.type) || !Number.isSafeInteger(event.at) || event.at < 0) {
    throw workError('invalid work event')
  }
  if (nowMs !== undefined && (event.at < nowMs - WORK_EVENT_WINDOW_MS || event.at > nowMs + 5 * 60 * 1000)) {
    throw workError('work event outside receipt window', 422)
  }
}

/** 来源与身份共同去重；相同 ID 的不同框架不会互相吞事件。 */
export const workEventKey = event => JSON.stringify([event.source, event.id])
