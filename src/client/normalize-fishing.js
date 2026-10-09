// @ts-check
import { arr, isObj, num, obj, str } from './values.js'

/** 搏斗手感（钓鱼 2.0，宿主 core/fishing.js 的 fightFeel）；老宿主没有就按难度现算。 */
function feel(value, difficulty) {
  const entry = obj(value)
  return {
    difficulty: num(entry.difficulty, difficulty), speed: num(entry.speed, 1), burst: num(entry.burst, 0), burstScale: num(entry.burstScale, 1),
    drift: num(entry.drift, 0), jitter: num(entry.jitter, 0), zone: num(entry.zone, 1), hold: num(entry.hold, 1), rod: str(entry.rod, ''),
  }
}

function fish(value) {
  const entry = obj(value)
  const difficulty = num(entry.difficulty, 1)
  return {
    id: str(entry.id, ''), key: str(entry.key, ''), label: str(entry.label, '鱼'), emoji: str(entry.emoji, '🐟'),
    rarity: str(entry.rarity, 'common'), behavior: str(entry.behavior, 'smooth'), difficulty,
    sizeCm: num(entry.sizeCm, 0), price: num(entry.price, 0), phase: str(entry.phase, ''),
    castPower: num(entry.castPower, 0), bitesAt: num(entry.bitesAt, 0), hookUntil: num(entry.hookUntil, 0), expiresAt: num(entry.expiresAt, 0),
    // 搏斗玩法（ring / bar / pull，没有就是老宿主：圆盘）；maxCm 用来说「大个的」。
    fight: str(entry.fight, 'ring'), maxCm: num(entry.maxCm, 0), feel: feel(entry.feel, difficulty),
  }
}

/** 升级入口只读宿主的档位和价格，页面不重复计算玩法。 */
function automation(value) {
  if (!isObj(value)) return null
  return { unlocked: value.unlocked === true, stored: num(value.stored, 0), usedHours: num(value.usedHours, 0), capacityHours: 6, full: value.full === true,
    baitLimit: num(value.baitLimit, 0),
    choices: arr(value.choices).filter(isObj).map(choice => ({ minutes: num(choice.minutes, 30), attempts: num(choice.attempts, 6), legacy: choice.minutes <= 60 })),
    upgrades: arr(value.upgrades).filter(isObj).map(upgrade => ({ kind: str(upgrade.kind, ''), label: str(upgrade.label, ''), price: num(upgrade.price, 0) }))
      .filter(upgrade => ['basket', 'duration', 'baitBox'].includes(upgrade.kind)) }
}

export function normalizeFishing(raw) {
  const source = obj(raw)
  const rod = obj(source.rod)
  return {
    automation: automation(source.automation),
    pending: isObj(source.pending) ? fish(source.pending) : null,
    bag: arr(source.bag).map(fish).filter(entry => entry.id !== ''),
    period: str(source.period, ''), autoTrips: num(source.autoTrips, 0),
    rod: { level: num(rod.level, 1), label: str(rod.label, '鱼竿'), emoji: str(rod.emoji, '🎣') },
    nextRod: isObj(source.nextRod) ? { level: num(source.nextRod.level, 2), label: str(source.nextRod.label, ''), emoji: str(source.nextRod.emoji, '🎣'), price: num(source.nextRod.price, 0) } : null,
    spot: str(source.spot, 'river'),
    spots: arr(source.spots).map(value => {
      const spot = obj(value)
      return { key: str(spot.key, ''), label: str(spot.label, ''), emoji: str(spot.emoji, '🏞'), price: num(spot.price, 0), unlocked: spot.unlocked === true, open: spot.open !== false, kinds: num(spot.kinds, 0) }
    }).filter(spot => spot.key !== ''),
  }
}
