// @ts-check
/** 本机摸摸小手偏好；不写养成存档。 */
import { readStore, writeStore } from './storage.js'
export const PET_HAND_KEY = 'dsh-piggy:pet-hand'
const listeners = new Set()
export function petHandEnabled() { return readStore(PET_HAND_KEY) !== 'off' }
export function setPetHandEnabled(on) {
  writeStore(PET_HAND_KEY, on ? 'on' : 'off')
  listeners.forEach(fn => fn())
}
export function onPetHandChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
if (typeof window !== 'undefined') window.addEventListener?.('storage', event => {
  if (event.key === PET_HAND_KEY || event.key === null) listeners.forEach(fn => fn())
})
