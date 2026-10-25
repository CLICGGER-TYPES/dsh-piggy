// @ts-check
import { normalizeSkinContact } from '../../packages/pet-core/src/core/skins.js'
import { syncDeclaredSkinContacts } from './skin-contact.js'
import { arr, obj, str } from './values.js'

export function normalizeSkins(raw) {
  const source = obj(raw)
  const skins = {
    current: str(source.current, 'default'),
    entries: arr(source.entries).map(function (value) {
      const entry = obj(value)
      return {
        key: str(entry.key, ''), label: str(entry.label, '皮肤'), emoji: str(entry.emoji, '🎨'), art: str(entry.art, ''),
        author: str(entry.author, ''), description: str(entry.description, ''), custom: entry.custom === true,
        current: entry.current === true, unlocked: entry.unlocked !== false,
        unlockJob: str(entry.unlockJob, ''), scenes: arr(entry.scenes).filter(scene => typeof scene === 'string'),
        // 皮肤包声明的摸摸手落点：只保留严格有效的值（旧的/没声明的就是 null）。
        // contactStated 区分「宿主明确说没有」和「旧宿主没这个字段」，见 skin-contact.js 的同步。
        contact: normalizeSkinContact(entry.contact),
        contactStated: entry.contact !== undefined,
      }
    }).filter(entry => entry.key !== ''),
  }
  // 快照里皮肤包声明的落点落到本机缓存：换设备/载入同步存档后不用重新导入也能用上。
  // 用户按过「恢复自动」的皮肤不会被装回来（见 syncDeclaredSkinContacts）。
  syncDeclaredSkinContacts(skins)
  return skins
}
