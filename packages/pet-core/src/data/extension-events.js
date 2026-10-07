// @ts-check
/** Public progress events are namespaced by the host, never by the caller. */
export const EXTENSION_EVENT_VERSION = 1
export const EXTENSION_EVENT_LIMITS = Object.freeze({ items: 128, batch: 24, count: Number.MAX_SAFE_INTEGER })
/** @type {Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>} */
export const EXTENSION_EVENTS = Object.freeze({
  farm: Object.freeze({ harvest: ['total', 'items'] }),
  mine: Object.freeze({ ore: ['total'], fossil: ['items'], depth: ['maximum'] }),
  gacha: Object.freeze({ spin: ['total'], machine: ['items'], gold: ['total'] }),
  blindbox: Object.freeze({ figure: ['items'], 'six-star': ['items'] }),
})
