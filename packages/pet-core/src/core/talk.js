// @ts-check
/**
 * 按时间说话、摸太多会不耐烦（G 批次，docs/tasks/numbers/G4-lines.md）。
 *
 * - 时段问候：早上、中午……同一时段一天只说一次；
 * - 提醒：当天在线满 90 分钟提醒喝水、满 2 小时提醒休息眼睛，每满一次说一次；
 * - 节日和猪的生日：当天第一次说话时说；周末第一次说话时说。
 * 记录放在 `state.dialogue.talk`，摸的时间放在 `state.dialogue.petTimes`。
 * @module dsh-piggy/core/talk
 */

import {
  DATED_HOLIDAYS, EYES_EVERY_MINUTES, PET_ANNOYED, SOLAR_HOLIDAYS, TALK_SLOTS, WATER_EVERY_MINUTES,
} from '../data.js'
import { dayKeyFor } from './clock.js'

const pad = n => String(n).padStart(2, '0')

/** 一份干净的「今天说过什么」。 */
export function emptyTalk() {
  return { day: '', said: [], water: 0, eyes: 0 }
}

/** 存档里的 talk 补齐；认不出就给空的。 */
export function cleanTalk(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return emptyTalk()
  return {
    day: typeof raw.day === 'string' ? raw.day : '',
    said: Array.isArray(raw.said) ? raw.said.filter(key => typeof key === 'string').slice(-20) : [],
    water: Number.isInteger(raw.water) && raw.water >= 0 ? raw.water : 0,
    eyes: Number.isInteger(raw.eyes) && raw.eyes >= 0 ? raw.eyes : 0,
  }
}

/** 最近 30 秒内摸的时间。 */
export function cleanPetTimes(raw) {
  return Array.isArray(raw) ? raw.filter(Number.isFinite).slice(-PET_ANNOYED.after * 2) : []
}

/** 当前时段（本地时间），不在任何时段返回 null。 */
export function slotFor(nowMs) {
  const hour = new Date(nowMs).getHours()
  for (const slot of TALK_SLOTS) {
    const inside = slot.from < slot.to ? hour >= slot.from && hour < slot.to : hour >= slot.from || hour < slot.to
    if (inside) return slot.scene
  }
  return null
}

/** 今天是不是猪的生日（出生满一天后，每年同月同日）。 */
export function isPigBirthday(state, nowMs) {
  if (state === null || typeof state.bornAt !== 'number' || nowMs - state.bornAt <= 86_400_000) return false
  const now = new Date(nowMs)
  const born = new Date(state.bornAt)
  return born.getMonth() === now.getMonth() && born.getDate() === now.getDate()
}

/** 今天是什么节日（含猪的生日），没有返回 null。 */
export function holidayFor(state, nowMs) {
  const now = new Date(nowMs)
  const md = pad(now.getMonth() + 1) + '-' + pad(now.getDate())
  const dated = DATED_HOLIDAYS[now.getFullYear() + '-' + md]
  if (dated !== undefined) return dated
  if (SOLAR_HOLIDAYS[md] !== undefined) return SOLAR_HOLIDAYS[md]
  return isPigBirthday(state, nowMs) ? 'pigBirthday' : null
}

/**
 * 现在该说哪一句按时间的话；说了就记下来（同一件事一天一次）。没有要说的返回 null。
 * @param {object} state
 * @param {{talk: ReturnType<typeof emptyTalk>}} dialogue
 * @param {number} nowMs
 * @returns {string|null}
 */
export function timeTalkScene(state, dialogue, nowMs) {
  const today = dayKeyFor(nowMs)
  if (dialogue.talk.day !== today) dialogue.talk = { ...emptyTalk(), day: today }
  const talk = dialogue.talk
  const said = key => talk.said.includes(key)
  const mark = key => { talk.said = [...talk.said, key]; return key }

  const holiday = holidayFor(state, nowMs)
  if (holiday !== null && !said(holiday)) return mark(holiday)
  const weekday = new Date(nowMs).getDay()
  if ((weekday === 0 || weekday === 6) && !said('weekend')) return mark('weekend')

  const online = state.daily?.online
  const minutes = online?.day === today ? Math.floor((online.onlineMs ?? 0) / 60_000) : 0
  const eyes = Math.floor(minutes / EYES_EVERY_MINUTES)
  if (eyes > talk.eyes) { talk.eyes = eyes; return 'eyes' }
  const water = Math.floor(minutes / WATER_EVERY_MINUTES)
  if (water > talk.water) { talk.water = water; return 'water' }

  const slot = slotFor(nowMs)
  if (slot !== null && !said(slot)) return mark(slot)
  return null
}

/**
 * 记一下又摸了一次：30 秒内摸到第 8 下开始不耐烦；不耐烦以后要停手 1 分钟才消气。
 * @returns {boolean} 这一下是不是摸多了
 */
export function notePet(dialogue, nowMs) {
  const previous = dialogue.petTimes.length > 0 ? dialogue.petTimes[dialogue.petTimes.length - 1] : -Infinity
  const recent = dialogue.petTimes.filter(at => nowMs - at < PET_ANNOYED.windowMs && at <= nowMs)
  recent.push(nowMs)
  dialogue.petTimes = recent.slice(-PET_ANNOYED.after * 2)
  const stillCross = dialogue.petAnnoyed === true && nowMs - previous < PET_ANNOYED.calmMs
  dialogue.petAnnoyed = recent.length >= PET_ANNOYED.after || stillCross
  return dialogue.petAnnoyed
}
